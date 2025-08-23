import React, { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, Calculator, AlertCircle, BarChart3, Sparkles, Camera, ToggleLeft, ToggleRight } from 'lucide-react';
import { ApiService } from '../../services/api';
import { CellInfo, DrillDownResponse, DependencyInfo } from '../../types/api';
import { ColumnSelectDropdown } from './ColumnSelectDropdown';
import { RowValueDropdown } from './RowValueDropdown';
import { ContextInput } from './ContextInput';
import { AnalyzeView } from '../analyze/AnalyzeView';
import { AnalyzeData, AnalyzeRow } from '../../types/analyzeData';

interface DrillDownTableProps {
  sessionId: string;
  cellInfo: CellInfo;
}

interface NestedDependencyInfo extends DependencyInfo {
  loading?: boolean;
  uniqueId?: string;
}

// Utility function to generate unique IDs for dependency rows
const generateUniqueId = (cellRef: string, parentId?: string, index?: number): string => {
  const cleanCellRef = cellRef.replace('!', '_');
  if (parentId) {
    return `${parentId}_${cleanCellRef}_${index || 0}`;
  }
  return `root_${cleanCellRef}_${index || 0}`;
};

// Utility function to assign unique IDs to dependencies recursively
const assignUniqueIds = (deps: DependencyInfo[], parentId: string = 'root'): NestedDependencyInfo[] => {
  return deps.map((dep, index) => {
    const uniqueId = generateUniqueId(dep.cell_reference, parentId, index);
    return {
      ...dep,
      children: [],
      expanded: false,
      loading: false,
      uniqueId
    };
  });
};

// Utility function to extract column letter from cell reference
const extractColumnLetter = (cellReference: string): string => {
  // Handle sheet reference like "Sheet1!BT71" or just "BT71"
  const cellPart = cellReference.includes('!') ? cellReference.split('!')[1] : cellReference;
  // Extract just the column letters (e.g., "BT" from "BT71")
  const match = cellPart.match(/^([A-Z]+)\d+$/);
  return match ? match[1] : 'A';
};

