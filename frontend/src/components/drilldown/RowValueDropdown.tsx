import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { ApiService } from '../../services/api';

interface RowValue {
  row: string;
  value: string;
  is_meaningful: boolean;
}

interface RowValueDropdownProps {
  sessionId: string;
  columnLetter: string;
  sheetName: string;
  selectedValue?: string;
  cellReference: string;
  onSelect: (selectedValue: string, selectedRow: number) => void;
}

export const RowValueDropdown: React.FC<RowValueDropdownProps> = ({ 
  sessionId, 
  columnLetter, 
  sheetName, 
  selectedValue, 
  onSelect 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rowValues, setRowValues] = useState<RowValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRowValues = async () => {
      try {
        setLoading(true);
        const data = await ApiService.getColumnValues(sessionId, sheetName, columnLetter);
        setRowValues(data.column_values);
      } catch (error) {
        console.error('Error fetching row values:', error);
      } finally {
        setLoading(false);
      }
    };

    if (columnLetter) {
      fetchRowValues();
    }
  }, [sessionId, sheetName, columnLetter]);

  const handleSelect = (value: string, row: string) => {
    const rowNumber = parseInt(row, 10);
    onSelect(value, rowNumber);
    setIsOpen(false);
  };

  const displayValue = selectedValue || 'Row value...';
  
  // Show meaningful values first, then others
  const sortedRowValues = rowValues.sort((a, b) => {
    if (a.is_meaningful && !b.is_meaningful) return -1;
    if (!a.is_meaningful && b.is_meaningful) return 1;
    return parseInt(a.row) - parseInt(b.row);
  });

  if (loading) {
    return (
      <div className="w-full px-1 py-1 text-xs bg-gray-100 border rounded">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="w-full px-1 py-1 text-xs text-left bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-between">
          <span className="block truncate" title={displayValue}>
            {displayValue}
          </span>
          <ChevronDown className="w-3 h-3 ml-1 text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="max-h-32 overflow-y-auto">
            {sortedRowValues.length > 0 ? (
              sortedRowValues.map((rv) => (
                <button
                  key={rv.row}
                  type="button"
                  className="w-full px-2 py-1 text-xs text-left hover:bg-blue-100 focus:outline-none focus:bg-blue-100"
                  onClick={() => handleSelect(rv.value, rv.row)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate" title={rv.value}>
                      {rv.value || `Row ${rv.row} (empty)`}
                    </span>
                    <span className="text-gray-400 text-xs ml-1">
                      R{rv.row}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-2 py-1 text-xs text-gray-500">
                No values found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};