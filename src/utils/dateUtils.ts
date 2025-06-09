/**
 * Utility functions for date and time formatting
 */

/**
 * Formats a date in the "Date MM-DD-YYYY time HH:MM:SS" format
 * @param date The date to format (defaults to now)
 * @returns Formatted date string
 */
export function formatDateForNote(date: Date = new Date()): string {
  return `Date ${date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  })} time ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })}`;
}

/**
 * Formats a date in a shorter format for UI display
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Formats a date into a readable string
 * @param date The date to format
 * @param format Optional formatting style
 * @returns Formatted date string
 */
export function formatDate(date: Date | number | string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'object' ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    case 'long':
      return dateObj.toLocaleString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    
    case 'medium':
    default:
      return dateObj.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit'
      });
  }
}

/**
 * Returns a relative time string (e.g., "2 hours ago")
 * @param date The date to format
 * @returns Relative time string
 */
export function getRelativeTime(date: Date | number | string): string {
  if (!date) return '';
  
  const dateObj = typeof date === 'object' ? date : new Date(date);
  const now = new Date();
  
  if (isNaN(dateObj.getTime())) {
    return '';
  }
  
  const diffSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
  
  if (diffSeconds < 60) {
    return 'just now';
  } else if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  } else if (diffSeconds < 604800) {
    const days = Math.floor(diffSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  } else {
    return formatDate(dateObj);
  }
}

/**
 * Formats a date specifically for use in filenames (using hyphens instead of slashes)
 * @param date The date to format (defaults to now)
 * @returns Filename-safe formatted date string (MM-DD-YYYY-HH-MM-SS)
 */
export function formatDateForFilename(date: Date = new Date()): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${month}-${day}-${year}-${hours}-${minutes}-${seconds}`;
} 