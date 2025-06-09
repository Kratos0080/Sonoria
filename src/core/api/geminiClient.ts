import type { Message } from '../types/conversation';
import type { AIClient } from './aiClient';
// 🔧 BETA FIX: Temporarily disable Google import to eliminate third-party cookie warnings
// import { GoogleGenerativeAI /*, HarmCategory, HarmBlockThreshold*/ } from "@google/generative-ai";

/**
 * Google Gemini API client for NoteChat
 * 🔧 BETA NOTE: Temporarily disabled to eliminate third-party cookie warnings during beta testing
 * Can be re-enabled for future releases by uncommenting the import above
 */
export class GeminiClient implements AIClient {
  private _apiKey: string;
  private _model: string;
  // private _genAI: GoogleGenerativeAI;
  // @ts-expect-error - Disabled during beta testing to avoid third-party cookies
  private __genAI: null = null; // Disabled during beta testing to avoid third-party cookies
  // private _isInitialized: boolean = false; // Used in original implementation (commented during beta)
  
  /**
   * The provider name (implements AIClient)
   */
  public readonly provider: string = 'google';
  
  /**
   * Get the current model (implements AIClient)
   */
  public get model(): string {
    return this._model;
  }

  /**
   * Create a new Gemini client
   * @param apiKey - Google API key
   * @param model - Model to use for completions
   */
  constructor(apiKey?: string, model?: string) {
    this._apiKey = apiKey || '';
    this._model = model || 'gemini-1.5-pro';
    
    // 🔧 BETA FIX: Skip Google AI initialization during beta to avoid third-party cookies
    console.warn("GeminiClient: Temporarily disabled during beta testing to avoid third-party cookie warnings");
    
    if (!this._apiKey) {
      console.warn("GeminiClient: API key is missing on initialization. Client will not function.");
      // this._genAI = {} as GoogleGenerativeAI;
      this.__genAI = null; // Placeholder
      // this._isInitialized = false;
    } else {
      this.initializeClient();
    }
  }

  /**
   * Initialize the client with provided API key and model (implements AIClient)
   * @param apiKey - The API key for this provider
   * @param model - The model to use
   */
  public initialize(apiKey: string, model: string): void {
    // 🔧 BETA FIX: Skip initialization during beta
    console.warn("GeminiClient: Public initialize() called but skipped during beta testing");
    this._apiKey = apiKey;
    this._model = model;
    // Skip actual Google AI initialization during beta
  }

  /**
   * Initialize the Google Generative AI client (private method)
   * @param apiKey - Google API key
   * @param model - Model name to use
   */
  private initializeClient(): void {
    // 🔧 BETA FIX: Skip initialization during beta
    console.warn("GeminiClient: Initialization skipped during beta testing");
      return;
    
    // Original initialization code (commented during beta):
    // if (!this._apiKey) {
    //   throw new Error("Cannot initialize GeminiClient without an API key.");
    // }
    // this._genAI = new GoogleGenerativeAI(this._apiKey);
    // this._isInitialized = true;
    // console.log(`GeminiClient initialized explicitly with model: ${this._model}`);
  }

  /**
   * Update the API key and reinitialize the client
   * @param apiKey - New API key
   */
  public updateApiKey(apiKey: string): void {
    if (!apiKey) {
      console.warn('GeminiClient: Attempted to update with empty API key');
      return;
    }
    this._apiKey = apiKey;
    // this._genAI = new GoogleGenerativeAI(this._apiKey);
    // this._isInitialized = true;
    console.log('GeminiClient: API key updated.');
  }

  /**
   * Update the model
   * @param model - New model to use
   */
  public updateModel(model: string): void {
    if (!model) {
      console.warn('GeminiClient: Attempted to update with empty model name');
      return;
    }
    this._model = model;
    console.log(`GeminiClient: Model updated to ${this._model}`);
  }

  /**
   * Generate a summary of a note
   * @param noteContent - Content of the note to summarize
   * @returns Summary of the note
   */
  public async generateNoteSummary(_noteContent: string): Promise<string> {
    // 🔧 BETA FIX: Return error message during beta testing
    throw new Error("GeminiClient temporarily disabled during beta testing to avoid third-party cookie warnings");
  }

