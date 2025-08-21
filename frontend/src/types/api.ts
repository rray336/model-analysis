// API response types
export interface UploadResponse {
  session_id: string;
  message: string;
  sheets: string[];
}

export interface CellInfo {
  sheet_name: string;
  cell_address: string;
  value: number | null;
  formula: string | null;
  can_drill_down: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  has_external_refs: boolean;
}

export interface RowValue {
  column: string;
  value: string;
  is_meaningful: boolean;
}

export interface AINameResult {
  cell_reference: string;
  suggested_name?: string;
  confidence: number;
  status: 'success' | 'failed';
  error_message?: string;
}

export interface AIBatchResult {
  results: Record<string, AINameResult>;
  failed_cells: string[];
  processing_stats: {
    total_cells: number;
    successful: number;
    failed: number;
  };
}

export interface DependencyInfo {
  name: string;
  cell_reference: string;
  value: number;
  formula: string | null;
  is_leaf: boolean;
  can_expand: boolean;
  depth: number;
  children: DependencyInfo[];
  expanded: boolean;
  resolved_name?: string;
  name_source?: string;
  row_values?: RowValue[];
  ai_name?: string;
  ai_confidence?: number;
  ai_status?: 'success' | 'failed';
  is_manually_edited?: boolean;
}

export interface DrillDownResponse {
  source_cell: string;
  source_value: number;
  source_formula: string | null;
  dependencies: DependencyInfo[];
  depth: number;
  total_dependencies: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: string;
}

// Component state types
export interface UploadState {
  file: File | null;
  uploading: boolean;
  error: string | null;
  progress: number;
}

export interface AnalysisState {
  sessionId: string;
  sheets: string[];
  selectedSheet: string;
  cellAddress: string;
  cellInfo: CellInfo | null;
  drillDownData: DrillDownResponse | null;
  loading: boolean;
  error: string | null;
}