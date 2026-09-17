import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const eventIdParamSchema = z.object({
  eventId: z.string({ required_error: 'Event ID is required' }).regex(objectIdRegex, 'Invalid event ID format')
});
