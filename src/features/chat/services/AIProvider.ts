import type { AIClient } from '@app/core/api/aiClient';
// import type { ConversationManager } from '../store/conversationContext';
import type NoteChatPlugin from '@app/main';
import type { NoteChatSettings } from '@app/settings';
import type { Message } from '@app/core/types/conversation'; // Import Message type

/**
 * Wrapper service to interact with the currently configured AI client.
 * This acts as a bridge between the UI/ConversationManager and the specific AI client implementation (OpenAI, Google).
 */
export class AIProvider {
  private plugin: NoteChatPlugin;
  private settings: NoteChatSettings;
  private get aiClient(): AIClient | null {
    // Always get the current client instance from the plugin
    return this.plugin.aiClient;
  }

  constructor(plugin: NoteChatPlugin) {
    this.plugin = plugin;
    this.settings = plugin.settings;
    console.log("AIProvider initialized.");
  }

  /**
   * Ensures the AI client is initialized and ready.
   * @throws Error if the client is not initialized.
   */
  private getClient(): AIClient {
    const client = this.aiClient;
    if (!client) {
      console.error("AIProvider: Attempted to use AI client, but it's not initialized.");
      throw new Error('AI client is not initialized. Please check plugin settings.');
    }
    // Ensure the client's model is up-to-date with settings
    const expectedModel = this.settings.llmModel;
    if (client.model !== expectedModel) {
        console.log(`AIProvider: Updating client model from ${client.model} to ${expectedModel}`);
        client.updateModel(expectedModel);
    }
    return client;
  }

  /**
   * Generates a standard summary for the given note content.
   * @param noteContent The content of the note to summarize.
   * @returns A promise resolving to the generated summary string.
   */
  async generateSummary(noteContent: string): Promise<string> {
    const client = this.getClient();
    console.log(`AIProvider: Generating summary using ${client.provider} (${client.model}).`);
    // Assuming AIClient interface has this method
    return client.generateNoteSummary(noteContent);
  }

  /**
   * Generates a brief (1-2 sentence) summary for the given note content.
   * @param noteContent The content of the note to summarize briefly.
   * @returns A promise resolving to the generated brief summary string.
   */
  async generateBriefSummary(noteContent: string): Promise<string> {
    const client = this.getClient();
     console.log(`AIProvider: Generating brief summary using ${client.provider} (${client.model}).`);
     // Assuming AIClient interface has this method
    return client.generateBriefNoteSummary(noteContent);
  }

  /**
   * Generates a response based on the conversation history and provided note context.
   * @param messages The conversation history (array of Message objects).
   * @param noteContent The context from the current note(s).
   * @returns A promise resolving to the AI's generated response string.
   */
  // Corrected type for messages parameter
  async generateResponse(messages: Message[], noteContent: string): Promise<string> {
    const client = this.getClient();
    console.log(`AIProvider: Generating response using ${client.provider} (${client.model}).`);
    // Ensure messages format matches what AIClient expects if necessary
    // Assuming client.handleConversationMessage handles the Message[] type directly
    return client.handleConversationMessage(messages, noteContent);
  }

  /**
   * Generates a structured markdown note based on the conversation history and original note content.
   * @param messages The conversation history (array of Message objects).
   * @param noteContent The original note content for context.
   * @returns A promise resolving to the generated structured markdown note string.
   */
   // Corrected type for messages parameter
  async generateStructuredNote(messages: Message[], noteContent: string): Promise<string> {
    const client = this.getClient();
    console.log(`AIProvider: Generating structured note using ${client.provider} (${client.model}).`);
     // Ensure messages format matches what AIClient expects if necessary
     // Assuming client.generateStructuredNote handles the Message[] type directly
    return client.generateStructuredNote(messages, noteContent);
  }

  // No need for updateAIClient method here, as we always pull the current client from the plugin instance via the getter.
  // Also removed old implementation details like sendRequest, inner classes, etc.
}