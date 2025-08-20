import axios, { AxiosResponse } from 'axios';
import { UploadResponse, CellInfo, DrillDownResponse } from '../types/api';

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
  
  static async cleanupSession(sessionId: string): Promise<{ message: string }> {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  }
  
  static async healthCheck(): Promise<{ status: string; service: string }> {
    const response = await api.get('/health');
    return response.data;
  }
}

export default api;