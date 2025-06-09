import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Custom hook to detect clicks outside a specified element.
 *
 * @param ref RefObject pointing to the element to monitor.
 * @param callback Function to call when a click outside is detected.
 */
function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  callback: (event: MouseEvent | TouchEvent) => void
): void {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      callback(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, callback]); // Re-run if ref or callback changes
}

export default useClickOutside; 