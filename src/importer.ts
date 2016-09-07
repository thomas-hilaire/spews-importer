import {batchErrorLogger, logger} from "./logger";
import {ContactMessage, EventMessage} from "./models";
import {BatchResult, PapiClient} from "./papi-client";
import {URL} from "./types";
import {Observable} from "rx";
import * as Promise from "bluebird";

export interface AmqpQueues {
    event: string;
    contact: string;
}

export interface AmqpConfig {
    host: URL;
    queues: AmqpQueues;
}

export interface ImporterConfig {
    amqp: AmqpConfig;
    maxBatchSize: number;
    maxBatchWaitTimeMs: number;
    delayBetweenBatchMs: number;
}

export class Importer {

    private batchNumber: number = 0;

    constructor(
        private papiClient: PapiClient,
        private config: ImporterConfig,
        private amqpConnectionProvider
    ) {}

    public searchForUUID(uuid: string): void {
        this.amqpConnectionProvider
            .flatMap(connection => connection.createChannel())
            .flatMap(channel => channel.assertQueue(this.config.amqp.queues.event, { durable: true }))
            .flatMap(reply => reply.channel.consume(this.config.amqp.queues.event, { noAck: false }))
            .subscribe(message => {
                let content = JSON.parse(message.content.toString());
                if (content.MimeContent.indexOf(uuid) >= 0) {
                    batchErrorLogger.warn("Found!!!!");
                    batchErrorLogger.warn(content);
                }
                message.nack();
            });
    }

    public importAllEvents(): void {
        let amqpChannel;
        this.amqpConnectionProvider
            .flatMap(connection => connection.createChannel())
            .flatMap(channel => Observable.merge(
                channel.assertQueue(this.config.amqp.queues.event, { durable: true }),
                channel.assertQueue(this.config.amqp.queues.contact, { durable: true })
            ))
            .flatMap(reply => {
                amqpChannel = reply.channel;
                reply.channel.prefetch(this.config.maxBatchSize, true);
                return Observable.merge(this.buildEventConsumer(amqpChannel), this.buildContactConsumer(amqpChannel));
            })
            .bufferWithTimeOrCount(this.config.maxBatchWaitTimeMs, this.config.maxBatchSize)
            .subscribe(amqpMessages => this.runBatchThenAck(amqpChannel, amqpMessages));
    }

    private buildEventConsumer(amqpChannel) {
        return amqpChannel
            .consume(this.config.amqp.queues.event, { noAck: false })
            .doOnNext(msg => msg.importWithPapi = () => {
                console.log('IMPORTING 1 EVENT');
                let content = JSON.parse(msg.content.toString());

                content.PrimaryAddress = "usera@d.lyon.lan";
                content.MimeContent = content.MimeContent.replace(/ORGANIZER.*/g, "ORGANIZER;CN=Usera display:MAILTO:usera@d.lyon.lan");

                return this.papiClient.importICS(content);
            });
    }

    private buildContactConsumer(amqpChannel) {
        return amqpChannel
            .consume(this.config.amqp.queues.contact, { noAck: false })
            .doOnNext(msg => msg.importWithPapi = () => {
                console.log('IMPORTING 1 CONTACT');
                let content = JSON.parse(msg.content.toString());

                content.PrimaryAddress = "usera@d.lyon.lan";

                return this.papiClient.importVCF(content);
            });
    }

    private runBatchThenAck(amqpChannel, amqpMessages) {
        console.log('IN RUN BATCH: ', amqpMessages.length);
        console.log('TYPES: ', amqpMessages);
        if (amqpMessages.length === 0) {
            logger.info("Empty buffer, skipping it");
            return;
        }

        this.batchNumber++;
        logger.info("Batch %d has %d messages", this.batchNumber, amqpMessages.length);
        this.runBatchOnPapi(amqpMessages).then(batchResult => {
            logger.info("Batch %d is done: ", this.batchNumber, batchResult.message);
            batchResult.errors.forEach(e => batchErrorLogger.error("Batch #%d", this.batchNumber, e));
            setTimeout(() => this.ackOrRequeueAllIfAnyError(batchResult, amqpChannel, amqpMessages), this.config.delayBetweenBatchMs);
        });
    }

    private ackOrRequeueAllIfAnyError(batchResult, amqpChannel, amqpMessages) {
        // We are not able to know which items are in error so we requeue all.
        // As the import operations are idempotent, process again well imported item won't have any effect.
        //if (batchResult.errors.length === 0) {
        //    amqpMessages.forEach(e => e.ack());
        //} else {
        //    amqpMessages.forEach(e => amqpChannel.sendToQueue(this.config.amqp.queues.event, e.content, e.properties));
        //    amqpMessages.forEach(e => e.nack(false));
        //}
        //amqpMessages.forEach(e => amqpChannel.sendToQueue(this.config.amqp.queues.event, e.content, e.properties));
        amqpMessages.forEach(e => e.nack(true));
    }

    private runBatchOnPapi(messages): Promise<BatchResult> {
        logger.info("Starting a batch");
        return this.papiClient.startBatch().then(() => {
            return Promise.all(messages.map(msg => msg.importWithPapi()))
                .then(() => {
                    logger.info("Commiting a batch");
                    return this.papiClient.commitBatch();
                })
                .then(() => {
                    logger.info("Waiting for batch to finish");
                    return this.papiClient.waitForBatchSuccess();
                });
        });
    }

}
