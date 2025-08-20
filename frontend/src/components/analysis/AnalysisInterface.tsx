import React, { useState, useCallback } from 'react';
import { Search, AlertCircle, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { ApiService } from '../../services/api';
import { AnalysisState, CellInfo } from '../../types/api';

interface AnalysisInterfaceProps {
  sessionId: string;
  sheets: string[];
  onBack: () => void;
  onCellAnalyzed: (cellInfo: CellInfo) => void;
}

export const AnalysisInterface: React.FC<AnalysisInterfaceProps> = ({
  sessionId,
  sheets,
  onBack,
  onCellAnalyzed
}) => {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    sessionId,
    sheets,
    selectedSheet: sheets[0] || '',
    cellAddress: '',
    cellInfo: null,
    drillDownData: null,
    loading: false,
    error: null
  });

  const handleSheetChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    setAnalysisState(prev => ({
      ...prev,
      selectedSheet: event.target.value,
      cellAddress: '',
      cellInfo: null,
      error: null
    }));
  }, []);

  const handleCellAddressChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.toUpperCase();
    // Basic validation: only allow letters followed by numbers
    const isValid = /^[A-Z]*\d*$/.test(value);
    
    if (isValid) {
      setAnalysisState(prev => ({
        ...prev,
        cellAddress: value,
        error: null
      }));
    }
  }, []);

  const validateCellAddress = (address: string): boolean => {
    // Validate cell address format (A1, B5, AC123, etc.)
    const pattern = /^[A-Z]+\d+$/;
    return pattern.test(address);
  };

  const handleAnalyzeCell = async () => {
    if (!analysisState.selectedSheet) {
      setAnalysisState(prev => ({ ...prev, error: 'Please select a sheet' }));
      return;
    }

    if (!analysisState.cellAddress) {
      setAnalysisState(prev => ({ ...prev, error: 'Please enter a cell address' }));
      return;
    }

    if (!validateCellAddress(analysisState.cellAddress)) {
      setAnalysisState(prev => ({ 
        ...prev, 
        error: 'Invalid cell address format. Use format like A1, B5, AC123' 
      }));
      return;
    }

    setAnalysisState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const cellInfo = await ApiService.analyzeCell(
        sessionId,
        analysisState.selectedSheet,
        analysisState.cellAddress
      );

      setAnalysisState(prev => ({ 
        ...prev, 
        loading: false, 
        cellInfo 
      }));

      onCellAnalyzed(cellInfo);

    } catch (error: any) {
      setAnalysisState(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.message || 'Error analyzing cell'
      }));
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleAnalyzeCell();
    }
  };

  const canAnalyze = analysisState.selectedSheet && analysisState.cellAddress && !analysisState.loading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="btn btn-outline btn-sm mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Cell Analysis</h2>
              <p className="text-sm text-gray-600 mt-1">
                Select a sheet and enter a cell address to analyze formula dependencies
              </p>
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <FileSpreadsheet className="h-4 w-4 mr-1" />
            {sheets.length} sheet{sheets.length !== 1 ? 's' : ''} available
          </div>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Sheet Selector */}
          <div>
            <label htmlFor="sheet-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Sheet
            </label>
            <select
              id="sheet-select"
              value={analysisState.selectedSheet}
              onChange={handleSheetChange}
              className="select"
            >
              {sheets.map((sheet) => (
                <option key={sheet} value={sheet}>
                  {sheet}
                </option>
              ))}
            </select>
          </div>

          {/* Cell Address Input */}
          <div>
            <label htmlFor="cell-input" className="block text-sm font-medium text-gray-700 mb-1">
              Cell Address
            </label>
            <input
              id="cell-input"
              type="text"
              value={analysisState.cellAddress}
              onChange={handleCellAddressChange}
              onKeyPress={handleKeyPress}
              placeholder="A1, B5, AC123..."
              className="input"
              maxLength={10}
            />
          </div>

          {/* Analyze Button */}
          <div>
            <button
              onClick={handleAnalyzeCell}
              disabled={!canAnalyze}
              className={`btn btn-primary w-full ${!canAnalyze ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {analysisState.loading ? (
                <div className="flex items-center justify-center">
                  <div className="spinner mr-2"></div>
                  Analyzing...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Search className="h-4 w-4 mr-2" />
                  Analyze Cell
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {analysisState.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-900">{analysisState.error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Cell Information Display */}
      {analysisState.cellInfo && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Cell Information: {analysisState.cellInfo.sheet_name}!{analysisState.cellInfo.cell_address}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Value */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">Value</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {analysisState.cellInfo.value !== null ? 
                  analysisState.cellInfo.value.toLocaleString() : 
                  'No value'
                }
              </div>
            </div>

            {/* Formula */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">Formula</div>
              <div className="text-sm font-mono text-gray-900 mt-1 break-all">
                {analysisState.cellInfo.formula || 'No formula'}
              </div>
            </div>

            {/* Complexity */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">Complexity</div>
              <div className="mt-1">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  analysisState.cellInfo.complexity === 'simple' ? 'bg-green-100 text-green-800' :
                  analysisState.cellInfo.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysisState.cellInfo.complexity}
                </span>
              </div>
            </div>

            {/* Drill-down Capability */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 font-medium">Can Drill Down</div>
              <div className="mt-1">
                {analysisState.cellInfo.can_drill_down ? (
                  <span className="text-green-600 font-semibold">Yes</span>
                ) : (
                  <span className="text-gray-500">No</span>
                )}
              </div>
            </div>
          </div>

          {/* External References Warning */}
          {analysisState.cellInfo.has_external_refs && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
                <p className="text-sm text-yellow-900">
                  This cell contains external file references. Drill-down may be limited.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};