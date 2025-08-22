"""
Main FastAPI application serving both API and React frontend

Features:
- Single Excel file upload and analysis
- Multi-level drill-down capabilities with true nested expansion
- Click on any formula cell to explore its dependencies
- Progressive dependency tree visualization
- Session-based file management
- AI-powered contextual naming with Google Gemini
"""
import uuid
import os
import shutil
from pathlib import Path
from typing import List
import logging
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.models.analysis import (
    UploadResponse, 
    CellInfo, 
    DrillDownResponse, 
    DependencyInfo,
    ErrorResponse,
    RowValue,
    AIBatchResult,
    AIBatchRequest,
    AINameResult
)
from backend.app.services.formula_analyzer import FormulaAnalyzer
from backend.app.services.ai_naming_service import AINameService
from backend.app.utils.excel_utils import (
    ExcelReader, 
    get_cell_value_and_formula, 
    validate_cell_address,
    get_row_values,
    get_cell_name_from_column,
    parse_cell_address
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Model Analysis",
    description="Single file Excel financial model analyzer with drill-down capabilities",
    version="1.0.0"
)

# Add CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
formula_analyzer = FormulaAnalyzer()
ai_naming_service = AINameService()

# Create uploads directory
UPLOADS_DIR = Path("backend/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Store session data in memory (use database for production)
sessions: dict = {}

# Store naming configurations per session: {session_id: {sheet_name: column_letter}}
naming_configs: dict = {}

# Store AI processed cells per session: {session_id: {sheet_name: {cell_ref: ai_result}}}
ai_processed_cells: dict = {}

# Store manually edited AI names per session: {session_id: {sheet_name: {cell_ref: manual_name}}}
manual_ai_edits: dict = {}


def cleanup_uploads_directory():
    """Clean up all files and folders in the uploads directory with improved Windows compatibility"""
    try:
        if not UPLOADS_DIR.exists():
            return
            
        import gc
        import time
        import os
        
        # Force close any open workbooks and clear sessions
        force_close_open_workbooks()
        
        # Multiple garbage collection passes to release file handles
        for _ in range(3):
            gc.collect()
        time.sleep(1)  # Give Windows more time to release handles
        
        deleted_count = 0
        failed_count = 0
        old_files_count = 0
        
        # Get current time for age-based cleanup
        current_time = time.time()
        max_age_hours = 24  # Only try to delete files older than 24 hours
        
        for item in UPLOADS_DIR.iterdir():
            try:
                # Check file age - only delete old uploads to avoid conflicts
                try:
                    item_age_hours = (current_time - item.stat().st_mtime) / 3600
                    if item_age_hours < max_age_hours:
                        continue  # Skip recent files that might be in use
                    old_files_count += 1
                except OSError:
                    # If we can't get file stats, assume it's old
                    old_files_count += 1
                
                if item.is_dir():
                    # Try to delete directory with retries
                    for attempt in range(2):
                        try:
                            shutil.rmtree(item)
                            deleted_count += 1
                            logger.debug(f"Deleted old upload directory: {item.name}")
                            break
                        except (OSError, PermissionError) as e:
                            if attempt == 0:
                                time.sleep(0.5)
                                gc.collect()
                            else:
                                # Silently fail for locked directories - this is expected
                                failed_count += 1
                                break
                else:
                    try:
                        item.unlink()
                        deleted_count += 1
                        logger.debug(f"Deleted old upload file: {item.name}")
                    except (OSError, PermissionError):
                        failed_count += 1
                        
            except Exception as e:
                logger.debug(f"Error processing {item}: {e}")
                failed_count += 1
        
        # Only log if there's something interesting to report
        if deleted_count > 0:
            logger.info(f"Cleanup: {deleted_count} old uploads deleted, {failed_count} locked items skipped")
        elif old_files_count > 0 and failed_count > 0:
            logger.debug(f"Cleanup: {failed_count} old upload directories are locked (will retry on next upload)")
        # If no old files and no deletions, don't log anything
                
    except Exception as e:
        logger.debug(f"Error during uploads cleanup: {e}")  # Reduced to debug level
        # Don't raise exception - upload can still proceed




def force_close_open_workbooks():
    """Force close any open workbooks by clearing sessions"""
    try:
        # Clear all session references to workbooks
        for session_id in list(sessions.keys()):
            try:
                session_data = sessions[session_id]
                # If session has any workbook references, clear them
                if 'workbook' in session_data:
                    del session_data['workbook']
                if 'excel_reader' in session_data:
                    del session_data['excel_reader']
            except Exception as e:
                logger.debug(f"Error clearing session {session_id}: {e}")
        
        # Force garbage collection
        import gc
        gc.collect()
        
    except Exception as e:
        logger.debug(f"Error in force_close_open_workbooks: {e}")



@app.post("/api/upload", response_model=UploadResponse)
async def upload_excel_file(file: UploadFile = File(...)):
    """Upload a single Excel file and return session information"""
    
    # Clean up uploads directory before processing new file
    cleanup_uploads_directory()
    
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Please upload an Excel file (.xlsx or .xls)"
        )
    
    # Generate session ID and create upload directory
    session_id = str(uuid.uuid4())
    session_dir = UPLOADS_DIR / session_id
    session_dir.mkdir(exist_ok=True)
    
    # Save the uploaded file
    file_path = session_dir / file.filename
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"File uploaded successfully: {file.filename} -> {session_id}")
        
        # Analyze the file to get sheet names
        excel_reader = ExcelReader(file_path)
        sheets = excel_reader.get_sheet_names()
        
        # Store session information
        sessions[session_id] = {
            "filename": file.filename,
            "file_path": file_path,
            "upload_time": datetime.now().isoformat(),
            "sheets": sheets
        }
        
        return UploadResponse(
            session_id=session_id,
            message=f"File '{file.filename}' uploaded successfully",
            sheets=sheets
        )
        
    except Exception as e:
        logger.error(f"Error processing uploaded file: {e}")
        # Clean up on error
        if session_dir.exists():
            shutil.rmtree(session_dir)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/api/sheets/{session_id}")
