"""
Main FastAPI application serving both API and React frontend
"""
import uuid
import os
import shutil
from pathlib import Path
from typing import List
import logging
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.app.models.analysis import (
    UploadResponse, 
    CellInfo, 
    DrillDownResponse, 
    DependencyInfo,
    ErrorResponse
)
from backend.app.services.formula_analyzer import FormulaAnalyzer
from backend.app.utils.excel_utils import (
    ExcelReader, 
    get_cell_value_and_formula, 
    validate_cell_address
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Financial Model Analyzer",
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

# Create uploads directory
UPLOADS_DIR = Path("backend/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Store session data in memory (use database for production)
sessions: dict = {}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_excel_file(file: UploadFile = File(...)):
    """Upload a single Excel file and return session information"""
    
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
        
        # Convert to API response format
        dependency_list = []
        for dep in dependencies:
            dependency_list.append(DependencyInfo(
                name=dep.name,
                cell_reference=dep.cell_reference,
                value=dep.value,
                formula=dep.formula,
                is_leaf=dep.is_leaf_node,
                can_expand=not dep.is_leaf_node and len(dep.dependencies) == 0,  # Has formula but not yet expanded
                depth=depth
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

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Financial Model Analyzer"}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )