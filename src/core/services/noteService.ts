import type { App as ObsidianApp, Vault } from 'obsidian';
import { MarkdownView, TFile, TFolder, Notice } from 'obsidian';

interface FileParser {
  supportedExtensions: string[];
  parseFile: (file: TFile, vault: Vault) => Promise<string>;
}

/**
 * Service for interacting with Obsidian notes
 */
export class NoteService {
  private app: ObsidianApp;
  private parsers: Map<string, FileParser> = new Map();
  private noteFolderPath: string = ''; // Default folder for saving notes

  /**
   * Create a new service
   */
  constructor(app: ObsidianApp, noteFolderPath: string) {
    if (!app) {
      throw new Error("NoteService requires a valid Obsidian App instance.");
    }
    this.app = app;
    // Use the provided noteFolderPath
    this.noteFolderPath = noteFolderPath || ''; // Use default if empty
    
    // Register parsers
    this.registerParser({
      supportedExtensions: ['md'],
      parseFile: async (file, vault) => await vault.read(file)
    });
  }

  /**
   * Register a file parser
   */
  private registerParser(parser: FileParser) {
    for (const ext of parser.supportedExtensions) {
      this.parsers.set(ext, parser);
    }
  }

  /**
   * Get the currently active note content
   * Multiple fallbacks to ensure we always get content if possible
   */
  async getActiveNoteContent(): Promise<string | null> {
    try {
      console.log('NoteService: Getting active note content');
      
      // Method 1: Direct access via workspace API
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        // Read the file content
        const content = await this.app.vault.read(activeFile);
        if (content) {
          console.log(`NoteService: Got content from active file (${activeFile.path})`);
          return content;
        }
      }
      
      // Method 2: Get from active markdown view
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView instanceof MarkdownView && activeView.file) {
        const editor = activeView.editor;
        if (editor) {
          const content = editor.getValue();
          console.log('NoteService: Got content from active markdown view editor');
          return content;
        }
      }
      
      // Method 3: Try from global cache (set by NoteChatView)
      if (window.lastActiveNoteContent) {
        console.log('NoteService: Using cached note content from global variable');
        return window.lastActiveNoteContent;
      }
      
