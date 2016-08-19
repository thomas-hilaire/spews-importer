import {EventMessage} from "./models";
import {PapiClient} from "./papi-client";
import * as Promise from "bluebird";
import {Response} from "superagent";

export interface AmqpQueues {
    event: string;
}

export interface AmqpConfig {
    host: string;
    queues: AmqpQueues;
}

export interface ImporterConfig {
    amqp: AmqpConfig;
    maxBatchSize: number;
    maxBatchWaitTimeMs: number;
    delayBetweenBatchMs: number;
}

export class Importer {

    constructor(
        private papiClient: PapiClient,
        private config: ImporterConfig,
        private amqpConnectionProvider
    ) {}

    public importAllEvents(): void {
        let runCount = 0;
        this.amqpConnectionProvider
            .flatMap(connection => connection.createChannel())
            .flatMap(channel => channel.assertQueue(this.config.amqp.queues.event, { durable: true }))
            .flatMap(reply => {
                reply.channel.prefetch(this.config.maxBatchSize);
                return reply.channel.consume(this.config.amqp.queues.event, { noAck: false });
            })
            .bufferWithTimeOrCount(this.config.maxBatchWaitTimeMs, this.config.maxBatchSize)
            .subscribe(events => {
                if (events.length === 0) {
                    console.info("Empty buffer, skipping it");
                    return;
                }

                runCount++;
                console.info("Cycle %d has %d events", runCount, events.length);
                this.runBatchOnPapi(events)
                    .then(message => console.log(message))
                    .then(() => {
                        setTimeout(() => events.forEach(e => e.ack()), this.config.delayBetweenBatchMs);
                    });
            });
    }

    private messagesToPapiEvents(events): EventMessage[] {
        return events.map(event => {
            let content = JSON.parse(event.content.toString());
            console.info("Got message %s created at %s", content.Id, content.CreationDate);

            return {
                Id: content.Id,
                CreationDate: content.CreationDate,
                PrimaryAddress: content.PrimaryAddress,
                CalendarId: content.CalendarId,
                AppointmentId: content.AppointmentId,
                MimeContent: content.MimeContent,
            };
        });
    }

    private runBatchOnPapi(events): Promise<string> {
        console.log("Starting a batch");
        return this.papiClient.startBatch().then(() => {
            return this.papiClient.importAllICS(this.messagesToPapiEvents(events))
                .then((responses: Response[]) => {
                    responses
                        .filter(r => !r.ok)
                        .forEach(r => console.log("Something went wrong for the following import ics request: ", r));

                    console.info("Commiting a batch");
                    return this.papiClient.commitBatch();
                })
                .then(() => {
                    console.info("Waiting for batch to finish");
                    return this.papiClient.waitForBatchSuccess();
                });
        });
    }

}