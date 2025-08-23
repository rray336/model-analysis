import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { AnalyzeData } from '../../types/analyzeData';

interface AnalyzeViewProps {
  baselineData: AnalyzeData | null;
  newData: AnalyzeData | null;
  onFileUpload: (file: File) => void;
  baselineFileName: string;
  newFileName: string;
}

export const AnalyzeView: React.FC<AnalyzeViewProps> = ({ baselineData, newData, onFileUpload, baselineFileName, newFileName }) => {
  const [baselineAiSummary, setBaselineAiSummary] = useState<string>('');
  const [newAiSummary, setNewAiSummary] = useState<string>('');
  const [varianceSummary, setVarianceSummary] = useState<string>('');
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const formatValue = (value: number | string): string => {
    if (typeof value === 'string') return value;
    return value.toLocaleString();
  };

  const truncateText = (text: string, maxLength: number = 40): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const renderTable = (data: AnalyzeData | null, title: string, filename: string = '') => (
    <div className="flex-1">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {title}{filename ? ` (${filename})` : ''}
      </h3>
      
      {data && data.rows.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden min-w-0">
          {/* Table Header */}
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-4 gap-2 px-3 py-3">
              <div className="font-semibold text-xs text-gray-700 truncate">CELL REF</div>
              <div className="font-semibold text-xs text-gray-700 truncate">NAME</div>
              <div className="font-semibold text-xs text-gray-700 truncate text-right">VALUE</div>
              <div className="font-semibold text-xs text-gray-700 truncate">FORMULA</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="max-h-96 overflow-y-auto">
            {data.rows.map((row, index) => (
              <div
                key={index}
                className={`grid grid-cols-4 gap-2 px-3 py-2 border-b border-gray-100 last:border-b-0 ${
                  row.rowType === 'formula' 
                    ? 'bg-blue-50 hover:bg-blue-100' 
                    : 'bg-green-50 hover:bg-green-100'
                }`}
              >
                <div className="text-xs font-mono text-gray-900 truncate" title={row.cellReference}>
                  {row.cellReference}
                </div>
                <div className="text-xs text-gray-900 truncate" title={row.name}>
                  {truncateText(row.name, 20)}
                </div>
                <div className="text-xs font-mono text-right text-gray-900 truncate">
                  {formatValue(row.value)}
                </div>
                <div className="text-xs font-mono text-gray-600 truncate" title={row.formula}>
                  {row.formula ? truncateText(row.formula, 25) : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
          <p className="text-gray-500">No data available</p>
          <p className="text-sm text-gray-400 mt-1">
            {title === 'BASELINE' 
              ? 'Analyze dependencies in Label mode first' 
              : 'Upload a new Excel file to compare'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Main Comparison Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-full overflow-hidden">
        {/* BASELINE Section */}
        <div className="space-y-4 min-w-0">
          {/* Spacer to align with Upload button */}
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 border-2 border-transparent rounded-lg text-sm font-medium invisible">
              <div className="w-4 h-4 mr-2" />
              Upload Excel File
            </div>
          </div>
          
          {renderTable(baselineData, 'BASELINE', baselineFileName)}
          
          {/* Baseline AI Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Summary
            </label>
            <textarea
              value={baselineAiSummary}
              onChange={(e) => setBaselineAiSummary(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Paste AI summary of baseline data here..."
            />
          </div>
        </div>

        {/* NEW Section */}
        <div className="space-y-4 min-w-0">
          {/* File Upload */}
          <div className="text-center">
            <label
              className="inline-flex items-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Excel File
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {renderTable(newData, 'NEW', newFileName)}
          
          {/* New AI Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Summary
            </label>
            <textarea
              value={newAiSummary}
              onChange={(e) => setNewAiSummary(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Paste AI summary of new data here..."
            />
          </div>
        </div>
      </div>

      {/* AI Summary of Variance */}
      <div className="border-t border-gray-200 pt-6">
        <div className="max-w-2xl mx-auto">
          <label className="block text-lg font-semibold text-gray-900 mb-3">
            AI Summary of Variance
          </label>
          <textarea
            value={varianceSummary}
            onChange={(e) => setVarianceSummary(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Paste AI variance analysis summary here..."
          />
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex items-center space-x-6 text-xs text-gray-600">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded mr-2"></div>
            <span>Formula cells</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-2"></div>
            <span>Constant cells</span>
          </div>
          <div className="text-gray-500">
            Live updates from Label mode • Values refresh automatically
          </div>
        </div>
      </div>
    </div>
  );
};