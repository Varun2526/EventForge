import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createSessionSchema = z
  .object({
    eventRef: z
      .string({ required_error: 'Event reference is required' })
      .regex(objectIdRegex, 'Invalid event ID format'),
    title: z.string({ required_error: 'Session title is required' }).trim().min(3).max(200),
    description: z.string().trim().default('').optional(),
    type: z
      .enum(['keynote', 'panel', 'breakout', 'workshop', 'networking', 'fireside_chat'])
      .default('breakout')
      .optional(),
    track: z.string().trim().default('General').optional(),
    roomId: z
      .string({ required_error: 'Room ID is required' })
      .regex(objectIdRegex, 'Invalid room ID format'),
    startTime: z.string({ required_error: 'Start time is required' }).datetime({ offset: true }).or(z.string()),
    endTime: z.string({ required_error: 'End time is required' }).datetime({ offset: true }).or(z.string()),
    speakerRefs: z.array(z.string().regex(objectIdRegex, 'Invalid speaker ID format')).optional(),
    capacityLimit: z.number({ required_error: 'Capacity limit is required' }).int().min(1),
    tags: z.array(z.string().trim().toLowerCase()).optional(),
    isLiveStreamed: z.boolean().optional(),
    streamUrl: z.string().trim().url().or(z.literal('')).optional(),
    slidesUrl: z.string().trim().url().or(z.literal('')).optional()
  })
  .refine((data) => new Date(data.startTime) < new Date(data.endTime), {
    message: 'Session start time must be strictly before end time',
    path: ['endTime']
  });

export const updateSessionSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().optional(),
    type: z.enum(['keynote', 'panel', 'breakout', 'workshop', 'networking', 'fireside_chat']).optional(),
    track: z.string().trim().optional(),
    roomId: z.string().regex(objectIdRegex, 'Invalid room ID format').optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    speakerRefs: z.array(z.string().regex(objectIdRegex, 'Invalid speaker ID format')).optional(),
    capacityLimit: z.number().int().min(1).optional(),
    tags: z.array(z.string().trim().toLowerCase()).optional(),
    isLiveStreamed: z.boolean().optional(),
    streamUrl: z.string().trim().url().or(z.literal('')).optional(),
    slidesUrl: z.string().trim().url().or(z.literal('')).optional(),
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).optional()
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.startTime) < new Date(data.endTime);
      }
      return true;
    },
    {
      message: 'Session start time must be strictly before end time',
      path: ['endTime']
    }
  );