const extractRowNumber = (cellReference: string): number => {
  // Handle sheet reference like "Sheet1!BT71" or just "BT71"
  const cellPart = cellReference.includes('!') ? cellReference.split('!')[1] : cellReference;
  // Extract just the row number (e.g., "71" from "BT71")
  const match = cellPart.match(/^[A-Z]+(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
};


export const DrillDownTable: React.FC<DrillDownTableProps> = ({ sessionId, cellInfo }) => {
  const [drillDownData, setDrillDownData] = useState<DrillDownResponse | null>(null);
  const [dependencies, setDependencies] = useState<NestedDependencyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'label' | 'analyze'>('label');
  const [, setNamingConfig] = useState<Record<string, string>>({});
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccess, setAiSuccess] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [nameDisplayMode, setNameDisplayMode] = useState<'manual' | 'ai'>('manual');
  const [showManualComponents, setShowManualComponents] = useState(true);
  const [sourceCellName, setSourceCellName] = useState<string>('Source Cell');
  const [sourceCellManuallyEdited, setSourceCellManuallyEdited] = useState<boolean>(false);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeData | null>(null);

  const loadNamingConfig = useCallback(async () => {
    try {
      const config = await ApiService.getNamingConfig(sessionId);
      setNamingConfig(config.naming_config);
    } catch (error) {
      console.error('Error loading naming config:', error);
    }
  }, [sessionId]);

  // Helper function to collect all cell references from dependencies tree
  const collectAllCellRefs = useCallback((deps: NestedDependencyInfo[]): string[] => {
    const refs: string[] = [];
    deps.forEach(dep => {
      refs.push(dep.cell_reference);
      if (dep.children && dep.children.length > 0) {
        refs.push(...collectAllCellRefs(dep.children));
      }
    });
    return refs;
  }, []);

  const updateResolvedNames = useCallback((nameResults: Record<string, any>) => {
    // Update resolved names in the dependencies state without resetting the tree structure
    const updateDependenciesRecursively = (deps: NestedDependencyInfo[]): NestedDependencyInfo[] => {
      return deps.map(dep => {
        let updatedDep = { ...dep };
        
        // Check if this dependency has name result
        if (nameResults[dep.cell_reference]) {
          const nameResult = nameResults[dep.cell_reference];
          updatedDep = {
            ...updatedDep,
            resolved_name: nameResult.resolved_name,
            name_source: nameResult.name_source,
            row_values: nameResult.row_values,
            // Update three-component naming fields
            context_name: nameResult.context_name,
            row_value_name: nameResult.row_value_name,
            column_value_name: nameResult.column_value_name
          };
        }
        
        // Recursively update children
        if (updatedDep.children && updatedDep.children.length > 0) {
          updatedDep.children = updateDependenciesRecursively(updatedDep.children);
        }
        
        return updatedDep;
      });
    };
    
    setDependencies(prev => updateDependenciesRecursively(prev));
  }, []);

  // Name resolution logic based on toggle state
  const getDisplayName = useCallback((dependency: NestedDependencyInfo): { name: string; source: 'manual' | 'ai' | 'fallback' } => {
    if (nameDisplayMode === 'ai') {
      if (dependency.ai_name && dependency.ai_name.trim()) {
        return { name: dependency.ai_name, source: 'ai' };
      } else if (dependency.resolved_name && dependency.resolved_name.trim()) {
        return { name: dependency.resolved_name, source: 'manual' };
      }
    } else {
      if (dependency.resolved_name && dependency.resolved_name.trim()) {
        return { name: dependency.resolved_name, source: 'manual' };
      }
    }
    return { name: dependency.cell_reference, source: 'fallback' };
  }, [nameDisplayMode]);

  // Extract data for Analyze mode with live updates - preserves EXACT table rendering order
  const extractAnalyzeData = useCallback((): AnalyzeData | null => {
    if (!drillDownData) return null;
    
    const rows: AnalyzeRow[] = [];
    
    // This function mirrors the EXACT same logic as the table rendering
    const collectInRenderingOrder = (deps: NestedDependencyInfo[], depth: number = 0) => {
      console.log(`Collecting at depth ${depth}:`, deps.map(d => `${d.cell_reference}(expanded: ${d.expanded})`));
      
      deps.forEach(dep => {
        // If expanded, add its children FIRST (matches table rendering order)
        if (dep.expanded && dep.children && dep.children.length > 0) {
          console.log(`${dep.cell_reference} is expanded, adding ${dep.children.length} children first`);
          collectInRenderingOrder(dep.children, depth + 1);
        }
        
        // Then add the current dependency (matches table row rendering)
        const displayInfo = getDisplayName(dep);
        const hasFormula = dep.formula && dep.formula.trim();
        
        console.log(`Adding to analyze: ${dep.cell_reference} - ${displayInfo.name}`);
        
        rows.push({
          cellReference: dep.cell_reference,
          name: displayInfo.name,
          value: dep.value,
          formula: dep.formula || '',
          rowType: hasFormula ? 'formula' : 'constant'
        });
      });
    };
    
    // Collect all visible dependency rows in exact rendering order
    collectInRenderingOrder(dependencies);
    
    // Add source cell row at the end (matches table structure)
    const sourceHasFormula = drillDownData.source_formula && drillDownData.source_formula.trim();
    rows.push({
      cellReference: drillDownData.source_cell,
      name: sourceCellName,
      value: drillDownData.source_value,
      formula: drillDownData.source_formula || '',
      rowType: sourceHasFormula ? 'formula' : 'constant'
    });
    
    return {
      rows,
      sourceCell: drillDownData.source_cell,
      extractedAt: Date.now()
    };
  }, [dependencies, drillDownData, sourceCellName, getDisplayName]);

  // Update analyze data whenever Label mode data changes
  React.useEffect(() => {
    const newAnalyzeData = extractAnalyzeData();
    setAnalyzeData(newAnalyzeData);
  }, [extractAnalyzeData]);

  const handleColumnSelect = useCallback(async (cellReference: string, columnLetter: string) => {
    try {
      // Parse cell reference to get sheet name
      const [sheetName] = cellReference.includes('!') 
        ? cellReference.split('!')
        : [cellInfo.sheet_name];
      
      await ApiService.configureSheetNaming(sessionId, sheetName, columnLetter);
      
      // Update local naming config
      setNamingConfig(prev => ({
        ...prev,
        [sheetName]: columnLetter
      }));
      
      // Instead of full reload, update resolved names in-place
      // Collect all cell references from current tree
      const allCellRefs = collectAllCellRefs(dependencies);
      
      if (allCellRefs.length > 0) {
        // Fetch updated resolved names from the backend
        const resolvedNamesResponse = await ApiService.getResolvedNames(sessionId, allCellRefs);
        
        // Update the tree structure without full reload
        updateResolvedNames(resolvedNamesResponse.results);
      }
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error configuring sheet naming');
    }
  }, [sessionId, cellInfo.sheet_name, dependencies, collectAllCellRefs, updateResolvedNames]);

  const handleContextSave = useCallback(async (cellReference: string, contextText: string) => {
    try {
      // Parse cell reference to get sheet name and cell address
      const [sheetName, cellAddress] = cellReference.includes('!') 
        ? cellReference.split('!')
        : [cellInfo.sheet_name, cellReference];
      
      await ApiService.setContextName(sessionId, sheetName, cellAddress, contextText);
      
      // Update resolved names to reflect the change
      const allCellRefs = collectAllCellRefs(dependencies);
      if (allCellRefs.length > 0) {
        const resolvedNamesResponse = await ApiService.getResolvedNames(sessionId, allCellRefs);
        updateResolvedNames(resolvedNamesResponse.results);
      }
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error setting context name');
    }
  }, [sessionId, cellInfo.sheet_name, dependencies, collectAllCellRefs, updateResolvedNames]);

  const handleRowValueSelect = useCallback(async (cellReference: string, _selectedValue: string, selectedRow: number) => {
    try {
      // Parse cell reference to get sheet name
      const [sheetName] = cellReference.includes('!') 
        ? cellReference.split('!')
        : [cellInfo.sheet_name];
      
      // Configure sheet-level row naming (this affects all cells in the sheet)
      await ApiService.configureSheetRowNaming(sessionId, sheetName, selectedRow);
      
      // Update resolved names to reflect the change for all cells
      const allCellRefs = collectAllCellRefs(dependencies);
      if (allCellRefs.length > 0) {
        const resolvedNamesResponse = await ApiService.getResolvedNames(sessionId, allCellRefs);
        updateResolvedNames(resolvedNamesResponse.results);
      }
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error configuring sheet row naming');
    }
  }, [sessionId, cellInfo.sheet_name, dependencies, collectAllCellRefs, updateResolvedNames]);

  const reloadDrillDownData = useCallback(async () => {
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
      
      // Initialize nested dependencies structure with unique IDs
      const nestedDeps = assignUniqueIds(data.dependencies, 'root');
      setDependencies(nestedDeps);

    } catch (error: any) {
      setError(error.response?.data?.message || 'Error loading drill-down data');
    } finally {
      setLoading(false);
    }
  }, [sessionId, cellInfo]);

  const updateAINames = useCallback((aiResults: Record<string, any>) => {
    // Update AI names in the dependencies state without resetting the tree structure
    const updateDependenciesRecursively = (deps: NestedDependencyInfo[]): NestedDependencyInfo[] => {
      return deps.map(dep => {
        let updatedDep = { ...dep };
        
        // Check if this dependency has AI result
        if (aiResults[dep.cell_reference]) {
          const aiResult = aiResults[dep.cell_reference];
          updatedDep = {
            ...updatedDep,
            ai_name: aiResult.suggested_name,
            ai_confidence: aiResult.confidence,
            ai_status: aiResult.status,
            is_manually_edited: false // Reset manual edit flag for new AI names
          };
        }
        
        // Recursively update children
        if (updatedDep.children && updatedDep.children.length > 0) {
          updatedDep.children = updateDependenciesRecursively(updatedDep.children);
        }
        
        return updatedDep;
      });
    };
    
    setDependencies(prev => updateDependenciesRecursively(prev));
  }, []);

  const handleAIGeneration = useCallback(async () => {
    if (!drillDownData || aiGenerating) return;
    
    setAiGenerating(true);
    setAiError(null);
    setAiSuccess(null);
    
    try {
      // Collect all cell references from current dependencies
      const collectCellRefs = (deps: NestedDependencyInfo[]): string[] => {
        const refs: string[] = [];
        deps.forEach(dep => {
          refs.push(dep.cell_reference);
          if (dep.children && dep.children.length > 0) {
            refs.push(...collectCellRefs(dep.children));
          }
        });
        return refs;
      };
      
      const allCellRefs = collectCellRefs(dependencies);
      
      if (allCellRefs.length === 0) {
        setAiError('No cells available for AI naming');
        return;
      }
      
      // Call AI naming API
      const result = await ApiService.generateAINames(
        sessionId,
        cellInfo.sheet_name,
        allCellRefs
      );
      
      if (result.processing_stats.successful > 0) {
        // Update AI names in place without reloading the entire table
        updateAINames(result.results);
        setAiSuccess(`Successfully generated AI names for ${result.processing_stats.successful} cells!`);
      }
      
      if (result.processing_stats.failed > 0) {
        setAiError(`Generated names for ${result.processing_stats.successful} cells. ${result.processing_stats.failed} failed.`);
      }
      
    } catch (error: any) {
      setAiError(error.response?.data?.message || 'Failed to generate AI names');
    } finally {
      setAiGenerating(false);
    }
  }, [sessionId, cellInfo.sheet_name, drillDownData, dependencies, aiGenerating, updateAINames]);

  const handleDebugScreenshot = useCallback(async () => {
    if (!drillDownData) return;
    
    try {
      // Collect all cell references from current dependencies
      const collectCellRefs = (deps: NestedDependencyInfo[]): string[] => {
        const refs: string[] = [];
        deps.forEach(dep => {
          refs.push(dep.cell_reference);
          if (dep.children && dep.children.length > 0) {
            refs.push(...collectCellRefs(dep.children));
          }
        });
        return refs;
      };
      
      const allCellRefs = collectCellRefs(dependencies);
      const cellRefsString = allCellRefs.join(',');
      
      const result = await ApiService.debugScreenshot(
        sessionId,
        cellInfo.sheet_name,
        cellRefsString
      );
      
      // Create a new window to display the screenshot
      const newWindow = window.open('', '_blank', 'width=800,height=600');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Debug Screenshot - ${result.sheet_name}</title></head>
            <body style="margin: 20px; font-family: Arial, sans-serif;">
              <h2>Debug Screenshot: ${result.sheet_name}</h2>
              <p><strong>File saved to:</strong> ${result.file_path}</p>
              <p><strong>Target cells:</strong> ${result.target_cells.join(', ')}</p>
              <p><strong>Size:</strong> ${(result.size_bytes / 1024).toFixed(1)} KB</p>
              <img src="data:image/png;base64,${result.screenshot_base64}" style="max-width: 100%; border: 1px solid #ccc;" />
            </body>
          </html>
        `);
      }
      
      setAiSuccess(`Screenshot saved to: ${result.file_path}`);
      
    } catch (error: any) {
      setAiError(error.response?.data?.message || 'Failed to generate debug screenshot');
    }
  }, [sessionId, cellInfo.sheet_name, drillDownData, dependencies]);

  const handleStartEdit = useCallback((cellRef: string, currentName: string) => {
    setEditingCell(cellRef);
    setEditValue(currentName || '');
  }, []);

  const handleSaveEdit = useCallback(async (cellRef: string) => {
    if (!editValue.trim()) {
      setEditingCell(null);
      return;
    }

    try {
      await ApiService.markManualEdit(sessionId, cellInfo.sheet_name, cellRef, editValue.trim());
      
      // Check if this is the source cell
      if (drillDownData && cellRef === drillDownData.source_cell) {
        // Update source cell name state
        setSourceCellName(editValue.trim());
        setSourceCellManuallyEdited(true);
      } else {
        // Update local state to show manual edit immediately for dependency cells
        setDependencies(prev => {
          const updateDependency = (deps: NestedDependencyInfo[]): NestedDependencyInfo[] => {
            return deps.map(dep => {
              if (dep.cell_reference === cellRef) {
                return {
                  ...dep,
                  ai_name: editValue.trim(),
                  is_manually_edited: true,
                  ai_status: 'success' as const
                };
              }
              if (dep.children.length > 0) {
                return { ...dep, children: updateDependency(dep.children) };
              }
              return dep;
            });
          };
          return updateDependency(prev);
        });
      }

      setEditingCell(null);
      setEditValue('');
    } catch (error: any) {
      setAiError(error.response?.data?.message || 'Failed to save manual edit');
    }
  }, [sessionId, cellInfo.sheet_name, editValue, drillDownData]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue('');
  }, []);

  const loadInitialDrillDown = reloadDrillDownData;

  const expandDependency = useCallback(async (targetUniqueId: string) => {
    // Find the dependency by unique ID in our nested structure
    const updateDependencyInTree = (deps: NestedDependencyInfo[], uniqueId: string): NestedDependencyInfo[] => {
      return deps.map(dep => {
        if (dep.uniqueId === uniqueId) {
          if (dep.is_leaf || !dep.can_expand) return dep;
          
          return { ...dep, loading: true };
        }
        if (dep.children.length > 0) {
          return { ...dep, children: updateDependencyInTree(dep.children, uniqueId) };
        }
        return dep;
      });
    };
    
    // Find the dependency to get its cell reference
    const findDependencyByUniqueId = (deps: NestedDependencyInfo[], uniqueId: string): NestedDependencyInfo | null => {
      for (const dep of deps) {
        if (dep.uniqueId === uniqueId) {
          return dep;
        }
        if (dep.children.length > 0) {
          const found = findDependencyByUniqueId(dep.children, uniqueId);
          if (found) return found;
        }
      }
      return null;
    };
    
    const targetDep = findDependencyByUniqueId(dependencies, targetUniqueId);
    if (!targetDep) {
      console.error('Could not find dependency with unique ID:', targetUniqueId);
      return;
    }
    
    // Set loading state
    setDependencies(prev => updateDependencyInTree(prev, targetUniqueId));
    
    try {
      // Parse cell reference to get sheet and address
      const [sheetName, cellAddress] = targetDep.cell_reference.includes('!') 
        ? targetDep.cell_reference.split('!')
        : [cellInfo.sheet_name, targetDep.cell_reference];
      
      const data = await ApiService.expandDependency(sessionId, sheetName, cellAddress);
      
      // Update the tree with expanded children
      const updateWithChildren = (deps: NestedDependencyInfo[], uniqueId: string): NestedDependencyInfo[] => {
        return deps.map(dep => {
          if (dep.uniqueId === uniqueId) {
            // Assign unique IDs to new children based on parent's unique ID
            const newChildren = assignUniqueIds(data.dependencies, dep.uniqueId);
            
            return {
              ...dep,
              expanded: true,
              children: newChildren,
              loading: false
            };
          }
          if (dep.children.length > 0) {
            return { ...dep, children: updateWithChildren(dep.children, uniqueId) };
          }
          return dep;
        });
      };
      
      setDependencies(prev => updateWithChildren(prev, targetUniqueId));
      
    } catch (error: any) {
      setError(error.response?.data?.message || 'Error expanding dependency');
      
      // Remove loading state on error
      const removeLoading = (deps: NestedDependencyInfo[], uniqueId: string): NestedDependencyInfo[] => {
        return deps.map(dep => {
          if (dep.uniqueId === uniqueId) {
            return { ...dep, loading: false };
          }
          if (dep.children.length > 0) {
            return { ...dep, children: removeLoading(dep.children, uniqueId) };
          }
          return dep;
        });
      };
      
      setDependencies(prev => removeLoading(prev, targetUniqueId));
    }
  }, [sessionId, cellInfo.sheet_name, dependencies]);

  const toggleExpansion = useCallback((dependency: NestedDependencyInfo) => {
    if (!dependency.expanded && dependency.can_expand && dependency.uniqueId) {
      expandDependency(dependency.uniqueId);
    } else if (dependency.expanded && dependency.uniqueId) {
      // Collapse the dependency
      const collapseDependency = (deps: NestedDependencyInfo[], uniqueId: string): NestedDependencyInfo[] => {
        return deps.map(dep => {
          if (dep.uniqueId === uniqueId) {
            return { ...dep, expanded: false };
          }
          if (dep.children.length > 0) {
            return { ...dep, children: collapseDependency(dep.children, uniqueId) };
          }
          return dep;
        });
      };
      
      setDependencies(prev => collapseDependency(prev, dependency.uniqueId!));
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
      <tr key={dep.uniqueId || dep.cell_reference} className={`expandable-row ${levelClass}`}>
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
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
          {(() => {
            const displayInfo = getDisplayName(dep);
            
            // Handle editing state
            if (editingCell === dep.cell_reference) {
              return (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit(dep.cell_reference);
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(dep.cell_reference)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    ✕
                  </button>
                </div>
              );
            }
            
            // Manual names mode - Four column layout
            if (nameDisplayMode === 'manual') {
              // Compute concatenated name from components
              const computeManualName = (dep: NestedDependencyInfo) => {
                const parts = [];
                if (dep.context_name && dep.context_name.trim()) {
                  parts.push(dep.context_name.trim());
                }
                if (dep.row_value_name && dep.row_value_name.trim()) {
                  parts.push(dep.row_value_name.trim());
                }
                if (dep.column_value_name && dep.column_value_name.trim()) {
                  parts.push(dep.column_value_name.trim());
                }
                return parts.join(' ');
              };

              const manualName = computeManualName(dep);

              return (
                <div className="flex gap-1">
                  {showManualComponents && (
                    <>
                      {/* Context Input - 1/4 width */}
                      <div className="w-1/4">
                        <ContextInput
                          value={dep.context_name || ''}
                          cellReference={dep.cell_reference}
                          sessionId={sessionId}
                          sheetName={cellInfo.sheet_name}
                          onSave={handleContextSave}
                        />
                      </div>
                      
                      {/* Row Values - 1/4 width */}
                      <div className="w-1/4">
                        {dep.row_value_name ? (
                          <div className="w-full px-1 py-1 text-xs bg-gray-100 border rounded" title={dep.row_value_name}>
                            <span className="block truncate text-gray-700">{dep.row_value_name}</span>
                          </div>
                        ) : (
                          <RowValueDropdown
                            sessionId={sessionId}
                            columnLetter={extractColumnLetter(dep.cell_reference)}
                            sheetName={cellInfo.sheet_name}
                            selectedValue=""
                            cellReference={dep.cell_reference}
                            onSelect={(selectedValue, selectedRow) => handleRowValueSelect(dep.cell_reference, selectedValue, selectedRow)}
                          />
                        )}
                      </div>
                      
                      {/* Column Values - 1/4 width */}
                      <div className="w-1/4">
                        {dep.column_value_name ? (
                          <div className="w-full px-1 py-1 text-xs bg-gray-100 border rounded" title={dep.column_value_name}>
                            <span className="block truncate text-gray-700">{dep.column_value_name}</span>
                          </div>
                        ) : (
                          <ColumnSelectDropdown
                            sessionId={sessionId}
                            sheetName={cellInfo.sheet_name}
                            rowNumber={extractRowNumber(dep.cell_reference)}
                            onSelect={(columnLetter) => handleColumnSelect(dep.cell_reference, columnLetter)}
                            cellReference={dep.cell_reference}
                          />
                        )}
                      </div>
                    </>
                  )}
                  
                  {/* Computed Manual Name - full width when collapsed, 1/4 when expanded */}
                  <div className={showManualComponents ? "w-1/4" : "w-full"}>
                    <div className="w-full px-1 py-1 text-xs bg-blue-50 border rounded" title={manualName || 'No components configured'}>
                      <span className="block truncate text-blue-700 font-medium">
                        {manualName || ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }
            
            // AI names mode
            else {
              if (displayInfo.source === 'ai' && dep.ai_name) {
                return (
                  <div 
                    className="cursor-pointer hover:bg-gray-50 rounded p-1 -m-1"
                    onClick={() => handleStartEdit(dep.cell_reference, dep.ai_name || '')}
                    title="Click to edit AI name"
                  >
                    <span className={`${dep.is_manually_edited ? 'text-red-600 font-medium' : 'text-blue-600 font-medium'}`}>
                      {dep.ai_name}
                    </span>
                    {dep.ai_confidence && !dep.is_manually_edited && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({Math.round(dep.ai_confidence * 100)}%)
                      </span>
                    )}
                    {dep.is_manually_edited && (
                      <span className="text-xs text-red-500 ml-2">(edited)</span>
                    )}
                  </div>
                );
              } else if (displayInfo.source === 'manual' && dep.resolved_name) {
                return (
                  <div>
                    <span className="text-gray-600 font-medium">{dep.resolved_name}</span>
                    <span className="text-xs text-gray-500 ml-2">(manual fallback)</span>
                  </div>
                );
              } else if (dep.ai_status === 'failed') {
                return (
                  <div 
                    className="cursor-pointer hover:bg-gray-50 rounded p-1 -m-1"
                    onClick={() => handleStartEdit(dep.cell_reference, '')}
                    title="Click to add name manually"
                  >
                    <span className="text-red-500 text-xs">AI generation failed</span>
                  </div>
                );
              } else {
                return (
                  <div 
                    className="cursor-pointer hover:bg-gray-50 rounded p-1 -m-1"
                    onClick={() => handleStartEdit(dep.cell_reference, '')}
                    title="Click to add name manually"
                  >
                    <span className="text-gray-400 text-sm italic">{displayInfo.name}</span>
                  </div>
                );
              }
            }
          })()}
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

  const renderSourceCellRow = (): React.ReactElement => {
    if (!drillDownData) return <></>;

    return (
      <tr className="bg-blue-50 border-2 border-blue-200 font-medium">
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          <div className="flex items-center pl-0">
            <span className="font-mono text-sm font-semibold text-blue-800">
              {drillDownData.source_cell} (SOURCE)
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
          {(() => {
            // Handle editing state for source cell
            if (editingCell === drillDownData.source_cell) {
              return (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit(drillDownData.source_cell);
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(drillDownData.source_cell)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✓
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    ✕
                  </button>
                </div>
              );
            }
            
            // Display source cell name with editing capability
            return (
              <div 
                className="cursor-pointer hover:bg-gray-50 rounded p-1 -m-1"
                onClick={() => handleStartEdit(drillDownData.source_cell, sourceCellName)}
                title="Click to edit source cell name"
              >
                <span className={sourceCellManuallyEdited ? 'text-blue-600 font-medium' : 'text-gray-500'}>
                  {sourceCellName}
                </span>
              </div>
            );
          })()}
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200 text-right font-mono">
          <span className="text-blue-800 font-semibold">
            {drillDownData.source_value.toLocaleString()}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 border-b border-gray-200">
          <span className="font-mono text-sm break-all text-blue-700">
            {drillDownData.source_formula || 'No formula'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm border-b border-gray-200">
          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
            Source
          </span>
        </td>
      </tr>
    );
  };

  // Load initial data when component mounts or cellInfo changes
  React.useEffect(() => {
    loadNamingConfig();
    if (cellInfo.can_drill_down) {
      loadInitialDrillDown();
    }
    // Reset source cell name when cell changes
    setSourceCellName('Source Cell');
    setSourceCellManuallyEdited(false);
  }, [cellInfo, loadInitialDrillDown, loadNamingConfig]);

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
              onClick={() => setActiveView('label')}
              className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeView === 'label' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calculator className="w-4 h-4 mr-1" />
              Label
            </button>
            <button
              onClick={() => setActiveView('analyze')}
              className={`flex items-center px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeView === 'analyze' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              Analyze
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

        {aiSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <Sparkles className="h-5 w-5 text-green-500 mr-2" />
              <p className="text-sm text-green-900">{aiSuccess}</p>
            </div>
          </div>
        )}

        {aiError && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
              <p className="text-sm text-yellow-900">{aiError}</p>
            </div>
          </div>
        )}

        {/* AI Generation Button */}
        {drillDownData && drillDownData.dependencies.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-3">
              <button
                onClick={handleAIGeneration}
                disabled={aiGenerating}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors"
              >
                {aiGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Generating AI Names...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    🤖 Generate AI Names
                  </>
                )}
              </button>
              
              <button
                onClick={handleDebugScreenshot}
                className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                title="Generate debug screenshot to see what the AI sees"
              >
                <Camera className="w-4 h-4 mr-1" />
                Debug Screenshot
              </button>
            </div>
            
            {/* Name Display Mode Toggle */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-sm font-medium text-gray-700">Name Display:</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${nameDisplayMode === 'manual' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                  Manual
                </span>
                <button
                  onClick={() => setNameDisplayMode(nameDisplayMode === 'manual' ? 'ai' : 'manual')}
                  className="flex items-center p-1 rounded-full transition-colors hover:bg-gray-100"
                  title={`Switch to ${nameDisplayMode === 'manual' ? 'AI' : 'Manual'} names`}
                >
                  {nameDisplayMode === 'manual' ? (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  ) : (
                    <ToggleRight className="w-6 h-6 text-blue-600" />
                  )}
                </button>
                <span className={`text-sm ${nameDisplayMode === 'ai' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                  AI Generated
                </span>
              </div>
            </div>
            
            <p className="text-xs text-gray-600 mt-2">
              Generate contextual names for all visible cells using AI analysis. Only unprocessed cells will be named.
            </p>
          </div>
        )}

        {activeView === 'label' ? (
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

                {/* Dependencies Table */}
                {drillDownData.dependencies.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="drill-down-table">
                      <thead>
                        <tr>
                          <th className="text-left">Cell Reference</th>
                          <th className="text-left">
                            {nameDisplayMode === 'manual' ? (
                              <div className="flex items-center">
                                <button 
                                  onClick={() => setShowManualComponents(!showManualComponents)}
                                  className="text-gray-400 hover:text-gray-600 text-sm mr-2 flex-shrink-0"
                                  title={showManualComponents ? "Hide components" : "Show components"}
                                >
                                  {showManualComponents ? '⌄' : '>'}
                                </button>
                                <div className="flex gap-1 text-xs text-gray-400 flex-1">
                                  {showManualComponents ? (
                                    <>
                                      <span className="w-1/4">Context</span>
                                      <span className="w-1/4">Row</span>
                                      <span className="w-1/4">Column</span>
                                      <span className="w-1/4">Name (Manual)</span>
                                    </>
                                  ) : (
                                    <span className="w-full">Name (Manual)</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                Name 
                                <span className="text-xs text-gray-500 ml-1">
                                  (AI Generated)
                                </span>
                              </div>
                            )}
                          </th>
                          <th className="text-right">Value</th>
                          <th className="text-left">Formula</th>
                          <th className="text-left">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependencies.map(dep => renderDependencyRow(dep, 1)).flat()}
                        {/* Source Cell Row */}
                        {renderSourceCellRow()}
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
          /* Analyze Mode */
          <AnalyzeView baselineData={analyzeData} />
        )}
      </div>
    </div>
  );
};