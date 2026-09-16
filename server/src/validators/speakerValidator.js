import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createSpeakerSchema = z.object({
  eventRef: z
    .string({ required_error: 'Event reference is required' })
    .regex(objectIdRegex, 'Invalid event ID format'),
  userRef: z.string().regex(objectIdRegex, 'Invalid user ID format').nullable().optional(),
  fullName: z.string({ required_error: 'Speaker full name is required' }).trim().min(2).max(100),
  headline: z.string().trim().default('').optional(),
  bio: z.string({ required_error: 'Biography is required' }).trim().min(10),
  avatarUrl: z.string().trim().url().or(z.literal('')).optional(),
  company: z.string().trim().default('').optional(),
  position: z.string().trim().default('').optional(),
  socials: z
    .object({
      linkedin: z.string().trim().optional(),
      twitter: z.string().trim().optional(),
      github: z.string().trim().optional(),
      website: z.string().trim().optional()
    })
    .optional(),
  topics: z.array(z.string().trim().toLowerCase()).optional(),
  status: z.enum(['invited', 'confirmed', 'declined']).default('confirmed').optional()
});

export const updateSpeakerSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  headline: z.string().trim().optional(),
  bio: z.string().trim().min(10).optional(),
  avatarUrl: z.string().trim().url().or(z.literal('')).optional(),
  company: z.string().trim().optional(),
  position: z.string().trim().optional(),
  socials: z
    .object({
      linkedin: z.string().trim().optional(),
      twitter: z.string().trim().optional(),
      github: z.string().trim().optional(),
      website: z.string().trim().optional()
    })
    .optional(),
  topics: z.array(z.string().trim().toLowerCase()).optional(),
  status: z.enum(['invited', 'confirmed', 'declined']).optional()
});