  // 🔧 BETA FIX: Original generateNoteSummary implementation commented out during beta
  /*
  public async generateNoteSummary_ORIGINAL(noteContent: string): Promise<string> {
    if (!this.__genAI) {
      await this.__waitForClient();
    }

    try {
      // Ensure we have a valid client
      if (!this.__genAI) {
        await this.__waitForClient();
      }

      // Ensure noteContent is a string
      const sanitizedContent = typeof noteContent === 'string' 
        ? noteContent 
        : JSON.stringify(noteContent);
      
      console.log('Generating summary with model:', this._model);
      
      // Create the gemini model instance
      const model = this.__genAI.getGenerativeModel({ model: this._model });
      
      // Set up safety settings for Gemini 2.0 models
      const generationConfig = {
        maxOutputTokens: 150,
        temperature: 0.4,
        topP: 0.95,
      };
      
      // Generate the summary
      try {
        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Summarize the following note content concisely.\n\n" + sanitizedContent }
              ]
            }
          ],
          generationConfig,
        });
        
        const response = result.response;
        const summary = response.text() || 'Failed to generate summary';
        console.log('Summary generated successfully');
        return summary;
      } catch (generationError) {
        console.error('Error in content generation:', generationError);
        
        // Try with a fallback model if this is a model-specific error
        if (this._model.includes('2.0') && generationError.message?.includes('not found')) {
          console.log('GeminiClient: Attempting fallback to Gemini 1.5 for summary generation');
          
          const fallbackModel = this.__genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const fallbackResult = await fallbackModel.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Summarize the following note content concisely.\n\n" + sanitizedContent }
                ]
              }
            ],
            generationConfig,
          });
          
          const fallbackResponse = fallbackResult.response;
          const fallbackSummary = fallbackResponse.text() || 'Failed to generate summary';
          console.log('Summary generated successfully using fallback model');
          return fallbackSummary;
        }
        
        throw generationError;
      }
    } catch (error) {
      console.error('Error generating note summary:', error);
      throw error;
    }
  }

  /**
   * Generate a brief summary of a note (shorter than the regular summary)
   * @param noteContent - Content of the note to summarize
   * @returns Brief summary of the note
   */
  public async generateBriefNoteSummary(_noteContent: string): Promise<string> {
    // 🔧 BETA FIX: Return error message during beta testing
    throw new Error("GeminiClient temporarily disabled during beta testing to avoid third-party cookie warnings");
  }

