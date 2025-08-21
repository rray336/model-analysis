import React, { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { RowValue } from '../../types/api';

interface ColumnSelectDropdownProps {
  rowValues: RowValue[];
  onSelect: (columnLetter: string) => void;
  cellReference: string;
}

export const ColumnSelectDropdown: React.FC<ColumnSelectDropdownProps> = ({
  rowValues,
  onSelect,
  cellReference
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (columnLetter: string) => {
    onSelect(columnLetter);
    setIsOpen(false);
  };

  const meaningfulOptions = rowValues.filter(rv => rv.is_meaningful && rv.value.trim().length > 0);
  const hasGoodOptions = meaningfulOptions.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-1 text-sm border border-gray-300 rounded-md hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
      >
        <span className="text-gray-600 text-xs">Select name column...</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-80 mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-600 font-medium">
              Choose name column for {cellReference}
            </p>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {hasGoodOptions ? (
              <>
                <div className="p-2 border-b border-gray-100">
                  <p className="text-xs text-gray-500 font-medium">Suggested columns:</p>
                </div>
                {meaningfulOptions.map((rv) => (
                  <button
                    key={rv.column}
                    onClick={() => handleSelect(rv.column)}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className="font-mono text-sm font-medium text-blue-600 mr-2">
                          {rv.column}:
                        </span>
                        <span className="text-sm text-gray-900 truncate">
                          "{rv.value}"
                        </span>
                      </div>
                    </div>
                    <Check className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100" />
                  </button>
                ))}
                
                {rowValues.length > meaningfulOptions.length && (
                  <>
                    <div className="p-2 border-b border-gray-100 border-t border-gray-100">
                      <p className="text-xs text-gray-500">All columns:</p>
                    </div>
                    {rowValues.filter(rv => !rv.is_meaningful || rv.value.trim().length === 0).map((rv) => (
                      <button
                        key={rv.column}
                        onClick={() => handleSelect(rv.column)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center">
                            <span className="font-mono text-sm text-gray-500 mr-2">
                              {rv.column}:
                            </span>
                            <span className="text-sm text-gray-400 truncate">
                              {rv.value || '(empty)'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </>
            ) : (
              <div className="p-4 text-center">
                <p className="text-sm text-gray-500">
                  No meaningful column values found
                </p>
                <div className="mt-2 space-y-1">
                  {rowValues.map((rv) => (
                    <button
                      key={rv.column}
                      onClick={() => handleSelect(rv.column)}
                      className="block w-full px-2 py-1 text-left text-xs hover:bg-gray-50 rounded"
                    >
                      <span className="font-mono text-gray-500">{rv.column}:</span>
                      <span className="ml-1 text-gray-400">
                        {rv.value || '(empty)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-2 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};