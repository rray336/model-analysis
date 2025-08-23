// Data types for Analyze Mode (4-column table view)

export interface AnalyzeRow {
  cellReference: string;  // e.g., "Income statement!BV11"
  name: string;          // Display name (AI, manual, or fallback)
  value: number | string; // Numeric value or "-" for missing
  formula: string;       // Formula text (empty string if no formula)
  rowType: 'formula' | 'constant'; // For color coding
}

export interface AnalyzeData {
  rows: AnalyzeRow[];
  sourceCell: string;    // Which cell is the source (for context)
  extractedAt: number;   // Timestamp
}