import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Calculator, AlertCircle, BarChart3 } from 'lucide-react';
import { ApiService } from '../../services/api';
import { CellInfo, DrillDownResponse, DependencyInfo } from '../../types/api';

interface DrillDownTableProps {
  sessionId: string;
  cellInfo: CellInfo;
}

interface NestedDependencyInfo extends DependencyInfo {
  loading?: boolean;
}

export const DrillDownTable: React.FC<DrillDownTableProps> = ({ sessionId, cellInfo }) => {
  const [drillDownData, setDrillDownData] = useState<DrillDownResponse | null>(null);
  const [dependencies, setDependencies] = useState<NestedDependencyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'table' | 'graph'>('table');

  const loadInitialDrillDown = useCallback(async () => {
    if (!cellInfo.can_drill_down) return;

    setLoading(true);
    setError(null);

    try {
      const data = await ApiService.drillDownCell(
        sessionId,
        cellInfo.sheet_name,
        cellInfo.cell_address,
        1
      );

      setDrillDownData(data);
      
      // Initialize nested dependencies structure
      const nestedDeps: NestedDependencyInfo[] = data.dependencies.map(dep => ({
        ...dep,
        children: [],
        expanded: false,
        loading: false
      }));
      setDependencies(nestedDeps);

    } catch (error: any) {
      setError(error.response?.data?.message || 'Error loading drill-down data');
    } finally {
      setLoading(false);
    }
  }, [sessionId, cellInfo]);

  const expandDependency = useCallback(async (targetCellRef: string) => {
    // Find the dependency in our nested structure
    const updateDependencyInTree = (deps: NestedDependencyInfo[], cellRef: string): NestedDependencyInfo[] => {
      return deps.map(dep => {
        if (dep.cell_reference === cellRef) {
          if (dep.is_leaf || !dep.can_expand) return dep;
          
          return { ...dep, loading: true };
        }
        if (dep.children.length > 0) {
          return { ...dep, children: updateDependencyInTree(dep.children, cellRef) };
        }
        return dep;
      });
    };
    
    // Set loading state
    setDependencies(prev => updateDependencyInTree(prev, targetCellRef));
    
    try {
      // Parse cell reference to get sheet and address
      const [sheetName, cellAddress] = targetCellRef.includes('!') 
        ? targetCellRef.split('!')
        : [cellInfo.sheet_name, targetCellRef];
      
      const data = await ApiService.expandDependency(sessionId, sheetName, cellAddress);
      
      // Update the tree with expanded children
      const updateWithChildren = (deps: NestedDependencyInfo[], cellRef: string): NestedDependencyInfo[] => {
        return deps.map(dep => {
          if (dep.cell_reference === cellRef) {
            const newChildren: NestedDependencyInfo[] = data.dependencies.map(childDep => ({
              ...childDep,
              children: [],
              expanded: false,
              loading: false
            }));
            
            return {
              ...dep,
              expanded: true,
              children: newChildren,
              loading: false
            };
          }
          if (dep.children.length > 0) {
            return { ...dep, children: updateWithChildren(dep.children, cellRef) };
          }
          return dep;
        });
      };
      
      setDependencies(prev => updateWithChildren(prev, targetCellRef));
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error expanding dependency');
      
      // Remove loading state on error
      const removeLoading = (deps: NestedDependencyInfo[], cellRef: string): NestedDependencyInfo[] => {
        return deps.map(dep => {
          if (dep.cell_reference === cellRef) {
            return { ...dep, loading: false };
          }
          if (dep.children.length > 0) {
            return { ...dep, children: removeLoading(dep.children, cellRef) };
          }
          return dep;
        });
      };
      
      setDependencies(prev => removeLoading(prev, targetCellRef));
    }
  }, [sessionId, cellInfo.sheet_name]);

  const toggleExpansion = useCallback((dependency: NestedDependencyInfo) => {
    if (!dependency.expanded && dependency.can_expand) {
      expandDependency(dependency.cell_reference);
    } else if (dependency.expanded) {
      // Collapse the dependency
      const collapseDependency = (deps: NestedDependencyInfo[], cellRef: string): NestedDependencyInfo[] => {
        return deps.map(dep => {
          if (dep.cell_reference === cellRef) {
            return { ...dep, expanded: false };
          }
          if (dep.children.length > 0) {
            return { ...dep, children: collapseDependency(dep.children, cellRef) };
          }
          return dep;
        });
      };
      
      setDependencies(prev => collapseDependency(prev, dependency.cell_reference));
    }
  }, [expandDependency]);

  const renderDependencyRow = (dep: NestedDependencyInfo, level: number = 1): React.ReactElement[] => {
    const levelClass = `dependency-level-${Math.min(level, 5)}`;
    const indentStyle = { paddingLeft: `${level * 16}px` };
    const isLoading = dep.loading || false;

    const rows: React.ReactElement[] = [];
    
    // Render children first (drivers/inputs appear above the formula that uses them)
    if (dep.expanded && dep.children.length > 0) {
      dep.children.forEach(child => {
        rows.push(...renderDependencyRow(child, level + 1));
      });
    }
    
    // Then render the current dependency
    rows.push(
      <tr key={dep.cell_reference} className={`expandable-row ${levelClass}`}>
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200" style={indentStyle}>
          <div className="flex items-center">
            {dep.can_expand && !dep.is_leaf ? (
              <button
                onClick={() => toggleExpansion(dep)}
                className="flex items-center justify-center w-6 h-6 mr-2 hover:bg-gray-100 rounded"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                ) : dep.expanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-6 mr-2"></div>
            )}
            <Calculator className="w-4 h-4 text-gray-400 mr-2" />
            <span className="font-mono text-sm">{dep.cell_reference}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 text-right font-mono">
          {dep.value.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 border-b border-gray-200 font-mono max-w-xs truncate">
          {dep.formula || 'Constant'}
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            dep.is_leaf ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}>
            {dep.is_leaf ? 'Constant' : 'Formula'}
          </span>
        </td>
      </tr>
    );
    
    return rows;
  };

  // Load initial data when component mounts or cellInfo changes
  React.useEffect(() => {
    if (cellInfo.can_drill_down) {
      loadInitialDrillDown();
    }
  }, [cellInfo, loadInitialDrillDown]);

  if (!cellInfo.can_drill_down) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
        <div className="text-center">
          <Calculator className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Dependencies Found</h3>
          <p className="text-gray-600">
            This cell doesn't contain a formula or cannot be analyzed for dependencies.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header with view toggle */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Formula Dependencies: {cellInfo.sheet_name}!{cellInfo.cell_address}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Progressive drill-down analysis - click to expand formula components
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveView('table')}
              className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeView === 'table' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calculator className="w-4 h-4 mr-1" />
              Table
            </button>
            <button
              onClick={() => setActiveView('graph')}
              className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeView === 'graph' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Graph
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-900">{error}</p>
            </div>
          </div>
        )}

        {activeView === 'table' ? (
          <>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center">
                  <div className="spinner mr-3"></div>
                  <span className="text-gray-600">Loading dependencies...</span>
                </div>
              </div>
            ) : drillDownData ? (
              <>
                {/* Source Cell Info */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-blue-900">Source Cell</h4>
                      <p className="text-blue-800 font-mono">{drillDownData.source_cell}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-600">Value</p>
                      <p className="text-lg font-semibold text-blue-900 font-mono">
                        {drillDownData.source_value.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {drillDownData.source_formula && (
                    <div className="mt-2">
                      <p className="text-sm text-blue-600">Formula</p>
                      <p className="text-blue-900 font-mono text-sm break-all">
                        {drillDownData.source_formula}
                      </p>
                    </div>
                  )}
                </div>

                {/* Dependencies Table */}
                {drillDownData.dependencies.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="drill-down-table">
                      <thead>
                        <tr>
                          <th className="text-left">Cell Reference</th>
                          <th className="text-right">Value</th>
                          <th className="text-left">Formula</th>
                          <th className="text-left">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependencies.map(dep => renderDependencyRow(dep, 1)).flat()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calculator className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-gray-600">No dependencies found</p>
                  </div>
                )}
              </>
            ) : null}
          </>
        ) : (
          /* Graph View Placeholder */
          <div className="text-center py-16">
            <BarChart3 className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Graph Visualization</h4>
            <p className="text-gray-600 mb-4">
              Visual dependency graph coming soon!
            </p>
            <div className="text-sm text-gray-500">
              <p>This view will show:</p>
              <ul className="mt-2 space-y-1">
                <li>• Interactive node-link diagram</li>
                <li>• Visual dependency relationships</li>
                <li>• Zoom and pan capabilities</li>
                <li>• Calculation path highlighting</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};