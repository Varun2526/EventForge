import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const attendeeDetailsSchema = z.object({
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: z.string().email('Valid email address is required').trim(),
  phone: z.string().optional().default(''),
  company: z.string().optional().default(''),
  designation: z.string().optional().default(''),
  dietaryRequirements: z.string().optional().default('None'),
  tShirtSize: z.enum(['XS', 'S', 'M', 'L', 'XL', '2XL', 'None']).optional().default('None'),
  guestNames: z.array(z.string().trim()).optional()
});

export const holdTicketSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ObjectId'),
  ticketTierId: z.string().regex(objectIdRegex, 'Invalid ticket tier ObjectId'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').optional().default(1),
  couponCode: z.string().trim().optional(),
  attendeeDetails: attendeeDetailsSchema
});

export const joinWaitlistSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ObjectId'),
  ticketTierId: z.string().regex(objectIdRegex, 'Invalid ticket tier ObjectId'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').optional().default(1),
  attendeeDetails: attendeeDetailsSchema
});
