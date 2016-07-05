export type UUID = string;
export type EmailAddress = string;
export type DateString = string;
export type ICS = string;

export interface EventMessage {
    Id: UUID;
    CreationDate: DateString;
    PrimaryAddress: EmailAddress;
    CalendarId: string;
    AppointmentId: string;
    MimeContent: ICS;
}

export class EventMessageImpl implements EventMessage {

    constructor(
        public Id: UUID,
        public CreationDate: DateString,
        public PrimaryAddress: EmailAddress,
        public CalendarId: string,
        public AppointmentId: string,
        public MimeContent: ICS
    ) {}
}

export let sample: EventMessage = new EventMessageImpl('5', '2016-07-01T15:11:04.802465+00:00', 'usera@obm14.lng.org', 'calendarId', 'appointmentId', generateICS());

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