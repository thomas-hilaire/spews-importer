import {post, put, Response, Request} from 'superagent';
import * as Promise from "bluebird";
import {EventMessage} from "./EventMessage";
import {SuperAgent} from "superagent";

require('superagent-bluebird-promise');

type BatchId = number;

export interface PapiCredentials {
    login: string,
    password: string
}

export class PapiClient {

    private apiUrl: string;
    private domainUUID: string;
    private credentials: PapiCredentials;

    private currentBatchId: BatchId;

    constructor(apiUrl: string, domainUUID: string, credentials: PapiCredentials) {
        this.apiUrl = apiUrl;
        this.domainUUID = domainUUID;
        this.credentials = credentials;

    }

    private auth(request) {
        return request.auth(this.credentials.login, this.credentials.password);
    }

    private papiUrl(urlSuffix: string): string {
        return this.apiUrl + this.domainUUID + urlSuffix;
    }

    private assertBatchHasBeenStarted() {
        if (!this.currentBatchId) {
            throw new Error('No batch has been started');
        }
    }

    startBatch(): Promise<Response> {
        if (this.currentBatchId) {
            throw new Error('The following batch is already started: ' + this.currentBatchId);
        }

        return Promise.fromCallback(callback => {
                return this.auth(post(this.papiUrl('/batches/'))).end(callback);
            })
            .then(res => {
                this.currentBatchId = res.body.id;
                return res;
            });
    }

    commitBatch(): Promise<Response> {
        this.assertBatchHasBeenStarted();

        return Promise.fromCallback(callback => {
                return this.auth(put(this.papiUrl('/batches/' + this.currentBatchId +'/'))).end(callback);
            })
            .then(res => {
                this.currentBatchId = undefined;
                return res;
            });
    }

    importICS(event: EventMessage): Promise<Response> {
        this.assertBatchHasBeenStarted();

        return Promise.fromCallback(callback => {
            return this.auth(post(this.papiUrl('/batches/' + this.currentBatchId + '/events/' + event.PrimaryAddress + '/' + event.PrimaryAddress)))
                .type('text/plain')
                .send(event.MimeContent)
                .end(callback);
        });
    }
}
