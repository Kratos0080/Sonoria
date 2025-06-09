import { Save, RefreshCw } from 'lucide-react';

interface HeaderActionsProps {
  onSaveConversation: () => void; // Placeholder - will be connected later
  onRecycleContext: () => void; // Placeholder - will be connected later
  isRecycling?: boolean; // Loading state for recycle button
}

/**
 * Renders the action icons (Save, Recycle) for the Chat Header.
 */
function HeaderActions({ onSaveConversation, onRecycleContext, isRecycling = false }: HeaderActionsProps) {
  return (
    <div className="notechat-header-actions">
      <button
        onClick={onSaveConversation}
        className="notechat-button-icon notechat-header__action-icon notechat-header__action-icon--save"
        aria-label="Save Conversation"
        title="Save Conversation"
      >
        <Save size={16} />
      </button>
      <button
        onClick={onRecycleContext}
        className={`notechat-button-icon notechat-header__action-icon notechat-header__action-icon--recycle${isRecycling ? ' loading-recycling' : ''}`}
        aria-label="Clear Context & History"
        title={isRecycling ? "Clearing Context & History..." : "Clear Context & History"}
        disabled={isRecycling}
      >
        <RefreshCw size={16} />
      </button>
      {/* Add placeholder for potential third icon (?) from design if needed */}
    </div>
  );
}

export default HeaderActions; 