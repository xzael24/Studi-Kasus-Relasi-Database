export type RegistrationStatus = 'registered' | 'cancelled' | 'checked_in';

export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  ticketId: string;
  status: RegistrationStatus;
  registeredAt: Date;
  checkedInAt?: Date;
}
