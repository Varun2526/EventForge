import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

export class OpenAIProvider {
  static async generateStructuredCompletion({
    systemPrompt,
    userPrompt,
    model = 'gpt-4o-mini',
    temperature = 0.7,
    timeoutMs = 15000
  }) {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new AppError('OpenAI API key is not configured in server environment.', 503, 'AI_CONFIG_MISSING');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: typeof userPrompt === 'string' ? userPrompt : JSON.stringify(userPrompt)
            }
          ]
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        if (response.status === 429) {
          throw new AppError('OpenAI rate limit exceeded. Please retry later.', 429, 'AI_RATE_LIMIT');
        }
        if (response.status === 401 || response.status === 403) {
          throw new AppError('AI provider authentication failed.', 503, 'AI_SERVICE_UNAVAILABLE');
        }
        const errBody = await response.text().catch(() => '');
        throw new AppError(`AI provider returned error (${response.status}): ${errBody}`, 503, 'AI_SERVICE_UNAVAILABLE');
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new AppError('Empty response content received from AI provider.', 502, 'AI_EMPTY_RESPONSE');
      }

      return content;
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new AppError('AI provider request timed out.', 504, 'AI_TIMEOUT');
      }
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(`AI service communication failure: ${err.message}`, 503, 'AI_SERVICE_UNAVAILABLE');
    }
  }
}
