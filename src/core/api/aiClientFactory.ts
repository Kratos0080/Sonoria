import type { AIClient } from './aiClient';
import type { NoteChatSettings } from '@app/settings';
import { PlaceholderAIClient } from './PlaceholderAIClient';

/**
 * Factory for creating AI clients based on configuration
 * Simplified for beta launch to support OpenAI only
 */
export class AIClientFactory {
  private static instance: AIClientFactory;

  private constructor() {}

  /**
   * Get the singleton instance of the factory
   * @returns The factory instance
   */
  public static getInstance(): AIClientFactory {
    if (!AIClientFactory.instance) {
      AIClientFactory.instance = new AIClientFactory();
    }
    return AIClientFactory.instance;
  }

  /**
   * Create an AI client from settings
   * @param settings - The plugin settings
   * @returns The appropriate AI client based on settings
   */
  public createClientFromSettings(settings: NoteChatSettings): AIClient {
    console.log('AIClientFactory: Creating client from settings');
    
    // For simplified beta configuration, always use OpenAI
    // Return PlaceholderAIClient if no OpenAI API key is configured
    if (!settings.openAiApiKey) {
      console.warn('AIClientFactory: No OpenAI API key configured, returning PlaceholderAIClient');
      return new PlaceholderAIClient('No OpenAI API key configured');
    }

    // For beta launch, all LLM interactions go through OpenAI Responses API
    // So we return a PlaceholderAIClient since the actual AI interactions
    // are handled by OpenAIService directly, not through the AIClient interface
    console.log('AIClientFactory: OpenAI key configured, but using PlaceholderAIClient for beta (OpenAI Responses API used directly)');
    return new PlaceholderAIClient('OpenAI configured - using Responses API directly');
  }
} 