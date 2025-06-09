import { VoiceModeButton } from './VoiceModeButton';

export function VoiceInputArea() {
  return (
    <div className="voice-input-area">
      <div className="voice-input-area__main">
        {/* Main voice recording button */}
        <VoiceModeButton />
      </div>
    </div>
  );
} 