  // 🔧 BETA FIX: Original generateBriefNoteSummary implementation commented out during beta
  /*
  public async generateBriefNoteSummary_ORIGINAL(noteContent: string): Promise<string> {
    if (!this.__genAI) {
      await this.__waitForClient();
    }

    try {
      // Ensure we have a valid client
      if (!this.__genAI) {
        await this.__waitForClient();
      }

      // Ensure noteContent is a string
      const sanitizedContent = typeof noteContent === 'string' 
        ? noteContent 
        : JSON.stringify(noteContent);
      
      console.log('Generating brief summary with model:', this._model);
      
      // Create the gemini model instance
      const model = this.__genAI.getGenerativeModel({ model: this._model });
      
      // Set up generation config for a shorter response
      const generationConfig = {
        maxOutputTokens: 60,
        temperature: 0.3,
        topP: 0.95,
      };
      
      // Generate the brief summary
      try {
        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                { text: "Provide an extremely brief 1-2 sentence summary of the following note content, focusing only on the main topic.\n\n" + sanitizedContent }
              ]
            }
          ],
          generationConfig,
        });
        
        const response = result.response;
        const summary = response.text() || 'Failed to generate brief summary';
        console.log('Brief summary generated successfully');
        return summary;
      } catch (generationError) {
        console.error('Error in brief summary generation:', generationError);
        
        // Try with a fallback model if this is a model-specific error
        if (this._model.includes('2.0') && generationError.message?.includes('not found')) {
          console.log('GeminiClient: Attempting fallback to Gemini 1.5 for brief summary generation');
          
          const fallbackModel = this.__genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const fallbackResult = await fallbackModel.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Provide an extremely brief 1-2 sentence summary of the following note content, focusing only on the main topic.\n\n" + sanitizedContent }
                ]
              }
            ],
            generationConfig,
          });
          
          const fallbackResponse = fallbackResult.response;
          const fallbackSummary = fallbackResponse.text() || 'Failed to generate brief summary';
          console.log('Brief summary generated successfully using fallback model');
          return fallbackSummary;
        }
        
        throw generationError;
      }
    } catch (error) {
      console.error('Error generating brief note summary:', error);
      throw error;
    }
  }

  /**
   * Process a conversation and generate a response
   * @param messages - Array of messages in the conversation
   * @param systemPrompt - Content of the note to provide context (used as system prompt)
   * @returns AI-generated response
   */
  public async handleConversationMessage(
    _messages: Message[], 
    _systemPrompt: string
  ): Promise<string> {
    // 🔧 BETA FIX: Return error message during beta testing
    throw new Error("GeminiClient temporarily disabled during beta testing to avoid third-party cookie warnings");

    /*
    if (!this.__genAI) {
      await this.__waitForClient();
    }

    try {
      const sanitizedSystemPrompt = typeof systemPrompt === 'string' ? systemPrompt : JSON.stringify(systemPrompt);
      const truncatedSystemPrompt = sanitizedSystemPrompt; // Use full prompt
      
      try {
        const model = this.__genAI.getGenerativeModel({
          model: this._model,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
            topP: 0.95,
          },
        });

        // --- REVISED LOGIC: Use generateContent with explicit history --- 

        // Convert our Message[] format to Gemini's history format
        // Gemini expects [{ role: "user"/"model", parts: [{ text: "..." }] }]
        const geminiHistory = [
            // Prepend the system prompt as the first user message 
            { role: "user", parts: [{ text: `System Context:\n${truncatedSystemPrompt}` }] },
            // Add a simple model acknowledgement to establish the turn structure
            { role: "model", parts: [{ text: "Okay, I understand the context. How can I help?" }] }
        ];

        // Add the actual conversation history passed in `messages` argument
        messages.forEach(msg => {
            if (msg.role !== 'user' && msg.role !== 'assistant') return; 
            geminiHistory.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.content }]
            });
        });
        
        // ADDED: Logging before the API call
        console.log(`GeminiClient: Calling generateContent (${this._model}). Turns: ${geminiHistory.length}`);
        console.log(`GeminiClient: System Prompt Used (length: ${truncatedSystemPrompt.length}):\n${truncatedSystemPrompt.substring(0, 300)}...`); // Log start of prompt
        console.log("GeminiClient: Full History for generateContent:", JSON.stringify(geminiHistory)); 

        // Use generateContent directly with the full history
        const result = await model.generateContent({ contents: geminiHistory });
        
        // --- END REVISED LOGIC --- 

        const response = result.response;
        const content = response.text() || 'Failed to generate response';
        
        console.log('Response generated successfully using generateContent');
        return content;

      } catch (generationError) {
        console.error('Error in content generation:', generationError);
        
        // Fallback might still be useful, but adapt it
        console.log('GeminiClient: Falling back to simpler prompt due to generation error');
        
        // Build a simpler prompt for fallback
        const fallbackPrompt = `System Context:\n${truncatedSystemPrompt}\n\nConversation History:\n${messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\n\nPlease respond to the last message.`;
        
        const modelInstance = this.__genAI.getGenerativeModel({ 
          model: this._model, 
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7, topP: 0.95 }
        });
        
        const fallbackResult = await modelInstance.generateContent({
          contents: [{ role: "user", parts: [{ text: fallbackPrompt }] }],
        });
        
        const fallbackResponse = fallbackResult.response;
        const fallbackContent = fallbackResponse.text() || 'Failed to generate fallback response';
          
        console.log('Response generated successfully using fallback approach');
        return fallbackContent;
      }
    } catch (error) {
      console.error('Error handling conversation message:', error);
      throw error;
    }
    */
  }

