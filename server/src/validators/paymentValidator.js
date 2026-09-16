import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createPaymentIntentSchema = z.object({
  registrationId: z.string().regex(objectIdRegex, 'Invalid registration ObjectId')
});

export const verifyPaymentSchema = z.object({
  registrationId: z.string().regex(objectIdRegex, 'Invalid registration ObjectId'),
  paymentIntentId: z.string().min(1, 'paymentIntentId is required').trim()
});