async def get_sheets(session_id: str) -> List[str]:
    """Get available sheets for a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return sessions[session_id]["sheets"]

@app.get("/api/analyze/{session_id}/{sheet_name}/{cell_address}", response_model=CellInfo)
async def analyze_cell(session_id: str, sheet_name: str, cell_address: str):
    """Analyze a specific cell and return basic information"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate cell address format
    if not validate_cell_address(cell_address):
        raise HTTPException(status_code=400, detail="Invalid cell address format. Use format like 'A1', 'B5', 'AC123'")
    
    session_data = sessions[session_id]
    file_path = session_data["file_path"]
    
    # Validate sheet name
    if sheet_name not in session_data["sheets"]:
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found in workbook")
    
    try:
        # Get cell value and formula
        value, formula = get_cell_value_and_formula(file_path, sheet_name, cell_address.upper())
        
        # Analyze formula complexity if it's a formula cell
        complexity_info = {"complexity": "simple", "can_drill_down": False}
        if formula:
            complexity_info = formula_analyzer.analyze_formula_complexity(formula)
        
        return CellInfo(
            sheet_name=sheet_name,
            cell_address=cell_address.upper(),
            value=value,
            formula=formula,
            can_drill_down=complexity_info.get("can_drill_down", False),
            complexity=complexity_info.get("complexity", "simple"),
            has_external_refs=complexity_info.get("has_external_refs", False)
        )
        
    except Exception as e:
        logger.error(f"Error analyzing cell {sheet_name}!{cell_address}: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing cell: {str(e)}")

