// Simplified OpenAI API type declarations for NoteChat plugin

declare module 'openai' {
  export default class OpenAI {
    constructor(options: { apiKey: string });
    
    chat: {
      completions: {
        create(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;
      };
    };
  }
  
  export interface ChatCompletionOptions {
    model: string;
    messages: ChatCompletionMessage[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  }
  
  export interface ChatCompletionMessage {
    role: string;
    content: string;
  }
  
  export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
      message: {
        role: string;
        content: string;
      };
      index: number;
      finish_reason: string;
    }[];
  }
} 