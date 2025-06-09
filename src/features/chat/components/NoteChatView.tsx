import type { WorkspaceLeaf} from 'obsidian';
import { ItemView, Notice } from 'obsidian';
import type { Root} from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { VIEW_TYPE_SONORIA } from '@app/constants';
import type NoteChatPlugin from '@app/main';
import ChatView from './ChatView'; // Corrected relative path if needed
import { ChatProvider /*, ErrorBoundary */ } from '../../../core/context/ChatContext'; // REMOVED: Unused ErrorBoundary import
// REMOVED: Direct CSS import - Obsidian loads CSS from root styles.css only
// import '../../../styles/chat.css';

/**
 * NoteChatView is the main entry point for the chat interface in Obsidian
 * It creates a React root and renders the ChatView component
 */
export class NoteChatView extends ItemView {
  private root: Root | null = null;
  private plugin: NoteChatPlugin;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    // Retrieve plugin instance from global variable
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Null case is handled by throwing an error immediately after.
    this.plugin = window.sonoriaPlugin!;
    if (!this.plugin) {
      // Fallback or error handling if the global variable isn't set
              console.error("Sonoria Error: Plugin instance not found on window object!");
        new Notice("Critical Error: Sonoria plugin instance not found. Please reload Obsidian.");
      // Cannot proceed without the plugin instance
              throw new Error("Sonoria plugin instance not available.");
    }
    this.containerEl.addClass('notechat-plugin-view-container');
  }

  /**
   * Get the type of the view
   */
  getViewType(): string {
    return VIEW_TYPE_SONORIA;
  }

  /**
   * Get the display text for the view
   */
  getDisplayText(): string {
    return 'Sonoria';
  }

  /**
   * Get the icon name for the view
   */
  getIcon(): string {
    return 'message-circle';
  }

  /**
   * Initialize the React application
   */
  async onOpen(): Promise<void> {
    // Create container for React app
    const container = this.containerEl.children[1];
    container.empty();
    container.classList.add('notechat-container');

    // Create React root
    this.root = createRoot(container);
    
    // Render the main ChatView component wrapped in context providers
    this.root.render(
      <ChatProvider plugin={this.plugin}>
        <ChatView onClose={() => this.leaf.detach()} plugin={this.plugin} />
      </ChatProvider>
    );
  }

  /**
   * Clean up React application when view is closed
   */
  async onClose(): Promise<void> {
    // Unmount the React component to avoid memory leaks
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  getViewData() {
    return {}; // Reverting to original placeholder, as root object might not be serializable
  }
} 