@app.get("/api/drill-down/{session_id}/{sheet_name}/{cell_address}", response_model=DrillDownResponse)
async def drill_down_cell(
    session_id: str, 
    sheet_name: str, 
    cell_address: str,
    depth: int = Query(1, ge=1, le=5, description="Depth level for progressive drill-down")
):
    """Get progressive drill-down dependencies for a cell"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate cell address format
    if not validate_cell_address(cell_address):
        raise HTTPException(status_code=400, detail="Invalid cell address format")
    
    session_data = sessions[session_id]
    file_path = session_data["file_path"]
    
    # Validate sheet name
    if sheet_name not in session_data["sheets"]:
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found")
    
    try:
        # Get source cell info
        source_value, source_formula = get_cell_value_and_formula(file_path, sheet_name, cell_address.upper())
        
        if not source_formula:
            return DrillDownResponse(
                source_cell=f"{sheet_name}!{cell_address.upper()}",
                source_value=source_value or 0.0,
                source_formula=None,
                dependencies=[],
                depth=depth,
                total_dependencies=0
            )
        
        # Get progressive dependencies
        dependencies = formula_analyzer.get_progressive_dependencies(
            file_path, sheet_name, cell_address.upper(), depth=depth
        )
        
        if not dependencies:
            dependencies = []
        
        # Convert to API response format with name resolution
        dependency_list = []
        for dep in dependencies:
            resolved_name = None
            name_source = None
            row_values_data = None
            
            # Check if this dependency has a configured naming column
            if session_id in naming_configs:
                # Parse cell reference to get sheet and row
                if '!' in dep.cell_reference:
                    dep_sheet, dep_cell = dep.cell_reference.split('!', 1)
                    try:
                        _, row_num = parse_cell_address(dep_cell)
                        if dep_sheet in naming_configs[session_id]:
                            column_letter = naming_configs[session_id][dep_sheet]
                            resolved_name = get_cell_name_from_column(file_path, dep_sheet, row_num, column_letter)
                            if resolved_name:
                                name_source = f"Column {column_letter}"
                    except:
                        pass
            
            # If no resolved name, get row values for dropdown
            if not resolved_name and '!' in dep.cell_reference:
                dep_sheet, dep_cell = dep.cell_reference.split('!', 1)
                try:
                    _, row_num = parse_cell_address(dep_cell)
                    row_values = get_row_values(file_path, dep_sheet, row_num)
                    row_values_data = [RowValue(**rv) for rv in row_values]
                except:
                    pass
            
            # Check for AI naming data
            ai_name = None
            ai_confidence = None
            ai_status = None
            is_manually_edited = False
            
            if session_id in ai_processed_cells and dep.cell_reference in ai_processed_cells[session_id].get(sheet_name, {}):
                ai_result = ai_processed_cells[session_id][sheet_name][dep.cell_reference]
                ai_name = ai_result.get('suggested_name')
                ai_confidence = ai_result.get('confidence')
                ai_status = ai_result.get('status')
            
            # Check for manual edits
            if session_id in manual_ai_edits and dep.cell_reference in manual_ai_edits[session_id].get(sheet_name, {}):
                ai_name = manual_ai_edits[session_id][sheet_name][dep.cell_reference]
                is_manually_edited = True
                ai_status = "success"  # Manual edit counts as success
            
            dependency_list.append(DependencyInfo(
                name=dep.name,
                cell_reference=dep.cell_reference,
                value=dep.value,
                formula=dep.formula,
                is_leaf=dep.is_leaf_node,
                can_expand=dep.formula is not None and len(dep.dependencies) == 0,  # Has formula but not yet expanded
                depth=depth,
                children=[],
                expanded=False,
                resolved_name=resolved_name,
                name_source=name_source,
                row_values=row_values_data,
                ai_name=ai_name,
                ai_confidence=ai_confidence,
                ai_status=ai_status,
                is_manually_edited=is_manually_edited
            ))
        
        return DrillDownResponse(
            source_cell=f"{sheet_name}!{cell_address.upper()}",
            source_value=source_value or 0.0,
            source_formula=source_formula,
            dependencies=dependency_list,
            depth=depth,
            total_dependencies=len(dependency_list)
        )
        
    except Exception as e:
        logger.error(f"Error drilling down cell {sheet_name}!{cell_address}: {e}")
        raise HTTPException(status_code=500, detail=f"Error drilling down: {str(e)}")

@app.post("/api/expand-dependency/{session_id}/{sheet_name}/{cell_address}")
async def expand_dependency(
    session_id: str,
    sheet_name: str, 
    cell_address: str
):
    """Expand a specific dependency to show its children"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Validate cell address format  
    if not validate_cell_address(cell_address):
        raise HTTPException(status_code=400, detail="Invalid cell address format")
    
    session_data = sessions[session_id]
    file_path = session_data["file_path"]
    
    # Validate sheet name
    if sheet_name not in session_data["sheets"]:
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found")
    
    try:
        logger.info(f"Expanding dependency: {sheet_name}!{cell_address}")
        # Get dependencies for this specific cell
        dependencies = formula_analyzer.get_progressive_dependencies(
            file_path, sheet_name, cell_address.upper(), depth=1
        )
        logger.info(f"Found {len(dependencies) if dependencies else 0} dependencies for {sheet_name}!{cell_address}")
        
        if not dependencies:
            dependencies = []
        
        # Convert to API response format with name resolution
        dependency_list = []
        for dep in dependencies:
            resolved_name = None
            name_source = None
            row_values_data = None
            
            # Check if this dependency has a configured naming column
            if session_id in naming_configs:
                # Parse cell reference to get sheet and row
                if '!' in dep.cell_reference:
                    dep_sheet, dep_cell = dep.cell_reference.split('!', 1)
                    try:
                        _, row_num = parse_cell_address(dep_cell)
                        if dep_sheet in naming_configs[session_id]:
                            column_letter = naming_configs[session_id][dep_sheet]
                            resolved_name = get_cell_name_from_column(session_data["file_path"], dep_sheet, row_num, column_letter)
                            if resolved_name:
                                name_source = f"Column {column_letter}"
                    except:
                        pass
            
            # If no resolved name, get row values for dropdown
            if not resolved_name and '!' in dep.cell_reference:
                dep_sheet, dep_cell = dep.cell_reference.split('!', 1)
                try:
                    _, row_num = parse_cell_address(dep_cell)
                    row_values = get_row_values(session_data["file_path"], dep_sheet, row_num)
                    row_values_data = [RowValue(**rv) for rv in row_values]
                except:
                    pass
            
            # Check for AI naming data
            ai_name = None
            ai_confidence = None
            ai_status = None
            is_manually_edited = False
            
            if session_id in ai_processed_cells and dep.cell_reference in ai_processed_cells[session_id].get(sheet_name, {}):
                ai_result = ai_processed_cells[session_id][sheet_name][dep.cell_reference]
                ai_name = ai_result.get('suggested_name')
                ai_confidence = ai_result.get('confidence')
                ai_status = ai_result.get('status')
            
            # Check for manual edits
            if session_id in manual_ai_edits and dep.cell_reference in manual_ai_edits[session_id].get(sheet_name, {}):
                ai_name = manual_ai_edits[session_id][sheet_name][dep.cell_reference]
                is_manually_edited = True
                ai_status = "success"  # Manual edit counts as success
            
            dependency_list.append(DependencyInfo(
                name=dep.name,
                cell_reference=dep.cell_reference,
                value=dep.value,
                formula=dep.formula,
                is_leaf=dep.is_leaf_node,
                can_expand=dep.formula is not None,
                depth=1,
                children=[],
                expanded=False,
                resolved_name=resolved_name,
                name_source=name_source,
                row_values=row_values_data,
                ai_name=ai_name,
                ai_confidence=ai_confidence,
                ai_status=ai_status,
                is_manually_edited=is_manually_edited
            ))
        
        return {"dependencies": dependency_list}
        
    except Exception as e:
        logger.error(f"Error expanding dependency {sheet_name}!{cell_address}: {e}")
        raise HTTPException(status_code=500, detail=f"Error expanding dependency: {str(e)}")

