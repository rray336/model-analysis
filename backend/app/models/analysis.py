"""
Data models for single file Excel analysis
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class AnalysisSession(BaseModel):
    """Session information for uploaded Excel file"""
    session_id: str
    filename: str
    upload_time: str
    sheets: List[str]

class CellInfo(BaseModel):
    """Basic information about a cell"""
    sheet_name: str
    cell_address: str
    value: Optional[float] = None
    formula: Optional[str] = None
    can_drill_down: bool = False
    complexity: str = "simple"  # simple, moderate, complex
    has_external_refs: bool = False

class RowValue(BaseModel):
    """Value from a specific column in a row"""
    column: str
    value: str
    is_meaningful: bool = False

class DependencyInfo(BaseModel):
    """Information about a single dependency in drill-down"""
    name: str
    cell_reference: str
    value: float
    formula: Optional[str] = None
    is_leaf: bool = False
    can_expand: bool = False
    depth: int = 1
    children: List['DependencyInfo'] = []
    expanded: bool = False
    resolved_name: Optional[str] = None
    name_source: Optional[str] = None
    row_values: Optional[List[RowValue]] = None
    ai_name: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_status: Optional[str] = None
    is_manually_edited: bool = False

class DrillDownResponse(BaseModel):
    """Response for progressive drill-down"""
    source_cell: str
    source_value: float
    source_formula: Optional[str] = None
    dependencies: List[DependencyInfo]
    depth: int = 1
    total_dependencies: int = 0

class UploadResponse(BaseModel):
    """Response after successful file upload"""
    session_id: str
    message: str
    sheets: List[str]

class AINameResult(BaseModel):
    """Result of AI naming for a single cell"""
    cell_reference: str
    suggested_name: Optional[str] = None
    confidence: float = 0.0
    status: str = "failed"  # "success" or "failed"
    error_message: Optional[str] = None

class AIBatchResult(BaseModel):
    """Result of batch AI naming for multiple cells"""
    results: Dict[str, AINameResult]
    failed_cells: List[str] = []
    processing_stats: Dict[str, Any] = {}

class AIBatchRequest(BaseModel):
    """Request for batch AI naming"""
    session_id: str
    sheet_name: str
    unprocessed_cells: List[str]

class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    message: str
    details: Optional[str] = None

# Update forward references
DependencyInfo.model_rebuild()