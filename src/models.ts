import {DateString, EmailAddress, ICS, UUID, VCF} from "./types";

export interface EventMessage {
    Id: UUID;
    CreationDate: DateString;
    PrimaryAddress: EmailAddress;
    CalendarId: string;
    AppointmentId: string;
    MimeContent: ICS;
}

export interface ContactMessage {
    Id: UUID;
    CreationDate: DateString;
    PrimaryAddress: EmailAddress;
    AddressBookId: string;
    OriginalContactId: string;
    MimeContent: VCF;
}