@app.get("/api/row-values/{session_id}/{sheet_name}/{row_number}")
async def get_row_values_endpoint(session_id: str, sheet_name: str, row_number: int):
    """Get values from a specific row for column selection dropdown"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = sessions[session_id]
    file_path = session_data["file_path"]
    
    # Validate sheet name
    if sheet_name not in session_data["sheets"]:
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found")
    
    try:
        row_values = get_row_values(file_path, sheet_name, row_number)
        return {"row_values": [RowValue(**rv) for rv in row_values]}
        
    except Exception as e:
        logger.error(f"Error getting row values for {sheet_name}!{row_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting row values: {str(e)}")

@app.post("/api/configure-sheet-naming/{session_id}/{sheet_name}/{column_letter}")
async def configure_sheet_naming(session_id: str, sheet_name: str, column_letter: str):
    """Configure which column to use for naming cells in a specific sheet"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = sessions[session_id]
    
    # Validate sheet name
    if sheet_name not in session_data["sheets"]:
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' not found")
    
    # Initialize naming config for session if not exists
    if session_id not in naming_configs:
        naming_configs[session_id] = {}
    
    # Store the column mapping
    naming_configs[session_id][sheet_name] = column_letter.upper()
    
    logger.info(f"Configured sheet '{sheet_name}' to use column '{column_letter}' for names in session {session_id}")
    
    return {
        "message": f"Sheet '{sheet_name}' configured to use column '{column_letter}' for names",
        "sheet_name": sheet_name,
        "column": column_letter.upper()
    }

