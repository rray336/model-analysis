# NEW File Upload Implementation Plan

## Overview
Implement Excel file upload functionality for the NEW table in Analyze mode. The NEW table will replicate the structure of the BASELINE table but with values extracted from the uploaded NEW file.

## Core Requirements
- **Dual Session Management**: Maintain separate sessions for BASELINE and NEW files
- **Exact Structure Replication**: NEW table copies Cell Reference, Name, and Formula from BASELINE
- **Value Extraction**: Query NEW file for values using BASELINE cell references
- **Live Sync**: NEW table automatically updates when BASELINE changes
- **Error Handling**: Display "-" for missing or invalid cell references

## Implementation Steps

### 1. Frontend State Management
- Add `newSessionId` state for uploaded file session
- Add `newTableData` state for NEW table data
- Maintain existing BASELINE session and data unchanged

### 2. New API Endpoint
- Create `/get-cell-values` endpoint
- Input: session ID + array of cell references
- Output: key-value pairs of cell references and their values
- Handle missing references by returning null values

### 3. File Upload Flow
- Replace placeholder button with actual file upload component
- Upload file using existing `/upload` endpoint to get NEW session
- Extract cell references from current BASELINE data
- Query NEW file for values using new API endpoint
- Generate NEW table data structure

### 4. Live Sync Implementation
- Integrate NEW table updates into existing BASELINE data extraction
- Re-query NEW session whenever BASELINE structure changes
- Maintain synchronized table structures between BASELINE and NEW

### 5. UI Integration
- Update AnalyzeView to handle NEW table data
- Add loading states for file upload and processing
- Display error handling for missing references

## Technical Specifications
- **Session Isolation**: BASELINE and NEW sessions operate independently
- **Sheet Mapping**: Assume exact sheet name matching between files
- **Value Handling**: Use same extraction logic as BASELINE file processing
- **Error Strategy**: Minimal validation, graceful degradation with "-" for errors