import * as program from "commander";
import * as Amqp from "amqp-ts";
import {generateICS, EventMessageImpl} from "./EventMessage";
import {PapiClient} from "./PapiClient";
import {Response} from 'superagent';

var connection = new Amqp.Connection("amqp://localhost");
var completeConfiguration = connection.completeConfiguration();
var exchange = connection.declareExchange("SPEWS_exchange");
var queue = connection.declareQueue("SPEWS_EVENTS_exchange", {durable: true});


program.version('0.0.1');

program.command('generate <count> <user> <calendar>')
    .action((count, user, calendar) => {
    console.log('Generating fake date in the queue %d', count);

    completeConfiguration.then(() => {
        for (var _i = 1; _i <= count; _i++) {
            let event = new EventMessageImpl(user, calendar, generateICS(_i.toString()));
            console.log('Sending event for owner: ' + event.owner);
            exchange.send(new Amqp.Message(event));
        }
    }).then(() => {
        console.log('Done');
        setTimeout(function() {
            connection.close();
            process.exit(0);
        }, 500);
    });

});

program.command('list').action(() => {
    let itemCount = 0;
    queue.bind(exchange);
    queue.activateConsumer((message) => {
        console.log("Item %d: ", ++itemCount, message.getContent());
    });
});

program.command('empty').action(() => {
    let itemCount = 0;
    queue.bind(exchange);
    queue.activateConsumer((message) => {
        message.ack();
        console.log('Item removed %d', ++itemCount);
    });
});


program.command('import <count>').action((count) => {
    console.log('Will import %d message from the queue', count);

    let papiClient = new PapiClient('http://obm14/provisioning/v1/', '80a6ca8a-3fcf-c013-ad13-a6840868f923', {
        login: 'admin0@global.virt',
        password: 'admin'
    });

    queue.bind(exchange);

    let alreadyImported = 0, requiredAckCount = 0;
    papiClient.startBatch().then(() => {
        queue.activateConsumer((message) => {
            if (alreadyImported++ >= count) {
                return;
            }

            requiredAckCount++;

            let content = message.getContent();
            console.log("Will import an ICS for user: ", content.owner);

            papiClient.importICS(new EventMessageImpl(content.owner, content.calendar, content.ics))
                .then((res: Response) => {
                    res.ok && message.ack();
                    requiredAckCount--;

                    if (alreadyImported >= count && requiredAckCount == 0) {
                        papiClient.commitBatch().then(res => process.exit(0));
                    }
                });
        }, { noAck: false });
    });
});

program.command('*').action(() => {
    console.log('Unknown command');
    program.outputHelp();
    process.exit(1);
});

program.parse(process.argv);