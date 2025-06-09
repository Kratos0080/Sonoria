// src/utils/devUtils.ts
import type { NoteChatSettings } from '@app/settings';

// Development API keys (only used if user hasn't set their own)
const DEV_OPENAI_API_KEY = process.env.DEV_OPENAI_API_KEY || '';

/**
 * Apply development settings if user settings are empty
 * This allows developers to use environment variables for API keys during development
 * without committing them to the repository
 */
export function applyDevelopmentSettings(userSettings: NoteChatSettings): NoteChatSettings {
  const newSettings = { ...userSettings };

  // Only inject DEV keys if user hasn't set their own
  if (!newSettings.openAiApiKey) { // If user hasn't set one or it's empty
    newSettings.openAiApiKey = DEV_OPENAI_API_KEY;
    if (DEV_OPENAI_API_KEY) {
      console.log('NoteChat: Using DEV_OPENAI_API_KEY from environment for development.');
    }
  }

  return newSettings;
}