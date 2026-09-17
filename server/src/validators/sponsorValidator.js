import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createSponsorProfileSchema = z.object({
  organizationRef: z.string({ required_error: 'Organization reference is required' }).regex(objectIdRegex, 'Invalid organization ID format'),
  name: z.string({ required_error: 'Sponsor name is required' }).trim().min(2).max(150),
  description: z.string().trim().max(1000).optional(),
  logoUrl: z.string().trim().url().or(z.literal('')).optional(),
  websiteUrl: z.string().trim().url().or(z.literal('')).optional(),
  contactPerson: z
    .object({
      name: z.string().trim().optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().optional(),
      role: z.string().trim().optional()
    })
    .optional(),
  socialLinks: z
    .object({
      linkedin: z.string().trim().url().or(z.literal('')).optional(),
      twitter: z.string().trim().url().or(z.literal('')).optional(),
      github: z.string().trim().url().or(z.literal('')).optional()
    })
    .optional()
});

export const createSponsorPackageSchema = z.object({
  eventRef: z.string({ required_error: 'Event reference is required' }).regex(objectIdRegex, 'Invalid event ID format'),
  name: z.string({ required_error: 'Package name is required' }).trim().min(2).max(100),
  tier: z.enum(['headline', 'platinum', 'gold', 'silver', 'bronze', 'in_kind', 'community', 'custom'], {
    required_error: 'Tier is required'
  }),
  price: z.number({ required_error: 'Price is required' }).min(0),
  currency: z.string().length(3).optional(),
  maxSlots: z.number({ required_error: 'Max slots is required' }).int().min(1),
  benefits: z.array(z.string().trim()).optional()
});

export const allocateSponsorshipSchema = z.object({
  eventRef: z.string({ required_error: 'Event reference is required' }).regex(objectIdRegex, 'Invalid event ID format'),
  sponsorProfileRef: z.string({ required_error: 'Sponsor profile reference is required' }).regex(objectIdRegex, 'Invalid sponsor profile ID format'),
  packageRef: z.string({ required_error: 'Package reference is required' }).regex(objectIdRegex, 'Invalid package ID format'),
  amountPaid: z.number().min(0).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'invoiced', 'refunded', 'waived']).optional(),
  deliverables: z
    .array(
      z.object({
        title: z.string().trim().min(2),
        description: z.string().trim().optional(),
        formatRequired: z.string().trim().optional(),
        dueDate: z.string().optional()
      })
    )
    .optional()
});

export const updateDeliverableStatusSchema = z.object({
  sponsorshipId: z.string().regex(objectIdRegex, 'Invalid sponsorship ID format').optional(),
  deliverableId: z.string().regex(objectIdRegex, 'Invalid deliverable ID format').optional(),
  status: z.enum(['pending', 'submitted', 'approved', 'rejected'], {
    required_error: 'Status is required'
  }),
  assetUrl: z.string().trim().url().or(z.literal('')).optional(),
  notes: z.string().trim().max(500).optional()
});

export const eventIdParamSchema = z.object({
  eventId: z.string({ required_error: 'Event ID is required' }).regex(objectIdRegex, 'Invalid event ID format')
});
