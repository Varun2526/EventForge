import { z } from 'zod';

export const gateCheckInSchema = z.object({
  token: z.string().min(1, 'Badge token is required'),
  eventId: z.string().optional()
});

export const sessionCheckInSchema = z.object({
  token: z.string().min(1, 'Badge token is required'),
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid session ID format')
});

export const assignStaffSchema = z
  .object({
    eventId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format').optional(),
    eventRef: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid event ID format').optional(),
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format').optional(),
    userRef: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format').optional(),
    role: z.enum(['checkin_staff', 'room_monitor', 'usher', 'support', 'general']).default('checkin_staff'),
    assignedRoomIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid room ID format')).optional().default([]),
    shiftStart: z.string().datetime().optional().nullable(),
    shiftEnd: z.string().datetime().optional().nullable()
  })
  .refine((data) => data.eventId || data.eventRef, {
    message: 'Either eventId or eventRef is required',
    path: ['eventId']
  })
  .refine((data) => data.userId || data.userRef, {
    message: 'Either userId or userRef is required',
    path: ['userId']
  });
