export interface NoteChatSettings {
  apiKey: string;
  selectedModel: string;
}

export const DEFAULT_SETTINGS: NoteChatSettings = {
  apiKey: '',
  selectedModel: 'gpt-4o-mini',
} 