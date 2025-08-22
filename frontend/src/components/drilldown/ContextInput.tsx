import React, { useState } from 'react';

interface ContextInputProps {
  value?: string;
  cellReference: string;
  sessionId: string;
  sheetName: string;
  onSave: (cellReference: string, contextText: string) => void;
}

export const ContextInput: React.FC<ContextInputProps> = ({ 
  value = '', 
  cellReference, 
  onSave 
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  const handleSave = () => {
    if (inputValue.trim() !== value) {
      onSave(cellReference, inputValue.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setInputValue(value);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    handleSave();
  };

  return (
    <input
      type="text"
      value={isFocused ? inputValue : (inputValue || '')}
      placeholder={isFocused ? 'Enter context...' : 'Context...'}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      className="w-full px-1 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      title={inputValue || 'Enter context information'}
    />
  );
};