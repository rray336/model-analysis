# Model Analysis

A single file Excel financial model analyzer with progressive drill-down capabilities.

## ✅ Status: PROJECT COMPLETE

The Excel model analyzer is fully implemented and operational with comprehensive AI analysis features. All phases including drill-down analysis, smart naming systems, AI integration, source cell editing, and AI-powered analysis summaries are complete and tested.

**Latest additions**: AI Summary functionality with screenshot-based analysis for BASELINE, NEW, and Variance analysis modes

## Features

- **Single File Upload**: Upload any Excel (.xlsx, .xls) file
- **Sheet Selection**: Choose from available sheets in your workbook
- **Cell Analysis**: Analyze any cell by entering its address (A1, B5, AC123, etc.)
- **Multi-Level Drill-down**: Click on ANY formula cell to drill down into its dependencies
  - True nested hierarchical expansion
  - Click on individual dependencies (like "Segments!BT57") to see their sub-dependencies
  - Unlimited depth exploration of formula relationships
  - Drivers appear above formulas (proper financial modeling flow)
  - **Integrated source cell**: Source cell appears as the bottom row in the dependency table with special highlighting
- **Editable source cell naming**: Click to edit source cell names with consistent UI and persistence
- **Smart Cell Naming**: Transform technical cell references into meaningful business names
  - **Manual/AI Toggle**: Switch between manual three-component naming and AI-generated names
  - **Three-Component Manual Naming**: Context + Row Values + Column Values with real-time preview
    - **Context**: Free-text input for additional context
    - **Row Values**: Dropdown selection with sheet-level configuration (like column naming)
    - **Column Values**: Intelligent dropdown selection from meaningful row data
    - **Collapsible UI**: Toggle to show/hide component columns for clean viewing
  - **Sheet-level Configuration**: Row and column selections apply to entire sheets
  - **Consistent Behavior**: Both row and column dropdowns work symmetrically regardless of selection order
  - **Auto-propagation**: Once configured, all cells from that sheet get meaningful names
  - **Progressive setup**: Only configure sheets when needed, others remain technical
- **🤖 AI-Powered Contextual Naming**: Advanced AI naming using Google Gemini
  - **New "AI Name" column** with intelligent contextual analysis
  - **Optimized Screenshots**: Focused column display (A-E + target columns) for better AI accuracy
  - **Period-Aware Naming**: Enhanced prompts that extract periods and generate "[Period] [Description]" format
  - **Anti-Hallucination**: Strict instructions to prevent AI from generating fake names
  - **Extended Context**: AI sees full range needed for accurate analysis without overwhelming data
  - **Batch processing**: Generate names for all visible cells with one click
  - **Incremental updates**: Only processes new/unprocessed cells on repeated clicks
  - **Manual editing**: Click any AI name to edit with red text indicating user changes
  - **Confidence scores**: Shows AI confidence percentage for generated names
  - **Error handling**: Clear indicators for failed AI generations with manual fallback
  - **Session persistence**: AI names and manual edits persist across navigation
