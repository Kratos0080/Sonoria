import { TFile } from 'obsidian';
import type { App } from 'obsidian';

/**
 * Utility class to manage the gathering and formatting of multi-note context
 */
export class NoteContextManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Retrieves content from multiple notes and formats it for AI context
   * @param primaryNoteId The ID of the primary note (the one that started the conversation)
   * @param additionalNoteIds Array of additional note IDs to include in context
   * @returns Formatted context containing all note contents
   */
  async getMultiNoteContext(primaryNoteId: string, additionalNoteIds: string[] = []): Promise<{ 
    primaryNoteContent: string,
    additionalContext: string,
    allNoteIds: string[]
  }> {
    try {
      console.log(`Building multi-note context with primary note: ${primaryNoteId} and ${additionalNoteIds.length} additional notes`);
      
      // Get the primary note content (always required)
      const primaryFile = this.app.vault.getAbstractFileByPath(primaryNoteId);
      if (!primaryFile || !(primaryFile instanceof TFile)) {
        throw new Error(`Primary note file not found: ${primaryNoteId}`);
      }
      
      const primaryNoteContent = await this.app.vault.read(primaryFile);
      
      // Filter out the primary note ID from additional notes to prevent duplication
      additionalNoteIds = additionalNoteIds.filter(id => id !== primaryNoteId);
      
      // If no additional notes, just return the primary note content
      if (!additionalNoteIds || additionalNoteIds.length === 0) {
        return {
          primaryNoteContent,
          additionalContext: '',
          allNoteIds: [primaryNoteId]
        };
      }
      
      // Build context from additional notes
      let additionalContext = '';
      const validNoteIds = [primaryNoteId]; // Start with primary note
      
      for (const noteId of additionalNoteIds) {
        try {
          // Make sure we have the .md extension on the path
          const notePath = noteId.endsWith('.md') ? noteId : `${noteId}.md`;
          const noteFile = this.app.vault.getAbstractFileByPath(notePath);
          
          if (noteFile && noteFile instanceof TFile) {
            const content = await this.app.vault.read(noteFile);
            const fileName = noteFile.basename;
            
            // Add formatted note context
            additionalContext += `\n\n--- NOTE: "${fileName}" ---\n\n${content}\n\n`;
            validNoteIds.push(notePath); // Add to valid notes with correct path
            console.log(`Added note to context: ${fileName}`);
          } else {
            console.log(`Note not found or not a valid file: ${noteId}`);
          }
        } catch (error) {
          console.error(`Error reading additional note ${noteId}:`, error);
        }
      }
      
      return {
        primaryNoteContent,
        additionalContext,
        allNoteIds: validNoteIds
      };
    } catch (error) {
      console.error('Error building multi-note context:', error);
      throw error;
    }
  }
  
  /**
   * Formats a system message with multi-note context
   * @param primaryNoteId ID of the primary note
   * @param primaryContent Content of the primary note
   * @param additionalContext Formatted additional note content from getMultiNoteContext
   * @returns Formatted system message
   */
  formatSystemMessage(primaryNoteId: string, primaryContent: string, additionalContext: string = ''): string {
    // Get the file name
    const primaryFile = this.app.vault.getAbstractFileByPath(primaryNoteId);
    const primaryFileName = primaryFile instanceof TFile ? primaryFile.basename : 'Untitled';
    
    let systemPrompt = `You are a helpful AI assistant called Sonoria that helps users analyze and discuss the contents of their notes. `;
    
    systemPrompt += `The primary note is titled "${primaryFileName}" and contains the following content:\n\n${primaryContent}\n\n`;
    
    if (additionalContext && additionalContext.trim().length > 0) {
      systemPrompt += `Additional notes for context are provided below:\n${additionalContext}\n\n`;
      systemPrompt += `When addressing content from multiple notes, please clearly indicate which note you're referring to. Be sure to address information from ALL provided notes when responding to queries about the notes.`;
    }
    
    systemPrompt += `\n\nYou may refer to the note content to provide insights, summaries, or otherwise help the user understand the material. `;
    systemPrompt += `If the user asks questions about the notes, provide helpful answers based on the content. `;
    systemPrompt += `If the information isn't available in the notes, you can say so. `;
    systemPrompt += `Your responses should be concise and helpful.`;
    
    // Add instructions for handling questions about the AI itself
    systemPrompt += `\n\nIf the user asks who you are or about your capabilities, respond that you are Sonoria, an AI assistant that helps analyze and discuss notes in Obsidian. `;
    systemPrompt += `If asked about the current notes you can access, list all notes by their titles that have been provided in the context.`;
    
    return systemPrompt;
  }
} 