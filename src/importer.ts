import * as program from "commander";
import {generateICS, EventMessageImpl} from "./EventMessage";
import {PapiClient} from "./PapiClient";
import {Response} from 'superagent';
import {AmqpClient} from "./AmqpClient";
import {ReceiverLink, Message} from "amqp10";

let amqpClient = new AmqpClient();

let listenQueue = function () {
    let itemCount = 0;
    amqpClient.onMessage((receiver: ReceiverLink, message: Message) => {
        console.log("Item %d: ", ++itemCount, message);
        receiver.release(message);
    });
    amqpClient.onError(error => console.log("Error %d: ", ++itemCount, error));
};

program.version('0.0.1');

program.command('generate <count> <user> <calendar>')
    .action((count, user, calendar) => {
    console.log('Generating fake date in the queue %d', count);
    amqpClient.connect();
    listenQueue();

    let promises = [];
    for (var _i = 1; _i <= count; _i++) {
        let event = new EventMessageImpl('id', 'date', user, calendar, 'appointmentId', generateICS(_i.toString()));
        console.log('Sending event for owner: ' + event.PrimaryAddress);
        promises.push(amqpClient.send(event));
    }

    Promise.all(promises).then(() => {
        console.log('Done');
        setTimeout(function() {
            process.exit(0);
        }, 10000);
    });

});

program.command('list').action(() => {
    amqpClient.connect();
    listenQueue();
});
//
//program.command('empty').action(() => {
//    let itemCount = 0;
//    queue.bind(exchange);
//    queue.activateConsumer((message) => {
//        message.ack();
//        console.log('Item removed %d', ++itemCount);
//    });
//});
//
//
//program.command('import <count>').action((count) => {
//    console.log('Will import %d message from the queue', count);
//
//    let papiClient = new PapiClient('http://obm14/provisioning/v1/', '80a6ca8a-3fcf-c013-ad13-a6840868f923', {
//        login: 'admin0@global.virt',
//        password: 'admin'
//    });
//
//    queue.bind(exchange);
//
//    let alreadyImported = 0, requiredAckCount = 0;
//    papiClient.startBatch().then(() => {
//        queue.activateConsumer((message) => {
//            let content = message.getContent();
//
//            if (typeof content === 'string') {
//                content = JSON.parse(content);
//            }
//
//            if (alreadyImported++ >= count) {
//                return;
//            }
//            requiredAckCount++;
//
//            let event = new EventMessageImpl(
//                content.Id,
//                content.CreationDate,
//                content.PrimaryAddress,
//                content.CalendarId,
//                content.AppointmentId,
//                content.MimeContent
//            );
//            console.log("Will import the following event: ", event);
//
//            papiClient.importICS(event)
//                .then((res: Response) => {
//                    res.ok && message.ack();
//                    requiredAckCount--;
//
//                    if (alreadyImported >= count && requiredAckCount == 0) {
//                        papiClient.commitBatch().then(res => process.exit(0));
//                    }
//                });
//        }, { noAck: false });
//    });
//});

program.command('*').action(() => {
    console.log('Unknown command');
    program.outputHelp();
    process.exit(1);
});

program.parse(process.argv);