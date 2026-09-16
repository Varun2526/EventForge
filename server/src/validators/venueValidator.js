import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const roomSchema = z.object({
  name: z.string({ required_error: 'Room name is required' }).trim().min(1).max(100),
  floor: z.string().trim().default('Ground').optional(),
  capacity: z.number({ required_error: 'Room capacity is required' }).int().min(1),
  avEquipment: z.array(z.string().trim()).optional(),
  notes: z.string().trim().optional()
});

export const createVenueSchema = z.object({
  name: z.string({ required_error: 'Venue name is required' }).trim().min(2).max(150),
  organizationRef: z
    .string({ required_error: 'Organization reference is required' })
    .regex(objectIdRegex, 'Invalid organization ID format'),
  address: z.object({
    street: z.string({ required_error: 'Street is required' }).trim().min(1),
    city: z.string({ required_error: 'City is required' }).trim().min(1),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
    country: z.string({ required_error: 'Country is required' }).trim().min(1),
    coordinates: z
      .object({
        lat: z.number().nullable().optional(),
        lng: z.number().nullable().optional()
      })
      .optional()
  }),
  capacity: z.number({ required_error: 'Capacity is required' }).int().min(1),
  contactPerson: z
    .object({
      name: z.string().trim().optional(),
      email: z.string().trim().email().or(z.literal('')).optional(),
      phone: z.string().trim().optional()
    })
    .optional(),
  rooms: z.array(roomSchema).optional()
});

export const updateVenueSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  address: z
    .object({
      street: z.string().trim().min(1).optional(),
      city: z.string().trim().min(1).optional(),
      state: z.string().trim().optional(),
      postalCode: z.string().trim().optional(),
      country: z.string().trim().min(1).optional(),
      coordinates: z
        .object({
          lat: z.number().nullable().optional(),
          lng: z.number().nullable().optional()
        })
        .optional()
    })
    .optional(),
  capacity: z.number().int().min(1).optional(),
  contactPerson: z
    .object({
      name: z.string().trim().optional(),
      email: z.string().trim().email().or(z.literal('')).optional(),
      phone: z.string().trim().optional()
    })
    .optional()
});
