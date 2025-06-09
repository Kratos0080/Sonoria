import type { Editor } from 'obsidian';
import { Notice } from 'obsidian';
import type NoteChatPlugin from '@app/main';

// Development API key from environment variable
const DEV_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Register commands with Obsidian
 * @param plugin - The NoteChat plugin instance
 */
export function registerCommands(plugin: NoteChatPlugin): void {
  // Command to start a conversation
  plugin.addCommand({
    id: 'start-conversation',
    name: 'Start conversation about current note',
    editorCallback: (editor: Editor) => {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (!activeFile) {
        new Notice('No active file');
        return;
      }
      
      // Get the file path and content
      const content = editor.getValue();
      
      // ADDED: Check if ConversationManager exists
      if (!plugin.conversationManager) {
        console.error('ConversationManager not initialized');
        new Notice('Error: Conversation feature not ready.');
        return;
      }
      // Call startConversation with correct arguments
      plugin.conversationManager.startConversation(activeFile.path, content);
    }
  });
  
  // Command to directly set the development API key
  plugin.addCommand({
    id: 'set-development-api-key',
    name: 'Set development API key',
    callback: async () => {
      // Set the API key
      plugin.settings.openAiApiKey = DEV_API_KEY;
      
      // Save the settings
      await plugin.saveSettings();
      
      // Show a notice
      new Notice('Development API key has been set', 3000);
      
      // Reload the conversation manager
      if (plugin.conversationManager) {
        plugin.conversationManager.updateSettings();
        new Notice('Conversation manager updated with new API key', 3000);
      }
    }
  });
  
  // Command to open the Sonoria view
  plugin.addCommand({
    id: 'open-sonoria-view',
    name: 'Open Sonoria view',
    callback: () => {
      plugin.activateView();
    }
  });
  
  // Command to start new conversation with active note
  plugin.addCommand({
    id: 'start-new-conversation',
    name: 'Start new conversation with current note',
    checkCallback: (checking: boolean) => {
      const activeFile = plugin.conversationManager.getNoteService().getActiveFile();
      
      // Only enable command if there's an active note
      if (activeFile) {
        if (!checking) {
          // Perform async actions separately
          const startConversation = async () => {
            await plugin.activateView();
            const noteId = activeFile.path;
            const noteContent = await plugin.conversationManager.getNoteService().getActiveNoteContent();
            if (noteContent !== null) {
              document.dispatchEvent(new CustomEvent('notechat-start-conversation', {
                detail: {
                  noteId,
                  noteContent
                }
              }));
            } else {
              new Notice('Could not read note content');
            }
          };
          startConversation(); // Don't await this call, let it run independently
        }
        return true; // Command is valid if activeFile exists
      }
      
      return false; // Command invalid if no activeFile
    }
  });
  
  // Add command to end the current conversation
  plugin.addCommand({
    id: 'end-sonoria-conversation',
    name: 'End Sonoria conversation',
    checkCallback: (checking: boolean) => {
      // This will be implemented later when we have a way to track active conversations
      if (checking) {
        return false; // For now, always return false when checking
      }
      
      new Notice('This command will be implemented in a future version');
      return false;
    }
  });
} 