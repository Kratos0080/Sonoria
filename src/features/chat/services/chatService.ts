import { Notice } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_SONORIA } from '@app/constants';
import { NoteChatView } from '../components/NoteChatView';
import type NoteChatPlugin from '@app/main';
import type { ConversationManager } from '../store/conversationContext';

/**
 * ChatService handles the integration between the React chat components
 * and the Obsidian plugin system
 */
export class ChatService {
  private conversationManager: ConversationManager;

  constructor(private plugin: NoteChatPlugin) {
    // Ensure conversationManager is assigned correctly
    this.conversationManager = plugin.conversationManager;
  }

  /**
   * Initialize the chat service
   */
  initialize(): void {
    // Register the view
    this.registerView();
    
    // Add ribbon icon
    this.addRibbonIcon();
    
    // Register commands
    this.addCommands();
    console.log('ChatService initialized');
  }

  /**
   * Register the chat view with Obsidian
   */
  private registerView(): void {
    this.plugin.registerView(
      VIEW_TYPE_SONORIA,
      (leaf) => new NoteChatView(leaf) // Pass only leaf to constructor
    );
  }

  /**
   * Add the chat icon to the ribbon
   */
  private addRibbonIcon(): void {
    this.plugin.addRibbonIcon(
      'message-circle',
      'Open Sonoria',
      () => this.activateView()
    );
  }

  /**
   * Register plugin commands
   */
  private addCommands(): void {
    this.plugin.addCommand({
      id: 'open-sonoria',
      name: 'Open Sonoria',
      callback: () => this.activateView(),
    });

    this.plugin.addCommand({
      id: 'start-chat-with-current-note',
      name: 'Start chat with current note',
      checkCallback: (checking) => {
        const workspace = this.plugin.app.workspace;
        const activeFile = workspace.getActiveFile();
        if (activeFile && activeFile.extension === 'md') {
          if (!checking) {
            this.activateViewWithNote(activeFile.path);
          }
          return true;
        }
        return false;
      },
    });
  }

  /**
   * Activate the chat view
   */
  public async activateView() {
    console.log("Activating Sonoria view...");
    const { workspace } = this.plugin.app;

    // Detach existing leaves if any
          workspace.detachLeavesOfType(VIEW_TYPE_SONORIA);

    // Create a new leaf in the right split
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) {
      console.error("Failed to get right leaf.");
      return;
    }
    await leaf.setViewState({ type: VIEW_TYPE_SONORIA, active: true });

    // Reveal the leaf
    workspace.revealLeaf(leaf);
    console.log("Sonoria view activated.");
  }

  /**
   * Opens the chat view in a modal (alternative UI approach)
   */
  public openChatModal() {
    // Assuming ChatModal component exists and handles its own logic
    // new ChatModal(this.plugin.app, this.plugin).open();
    console.warn("ChatModal is deprecated/removed. Use activateView instead.");
  }

  /**
   * Ensures the NoteChat view exists and is active in the workspace.
   * Slightly different from activateView - might reuse existing leaf.
   */
  public async ensureNoteChatView() {
    const { workspace } = this.plugin.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_SONORIA);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      // Remove `as any` cast
      leaf = workspace.getRightLeaf(false);
      if (!leaf) {
        console.error("Failed to get right leaf for NoteChat view.");
        return;
      }
      await leaf.setViewState({ type: VIEW_TYPE_SONORIA, active: true });
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  /**
   * Activate the chat view with a specific note
   */
  async activateViewWithNote(notePath: string): Promise<void> {
    // First, make sure the view is open
    await this.activateView();
    
    // Then, include the note in the conversation
    try {
      if (this.conversationManager) {
        await this.conversationManager.startConversation(notePath);
        new Notice(`Started chat with note: ${notePath}`);
      }
    } catch (error) {
      console.error('Error starting conversation with note:', error);
      new Notice('Failed to start chat with the note');
    }
  }

  // Commented out - ChatView should get messages via hooks/context
  // /**
  //  * Set initial messages in the chat view
  //  */
  // setInitialMessages() {
  //   // Ensure the view is open and accessible
  //   const leaf = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOTECHAT)[0];
  //   if (!leaf || !leaf.view) {
  //     console.error('Chat view not found or not ready for setInitialMessages.');
  //     return;
  //   }
  // 
  //   // Check if the view has the setMessages method before calling it
  //   // Add type assertion for leaf.view
  //   const noteChatView = leaf.view as NoteChatView;
  //   if (typeof noteChatView.setMessages === 'function') {
  //     const initialMessages = this.plugin.conversationManager?.getMessages() || [];
  //     noteChatView.setMessages(initialMessages);
  //   } else {
  //     console.error('setMessages method not found on the chat view.');
  //   }
  // }
} 