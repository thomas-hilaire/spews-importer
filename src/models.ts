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
