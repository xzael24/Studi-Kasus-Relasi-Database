export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventLocation {
  name: string;
  address: string;
  city: string;
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  location: EventLocation;
  startDate: string;
  endDate: string;
  capacity: number;
  status: EventStatus;
  organizerId: string;
  createdAt: Date;
}
