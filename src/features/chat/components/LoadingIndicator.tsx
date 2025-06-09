import * as React from 'react';
import type { LoadingIndicatorProps } from '../../../core/types/components';

/**
 * Loading indicator component that displays a loading animation
 * with an optional message.
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  size = 'medium'
}) => {
  const sizeClass = `notechat-loading-${size}`;
  
  return (
    <div className={`loading-message ${sizeClass}`}>
      <div className="loading-indicator">
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
        <div className="loading-dot"></div>
      </div>
      {message && <div className="loading-text">{message}</div>}
    </div>
  );
};

export default LoadingIndicator; 