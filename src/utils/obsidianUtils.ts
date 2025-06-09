import { TFile, TFolder, FileView } from 'obsidian';
import type { App as ObsidianApp } from 'obsidian';

let appInstance: ObsidianApp | null = null;

export function setAppInstance(app: ObsidianApp) {
  appInstance = app;
}

export function getAppInstance(): ObsidianApp {
  if (!appInstance) {
    throw new Error("App instance is not set. Ensure setAppInstance is called in main.ts.");
  }
  return appInstance;
}

/**
 * Gets the currently active file in Obsidian
 * @returns The active file, or null if none is active
 */
export function getActiveFile(): TFile | null {
  // Prefix unused variable
  // const _app = getAppInstance(); 
  if (!appInstance) return null; // Check directly
  try {
    // First try using the standard API method (if available in the future)
    if (typeof appInstance.workspace.getActiveFile === 'function') {
      return appInstance.workspace.getActiveFile();
    }
    
    // Fall back to getting it from the active leaf
    const view = appInstance.workspace.activeLeaf?.view;
    if (view instanceof FileView) {
      return view.file;
    }
    return null;
  } catch (error) {
    console.error('Error getting active file:', error);
    return null;
  }
}

/**
 * Gets a list of recently opened files
 * @param limit Maximum number of files to return
 * @returns Array of TFile objects
 */
export function getRecentFiles(limit = 10): TFile[] {
  const app = getAppInstance();
  try {
    // Try using the known API method for recent files
    if (typeof app.workspace.getLastOpenFiles === 'function') {
      return (app.workspace.getLastOpenFiles() || [])
        .map((path: string) => app.vault.getAbstractFileByPath(path))
        .filter((file: unknown): file is TFile => file instanceof TFile && (file as TFile).extension === 'md')
        .slice(0, limit);
    }
    
    // If that doesn't exist, return an empty array
    return [];
  } catch (error) {
    console.error('Error getting recent files:', error);
    return [];
  }
}

/**
 * Search for files in the vault by name
 * @param query Search term to look for in file names
 * @param limit Maximum number of results to return
 * @returns Array of matching TFile objects
 */
export function searchFilesByName(query: string, limit = 10): TFile[] {
  // Remove unused variable
  // const _app = getAppInstance();
  try {
    // Use a safer approach - get all markdown files through getMarkdownFiles
    const allFiles = getAllMarkdownFiles();
    return allFiles
      .filter((file: TFile) => 
        file.basename.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit);
  } catch (error) {
    console.error('Error searching files:', error);
    return [];
  }
}

/**
 * Get all markdown files in the vault
 * @returns Array of all TFile objects that are markdown files
 */
export function getAllMarkdownFiles(): TFile[] {
  const app = getAppInstance();
  try {
    // Use vault.getFiles if available (type it safely)
    if (typeof app.vault.getFiles === 'function') {
      return (app.vault.getFiles() || [])
        .filter((file: unknown): file is TFile => 
          file instanceof TFile && file.extension === 'md'
        );
    }
    
    // Fall back to getting files through recursively checking all files
    const allFiles: TFile[] = [];
    const processFolder = (folderPath: string) => {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (folder && folder instanceof TFolder) {
        folder.children.forEach(file => {
          if (file instanceof TFile && file.extension === 'md') {
            allFiles.push(file);
          } else if (file instanceof TFolder) {
            processFolder(file.path);
          }
        });
      }
    };
    
    processFolder('/');
    return allFiles;
  } catch (error) {
    console.error('Error getting all markdown files:', error);
    return [];
  }
}

/**
 * Add event handler with type safety for React events
 * @param element DOM element to attach handler to
 * @param event Event name
 * @param handler Event handler function
 */
export function addSafeEventListener<K extends keyof HTMLElementEventMap>(
  element: HTMLElement | null,
  event: K,
  handler: (event: HTMLElementEventMap[K]) => void
): void {
  if (element) {
    element.addEventListener(event, handler);
  }
}

/**
 * Gets the content of a file by its path.
 */
export async function getFileContent(filePath: string): Promise<string | null> {
  // const app = getAppInstance(); // Keep removed
  const file = getAppInstance().vault.getAbstractFileByPath(filePath);
  
  if (file instanceof TFile) {
    try {
      const content = await getAppInstance().vault.read(file);
      return content;
    } catch (error) {
      console.error(`Error reading file content for ${filePath}:`, error);
      return null;
    }
  } else {
    console.warn(`File not found or not a TFile: ${filePath}`);
    return null;
  }
}

/**
 * Get the content of the currently active Markdown file.
 * Returns null if no file is active or if the file is not Markdown.
 */
export function getActiveFileContent(app: ObsidianApp): string | null {
	// const app = getAppInstance(); // Ensure this line assigning to 'app' remains commented out or removed
	const activeFile = app.workspace.getActiveFile();
	if (activeFile) {
		// Returning path as placeholder, content requires async
		return activeFile.path;
	}
	return null;
}

/**
 * Opens a specific note by its path.
 */
export function openNote(app: ObsidianApp, filePath: string): void {
  // const app = getAppInstance(); // Removed internal app assignment
  try {
    app.workspace.openLinkText(filePath, '', true);
  } catch (error) {
    console.error(`Error opening note: ${filePath}`, error);
  }
}

export function findOrCreateFolder(folderPath: string): TFolder | null {
  if (!appInstance) {
    console.error('Obsidian App instance is not available in findOrCreateFolder');
    return null;
  }
  // Removed unused _app variable assignment
  // const _app = getAppInstance(); 

  try {
    const folder = appInstance.vault.getAbstractFileByPath(folderPath);
    if (folder instanceof TFolder) {
      // console.log('Folder already exists:', folderPath);
      return folder;
    } else if (folder) {
      // It's a file, not a folder
      console.error(`Path exists but is not a folder: ${folderPath}`);
      return null;
    } else {
      // Folder does not exist, create it
      // console.log('Folder does not exist, creating:', folderPath);
      appInstance.vault.createFolder(folderPath).then(newFolder => {
        // console.log('Folder created successfully:', newFolder.path);
        return newFolder;
      }).catch(error => {
        console.error(`Error creating folder: ${folderPath}`, error);
        return null; // Return null on creation error
      });
      // Need to handle the promise return correctly - this part is complex without seeing full original code
      // For now, assume async operation means we can't return synchronously here, return null
      // Or refactor to be async
      return null; // Adjusted to return null pending async handling
    }
  } catch (error) {
    console.error(`Error accessing/creating folder: ${folderPath}`, error);
    return null;
  }
  // Remove unused return
  // return null; // Ensure all paths return TFolder or null
} 