export type ICS = string;

export interface EventMessage {
    owner: string;
    calendar: string;
    ics: ICS;
}

export class EventMessageImpl implements EventMessage {

    constructor(public owner: string, public calendar: string, public ics: ICS) {
    }
}

export let sample: EventMessage = new EventMessageImpl('5', 'default calendar', generateICS());

export function generateICS(index?: string) {
    index = index || '1';
    return 'BEGIN:VCALENDAR\n\
PRODID:-//Aliasource Groupe LINAGORA//OBM Calendar 3.2.0-rc1//FR\n\
CALSCALE:GREGORIAN\n\
VERSION:2.0\n\
METHOD:REQUEST\n\
BEGIN:VEVENT\n\
CREATED:20160702T090245Z\n\
LAST-MODIFIED:20160702T090245Z\n\
DTSTAMP:20160702T090245Z\n\
DTSTART:20160702T130000Z\n\
DURATION:PT30M\n\
TRANSP:OPAQUE\n\
SEQUENCE:0\n\
SUMMARY:Event ' + index + '\n\
DESCRIPTION:\n\
CLASS:PUBLIC\n\
PRIORITY:5\n\
ORGANIZER;CN=Me:MAILTO:usera@obm14.lng.org\n\
LOCATION:Hublin\n\
CATEGORIES:\n\
UID:' + Date.now() + '-' + index + '\n\
END:VEVENT\n\
END:VCALENDAR'
}