@app.get("/api/naming-config/{session_id}")
async def get_naming_config(session_id: str):
    """Get current naming configuration for a session"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    config = naming_configs.get(session_id, {})
    return {"naming_config": config}

@app.post("/api/get-resolved-names/{session_id}")
async def get_resolved_names(session_id: str, request_body: dict):
    """Get resolved names for a batch of cell references"""
    
    cell_references = request_body.get("cell_references", [])
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = sessions[session_id]
    
    try:
        results = {}
        
        for cell_ref in cell_references:
            resolved_name = None
            name_source = None
            row_values_data = None
            
            # Check if this dependency has a configured naming column
            if session_id in naming_configs and '!' in cell_ref:
                dep_sheet, dep_cell = cell_ref.split('!', 1)
                try:
                    _, row_num = parse_cell_address(dep_cell)
                    if dep_sheet in naming_configs[session_id]:
                        column_letter = naming_configs[session_id][dep_sheet]
                        resolved_name = get_cell_name_from_column(session_data["file_path"], dep_sheet, row_num, column_letter)
                        if resolved_name:
                            name_source = f"Column {column_letter}"
                except:
                    pass
            
            # If no resolved name, get row values for dropdown
            if not resolved_name and '!' in cell_ref:
                dep_sheet, dep_cell = cell_ref.split('!', 1)
                try:
                    _, row_num = parse_cell_address(dep_cell)
                    row_values = get_row_values(session_data["file_path"], dep_sheet, row_num)
                    row_values_data = [RowValue(**rv) for rv in row_values]
                except:
                    pass
            
            results[cell_ref] = {
                "resolved_name": resolved_name,
                "name_source": name_source,
                "row_values": row_values_data
            }
        
        return {"results": results}
        
    except Exception as e:
        logger.error(f"Error getting resolved names: {e}")
        raise HTTPException(status_code=500, detail=f"Error getting resolved names: {str(e)}")

@app.post("/api/generate-ai-names/{session_id}/{sheet_name}")
async def generate_ai_names(session_id: str, sheet_name: str, request: AIBatchRequest):
    """Generate AI names for a batch of cells in a sheet"""
    
    # URL decode sheet name to handle spaces and special characters
    import urllib.parse
    decoded_sheet_name = urllib.parse.unquote(sheet_name)
    logger.info(f"AI Names request: original='{sheet_name}', decoded='{decoded_sheet_name}'")
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = sessions[session_id]
    file_path = session_data["file_path"]
    
    # Validate sheet name (try both original and decoded)
    final_sheet_name = None
    if decoded_sheet_name in session_data["sheets"]:
        final_sheet_name = decoded_sheet_name
    elif sheet_name in session_data["sheets"]:
        final_sheet_name = sheet_name
    else:
        available_sheets = ", ".join(session_data["sheets"])
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' (decoded: '{decoded_sheet_name}') not found. Available: {available_sheets}")
    
    logger.info(f"Using sheet name: '{final_sheet_name}'")
    
    try:
        # Filter out already processed cells
        unprocessed_cells = []
        for cell_ref in request.unprocessed_cells:
            # Skip if already AI processed or manually edited
            if session_id in ai_processed_cells and cell_ref in ai_processed_cells[session_id].get(sheet_name, {}):
                continue
            if session_id in manual_ai_edits and cell_ref in manual_ai_edits[session_id].get(sheet_name, {}):
                continue
            unprocessed_cells.append(cell_ref)
        
        if not unprocessed_cells:
            return {"message": "All cells already processed", "results": {}, "failed_cells": [], "processing_stats": {"total_cells": 0, "successful": 0, "failed": 0}}
        
        # Call AI service with corrected sheet name
        batch_result = await ai_naming_service.generate_batch_names(
            file_path, final_sheet_name, unprocessed_cells, use_extended_context=request.use_extended_context
        )
        
        # Store results in session (now handling multi-sheet results)
        if session_id not in ai_processed_cells:
            ai_processed_cells[session_id] = {}
        
        # Convert AINameResult objects to dict for storage
        sheets_processed = set()
        for cell_ref, ai_result in batch_result.results.items():
            # Extract sheet name from cell reference
            if '!' in cell_ref:
                result_sheet_name, _ = cell_ref.split('!', 1)
                sheets_processed.add(result_sheet_name)
                
                # Initialize sheet storage if needed
                if result_sheet_name not in ai_processed_cells[session_id]:
                    ai_processed_cells[session_id][result_sheet_name] = {}
                
                # Store result in correct sheet
                ai_processed_cells[session_id][result_sheet_name][cell_ref] = {
                    "suggested_name": ai_result.suggested_name,
                    "confidence": ai_result.confidence,
                    "status": ai_result.status,
                    "error_message": ai_result.error_message
                }
            else:
                # Fallback for cells without sheet prefix (shouldn't happen)
                if final_sheet_name not in ai_processed_cells[session_id]:
                    ai_processed_cells[session_id][final_sheet_name] = {}
                ai_processed_cells[session_id][final_sheet_name][cell_ref] = {
                    "suggested_name": ai_result.suggested_name,
                    "confidence": ai_result.confidence,
                    "status": ai_result.status,
                    "error_message": ai_result.error_message
                }
        
        # Enhanced logging with sheet breakdown
        sheets_list = list(sheets_processed) if sheets_processed else [final_sheet_name]
        logger.info(f"Generated AI names for {len(unprocessed_cells)} cells across {len(sheets_list)} sheets: {', '.join(sheets_list)}")
        
        return {
            "message": f"Generated AI names for {len(unprocessed_cells)} cells across {len(sheets_list)} sheets",
            "sheets_processed": sheets_list,
            "results": {cell_ref: {
                "cell_reference": result.cell_reference,
                "suggested_name": result.suggested_name,
                "confidence": result.confidence,
                "status": result.status,
                "error_message": result.error_message
            } for cell_ref, result in batch_result.results.items()},
            "failed_cells": batch_result.failed_cells,
            "processing_stats": batch_result.processing_stats
        }
        
    except Exception as e:
        logger.error(f"Error generating AI names for {sheet_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating AI names: {str(e)}")

@app.get("/api/ai-processed-cells/{session_id}/{sheet_name}")
async def get_ai_processed_cells(session_id: str, sheet_name: str):
    """Get list of already AI-processed cells for a sheet"""
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get processed cells
    processed_cells = []
    if session_id in ai_processed_cells and sheet_name in ai_processed_cells[session_id]:
        processed_cells.extend(ai_processed_cells[session_id][sheet_name].keys())
    
    # Add manually edited cells
    if session_id in manual_ai_edits and sheet_name in manual_ai_edits[session_id]:
        processed_cells.extend(manual_ai_edits[session_id][sheet_name].keys())
    
    return {"processed_cells": list(set(processed_cells))}

@app.post("/api/mark-manual-edit/{session_id}/{sheet_name}/{cell_address}")
async def mark_manual_edit(session_id: str, sheet_name: str, cell_address: str, request_body: dict):
    """Mark a cell as manually edited with user-provided name"""
    
    manual_name = request_body.get("manual_name", "")
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Initialize structures if needed
    if session_id not in manual_ai_edits:
        manual_ai_edits[session_id] = {}
    if sheet_name not in manual_ai_edits[session_id]:
        manual_ai_edits[session_id][sheet_name] = {}
    
    # Store manual edit
    manual_ai_edits[session_id][sheet_name][cell_address] = manual_name
    
    logger.info(f"Marked {sheet_name}!{cell_address} as manually edited: '{manual_name}'")
    
    return {
        "message": f"Cell {cell_address} marked as manually edited",
        "cell_address": cell_address,
        "manual_name": manual_name
    }

@app.get("/api/debug-screenshot/{session_id}/{sheet_name}")
async def debug_screenshot(session_id: str, sheet_name: str, cell_refs: str = ""):
    """Debug endpoint to generate and save screenshot for testing"""
    
    # URL decode sheet name to handle spaces and special characters
    import urllib.parse
    decoded_sheet_name = urllib.parse.unquote(sheet_name)
    logger.info(f"Debug screenshot request: original='{sheet_name}', decoded='{decoded_sheet_name}'")
    
    # Validate session
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = sessions[session_id]
    file_path = session_data["file_path"]
    
    # Validate sheet name (try both original and decoded)
    final_sheet_name = None
    if decoded_sheet_name in session_data["sheets"]:
        final_sheet_name = decoded_sheet_name
    elif sheet_name in session_data["sheets"]:
        final_sheet_name = sheet_name
    else:
        available_sheets = ", ".join(session_data["sheets"])
        raise HTTPException(status_code=400, detail=f"Sheet '{sheet_name}' (decoded: '{decoded_sheet_name}') not found. Available: {available_sheets}")
    
    logger.info(f"Debug screenshot using sheet name: '{final_sheet_name}'")
    
    try:
        from backend.app.services.ai_naming_service import AIExcelScreenshotGenerator
        import base64
        
        # Parse cell references (comma-separated)
        cell_references = [ref.strip() for ref in cell_refs.split(",") if ref.strip()] if cell_refs else ["A1"]
        
        # Generate screenshot
        screenshot_gen = AIExcelScreenshotGenerator(file_path)
        screenshot_bytes = screenshot_gen.generate_context_screenshot(final_sheet_name, cell_references)
        
        # Save to debug folder
        debug_dir = Path("debug_screenshots")
        debug_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_path = debug_dir / f"debug_{final_sheet_name.replace(' ', '_')}_{timestamp}.png"
        
        with open(screenshot_path, "wb") as f:
            f.write(screenshot_bytes)
        
        # Return base64 for display and file path
        screenshot_base64 = base64.b64encode(screenshot_bytes).decode('utf-8')
        
        return {
            "message": f"Screenshot generated successfully",
            "file_path": str(screenshot_path),
            "sheet_name": final_sheet_name,
            "original_sheet_name": sheet_name,
            "target_cells": cell_references,
            "screenshot_base64": screenshot_base64,
            "size_bytes": len(screenshot_bytes)
        }
        
    except Exception as e:
        logger.error(f"Error generating debug screenshot: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating screenshot: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Model Analysis"}

@app.post("/api/force-cleanup")
async def force_cleanup():
    """Force cleanup of uploads directory (manual trigger)"""
    try:
        cleanup_uploads_directory()
        return {"message": "Cleanup completed", "status": "success"}
    except Exception as e:
        logger.error(f"Error in force cleanup: {e}")
        return {"message": f"Cleanup failed: {str(e)}", "status": "error"}

@app.delete("/api/sessions/{session_id}")
async def cleanup_session(session_id: str):
    """Clean up a session and its files"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    try:
        # Remove files
        session_dir = UPLOADS_DIR / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir)
        
        # Remove from memory
        del sessions[session_id]
        
        # Clean up naming config
        if session_id in naming_configs:
            del naming_configs[session_id]
        
        # Clean up AI data
        if session_id in ai_processed_cells:
            del ai_processed_cells[session_id]
        if session_id in manual_ai_edits:
            del manual_ai_edits[session_id]
        
        return {"message": f"Session {session_id} cleaned up successfully"}
        
    except Exception as e:
        logger.error(f"Error cleaning up session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error cleaning up session: {str(e)}")