  /**
   * Generate a structured note from a conversation
   * @param messages - Array of messages in the conversation
   * @param noteContent - Content of the original note
   * @returns Structured note content
   */
  public async generateStructuredNote(
    _messages: Message[], 
    _noteContent: string
  ): Promise<string> {
    // 🔧 BETA FIX: Return error message during beta testing
    throw new Error("GeminiClient temporarily disabled during beta testing to avoid third-party cookie warnings");

    /*
    if (!this.__genAI) {
      await this.__waitForClient();
    }

    try {
      // Ensure noteContent is a string
      const sanitizedNoteContent = typeof noteContent === 'string' 
        ? noteContent 
        : JSON.stringify(noteContent);
      
      const truncatedContent = sanitizedNoteContent.slice(0, 10000) + 
        (sanitizedNoteContent.length > 10000 ? '...(content truncated for brevity)' : '');
      
      // Try to get a model instance for the configured model
      let modelInstance;
      
      try {
        modelInstance = this.__genAI.getGenerativeModel({ 
          model: this._model,
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.2, // Lower temperature for more structured output
            topP: 0.95,
          }
        });
      } catch (modelError) {
        console.warn(`GeminiClient: Error creating model instance for ${this._model}:`, modelError);
        console.log('GeminiClient: Falling back to gemini-1.5-pro for structured note generation');
        
        // Fallback to 1.5-pro which is good at structured outputs
        modelInstance = this.__genAI.getGenerativeModel({ 
          model: 'gemini-1.5-pro',
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.2,
            topP: 0.95,
          }
        });
      }
      
      // Prepare the prompt for generating a structured note
      const prompt = `
      Create a well-structured markdown note based on the conversation below.
      This note will be saved to the user's Obsidian vault, so it must be properly formatted with:
      
      1. First, create a level 1 heading (# Title) that summarizes the main topic of the conversation
      2. Then, create a level 2 heading (## Overview) with a brief summary paragraph
      3. Finally, organize the key information into appropriate level 2 and 3 sections
      
      Include key insights, important points, and action items.
      The original note content is provided for context.
      
      Original note:
      ${truncatedContent}
      
      Conversation:
      ${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')}
      
      IMPORTANT: Your response MUST be a complete markdown document with a title heading and proper structure.
      The title is especially important and should clearly reflect the main topic discussed.`;
      
      console.log(`Generating structured note from ${messages.length} messages using model: ${this._model}`);
      
      try {
        // Generate the structured note
        const result = await modelInstance.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        
        const response = result.response;
        let content = response.text() || 'Failed to generate structured note';
        
        // Ensure the content has a title
        if (!content.startsWith('# ')) {
          content = `# Notes from Conversation\n\n${content}`;
          console.log('Added missing title to generated note');
        }
        
        console.log('Structured note generated successfully');
        return content;
      } catch (generationError) {
        console.error('Error generating structured note content:', generationError);
        
        // Try a simpler approach if generation fails
        console.log('GeminiClient: Attempting simplified approach for note generation');
        
        // Create a simplified prompt
        const simplifiedPrompt = `
        Create a markdown note summarizing this conversation.
        Start with a # Title, then summarize the key points.
        
        Conversation:
        ${messages.map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 500)}`).join('\n\n')}`;
        
        // Try with a different model if available
        try {
          const fallbackModel = this.__genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.3,
            }
          });
          
          const fallbackResult = await fallbackModel.generateContent({
            contents: [{ role: "user", parts: [{ text: simplifiedPrompt }] }],
          });
          
          const fallbackResponse = fallbackResult.response;
          let fallbackContent = fallbackResponse.text() || 'Failed to generate structured note';
          
          // Ensure the content has a title
          if (!fallbackContent.startsWith('# ')) {
            fallbackContent = `# Notes from Conversation\n\n${fallbackContent}`;
            console.log('Added missing title to fallback generated note');
          }
          
          console.log('Structured note generated successfully with fallback approach');
          return fallbackContent;
        } catch (fallbackError) {
          console.error('Error in fallback note generation:', fallbackError);
          throw fallbackError;
        }
      }
    } catch (error) {
      console.error('Error generating structured note:', error);
      throw error;
    }
    */
  }
  
  /**
   * Wait for the client to be initialized
   * This is needed because we're using dynamic imports
   */
  // @ts-expect-error - Disabled during beta testing
  private async __waitForClient(): Promise<void> {
    // 🔧 BETA FIX: Client is disabled during beta testing
    throw new Error('Gemini client disabled during beta testing');
  }
} 