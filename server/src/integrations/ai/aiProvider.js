import { env } from '../../config/env.js';
import { OpenAIProvider } from './openaiProvider.js';
import { MockAIProvider } from './mockAiProvider.js';

export class AIProvider {
  static getProvider(providerName = env.AI_PROVIDER || 'mock') {
    switch (providerName) {
      case 'openai':
        return OpenAIProvider;
      case 'mock':
      default:
        return MockAIProvider;
    }
  }

  static async generateStructuredCompletion(params) {
    const provider = this.getProvider(params?.providerName);
    return provider.generateStructuredCompletion(params);
  }
}