      console.error('NoteService: Could not find active note content');
      return null;
    } catch (error) {
      console.error('NoteService: Error getting active note content', error);
      return null;
    }
  }
  
  /**
   * Get the active file if available
   */
  getActiveFile(): TFile | null {
    try {
      return this.app.workspace.getActiveFile();
    } catch (error) {
      console.error('NoteService: Error getting active file', error);
      return null;
    }
  }

  /**
   * Get the content of a note by path - async version
   * @param path - Path to the note
   * @returns The content of the note
   */
  public async getFileContent(file: TFile): Promise<string> {
    try {
      console.log(`Reading content from file: ${file.path}`);
      
      // Try to use the registered parser based on file extension
      const parser = this.parsers.get(file.extension);
      if (parser) {
        return await parser.parseFile(file, this.app.vault);
      }
      
      // Default to reading the file directly
      const content = await this.app.vault.read(file);
      console.log(`Successfully read ${content.length} characters from file: ${file.path}`);
      return content;
    } catch (error) {
      console.error(`Error reading file content from ${file.path}:`, error);
      throw error;
    }
  }

  /**
   * Create a new note with the given title and content in a specific directory
   * @param title The title for the new note.
   * @param content The content for the new note.
   * @param directoryPath The specific directory path to save the note in.
   * @param suppressNotice Optional. If true, suppresses the success notification.
   */
  async createNoteInDirectory(title: string, content: string, directoryPath: string, suppressNotice: boolean = false): Promise<TFile> {
    try {
      console.log(`NoteService: Creating note with title: ${title} in directory: ${directoryPath}`);
      
      // Sanitize the title for use as a filename
      const fileName = this.sanitizeFileName(title);
      
      // Clean up the directory path - remove leading/trailing slashes
      const folderPath = directoryPath.replace(/^\/|\/$/g, '');
      
      // Construct the file path
      const filePath = folderPath 
        ? `${folderPath}/${fileName}.md` 
        : `${fileName}.md`;
      
      console.log(`NoteService: File path: ${filePath}`);
      
      // Ensure the target directory exists
      if (folderPath) {
        await this.ensureFolderExists(folderPath);
      }
      
      // Check if file already exists
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile instanceof TFile) {
        const confirmOverwrite = confirm(`A note with the title "${fileName}" already exists. Do you want to overwrite it?`);
        if (!confirmOverwrite) {
          console.log('NoteService: User cancelled overwrite');
          throw new Error('Note creation cancelled by user');
        }
        // Delete existing file
        await this.app.vault.delete(existingFile);
      }
      
      // Create the new note file
      const file = await this.app.vault.create(filePath, content);
      
      // Conditionally show success notice
      if (!suppressNotice) {
        new Notice(`Note "${title}" created successfully in ${directoryPath}!`);
      }
      
      // Open the new note in a new pane
      await this.app.workspace.openLinkText(filePath, '', true);
      
      return file;
    } catch (error) {
      console.error('NoteService: Error creating note in directory', error);
      throw error;
    }
  }

  /**
   * Create a new note with the given title and content
   * @param title The title for the new note.
   * @param content The content for the new note.
   * @param suppressNotice Optional. If true, suppresses the success notification.
   */
  async createNote(title: string, content: string, suppressNotice: boolean = false): Promise<TFile> {
    try {
      console.log(`NoteService: Creating note with title: ${title}`);
      
      // Sanitize the title for use as a filename
      const fileName = this.sanitizeFileName(title);
      
      // Get folder path, use default if configured
      let folderPath = this.noteFolderPath || '';
      
      // Remove leading/trailing slashes
      folderPath = folderPath.replace(/^\/|\/$/g, '');
      
      // Construct the file path
      const filePath = folderPath 
        ? `${folderPath}/${fileName}.md` 
        : `${fileName}.md`;
      
      console.log(`NoteService: File path: ${filePath}`);
      
      // Ensure the target directory exists
      if (folderPath) {
        await this.ensureFolderExists(folderPath);
      }
      
      // Check if file already exists
      const existingFile = this.app.vault.getAbstractFileByPath(filePath);
      if (existingFile instanceof TFile) {
        const confirmOverwrite = confirm(`A note with the title "${fileName}" already exists. Do you want to overwrite it?`);
        if (!confirmOverwrite) {
          console.log('NoteService: User cancelled overwrite');
          throw new Error('Note creation cancelled by user');
        }
        // Delete existing file
        await this.app.vault.delete(existingFile);
      }
      
      // Create the new note file
      const file = await this.app.vault.create(filePath, content);
      
      // Conditionally show success notice
      if (!suppressNotice) {
        new Notice(`Note "${title}" created successfully!`);
      }
      
      // Open the new note in a new pane
      await this.app.workspace.openLinkText(filePath, '', true);
      
      return file;
    } catch (error) {
      console.error('NoteService: Error creating note', error);
      throw error;
    }
  }
  
  /**
   * Ensure a folder path exists, creating it if necessary
   * This method handles nested paths
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    console.log(`NoteService: Ensuring folder exists: ${folderPath}`);
    
    // Check if folder already exists
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (folder instanceof TFolder) {
      console.log(`NoteService: Folder already exists: ${folderPath}`);
      return;
    }
    
    // Split path into segments
    const pathSegments = folderPath.split('/').filter(segment => segment.length > 0);
    
    let currentPath = '';
    
    // Create each folder in the path if it doesn't exist
    for (const segment of pathSegments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      
      // Check if this segment exists
      const folderSegment = this.app.vault.getAbstractFileByPath(currentPath);
      if (!(folderSegment instanceof TFolder)) {
        console.log(`NoteService: Creating folder: ${currentPath}`);
        try {
          await this.app.vault.createFolder(currentPath);
        } catch (error) {
          console.error(`NoteService: Error creating folder ${currentPath}`, error);
          throw new Error(`Could not create folder ${currentPath}: ${error.message}`);
        }
      }
    }
    
    console.log(`NoteService: Successfully ensured folder path: ${folderPath}`);
  }

  /**
   * Append content to an existing note
   */
  async appendToNote(file: TFile, content: string): Promise<void> {
    try {
      // Get current content
      const currentContent = await this.app.vault.read(file);
      
      // Append new content
      const updatedContent = `${currentContent}\n\n${content}`;
      
      // Write back to file
      await this.app.vault.modify(file, updatedContent);
      
      // Show notice
      new Notice(`Content appended to "${file.basename}"`);
    } catch (error) {
      console.error('NoteService: Error appending to note', error);
      throw error;
    }
  }

  /**
   * Opens a note in the Obsidian workspace.
   * Handles potential errors during file opening.
   */
  async openNote(noteOrPath: TFile | string): Promise<void> {
    let filePath: string;
    if (typeof noteOrPath === 'string') {
      filePath = noteOrPath;
    } else {
      filePath = noteOrPath.path;
    }

    console.log(`NoteService: Attempting to open note: ${filePath}`);
    try {
      const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
      if (!abstractFile) {
        throw new Error(`File not found at path: ${filePath}`);
      }
      if (!(abstractFile instanceof TFile)) {
        throw new Error(`Path exists but is not a file: ${filePath}`);
      }

      const leaf = this.app.workspace.getLeaf(false); // Use existing leaf if possible
      await leaf.openFile(abstractFile);
      console.log(`NoteService: Successfully opened note: ${filePath}`);
    } catch (error: unknown) { // Use unknown for caught error
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`NoteService: Error opening note ${filePath}:`, errorMessage);
      new Notice(`Failed to open note: ${errorMessage}`);
      // Re-throw or handle as needed
      throw new Error(`Failed to open note: ${errorMessage}`);
    }
  }

  /**
   * Sanitize a string for use as a filename
   */
  private sanitizeFileName(input: string): string {
    // Remove characters that are invalid in filenames
    let sanitized = input.replace(/[\\/:*?"<>|]/g, '-');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // If empty, use default name
    if (!sanitized) {
      sanitized = 'Untitled';
    }
    
    return sanitized;
  }

  /**
   * Get recently opened files
   * @returns Array of TFile objects for recently opened files
   */
  async getRecentFiles(): Promise<TFile[]> {
    try {
      const recentFilePaths = this.app.workspace.getLastOpenFiles();
      const recentFiles: TFile[] = [];
      for (const filePath of recentFilePaths) {
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (file instanceof TFile) {
          recentFiles.push(file);
        }
      }
      return recentFiles;
    } catch (error) {
      console.error('NoteService: Error getting recent files', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Search markdown files in the vault by filename query.
   * @param query - The search query string.
   * @returns Array of TFile objects matching the query.
   */
  async searchFiles(query: string): Promise<TFile[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }
    console.log(`NoteService: Searching for files with query: ${query}`);
    try {
      // Note: Using getMarkdownFiles directly, assuming it exists via declaration merging or official types
      const allFiles = this.app.vault.getMarkdownFiles();
      const lowerCaseQuery = query.toLowerCase();

      const filteredFiles = allFiles.filter(file => 
        file.basename.toLowerCase().includes(lowerCaseQuery)
      );

      console.log(`NoteService: Found ${filteredFiles.length} files matching query.`);
      return filteredFiles;
    } catch (err) {
      console.error('NoteService: Error searching files:', err);
      // Optionally re-throw or return empty array depending on desired error handling
      return []; 
    }
  }
} 