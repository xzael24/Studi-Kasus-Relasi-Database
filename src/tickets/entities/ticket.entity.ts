export interface Ticket {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  price: number;
  quota: number;
  sold: number;
  createdAt: Date;
}
