import { AppError } from '../../utils/AppError.js';

export class MockAIProvider {
  /**
   * Generates deterministic, schema-compliant completions for testing and offline development.
   */
  static async generateStructuredCompletion({ systemPrompt, userPrompt, taskType, simulatedError = null }) {
    // 1. Simulate external failures when requested in tests
    if (simulatedError === 'timeout') {
      throw new AppError('AI provider request timed out.', 504, 'AI_TIMEOUT');
    }
    if (simulatedError === 'rate_limit') {
      throw new AppError('AI rate limit exceeded. Please retry with backoff.', 429, 'AI_RATE_LIMIT');
    }
    if (simulatedError === 'service_unavailable') {
      throw new AppError('AI provider service temporarily unavailable.', 503, 'AI_SERVICE_UNAVAILABLE');
    }
    if (simulatedError === 'malformed_json') {
      return 'INVALID_JSON_RAW_RESPONSE{{';
    }

    // 2. Deterministic outputs by task type
    switch (taskType) {
      case 'event_copy': {
        const topic = userPrompt?.topic || 'Technology & Innovation';
        const eventType = userPrompt?.eventType || 'Conference';
        return JSON.stringify({
          title: `${topic} Annual ${eventType} 2026`,
          description: `Join world-class industry leaders and practitioners at the ${topic} ${eventType}. Explore cutting-edge breakthroughs, practical workshops, and network with global experts shaping the future.`,
          executiveSummary: `A comprehensive gathering focused on ${topic}, designed to accelerate enterprise adoption and professional mastery.`,
          suggestedTags: [
            topic.toLowerCase().replace(/\s+/g, '-'),
            eventType.toLowerCase(),
            'innovation',
            'enterprise',
            'networking'
          ]
        });
      }

      case 'speaker_bio': {
        const name = userPrompt?.speakerName || 'Distinguished Speaker';
        const title = userPrompt?.professionalTitle || 'Principal Engineer';
        const org = userPrompt?.organization || 'Global Tech';
        const topic = userPrompt?.targetEventTopic || 'Enterprise Systems';
        return JSON.stringify({
          shortBio: `${name} is a ${title} at ${org}, specializing in ${topic}.`,
          fullBio: `${name} serves as ${title} at ${org}. With over a decade of hands-on expertise in ${topic}, ${name} has led transformative platform architectures and contributed extensively to community standards.`,
          keyTopics: [topic, 'Distributed Systems', 'Architecture', 'Best Practices'],
          socialHeadline: `${title} @ ${org} | Keynote Speaker on ${topic}`
        });
      }

      case 'announcement': {
        const eventTitle = userPrompt?.eventTitle || 'EventForge Summit';
        const keyMsg = userPrompt?.keyMessage || 'Important event schedule update';
        const urgency = userPrompt?.urgency || 'medium';
        return JSON.stringify({
          title: `Announcement: ${keyMsg}`,
          emailSubject: `[${eventTitle}] Update: ${keyMsg}`,
          content: `Dear Attendee,\n\nPlease be advised of the following update regarding ${eventTitle}: ${keyMsg}. If you have any questions or require support, please contact the event operations team.\n\nBest regards,\nEventForge Operations`,
          smsSummary: `[${eventTitle}] Update: ${keyMsg}. Check your email or app for details.`,
          recommendedChannels: urgency === 'high' ? ['email', 'in_app', 'sms'] : ['email', 'in_app']
        });
      }

      default:
        return JSON.stringify({
          generatedAt: new Date().toISOString(),
          status: 'success',
          summary: 'Mock generative completion'
        });
    }
  }
}
