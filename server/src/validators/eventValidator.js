import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createEventSchema = z
  .object({
    title: z.string({ required_error: 'Title is required' }).trim().min(3).max(200),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
      .optional(),
    organizationRef: z
      .string({ required_error: 'Organization reference is required' })
      .regex(objectIdRegex, 'Invalid organization ID format'),
    type: z.enum(['conference', 'workshop', 'exhibition', 'webinar', 'corporate_meet'], {
      required_error: 'Event type is required'
    }),
    summary: z.string().trim().max(300).optional(),
    description: z.string({ required_error: 'Description is required' }).trim().min(10),
    coverImageUrl: z.string().trim().url().or(z.literal('')).optional(),
    startDate: z.string({ required_error: 'Start date is required' }).datetime({ offset: true }).or(z.string()),
    endDate: z.string({ required_error: 'End date is required' }).datetime({ offset: true }).or(z.string()),
    timezone: z.string().trim().optional(),
    venueRef: z.string().regex(objectIdRegex, 'Invalid venue ID format').nullable().optional(),
    isVirtual: z.boolean().optional(),
    virtualMeetingUrl: z.string().trim().url().or(z.literal('')).optional(),
    totalCapacity: z.number({ required_error: 'Total capacity is required' }).int().min(1),
    tags: z.array(z.string().trim().toLowerCase()).optional(),
    settings: z
      .object({
        requireApproval: z.boolean().optional(),
        allowWaitlist: z.boolean().optional(),
        enablePublicSchedule: z.boolean().optional(),
        registrationDeadline: z.string().optional().nullable()
      })
      .optional()
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: 'Start date must be strictly before end date',
    path: ['endDate']
  });

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens')
      .optional(),
    type: z.enum(['conference', 'workshop', 'exhibition', 'webinar', 'corporate_meet']).optional(),
    status: z.enum(['draft', 'published', 'ongoing', 'completed', 'cancelled']).optional(),
    summary: z.string().trim().max(300).optional(),
    description: z.string().trim().min(10).optional(),
    coverImageUrl: z.string().trim().url().or(z.literal('')).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    timezone: z.string().trim().optional(),
    venueRef: z.string().regex(objectIdRegex, 'Invalid venue ID format').nullable().optional(),
    isVirtual: z.boolean().optional(),
    virtualMeetingUrl: z.string().trim().url().or(z.literal('')).optional(),
    totalCapacity: z.number().int().min(1).optional(),
    tags: z.array(z.string().trim().toLowerCase()).optional(),
    settings: z
      .object({
        requireApproval: z.boolean().optional(),
        allowWaitlist: z.boolean().optional(),
        enablePublicSchedule: z.boolean().optional(),
        registrationDeadline: z.string().optional().nullable()
      })
      .optional()
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'Start date must be strictly before end date',
      path: ['endDate']
    }
  );
