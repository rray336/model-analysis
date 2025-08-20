import React, { useState, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import { ApiService } from '../../services/api';
import { UploadState } from '../../types/api';

interface FileUploadProps {
  onUploadComplete: (sessionId: string, sheets: string[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onUploadComplete }) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    uploading: false,
    error: null,
    progress: 0
  });

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadState(prev => ({ ...prev, file, error: null }));
    }
  }, []);

  const triggerFileSelect = () => {
    const input = document.getElementById('file-input') as HTMLInputElement;
    input?.click();
  };

  const handleUpload = async () => {
    if (!uploadState.file) {
      setUploadState(prev => ({ ...prev, error: 'Please select an Excel file' }));
      return;
    }

    setUploadState(prev => ({ ...prev, uploading: true, error: null, progress: 0 }));

    try {
      setUploadState(prev => ({ ...prev, progress: 50 }));
      const response = await ApiService.uploadFile(uploadState.file);
      
      setUploadState(prev => ({ ...prev, progress: 100, uploading: false }));
      onUploadComplete(response.session_id, response.sheets);
      
    } catch (error: any) {
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: error.response?.data?.message || 'Upload failed'
      }));
    }
  };

  const resetUpload = () => {
    setUploadState({
      file: null,
      uploading: false,
      error: null,
      progress: 0
    });
  };

  const canUpload = uploadState.file && !uploadState.uploading;

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
          <Upload className="h-8 w-8 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Upload Excel Model</h2>
        <p className="text-gray-600 mt-2">
          Upload your Excel financial model to analyze cell formulas and dependencies
        </p>
      </div>

      {/* Upload Area */}
      <div className="mb-8">
        <div
          onClick={triggerFileSelect}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            uploadState.file 
              ? 'border-green-400 bg-green-50' 
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {uploadState.file ? (
            <div className="space-y-2">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-sm font-medium text-green-900">{uploadState.file.name}</p>
              <p className="text-xs text-green-700">
                {(uploadState.file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetUpload();
                }}
                className="btn btn-sm btn-outline mt-2"
              >
                Choose Different File
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
              <p className="text-sm font-medium text-gray-900">Choose Excel File</p>
              <p className="text-xs text-gray-500">Excel files (.xlsx, .xls)</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {uploadState.uploading && (
        <div className="mb-6">
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2 text-center">
            {uploadState.progress < 50 ? 'Uploading file...' : 'Processing Excel file...'}
          </p>
        </div>
      )}

      {/* Error Message */}
      {uploadState.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-900">{uploadState.error}</p>
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="text-center">
        <button
          onClick={handleUpload}
          disabled={!canUpload}
          className={`btn btn-primary btn-lg ${!canUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploadState.uploading ? (
            <div className="flex items-center">
              <div className="spinner mr-2"></div>
              Uploading...
            </div>
          ) : (
            'Upload & Analyze'
          )}
        </button>
      </div>

      {/* Requirements Note */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Supported formats: Excel (.xlsx, .xls)</p>
        <p className="mt-1">File size limit: 50MB</p>
      </div>
    </div>
  );
};