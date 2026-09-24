import { env } from '../../config/env.js';
import { OpenAIProvider } from './openaiProvider.js';
import { MockAIProvider } from './mockAiProvider.js';

export class AIProvider {
  static getProvider(providerName) {
    const chosen = providerName || env.AI_PROVIDER;

    if (chosen === 'openai') {
      return OpenAIProvider;
    }
    if (chosen === 'mock') {
      return MockAIProvider;
    }

    // Default to OpenAI if API key is present
    if (env.OPENAI_API_KEY) {
      return OpenAIProvider;
    }

    return MockAIProvider;
  }

  static async generateStructuredCompletion(params) {
    const provider = this.getProvider(params?.providerName);
    return provider.generateStructuredCompletion(params);
  }
}
