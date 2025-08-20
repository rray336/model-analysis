# Model Analysis

A single file Excel financial model analyzer with progressive drill-down capabilities.

## ✅ Status: FULLY OPERATIONAL

All core features have been implemented and tested. The application is ready for production use!

## Features

- **Single File Upload**: Upload any Excel (.xlsx, .xls) file
- **Sheet Selection**: Choose from available sheets in your workbook
- **Cell Analysis**: Analyze any cell by entering its address (A1, B5, AC123, etc.)
- **Multi-Level Drill-down**: Click on ANY formula cell to drill down into its dependencies
  - True nested hierarchical expansion
  - Click on individual dependencies (like "Segments!BT57") to see their sub-dependencies
  - Unlimited depth exploration of formula relationships
  - Drivers appear above formulas (proper financial modeling flow)
- **Formula Complexity**: Automatic complexity assessment (simple, moderate, complex)
- **External Reference Detection**: Identifies and handles external file references (stops drill-down appropriately)
- **Interactive Tabular Visualization**: Clean hierarchical view with expandable/collapsible rows
- **Graph Placeholder**: Tab interface ready for future graph visualization implementation

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm

### Installation

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. **Build frontend**:
   ```bash
   npm run build
   ```

### Running the Application

**Start the server (combined API + frontend)**:
```bash
python main.py
```

The application will be available at: **http://localhost:8000**

## Development Workflow

### Making Frontend Changes

1. Make changes to files in `frontend/src/`
2. Rebuild frontend:
   ```bash
   npm run build
   ```
3. Refresh browser to see changes

### Making Backend Changes

1. Make changes to files in `backend/`
2. FastAPI auto-reloads, so just refresh browser

### Development Commands

```bash
# Install frontend dependencies
npm run install-frontend

# Build frontend for production
npm run build

# Run frontend in development mode (if needed)
cd frontend && npm run dev
```

## Usage

1. **Upload Excel File**: 
   - Click upload area or drag & drop an Excel file
   - Supported formats: .xlsx, .xls
   - File size limit: 50MB

2. **Select Sheet**: 
   - Choose from available sheets in dropdown
   - All sheets in workbook are automatically detected

3. **Enter Cell Address**: 
   - Use Excel format: A1, B5, AC123, etc.
   - Case insensitive input with auto-uppercase

4. **Analyze Cell**: 
   - Click "Analyze Cell" to get cell information
   - View value, formula, complexity, and drill-down capability

5. **Multi-Level Drill-down**: 
   - If cell has dependencies, drill-down table appears
   - Click chevron icons OR click on ANY formula cell to expand its dependencies
   - **True nested expansion**: Each formula cell becomes clickable for further drill-down
   - **Drivers appear above the formulas that use them** (proper financial modeling flow)
   - Navigate through unlimited levels of dependencies
   - View hierarchical relationships with visual indentation
   - Collapse/expand individual dependency branches

## API Endpoints

- `POST /api/upload` - Upload Excel file
- `GET /api/sheets/{session_id}` - Get available sheets
- `GET /api/analyze/{session_id}/{sheet}/{cell}` - Analyze specific cell
- `GET /api/drill-down/{session_id}/{sheet}/{cell}?depth=N` - Initial drill-down analysis
- `POST /api/expand-dependency/{session_id}/{sheet}/{cell}` - **NEW**: Expand individual dependencies for multi-level drill-down
- `DELETE /api/sessions/{session_id}` - Clean up session
- `GET /api/health` - Health check

## Project Structure

```
model-analysis/
├── main.py                  # Combined FastAPI server
├── requirements.txt         # Python dependencies
├── package.json            # Node.js build scripts
├── backend/
│   ├── app/
│   │   ├── api/            # API endpoints (auto-generated)
│   │   ├── services/       # FormulaAnalyzer service
│   │   ├── models/         # Pydantic data models
│   │   └── utils/          # Excel utilities
│   └── uploads/            # Temporary file storage
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API integration
│   │   └── types/          # TypeScript definitions
│   └── dist/               # Built frontend (served by FastAPI)
└── README.md
```

## Technology Stack

- **Backend**: FastAPI, Python, openpyxl
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Architecture**: Combined serving (FastAPI serves both API and frontend)

## Troubleshooting

### Frontend not loading
- Ensure you've run `npm run build` to build the frontend
- Check that `frontend/dist/` directory exists with built files

### Python import errors
- Make sure you're in the project root directory when running `python main.py`
- Verify all Python dependencies are installed with `pip install -r requirements.txt`

### Cell analysis not working
- Check cell address format (must be like A1, B5, AC123)
- Ensure the selected sheet name exists in the Excel file
- Verify the cell contains a formula for drill-down capability

### Upload fails
- Check file format (.xlsx or .xls only)
- Ensure file size is under 50MB
- Try a different Excel file to isolate the issue

## 🚀 Future Upgrades

Ready for implementation when needed:

### Graph Visualization
- Interactive dependency graphs with D3.js
- Node-link diagrams showing formula relationships
- Zoom, pan, and highlighting capabilities
- **Status**: UI placeholder implemented

### Cloud Deployment
- Railway deployment configuration (railway.json, Procfile)
- Production optimizations and scaling
- Environment variable management
- **Status**: Architecture ready

### Advanced Features
- Export drill-down results to Excel/CSV
- Support for multiple file analysis
- Enhanced formula complexity metrics
- Circular reference detection

## Support

For issues or questions, refer to the implementation plan in `IMPLEMENTATION_PLAN.md`.