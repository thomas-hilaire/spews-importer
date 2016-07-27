import * as program from "commander";
import * as Promise from "bluebird";
import {generateICS, EventMessage, EventMessageImpl} from "./EventMessage";
import {PapiClient} from "./PapiClient";
import {Response} from 'superagent';
import {Observable} from 'rx';
const RxAmqpLib = require('rx-amqplib');

const config = {
    queue: 'MIMEImporter',
    host: 'amqp://localhost',
    maxBatchSize: 5
};

const amqpConnection = RxAmqpLib.newConnection(config.host);
process.on('SIGINT', () => amqpConnection.subscribe(conn => {
    console.log('Closing amqp connection..');
    conn.close();
    process.exit();
}));

program.version('0.0.1');

program.command('generate <count> <user> <calendar>')
    .action((count, user, calendar) => {
    console.log('Generating fake date in the queue %d', count);

    //completeConfiguration.then(() => {
    //    for (var _i = 1; _i <= count; _i++) {
    //        let event = new EventMessageImpl('id', 'date', user, calendar, 'appointmentId', generateICS(_i.toString()));
    //        console.log('Sending event for owner: ' + event.PrimaryAddress);
    //        exchange.send(new Amqp.Message(event));
    //    }
    //}).then(() => {
    //    console.log('Done');
    //    setTimeout(function() {
    //        connection.close();
    //        process.exit(0);
    //    }, 500);
    //});

});

program.command('list').action(() => {
    let itemCount = 0;

    amqpConnection
        .flatMap(connection => connection.createChannel())
        .flatMap(channel => channel.assertQueue(config.queue, { durable: true }))
        .flatMap(reply => reply.channel.consume(config.queue, { noAck: false }))
        .subscribe(message => console.log("Item %d: ", ++itemCount));
});

program.command('empty').action(() => {
    let itemCount = 0;

    amqpConnection
        .flatMap(connection => connection.createChannel())
        .flatMap(channel => channel.assertQueue(config.queue, { durable: true }))
        .flatMap(reply => reply.channel.consume(config.queue, { noAck: true }))
        .subscribe(message => console.log("Item %d removed ", ++itemCount));
});

program.command('import <apiUrl> <domainUuid>').action((apiUrl, domainUuid) => {

    const papiClient = new PapiClient(apiUrl, domainUuid, {
        login: 'admin0@global.virt',
        password: 'admin'
    });

    function messagesToPapiEvents(events): EventMessage[] {
        return events.map(event => {
            let content = JSON.parse(event.content.toString());
            console.log('Got message %s created at %s', content.Id, content.CreationDate);

            content.PrimaryAddress = 'usera@obm14.lng.org';
            content.MimeContent = content.MimeContent.replace(/ORGANIZER.*/, 'ORGANIZER;CN=Usera display:MAILTO:usera@obm14.lng.org');

            return new EventMessageImpl(
                content.Id,
                content.CreationDate,
                content.PrimaryAddress,
                content.CalendarId,
                content.AppointmentId,
                content.MimeContent
            );
        });
    }

    function runBatchOnPapi(events): Promise<string> {
        console.log('Starting a batch');
        return papiClient.startBatch().then(() => {
            return papiClient.importAllICS(messagesToPapiEvents(events))
                .then((responses: Response[]) => {
                    responses
                        .filter(r => !r.ok)
                        .forEach(r => console.log('Something went wrong for the following import ics request: ', r));

                    console.log('Commiting a batch');
                    return papiClient.commitBatch();
                })
                .then(() => {
                    console.log('Waiting for batch to finish');
                    return papiClient.waitForBatchSuccess();
                });
        });
    }

    let runCount = 0;
    amqpConnection
        .flatMap(connection => connection.createChannel())
        .flatMap(channel => channel.assertQueue(config.queue, { durable: true }))
        .flatMap(reply => {
            reply.channel.prefetch(config.maxBatchSize);
            return reply.channel.consume(config.queue, { noAck: false });
        })
        .bufferWithTimeOrCount(1000 /* ms */, config.maxBatchSize)
        .subscribe(events => {
            if (events.length === 0) {
                console.log('Empty buffer, skipping it');
                return;
            }

            runCount++;
            console.log('Cycle %d has %d events', runCount, events.length);
            runBatchOnPapi(events)
                .then(message => console.log(message))
                .then(() => {
                    setTimeout(() => events.forEach(e => e.ack()), 1000);
                });
        });
});

program.command('*').action(() => {
    console.log('Unknown command');
    program.outputHelp();
    process.exit(1);
});

program.parse(process.argv);