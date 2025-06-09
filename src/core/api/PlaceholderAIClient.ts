import type { AIClient } from './aiClient';
import type { Message } from '../types/conversation';
import { Notice } from 'obsidian';

// Define provider and model types based on what AIClient might expect
// These are simplified and might need adjustment based on actual AIClient usage
type PlaceholderProvider = 'placeholder';
type PlaceholderModel = 'placeholder_model';

export class PlaceholderAIClient implements AIClient {
  readonly provider: PlaceholderProvider = 'placeholder';
  readonly model: PlaceholderModel = 'placeholder_model';
  public reason: string;

  constructor(reason: string = "AI features are disabled. API key missing or invalid.") {
    this.reason = reason;
    console.warn(`PlaceholderAIClient initialized. Reason: ${this.reason}`);
  }

  initialize(_apiKey: string, _model: string): void {
    // No-op for placeholder
    console.warn("PlaceholderAIClient: initialize called, but it's a no-op.");
  }

  updateApiKey(_apiKey: string): void {
    // No-op
    new Notice("Placeholder AI Client: API key update ignored. Configure a real AI provider.");
    console.warn("PlaceholderAIClient: updateApiKey called.");
  }

  updateModel(_model: string): void {
    // No-op
    new Notice("Placeholder AI Client: Model update ignored. Configure a real AI provider.");
    console.warn("PlaceholderAIClient: updateModel called.");
  }

  async handleConversationMessage(_messages: Message[], _systemPrompt?: string): Promise<string> {
    console.warn("PlaceholderAIClient: handleConversationMessage called. Reason:", this.reason);
    new Notice(this.reason, 10000); // Show notice for longer
    return Promise.resolve(this.reason);
  }

  async generateStructuredNote(_messages: Message[], _context?: string): Promise<string> {
    console.warn("PlaceholderAIClient: generateStructuredNote called. Reason:", this.reason);
    new Notice(this.reason, 10000);
    return Promise.resolve(`# Placeholder Note\n\n${this.reason}`);
  }

  async generateNoteSummary(_text: string): Promise<string> {
    console.warn("PlaceholderAIClient: generateNoteSummary called. Reason:", this.reason);
    new Notice(this.reason, 10000);
    return Promise.resolve(`Summary not available. ${this.reason}`);
  }

  async generateBriefNoteSummary(_text: string): Promise<string> {
    console.warn("PlaceholderAIClient: generateBriefNoteSummary called. Reason:", this.reason);
    new Notice(this.reason, 10000);
    return Promise.resolve(`Brief summary not available. ${this.reason}`);
  }
} 