import * as Promise from "bluebird";
import {Client, Message, ReceiverLink, SenderLink} from "amqp10";
import {BaseError} from "~amqp10/lib/errors";

export class AmqpClient {

    private client: Client;
    private receiverDefer: Promise.Resolver<ReceiverLink>;
    private senderDefer: Promise.Resolver<SenderLink>;

    constructor() {
        this.client = new Client();
        this.receiverDefer = Promise.defer<ReceiverLink>();
        this.senderDefer = Promise.defer<SenderLink>();
    }

    connect() {
        console.log('CONNECTING..');
        return this.client.connect('amqp://apollo:ollopaehcapa@localhost')
            .then(() => {
                console.log('CONNECTION OK');
                return Promise.all([this.client.createReceiver('jms.queue.toto'), this.client.createSender('jms.queue.toto')])
            })
            .then(results => {
                this.receiverDefer.resolve(results[0]);
                this.senderDefer.resolve(results[1]);
            })
            .catch(err => {
                console.log("error: ", err);
            });
    }

    onMessage(listener: (ReceiverLink, Message) => any): void {
        this.receiverDefer.promise.then(receiver => receiver.on('message', listener.bind(listener, receiver)));
    }

    onError(listener: (BaseError) => any): void {
        this.receiverDefer.promise.then(receiver => receiver.on('errorReceived', listener));
    }

    send(msg: any) {
        return this.senderDefer.promise.then(sender => sender.send(msg));
    }
}