- **Formula Complexity**: Automatic complexity assessment (simple, moderate, complex)
- **External Reference Detection**: Identifies and handles external file references (stops drill-down appropriately)
- **Interactive Tabular Visualization**: Clean hierarchical view with expandable/collapsible rows
- **🚀 Analyze Mode**: Complete side-by-side comparison view with AI-powered analysis
  - **BASELINE vs NEW comparison**: Upload two Excel files for variance analysis
  - **AI Summary Generation**: Screenshot-based AI analysis using Google Gemini 2.5 Flash
    - **BASELINE AI Summary**: Comprehensive analysis of formula structure, 1% drivers, and risk assessment (150 words max)
    - **NEW AI Summary**: Identical analysis for comparison files (150 words max)  
    - **Variance AI Summary**: Detailed comparison analysis identifying major changes and quantitative impact (250 words max)
  - **Professional table screenshots**: Automated table generation with formula quoting for optimal AI analysis
  - **Increased textarea sizes**: Double-height textareas (8-12 rows) for better readability
  - **Dynamic source cell naming**: Variance analysis uses actual source cell names instead of hardcoded values
  - **Real-time error handling**: User-visible error messages with no silent failures

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 16+
- npm
- **Google Gemini API Key** (for AI naming features) - Get one at [Google AI Studio](https://makersuite.google.com/app/apikey)

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

4. **Configure AI (Optional)**:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env file and add your Gemini API key
   # GEMINI_API_KEY=your_actual_api_key_here
   ```
   
   Get your Gemini API key from: [Google AI Studio](https://makersuite.google.com/app/apikey)
   
   **Note**: The application works fully without an API key, but AI naming features will show "API not configured" messages.

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
   - If cell has dependencies, drill-down table appears with new Name column
   - Click chevron icons OR click on ANY formula cell to expand its dependencies
   - **True nested expansion**: Each formula cell becomes clickable for further drill-down
   - **Drivers appear above the formulas that use them** (proper financial modeling flow)
   - Navigate through unlimited levels of dependencies
   - View hierarchical relationships with visual indentation
   - Collapse/expand individual dependency branches

6. **Smart Naming Workflow**:
   - Initial view shows technical references like "Segments!BT71" with dropdown in Name column
   - Click dropdown to see row values from first few columns: [" ", "62", "Operating Income (loss)", "-1"]
   - Select meaningful option (e.g., "Operating Income (loss)" from column C)
   - **All cells from that worksheet instantly get meaningful names**
   - Other worksheets remain technical until you configure them
   - Configuration persists throughout your analysis session

7. **🤖 AI Naming Workflow**:
   - Click **"🤖 Generate AI Names"** button above the drill-down table
   - AI analyzes Excel context and generates contextual names for all visible cells
   - See results in new "AI Name" column with confidence percentages
   - **Click any AI name to edit manually** - edited names appear in red text
   - Repeated button clicks only process newly revealed cells from drill-downs
   - AI names persist across sheet navigation and session

## API Endpoints

- `POST /api/upload` - Upload Excel file
- `GET /api/sheets/{session_id}` - Get available sheets
- `GET /api/analyze/{session_id}/{sheet}/{cell}` - Analyze specific cell
- `GET /api/drill-down/{session_id}/{sheet}/{cell}?depth=N` - Initial drill-down analysis
- `POST /api/expand-dependency/{session_id}/{sheet}/{cell}` - Expand individual dependencies for multi-level drill-down
- `GET /api/row-values/{session_id}/{sheet_name}/{row_number}` - Get row values for column selection dropdown
- `POST /api/configure-sheet-naming/{session_id}/{sheet_name}/{column_letter}` - Configure naming column for a worksheet
- `GET /api/naming-config/{session_id}` - Get current naming configuration for session
- `POST /api/generate-ai-names/{session_id}/{sheet_name}` - Generate AI names for batch of cells using Gemini
- `GET /api/ai-processed-cells/{session_id}/{sheet_name}` - Get list of AI-processed cells for incremental updates
- `POST /api/mark-manual-edit/{session_id}/{sheet_name}/{cell_address}` - Mark cell as manually edited with custom name
- `POST /api/generate-baseline-summary/{session_id}` - **NEW**: Generate AI summary for BASELINE table data
- `POST /api/generate-new-summary/{session_id}` - **NEW**: Generate AI summary for NEW table data  
- `POST /api/generate-variance-summary/{baseline_session_id}/{new_session_id}` - **NEW**: Generate AI variance analysis comparing BASELINE vs NEW
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

- **Backend**: FastAPI, Python, openpyxl, Google Gemini 2.5 Flash, matplotlib
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **AI Integration**: Google Gemini API for contextual naming and analysis summaries
- **Architecture**: Combined serving (FastAPI serves both API and frontend)

## ⚡ Final Implementation - Complete AI Analysis Suite

### File Cleanup & Memory Management
- **Windows-Compatible Cleanup**: Enhanced upload directory cleanup with proper file handle management
- **Age-Based Deletion**: Only attempts to delete files older than 24 hours to avoid conflicts
- **Improved Error Handling**: Reduced warning spam and better handling of locked files
- **Automatic Cleanup**: Proper workbook closure using `finally` blocks in all Excel operations
- **Session Management**: Force close open workbooks on application shutdown
- **Manual Cleanup**: Added `/api/force-cleanup` endpoint for manual cleanup when needed

### AI Naming Enhancements
- **Improved Prompts**: Enhanced AI instructions to generate clean line item names without years
- **Contextual Focus**: AI now focuses on "WHAT" the line item is, not "WHEN" it applies
- **Consistent Naming**: Generates base names like "Revenue" instead of "Revenue 2024"
- **Better Instructions**: Clear guidelines prevent time period assumptions from limited column view

### Source Cell Improvements
- **Editable Source Cell Names**: Click-to-edit functionality for source cell naming
- **Consistent UI**: Source cell editing uses same interface as dependency cells
- **Visual Consistency**: Blue styling for edited names, removing error-like red coloring
- **Proper Alignment**: Decimal point alignment in value columns for professional appearance
- **State Persistence**: Source cell names persist throughout analysis session

### AI Analysis Suite (Final Implementation)
- **Screenshot-Based Analysis**: Professional table screenshots using matplotlib for optimal AI analysis
- **Google Gemini 2.5 Flash Integration**: Upgraded from 1.5 Flash for better multimodal performance
- **Three Analysis Types**: BASELINE, NEW, and comprehensive Variance analysis
- **Word Count Limits**: Concise summaries (150/250 words) to prevent information overload
- **Dynamic Prompts**: Source cell names dynamically integrated into variance analysis prompts
- **Professional Table Formatting**: Formula quoting and color coding for better AI comprehension
- **Error Handling**: Real-time error display with no silent failures
- **UI Improvements**: Double-height textareas (8-12 rows) for better content visibility

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

## 🚀 Known Issues

### AI Names Section Visibility (Analyze Mode)
- **Issue**: The "Generate AI Names" section remains visible in Analyze mode despite multiple hiding attempts
- **Impact**: Minor UI inconsistency - section should be hidden when in Analyze mode
- **Workaround**: Section functionality is not needed in Analyze mode, so can be ignored
- **Technical Details**: State synchronization issue between tab appearance and content visibility logic
- **Status**: Unresolved - would require deeper investigation of React state management

## 🚀 Future Enhancements

Ready for implementation when needed:

### Advanced Analysis Features  
- Export drill-down results to Excel/CSV
- Support for multiple file analysis
- Enhanced formula complexity metrics
- Circular reference detection

### Cloud Deployment
- Railway deployment configuration (railway.json, Procfile)
- Production optimizations and scaling
- Environment variable management
- **Status**: Architecture ready

### Visualization Enhancements
- Node-link diagrams showing formula relationships
- Advanced analytics and visualization capabilities
- Zoom, pan, and highlighting capabilities

## Support

For issues or questions, refer to the implementation plan in `IMPLEMENTATION_PLAN.md`.