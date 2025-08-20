import { useState } from 'react';
import { FileUpload } from './components/upload/FileUpload';
import { AnalysisInterface } from './components/analysis/AnalysisInterface';
import { DrillDownTable } from './components/drilldown/DrillDownTable';
import { CellInfo } from './types/api';
import { Calculator } from 'lucide-react';

type AppState = 'upload' | 'analysis' | 'drilldown';

interface AppData {
  sessionId: string;
  sheets: string[];
  cellInfo: CellInfo | null;
}

function App() {
  const [currentState, setCurrentState] = useState<AppState>('upload');
  const [appData, setAppData] = useState<AppData>({
    sessionId: '',
    sheets: [],
    cellInfo: null
  });

  const handleUploadComplete = (sessionId: string, sheets: string[]) => {
    setAppData(prev => ({
      ...prev,
      sessionId,
      sheets
    }));
    setCurrentState('analysis');
  };

  const handleCellAnalyzed = (cellInfo: CellInfo) => {
    setAppData(prev => ({
      ...prev,
      cellInfo
    }));
    setCurrentState('drilldown');
  };

  const handleBackToAnalysis = () => {
    setCurrentState('analysis');
  };

  const handleBackToUpload = () => {
    setAppData({
      sessionId: '',
      sheets: [],
      cellInfo: null
    });
    setCurrentState('upload');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex items-center">
                  <Calculator className="h-8 w-8 text-primary-600" />
                  <h1 className="ml-3 text-xl font-bold text-gray-900">
                    Model Analysis
                  </h1>
                </div>
              </div>
            </div>
            
            {/* Breadcrumb/Status */}
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className={currentState === 'upload' ? 'text-primary-600 font-medium' : ''}>
                Upload
              </span>
              <span>→</span>
              <span className={currentState === 'analysis' ? 'text-primary-600 font-medium' : ''}>
                Analysis
              </span>
              <span>→</span>
              <span className={currentState === 'drilldown' ? 'text-primary-600 font-medium' : ''}>
                Drill-down
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentState === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {currentState === 'analysis' && (
          <AnalysisInterface
            sessionId={appData.sessionId}
            sheets={appData.sheets}
            onBack={handleBackToUpload}
            onCellAnalyzed={handleCellAnalyzed}
          />
        )}

        {currentState === 'drilldown' && appData.cellInfo && (
          <div className="space-y-6">
            <DrillDownTable
              sessionId={appData.sessionId}
              cellInfo={appData.cellInfo}
            />
            
            {/* Back to Analysis Button */}
            <div className="text-center">
              <button
                onClick={handleBackToAnalysis}
                className="btn btn-outline"
              >
                Analyze Different Cell
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>Model Analysis - Single file Excel formula analysis with progressive drill-down</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;