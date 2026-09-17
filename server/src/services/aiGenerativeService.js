import { z } from 'zod';
import { AIProvider } from '../integrations/ai/aiProvider.js';
import { verifyOperatorEventAccess } from './checkInService.js';
import { AppError } from '../utils/AppError.js';

// Strict Zod output schemas for untrusted external AI responses
export const eventCopyOutputSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  executiveSummary: z.string().min(10),
  suggestedTags: z.array(z.string().min(1)).min(1)
});

export const speakerBioOutputSchema = z.object({
  shortBio: z.string().min(10),
  fullBio: z.string().min(20),
  keyTopics: z.array(z.string().min(1)).min(1),
  socialHeadline: z.string().min(5)
});

export const announcementOutputSchema = z.object({
  title: z.string().min(3),
  emailSubject: z.string().min(3),
  content: z.string().min(10),
  smsSummary: z.string().min(5),
  recommendedChannels: z.array(z.string().min(1)).min(1)
});

export class AIGenerativeService {
  /**
   * Helper to parse and validate AI-generated output strings against a Zod schema.
   */
  static parseAndValidate(rawContent, schema) {
    let parsed;
    try {
      parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent;
    } catch (err) {
      throw new AppError('AI provider returned malformed JSON content.', 502, 'AI_MALFORMED_OUTPUT');
    }

    const validation = schema.safeParse(parsed);
    if (!validation.success) {
      throw new AppError('AI generated output failed schema validation.', 502, 'AI_VALIDATION_ERROR', validation.error.format());
    }

    return validation.data;
  }

  /**
   * Drafts event title, description, executive summary, and tags from organizer inputs.
   */
  static async generateEventCopy({ topic, eventType, targetAudience, theme, keyPoints, operatorUser, simulatedError }) {
    if (!operatorUser) {
      throw new AppError('Authentication required to use AI generative services.', 401, 'UNAUTHORIZED');
    }

    const systemPrompt = `You are an expert event copywriter and conference organizer.
Generate professional, compelling event marketing copy in valid JSON format.
Do not include markdown backticks or commentary outside the JSON object.
JSON schema keys: "title" (string), "description" (string), "executiveSummary" (string), "suggestedTags" (array of strings).`;

    const userPrompt = {
      topic,
      eventType: eventType || 'conference',
      targetAudience: targetAudience || 'industry professionals',
      theme: theme || 'innovation',
      keyPoints: keyPoints || []
    };

    const rawResponse = await AIProvider.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      taskType: 'event_copy',
      simulatedError
    });

    return this.parseAndValidate(rawResponse, eventCopyOutputSchema);
  }

  /**
   * Polishes speaker bios and headlines from rough notes and credentials.
   */
  static async generateSpeakerBio({ speakerName, rawNotes, professionalTitle, organization, targetEventTopic, operatorUser, simulatedError }) {
    if (!operatorUser) {
      throw new AppError('Authentication required to use AI generative services.', 401, 'UNAUTHORIZED');
    }

    const systemPrompt = `You are a professional executive conference curator.
Synthesize concise, engaging speaker profiles from notes in valid JSON format.
Do not include markdown formatting or commentary outside the JSON object.
JSON schema keys: "shortBio" (string), "fullBio" (string), "keyTopics" (array of strings), "socialHeadline" (string).`;

    const userPrompt = {
      speakerName,
      rawNotes: rawNotes || '',
      professionalTitle: professionalTitle || '',
      organization: organization || '',
      targetEventTopic: targetEventTopic || ''
    };

    const rawResponse = await AIProvider.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      taskType: 'speaker_bio',
      simulatedError
    });

    return this.parseAndValidate(rawResponse, speakerBioOutputSchema);
  }

  /**
   * Drafts multi-channel attendee announcements with audience and urgency targeting.
   */
  static async generateAnnouncement({ eventId, eventTitle, announcementType, keyMessage, targetAudience, urgency, operatorUser, simulatedError }) {
    if (!operatorUser) {
      throw new AppError('Authentication required to use AI generative services.', 401, 'UNAUTHORIZED');
    }

    // Verify operator has event-scoped permissions
    await verifyOperatorEventAccess(operatorUser, eventId);

    const systemPrompt = `You are an operational event communications manager.
Draft clear, urgent, professional announcements in valid JSON format.
JSON schema keys: "title" (string), "emailSubject" (string), "content" (string), "smsSummary" (string), "recommendedChannels" (array of strings).`;

    const userPrompt = {
      eventTitle: eventTitle || 'EventForge Conference',
      announcementType: announcementType || 'general',
      keyMessage,
      targetAudience: targetAudience || 'all_attendees',
      urgency: urgency || 'medium'
    };

    const rawResponse = await AIProvider.generateStructuredCompletion({
      systemPrompt,
      userPrompt,
      taskType: 'announcement',
      simulatedError
    });

    return this.parseAndValidate(rawResponse, announcementOutputSchema);
  }
}