# Mount static files (React build output)
frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    # Mount assets directory (Vite builds to assets, not static)
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

# Root route for serving frontend
@app.get("/")
async def serve_root():
    """Serve React frontend at root"""
    frontend_path = Path("frontend/dist/index.html")
    if frontend_path.exists():
        return FileResponse(frontend_path)
    else:
        return {"message": "Frontend not built. Run 'npm run build' in frontend directory."}

# Catch-all route for React Router (SPA) - this must be LAST
@app.get("/{path:path}")
async def serve_frontend(path: str):
    """Serve React frontend for all non-API routes"""
    # Skip API paths to avoid conflicts
    if path.startswith("api"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    frontend_path = Path("frontend/dist/index.html")
    if frontend_path.exists():
        return FileResponse(frontend_path)
    else:
        return {"message": "Frontend not built", "path": path}

# Application shutdown cleanup using atexit for compatibility
import atexit

def cleanup_on_exit():
    """Clean up resources when the application shuts down"""
    logger.info("Application shutting down - cleaning up resources")
    
    try:
        # Force close all open workbooks
        force_close_open_workbooks()
        
        # Clean up all sessions
        session_ids = list(sessions.keys())
        for session_id in session_ids:
            try:
                session_dir = UPLOADS_DIR / session_id
                if session_dir.exists():
                    shutil.rmtree(session_dir, ignore_errors=True)
            except Exception as e:
                logger.debug(f"Error cleaning session {session_id} on shutdown: {e}")
        
        # Clear all in-memory data
        sessions.clear()
        naming_configs.clear()
        ai_processed_cells.clear()
        manual_ai_edits.clear()
        
        logger.info("Application cleanup completed")
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")

# Register cleanup function
atexit.register(cleanup_on_exit)


if __name__ == "__main__":
    import uvicorn
    import signal
    import sys
    
    def signal_handler(sig, frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {sig}, shutting down gracefully...")
        # Force cleanup before exit
        force_close_open_workbooks()
        sys.exit(0)
    
    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )