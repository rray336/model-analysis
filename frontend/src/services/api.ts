import axios, { AxiosResponse } from 'axios';
import { UploadResponse, CellInfo, DrillDownResponse, DependencyInfo, RowValue, AIBatchResult } from '../types/api';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class ApiService {
  static async uploadFile(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response: AxiosResponse<UploadResponse> = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }
  
  static async getSheets(sessionId: string): Promise<string[]> {
    const response: AxiosResponse<string[]> = await api.get(`/sheets/${sessionId}`);
    return response.data;
  }
  
  static async analyzeCell(sessionId: string, sheetName: string, cellAddress: string): Promise<CellInfo> {
    const response: AxiosResponse<CellInfo> = await api.get(
      `/analyze/${sessionId}/${encodeURIComponent(sheetName)}/${cellAddress}`
    );
    return response.data;
  }
  
  static async drillDownCell(
    sessionId: string, 
    sheetName: string, 
    cellAddress: string, 
    depth: number = 1
  ): Promise<DrillDownResponse> {
    const response: AxiosResponse<DrillDownResponse> = await api.get(
      `/drill-down/${sessionId}/${encodeURIComponent(sheetName)}/${cellAddress}?depth=${depth}`
    );
    return response.data;
  }
  
  static async expandDependency(
    sessionId: string,
    sheetName: string, 
    cellAddress: string
  ): Promise<{ dependencies: DependencyInfo[] }> {
    const response: AxiosResponse<{ dependencies: DependencyInfo[] }> = await api.post(
      `/expand-dependency/${sessionId}/${encodeURIComponent(sheetName)}/${cellAddress}`
    );
    return response.data;
  }
  
  static async cleanupSession(sessionId: string): Promise<{ message: string }> {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  }
  
  static async getRowValues(
    sessionId: string,
    sheetName: string,
    rowNumber: number
  ): Promise<{ row_values: RowValue[] }> {
    const response = await api.get(
      `/row-values/${sessionId}/${encodeURIComponent(sheetName)}/${rowNumber}`
    );
    return response.data;
  }
  
  static async configureSheetNaming(
    sessionId: string,
    sheetName: string,
    columnLetter: string
  ): Promise<{ message: string; sheet_name: string; column: string }> {
    const response = await api.post(
      `/configure-sheet-naming/${sessionId}/${encodeURIComponent(sheetName)}/${columnLetter}`
    );
    return response.data;
  }
  
  static async getNamingConfig(sessionId: string): Promise<{ naming_config: Record<string, string> }> {
    const response = await api.get(`/naming-config/${sessionId}`);
    return response.data;
  }
  
  static async generateAINames(
    sessionId: string,
    sheetName: string,
    unprocessedCells: string[]
  ): Promise<AIBatchResult & { message: string }> {
    const response = await api.post(
      `/generate-ai-names/${sessionId}/${encodeURIComponent(sheetName)}`,
      {
        session_id: sessionId,
        sheet_name: sheetName,
        unprocessed_cells: unprocessedCells
      }
    );
    return response.data;
  }
  
  static async getAIProcessedCells(
    sessionId: string,
    sheetName: string
  ): Promise<{ processed_cells: string[] }> {
    const response = await api.get(
      `/ai-processed-cells/${sessionId}/${encodeURIComponent(sheetName)}`
    );
    return response.data;
  }
  
  static async markManualEdit(
    sessionId: string,
    sheetName: string,
    cellAddress: string,
    manualName: string
  ): Promise<{ message: string; cell_address: string; manual_name: string }> {
    const response = await api.post(
      `/mark-manual-edit/${sessionId}/${encodeURIComponent(sheetName)}/${cellAddress}`,
      { manual_name: manualName },
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  }
  
  static async debugScreenshot(
    sessionId: string,
    sheetName: string,
    cellRefs: string
  ): Promise<{
    message: string;
    file_path: string;
    sheet_name: string;
    target_cells: string[];
    screenshot_base64: string;
    size_bytes: number;
  }> {
    const response = await api.get(
      `/debug-screenshot/${sessionId}/${encodeURIComponent(sheetName)}?cell_refs=${encodeURIComponent(cellRefs)}`
    );
    return response.data;
  }
  
  static async getResolvedNames(
    sessionId: string,
    cellReferences: string[]
  ): Promise<{ results: Record<string, { 
    resolved_name: string | null; 
    name_source: string | null; 
    row_values: RowValue[] | null;
    context_name: string | null;
    row_value_name: string | null;
    column_value_name: string | null;
  }> }> {
    const response = await api.post(
      `/get-resolved-names/${sessionId}`,
      { cell_references: cellReferences }
    );
    return response.data;
  }
  
  static async getColumnValues(
    sessionId: string,
    sheetName: string,
    columnLetter: string,
    rows: number = 5
  ): Promise<{ column_values: Array<{ row: string; value: string; is_meaningful: boolean }> }> {
    const response = await api.get(
      `/column-values/${sessionId}/${encodeURIComponent(sheetName)}/${columnLetter}?rows=${rows}`
    );
    return response.data;
  }
  
  static async setContextName(
    sessionId: string,
    sheetName: string,
    cellAddress: string,
    contextText: string
  ): Promise<{ message: string; cell_reference: string; context_text: string }> {
    const response = await api.post(
      `/set-context-name/${sessionId}/${encodeURIComponent(sheetName)}/${cellAddress}`,
      { context_text: contextText }
    );
    return response.data;
  }
  
  static async configureSheetRowNaming(
    sessionId: string,
    sheetName: string,
    rowNumber: number
  ): Promise<{ message: string; sheet_name: string; row_number: number }> {
    const response = await api.post(
      `/configure-sheet-row-naming/${sessionId}/${encodeURIComponent(sheetName)}/${rowNumber}`
    );
    return response.data;
  }
  
  static async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await api.get('/health');
    return response.data;
  }
  
  static async getCellValues(sessionId: string, cellReferences: string[]): Promise<{ values: Record<string, number | null> }> {
    const response = await api.post(`/get-cell-values/${sessionId}`, {
      session_id: sessionId,
      cell_references: cellReferences
    });
    return response.data;
  }
  
  static async getSessionInfo(sessionId: string): Promise<{ session_id: string; filename: string; upload_time: string; sheets: string[] }> {
    const response = await api.get(`/session-info/${sessionId}`);
    return response.data;
  }
  
  static async generateBaselineSummary(sessionId: string, baselineData: Array<{ cellReference: string; name: string; value: number | string; formula: string; rowType: string }>): Promise<{ summary: string; status: string; error_message?: string }> {
    const response = await api.post(`/generate-baseline-summary/${sessionId}`, {
      session_id: sessionId,
      baseline_data: baselineData
    });
    return response.data;
  }
  
  static async generateNewSummary(sessionId: string, newData: Array<{ cellReference: string; name: string; value: number | string; formula: string; rowType: string }>): Promise<{ summary: string; status: string; error_message?: string }> {
    const response = await api.post(`/generate-new-summary/${sessionId}`, {
      session_id: sessionId,
      new_data: newData
    });
    return response.data;
  }
  
  static async generateVarianceSummary(
    baselineSessionId: string, 
    newSessionId: string, 
    data: { 
      baseline_data: Array<{ cellReference: string; name: string; value: number | string; formula: string; rowType: string }>;
      new_data: Array<{ cellReference: string; name: string; value: number | string; formula: string; rowType: string }>;
      source_cell_name: string;
    }
  ): Promise<{ summary: string; status: string; error_message?: string }> {
    const response = await api.post(`/generate-variance-summary/${baselineSessionId}/${newSessionId}`, data);
    return response.data;
  }
}

export default api;