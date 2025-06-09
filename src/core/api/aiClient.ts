import type { Message } from '../types/conversation';

/**
 * Base interface for AI service providers
 * All AI clients (OpenAI, Google, etc.) should implement this interface
 */
export interface AIClient {
  /**
   * The provider name
   */
  readonly provider: string;
  
  /**
   * The current model being used
   */
  readonly model: string;
  
  /**
   * Initialize the client with the provided API key
   * @param apiKey - The API key for this provider
   * @param model - The model to use
   */
  initialize(apiKey: string, model: string): void;
  
  /**
   * Update the API key
   * @param apiKey - New API key
   */
  updateApiKey(apiKey: string): void;
  
  /**
   * Update the model
   * @param model - New model name
   */
  updateModel(model: string): void;
  
  /**
   * Generate a summary of a note
   * @param noteContent - Content of the note to summarize
   * @returns Summary of the note
   */
  generateNoteSummary(noteContent: string): Promise<string>;
  
  /**
   * Generate a brief summary of a note (shorter than the regular summary)
   * @param noteContent - Content of the note to summarize
   * @returns Brief summary of the note
   */
  generateBriefNoteSummary(noteContent: string): Promise<string>;
  
  /**
   * Handle a conversation message
   * @param messages - Array of messages in the conversation
   * @param noteContent - Content of the note for context
   * @returns AI response to the conversation
   */
  handleConversationMessage(
    messages: Message[], 
    noteContent: string
  ): Promise<string>;
  
  /**
   * Generate a structured note from a conversation
   * @param messages - Array of messages in the conversation
   * @param noteContent - Content of the original note
   * @returns Structured note content
   */
  generateStructuredNote(
    messages: Message[], 
    noteContent: string
  ): Promise<string>;
}

/**
 * AI provider information
 */
export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
  defaultModel: string;
}

/**
 * AI model information
 */
export interface AIModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  provider: string;
}

/**
 * Available AI models by provider
 */
export const AI_MODELS: Record<string, AIModel[]> = {
  openai: [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'GPT-4o - OpenAI\'s most advanced model',
      maxTokens: 128000,
      provider: 'openai'
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'GPT-3.5 Turbo - Faster, more affordable model',
      maxTokens: 16384,
      provider: 'openai'
    }
  ],
  google: [
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Gemini 2.0 Flash - Latest fastest model with 2M token context',
      maxTokens: 2000000,
      provider: 'google'
    },
    {
      id: 'gemini-2.0-pro-exp',
      name: 'Gemini 2.0 Pro Exp',
      description: 'Gemini 2.0 Pro Experimental - Most advanced Gemini model',
      maxTokens: 2000000,
      provider: 'google'
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Gemini 1.5 Flash - Fast model with 1M token context',
      maxTokens: 1000000,
      provider: 'google'
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Gemini 1.5 Pro - Most capable Gemini 1.5 model',
      maxTokens: 1000000,
      provider: 'google'
    }
  ]
};

/**
 * Available AI providers
 */
export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: AI_MODELS.openai,
    defaultModel: 'gpt-4o'
  },
  {
    id: 'google',
    name: 'Google',
    models: AI_MODELS.google,
    defaultModel: 'gemini-2.0-flash'
  }
];

/**
 * Get a model by ID
 * @param modelId - The model ID
 * @returns The model definition or undefined if not found
 */
export function getModelById(modelId: string): AIModel | undefined {
  for (const provider in AI_MODELS) {
    const model = AI_MODELS[provider].find(m => m.id === modelId);
    if (model) return model;
  }
  return undefined;
}

/**
 * Get a provider by ID
 * @param providerId - The provider ID
 * @returns The provider definition or undefined if not found
 */
export function getProviderById(providerId: string): AIProvider | undefined {
  return AI_PROVIDERS.find(p => p.id === providerId);
} 