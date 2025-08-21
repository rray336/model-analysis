"""
AI Naming Service using Google Gemini API for contextual Excel cell naming
"""
import os
import base64
import io
import logging
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
import google.generativeai as genai
import openpyxl
from openpyxl.utils import get_column_letter, column_index_from_string

logger = logging.getLogger(__name__)

class AINameResult:
    """Result of AI naming for a single cell"""
    def __init__(self, cell_reference: str, suggested_name: str = None, 
                 confidence: float = 0.0, status: str = "failed", error_message: str = None):
        self.cell_reference = cell_reference
        self.suggested_name = suggested_name
        self.confidence = confidence
        self.status = status  # "success" or "failed"
        self.error_message = error_message

class AIBatchResult:
    """Result of batch AI naming for multiple cells"""
    def __init__(self):
        self.results: Dict[str, AINameResult] = {}
        self.failed_cells: List[str] = []
        self.processing_stats: Dict[str, Any] = {}

class AIExcelScreenshotGenerator:
    """Generate Excel-like screenshots for AI analysis"""
    
    def __init__(self, workbook_path: Path):
        self.workbook_path = workbook_path
        
    def generate_context_screenshot(self, sheet_name: str, target_cells: List[str], 
                                  context_rows: int = 12, context_cols: int = 8) -> bytes:
        """Generate a screenshot showing context around target cells"""
        try:
            # Read Excel data
            df = pd.read_excel(self.workbook_path, sheet_name=sheet_name, header=None)
            
            # Calculate bounding box for all target cells
            min_row, max_row, min_col, max_col = self._get_bounding_box(target_cells)
            
            # Expand context
            start_row = max(0, min_row - context_rows // 2)
            end_row = min(len(df), max_row + context_rows // 2)
            start_col = max(0, min_col - context_cols // 2)
            end_col = min(len(df.columns), max_col + context_cols // 2)
            
            # Extract subset
            subset_df = df.iloc[start_row:end_row, start_col:end_col].copy()
            
            # Create figure
            fig, ax = plt.subplots(figsize=(14, 10))
            ax.axis('tight')
            ax.axis('off')
            
            # Create table
            table_data = []
            for i, row in subset_df.iterrows():
                table_data.append([str(val) if pd.notna(val) else '' for val in row])
            
            # Add column headers (A, B, C, etc.)
            col_headers = [get_column_letter(start_col + i + 1) for i in range(len(subset_df.columns))]
            
            # Add row numbers
            row_headers = [str(start_row + i + 1) for i in range(len(subset_df))]
            
            # Create table with headers
            table = ax.table(cellText=table_data, 
                           colLabels=col_headers,
                           rowLabels=row_headers,
                           cellLoc='left',
                           loc='center',
                           colWidths=[0.12] * len(col_headers))
            
            # Style the table
            table.auto_set_font_size(False)
            table.set_fontsize(9)
            table.scale(1, 1.5)
            
            # Highlight target cells
            for target_cell in target_cells:
                try:
                    col_letter, row_num = self._parse_cell_address(target_cell)
                    col_idx = column_index_from_string(col_letter) - 1
                    row_idx = row_num - 1
                    
                    # Check if cell is in visible range
                    if (start_row <= row_idx < end_row and start_col <= col_idx < end_col):
                        # Calculate table position
                        table_row = row_idx - start_row + 1  # +1 for header
                        table_col = col_idx - start_col + 1  # +1 for row labels
                        
                        # Highlight cell
                        cell = table[(table_row, table_col)]
                        cell.set_facecolor('#FF6B6B')  # Red highlight
                        cell.set_edgecolor('#FF0000')
                        cell.set_linewidth(2)
                except Exception as e:
                    logger.warning(f"Could not highlight cell {target_cell}: {e}")
            
            # Add title
            plt.title(f'Sheet: {sheet_name} - Context for AI Analysis', 
                     fontsize=14, fontweight='bold', pad=20)
            
            # Save to bytes
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', 
                       facecolor='white', edgecolor='none')
            buffer.seek(0)
            screenshot_bytes = buffer.getvalue()
            plt.close(fig)
            
            return screenshot_bytes
            
        except Exception as e:
            logger.error(f"Error generating screenshot for {sheet_name}: {e}")
            # Return empty screenshot on error
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.text(0.5, 0.5, f'Error generating screenshot:\n{str(e)}', 
                   ha='center', va='center', fontsize=12)
            ax.axis('off')
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', bbox_inches='tight')
            buffer.seek(0)
            screenshot_bytes = buffer.getvalue()
            plt.close(fig)
            return screenshot_bytes
    
    def _get_bounding_box(self, cell_addresses: List[str]) -> Tuple[int, int, int, int]:
        """Get bounding box (min_row, max_row, min_col, max_col) for cell addresses"""
        rows, cols = [], []
        
        for cell_addr in cell_addresses:
            try:
                col_letter, row_num = self._parse_cell_address(cell_addr)
                col_idx = column_index_from_string(col_letter) - 1  # 0-based
                row_idx = row_num - 1  # 0-based
                rows.append(row_idx)
                cols.append(col_idx)
            except:
                continue
        
        if not rows or not cols:
            return 0, 10, 0, 8  # Default range
        
        return min(rows), max(rows), min(cols), max(cols)
    
    def _parse_cell_address(self, cell_address: str) -> Tuple[str, int]:
        """Parse cell address into column letter and row number"""
        import re
        if '!' in cell_address:
            cell_address = cell_address.split('!')[1]
        
        match = re.match(r'^([A-Z]+)(\d+)$', cell_address.upper())
        if not match:
            raise ValueError(f"Invalid cell address: {cell_address}")
        
        return match.groups()[0], int(match.groups()[1])

class AINameService:
    """Service for AI-powered contextual cell naming using Gemini"""
    
    def __init__(self):
        self.api_key = os.getenv('GEMINI_API_KEY')
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            logger.warning("GEMINI_API_KEY not found. AI naming will be disabled.")
            self.model = None
    
    async def generate_batch_names(self, workbook_path: Path, sheet_name: str, 
                                 cell_references: List[str], 
                                 structured_data: Dict = None) -> AIBatchResult:
        """Generate AI names for a batch of cells"""
        result = AIBatchResult()
        
        if not self.model:
            # API key not configured
            for cell_ref in cell_references:
                result.results[cell_ref] = AINameResult(
                    cell_reference=cell_ref,
                    status="failed",
                    error_message="Gemini API not configured. Set GEMINI_API_KEY environment variable."
                )
                result.failed_cells.append(cell_ref)
            return result
        
        try:
            # Generate screenshot
            screenshot_gen = AIExcelScreenshotGenerator(workbook_path)
            screenshot_bytes = screenshot_gen.generate_context_screenshot(sheet_name, cell_references)
            
            # Prepare prompt
            prompt = self._create_batch_prompt(sheet_name, cell_references, structured_data)
            
            # Convert screenshot to base64 for Gemini
            screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')
            
            # Create image part for Gemini
            image_part = {
                "mime_type": "image/png",
                "data": screenshot_base64
            }
            
            # Call Gemini API
            response = self.model.generate_content([prompt, image_part])
            
            # Parse response
            if response and response.text:
                parsed_results = self._parse_gemini_response(response.text, cell_references)
                result.results.update(parsed_results)
            else:
                raise Exception("No response from Gemini API")
                
        except Exception as e:
            logger.error(f"Error in batch AI naming: {e}")
            # Mark all cells as failed
            for cell_ref in cell_references:
                result.results[cell_ref] = AINameResult(
                    cell_reference=cell_ref,
                    status="failed",
                    error_message=f"AI generation failed: {str(e)}"
                )
                result.failed_cells.append(cell_ref)
        
        # Update statistics
        successful = len([r for r in result.results.values() if r.status == "success"])
        result.processing_stats = {
            "total_cells": len(cell_references),
            "successful": successful,
            "failed": len(cell_references) - successful
        }
        
        return result
    
    def _create_batch_prompt(self, sheet_name: str, cell_references: List[str], 
                           structured_data: Dict = None) -> str:
        """Create prompt for batch cell naming"""
        
        cell_list = ", ".join(cell_references)
        
        prompt = f"""You are analyzing a financial Excel model. The screenshot shows a section of the '{sheet_name}' worksheet.

Target cells to name (highlighted in red): {cell_list}

Please generate concise, descriptive business names for each highlighted cell that capture their meaning and context. 

Requirements:
- Maximum 50 characters per name
- Include time periods if apparent (FY-2021, Q1-2023, Dec-21, etc.)
- Include business context (Revenue, EBITDA, Operating Income, etc.)
- Be specific enough to distinguish similar items
- Follow financial modeling conventions
- Use the visual context and surrounding labels to understand meaning

Return your response as a JSON object with this exact format:
{{
  "cell_names": {{
    "{cell_references[0] if cell_references else 'Sheet!A1'}": {{"name": "Descriptive Name Here", "confidence": 0.95}},
    "{cell_references[1] if len(cell_references) > 1 else 'Sheet!B1'}": {{"name": "Another Name Here", "confidence": 0.87}}
  }}
}}

Only include cells that you can confidently name based on the visual context. If you cannot determine a meaningful name for a cell, omit it from the response.
"""
        
        return prompt
    
    def _parse_gemini_response(self, response_text: str, cell_references: List[str]) -> Dict[str, AINameResult]:
        """Parse Gemini API response and create AINameResult objects"""
        results = {}
        
        try:
            import json
            
            # Try to extract JSON from response
            response_text = response_text.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            
            data = json.loads(response_text)
            cell_names = data.get('cell_names', {})
            
            for cell_ref in cell_references:
                if cell_ref in cell_names:
                    cell_data = cell_names[cell_ref]
                    results[cell_ref] = AINameResult(
                        cell_reference=cell_ref,
                        suggested_name=cell_data.get('name', ''),
                        confidence=cell_data.get('confidence', 0.0),
                        status="success"
                    )
                else:
                    results[cell_ref] = AINameResult(
                        cell_reference=cell_ref,
                        status="failed",
                        error_message="AI could not generate name for this cell"
                    )
                    
        except Exception as e:
            logger.error(f"Error parsing Gemini response: {e}")
            # Fall back to failed status for all cells
            for cell_ref in cell_references:
                results[cell_ref] = AINameResult(
                    cell_reference=cell_ref,
                    status="failed",
                    error_message=f"Failed to parse AI response: {str(e)}"
                )
        
        return results