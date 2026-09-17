import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const generateEventCopySchema = z.object({
  topic: z.string({ required_error: 'Topic is required' }).trim().min(3).max(200),
  eventType: z.enum(['conference', 'workshop', 'exhibition', 'webinar', 'corporate_meet']).optional(),
  targetAudience: z.string().trim().max(200).optional(),
  theme: z.string().trim().max(200).optional(),
  keyPoints: z.array(z.string().trim()).optional(),
  simulatedError: z.enum(['timeout', 'rate_limit', 'service_unavailable', 'malformed_json']).optional()
});

export const generateSpeakerBioSchema = z.object({
  speakerName: z.string({ required_error: 'Speaker name is required' }).trim().min(2).max(100),
  rawNotes: z.string().trim().max(2000).optional(),
  professionalTitle: z.string().trim().max(100).optional(),
  organization: z.string().trim().max(100).optional(),
  targetEventTopic: z.string().trim().max(200).optional(),
  simulatedError: z.enum(['timeout', 'rate_limit', 'service_unavailable', 'malformed_json']).optional()
});

export const generateAnnouncementSchema = z.object({
  eventId: z.string({ required_error: 'Event ID is required' }).regex(objectIdRegex, 'Invalid event ID format'),
  eventTitle: z.string().trim().max(200).optional(),
  announcementType: z.enum(['schedule_update', 'room_change', 'emergency', 'general', 'sponsor_spotlight']).optional(),
  keyMessage: z.string({ required_error: 'Key message is required' }).trim().min(5).max(1000),
  targetAudience: z.enum(['all_attendees', 'vip', 'speakers', 'sponsors', 'staff']).optional(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  simulatedError: z.enum(['timeout', 'rate_limit', 'service_unavailable', 'malformed_json']).optional()
});

export const getRecommendationsParamsSchema = z.object({
  eventId: z.string({ required_error: 'Event ID is required' }).regex(objectIdRegex, 'Invalid event ID format')
});
