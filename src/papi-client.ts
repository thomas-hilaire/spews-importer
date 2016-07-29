import {EventMessage} from "./models";
import * as Promise from "bluebird";
import {get, post, put, Response} from "superagent";

export type BatchId = number;

export interface PapiCredentials {
    login: string;
    password: string;
}

const DEFAUT_DELAY_MS = 1000;

export class PapiClient {

    public currentBatchId: BatchId;

    constructor(
        private apiUrl: string,
        private domainUUID: string,
        private credentials: PapiCredentials
    ) {}

    public startBatch(): Promise<Response> {
        if (this.currentBatchId) {
            throw new Error("The following batch is already started: " + this.currentBatchId);
        }

        return Promise.fromCallback(callback => {
                this.auth(post(this.papiUrl("/batches/"))).end(callback);
            })
            .then(res => {
                this.currentBatchId = res.body.id;
                return res;
            });
    }

    public commitBatch(): Promise<Response> {
        this.assertBatchHasBeenStarted();

        return Promise.fromCallback(callback => {
            this.auth(put(this.papiUrl("/batches/" + this.currentBatchId + "/"))).end(callback);
        });
    }

    public waitForBatchSuccess(delay?: number): Promise<string> {
        this.assertBatchHasBeenStarted();

        let deferred = Promise.defer<string>();
        let callback = (err, res) => {
            if (err) {
                deferred.reject(err);
            } else if (res.body.status === "ERROR") {
                deferred.reject("ERROR: " + res.body.operationDone + "/" + res.body.operationCount);
            } else if (res.body.status === "SUCCESS") {
                this.currentBatchId = undefined;
                deferred.resolve("SUCCESS: " + res.body.operationDone + "/" + res.body.operationCount);
            } else {
                setTimeout(lookForStatus, delay || DEFAUT_DELAY_MS);
            }
        };
        let lookForStatus = () => this.auth(get(this.papiUrl("/batches/" + this.currentBatchId + "/"))).end(callback);
        lookForStatus();

        return deferred.promise;
    }

    public importICS(event: EventMessage): Promise<Response> {
        this.assertBatchHasBeenStarted();

        return Promise.fromCallback(callback => {
            this.auth(post(this.papiUrl("/batches/" + this.currentBatchId + "/events/" + event.PrimaryAddress)))
                .type("text/plain")
                .send(event.MimeContent)
                .end(callback);
        });
    }

    public importAllICS(events: EventMessage[]): Promise<Response[]> {
        return Promise.all(events.map(e => this.importICS(e)));
    }

    private auth(request) {
        return request.auth(this.credentials.login, this.credentials.password);
    }

    private papiUrl(urlSuffix: string): string {
        return this.apiUrl + this.domainUUID + urlSuffix;
    }

    private assertBatchHasBeenStarted() {
        if (!this.currentBatchId) {
            throw new Error("No batch has been started");
        }
    }
}
