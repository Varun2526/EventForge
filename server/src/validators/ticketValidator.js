import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createTicketTierSchema = z
  .object({
    eventRef: z.string().regex(objectIdRegex, 'Invalid event ObjectId'),
    name: z.string().min(1, 'Tier name is required').trim(),
    description: z.string().optional().default(''),
    price: z.number().min(0, 'Price cannot be negative'),
    currency: z.string().optional().default('USD'),
    totalQuantity: z.number().int().min(1, 'Total quantity must be at least 1'),
    salesStart: z.string().datetime({ message: 'salesStart must be a valid ISO datetime' }),
    salesEnd: z.string().datetime({ message: 'salesEnd must be a valid ISO datetime' }),
    maxPerOrder: z.number().int().min(1).optional().default(5),
    perks: z.array(z.string()).optional().default([]),
    accessLevel: z.enum(['standard', 'all_access', 'vip', 'speaker', 'sponsor']).optional().default('standard'),
    isActive: z.boolean().optional().default(true)
  })
  .refine((data) => new Date(data.salesStart) < new Date(data.salesEnd), {
    message: 'salesStart must precede salesEnd',
    path: ['salesEnd']
  });

export const updateTicketTierSchema = z
  .object({
    name: z.string().min(1).trim().optional(),
    description: z.string().optional(),
    price: z.number().min(0).optional(),
    currency: z.string().optional(),
    totalQuantity: z.number().int().min(1).optional(),
    salesStart: z.string().datetime().optional(),
    salesEnd: z.string().datetime().optional(),
    maxPerOrder: z.number().int().min(1).optional(),
    perks: z.array(z.string()).optional(),
    accessLevel: z.enum(['standard', 'all_access', 'vip', 'speaker', 'sponsor']).optional(),
    isActive: z.boolean().optional()
  })
  .refine(
    (data) => {
      if (data.salesStart && data.salesEnd) {
        return new Date(data.salesStart) < new Date(data.salesEnd);
      }
      return true;
    },
    {
      message: 'salesStart must precede salesEnd',
      path: ['salesEnd']
    }
  );

export const createCouponSchema = z
  .object({
    eventRef: z.string().regex(objectIdRegex, 'Invalid event ObjectId'),
    code: z.string().min(1, 'Coupon code is required').trim(),
    discountType: z.enum(['percentage', 'fixed_amount']),
    discountValue: z.number().min(1, 'Discount value must be at least 1'),
    minOrderAmount: z.number().min(0).optional().default(0),
    maxUses: z.number().int().min(1, 'maxUses must be at least 1'),
    validFrom: z.string().datetime({ message: 'validFrom must be a valid ISO datetime' }),
    validUntil: z.string().datetime({ message: 'validUntil must be a valid ISO datetime' }),
    applicableTierRefs: z.array(z.string().regex(objectIdRegex)).optional().default([]),
    isActive: z.boolean().optional().default(true)
  })
  .refine((data) => new Date(data.validFrom) < new Date(data.validUntil), {
    message: 'validFrom must precede validUntil',
    path: ['validUntil']
  });

export const validateCouponSchema = z.object({
  eventId: z.string().regex(objectIdRegex, 'Invalid event ObjectId'),
  code: z.string().min(1, 'Coupon code is required').trim()
});
