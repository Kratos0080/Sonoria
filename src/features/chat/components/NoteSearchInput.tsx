import * as React from 'react';

interface NoteSearchInputProps {
  query: string;
  onChange: (newQuery: string) => void;
  placeholder?: string;
}

/**
 * Simple input component for note search query.
 */
function NoteSearchInput({ 
  query, 
  onChange, 
  placeholder = "Type to search notes. Notes in context won't appear."
}: NoteSearchInputProps) {
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <input 
      type="text"
      className="notechat-search-input"
      placeholder={placeholder}
      value={query}
      onChange={handleChange}
      aria-label="Search notes. Notes already in context will not appear in the search results."
    />
  );
}

export default NoteSearchInput; 