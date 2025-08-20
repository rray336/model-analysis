"""
Excel Formula Analysis Engine
Parses Excel formulas to build drill-down dependency trees
"""
import re
import openpyxl
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple, Any
from dataclasses import dataclass, field
import logging

logger = logging.getLogger(__name__)

@dataclass
class CellReference:
    """Represents a single cell reference"""
    sheet_name: Optional[str] = None
    column: str = ""
    row: int = 0
    is_absolute_column: bool = False
    is_absolute_row: bool = False
    is_range: bool = False
    range_end_column: Optional[str] = None
    range_end_row: Optional[int] = None
    
    def __str__(self):
        abs_col = "$" if self.is_absolute_column else ""
        abs_row = "$" if self.is_absolute_row else ""
        
        if self.is_range:
            range_abs_col = "$" if self.is_absolute_column else ""
            range_abs_row = "$" if self.is_absolute_row else ""
            base = f"{abs_col}{self.column}{abs_row}{self.row}"
            end = f"{range_abs_col}{self.range_end_column}{range_abs_row}{self.range_end_row}"
            result = f"{base}:{end}"
        else:
            result = f"{abs_col}{self.column}{abs_row}{self.row}"
        
        if self.sheet_name:
            return f"{self.sheet_name}!{result}"
        return result

@dataclass
class FormulaComponent:
    """Represents a component of a formula breakdown"""
    name: str
    cell_reference: str
    value: float
    formula: Optional[str] = None
    is_leaf_node: bool = False
    dependencies: List['FormulaComponent'] = field(default_factory=list)
    variance_contribution: float = 0.0

@dataclass
class DrillDownResult:
    """Result of drilling down into a formula"""
    source_item: str
    source_value: float
    components: List[FormulaComponent]
    total_explained: float
    unexplained_variance: float
    drill_down_path: List[str]

class FormulaAnalyzer:
    """Analyzes Excel formulas for drill-down capabilities"""
    
    def __init__(self):
        # Compile regex patterns for performance
        self.cell_pattern = re.compile(
            r"(?:(['\w\s]+)!)?"  # Optional sheet name with quotes
            r"(\$?[A-Z]+)(\$?\d+)"  # Column and row
            r"(?::(\$?[A-Z]+)(\$?\d+))?"  # Optional range end
        )
        
        self.simple_cell_pattern = re.compile(r"([A-Z]+)(\d+)")
        
        # Function patterns we can analyze
        self.supported_functions = {
            'SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN', 'SUMIF', 'SUMIFS',
            'IF', 'IFERROR', 'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH'
        }
        
    def parse_formula(self, formula: str) -> List[CellReference]:
        """Parse an Excel formula and extract cell references"""
        if not formula or not formula.startswith('='):
            return []
        
        # Clean up the formula
        formula_clean = formula[1:]  # Remove leading =
        
        # Check for external file references (e.g., [Workbook.xlsx]Sheet1!A1)
        if '[' in formula_clean and ']' in formula_clean:
            logger.info(f"External file reference detected in formula: {formula[:100]}...")
        
        references = []
        matches = self.cell_pattern.findall(formula_clean)
        
        for match in matches:
            sheet_name, col, row, range_col, range_row = match
            
            try:
                # Clean sheet name (remove quotes if present)
                if sheet_name:
                    sheet_name = sheet_name.strip("'\"")
                
                # Parse absolute references
                is_abs_col = col.startswith('$')
                is_abs_row = row.startswith('$')
                
                col_clean = col.replace('$', '')
                row_clean = int(row.replace('$', ''))
                
                ref = CellReference(
                    sheet_name=sheet_name if sheet_name else None,
                    column=col_clean,
                    row=row_clean,
                    is_absolute_column=is_abs_col,
                    is_absolute_row=is_abs_row
                )
                
                # Handle ranges
                if range_col and range_row:
                    ref.is_range = True
                    ref.range_end_column = range_col.replace('$', '')
                    ref.range_end_row = int(range_row.replace('$', ''))
                
                references.append(ref)
                
            except (ValueError, IndexError) as e:
                logger.warning(f"Could not parse cell reference from formula: {match}")
                continue
        
        return references
    
    def get_formula_function(self, formula: str) -> Optional[str]:
        """Extract the main function from a formula"""
        if not formula or not formula.startswith('='):
            return None
            
        # Look for function patterns
        formula_upper = formula.upper()
        for func in self.supported_functions:
            if f"{func}(" in formula_upper:
                return func
                
        return None
    
    def build_dependency_tree(self, workbook_path: Path, sheet_name: str, 
                            cell_address: str, max_depth: int = 5) -> Optional[FormulaComponent]:
        """Build a dependency tree for a specific cell"""
        
        try:
            wb = openpyxl.load_workbook(workbook_path, data_only=False)
            wb_data = openpyxl.load_workbook(workbook_path, data_only=True)
            
            if sheet_name not in wb.sheetnames:
                logger.warning(f"Sheet '{sheet_name}' not found in workbook")
                return None
            
            component = self._analyze_cell_recursive(
                wb, wb_data, sheet_name, cell_address, max_depth=max_depth, current_depth=0
            )
            
            wb.close()
            wb_data.close()
            
            return component
            
        except Exception as e:
            logger.error(f"Error building dependency tree: {e}")
            return None
    
    def _analyze_cell_recursive(self, wb, wb_data, sheet_name: str, cell_address: str,
                               max_depth: int, current_depth: int, visited_cells: set = None) -> Optional[FormulaComponent]:
        """Recursively analyze a cell and its dependencies"""
        
        if current_depth > max_depth:
            return None
            
        # Initialize visited cells set to prevent circular references
        if visited_cells is None:
            visited_cells = set()
            
        # Create a unique identifier for this cell
        cell_id = f"{sheet_name}!{cell_address}"
        
        # Check for circular references
        if cell_id in visited_cells:
            logger.warning(f"Circular reference detected: {cell_id}")
            return None
            
        # Add this cell to the visited set
        visited_cells.add(cell_id)
            
        try:
            # Check if the target sheet exists
            if sheet_name not in wb.sheetnames:
                logger.warning(f"Sheet '{sheet_name}' not found in workbook")
                visited_cells.remove(cell_id)  # Clean up before returning
                return None
                
            # Get the cell with formulas
            sheet = wb[sheet_name]
            sheet_data = wb_data[sheet_name]
            
            # Parse cell address (e.g., "A1", "B5")
            cell_match = self.simple_cell_pattern.match(cell_address)
            if not cell_match:
                return None
                
            col, row = cell_match.groups()
            row = int(row)
            
            # Get cell objects
            cell = sheet[f"{col}{row}"]
            cell_data = sheet_data[f"{col}{row}"]
            
            # Get the value
            value = 0.0
            if cell_data.value is not None and isinstance(cell_data.value, (int, float)):
                value = float(cell_data.value)
            
            # Create component
            component = FormulaComponent(
                name=f"{sheet_name}!{cell_address}",
                cell_reference=f"{sheet_name}!{cell_address}",
                value=value,
                formula=cell.value if cell.data_type == 'f' else None,
                is_leaf_node=cell.data_type != 'f'
            )
            
            # If it's a formula cell, analyze dependencies
            if cell.data_type == 'f' and cell.value:
                formula = str(cell.value)
                
                # Stop if external references detected
                if self._has_external_references(formula):
                    logger.info(f"External reference detected in {cell_id}, stopping drill-down")
                    component.is_leaf_node = True
                    return component
                
                references = self.parse_formula(formula)
                
                # Analyze each reference
                for ref in references:
                    if ref.is_range:
                        # Handle ranges by expanding them
                        range_components = self._expand_range_reference(
                            wb, wb_data, ref, max_depth, current_depth + 1, visited_cells.copy()
                        )
                        component.dependencies.extend(range_components)
                    else:
                        # Single cell reference
                        target_sheet = ref.sheet_name if ref.sheet_name else sheet_name
                        target_address = f"{ref.column}{ref.row}"
                        
                        dep_component = self._analyze_cell_recursive(
                            wb, wb_data, target_sheet, target_address, 
                            max_depth, current_depth + 1, visited_cells.copy()
                        )
                        
                        if dep_component:
                            component.dependencies.append(dep_component)
            
            return component
            
        except Exception as e:
            logger.warning(f"Error analyzing cell {sheet_name}!{cell_address}: {e}")
            return None
    
    def _expand_range_reference(self, wb, wb_data, ref: CellReference, 
                               max_depth: int, current_depth: int, visited_cells: set) -> List[FormulaComponent]:
        """Expand a range reference into individual cell components"""
        
        components = []
        
        if not ref.is_range:
            return components
            
        try:
            # Convert column letters to numbers
            start_col_num = self._column_letter_to_number(ref.column)
            end_col_num = self._column_letter_to_number(ref.range_end_column)
            
            # Ensure we don't process huge ranges
            max_cells = 50
            cell_count = 0
            
            for row in range(ref.row, ref.range_end_row + 1):
                for col_num in range(start_col_num, end_col_num + 1):
                    if cell_count >= max_cells:
                        logger.info(f"Range too large, limiting to {max_cells} cells")
                        return components
                    
                    col_letter = self._number_to_column_letter(col_num)
                    target_sheet = ref.sheet_name if ref.sheet_name else None
                    target_address = f"{col_letter}{row}"
                    
                    component = self._analyze_cell_recursive(
                        wb, wb_data, target_sheet, target_address,
                        max_depth, current_depth, visited_cells.copy()
                    )
                    
                    if component and abs(component.value) > 0.01:  # Only include non-zero values
                        components.append(component)
                    
                    cell_count += 1
            
        except Exception as e:
            logger.warning(f"Error expanding range {ref}: {e}")
        
        return components
    
    def _column_letter_to_number(self, column_letter: str) -> int:
        """Convert Excel column letter to number (A=1, B=2, etc.)"""
        result = 0
        for char in column_letter:
            result = result * 26 + (ord(char.upper()) - ord('A') + 1)
        return result
    
    def _number_to_column_letter(self, column_number: int) -> str:
        """Convert number to Excel column letter"""
        result = ""
        while column_number > 0:
            column_number -= 1
            result = chr(column_number % 26 + ord('A')) + result
            column_number //= 26
        return result
    
    def analyze_formula_complexity(self, formula: str) -> Dict[str, Any]:
        """Analyze the complexity of a formula for UI hints"""
        if not formula or not formula.startswith('='):
            return {"complexity": "simple", "can_drill_down": False}
        
        # Count references
        references = self.parse_formula(formula)
        ref_count = len(references)
        
        # Check for functions
        main_function = self.get_formula_function(formula)
        
        # Determine complexity
        complexity = "simple"
        if ref_count > 10:
            complexity = "complex"
        elif ref_count > 3 or main_function in ['SUMIF', 'SUMIFS', 'VLOOKUP']:
            complexity = "moderate"
        
        # Check for cross-sheet references
        has_cross_sheet = any(ref.sheet_name for ref in references)
        
        # Check for external references
        has_external_refs = self._has_external_references(formula)
        
        return {
            "complexity": complexity,
            "can_drill_down": ref_count > 0 and not has_external_refs,
            "reference_count": ref_count,
            "main_function": main_function,
            "has_cross_sheet_refs": has_cross_sheet,
            "has_external_refs": has_external_refs,
            "estimated_depth": min(5, ref_count // 2) if ref_count > 0 else 0
        }
    
    def _has_external_references(self, formula: str) -> bool:
        """Check if formula contains external file references"""
        if not formula:
            return False
        
        # Look for patterns like [Workbook.xlsx] or ['External File.xlsx']
        external_patterns = [
            r'\[[^\]]+\.xlsx?\]',  # [Workbook.xlsx]
            r'\[[^\]]+\.xlsm?\]',  # [Workbook.xlsm] 
            r"'\[[^']+\.[^']+\.xlsx?\]'",  # ['External File.xlsx']
        ]
        
        for pattern in external_patterns:
            if re.search(pattern, formula, re.IGNORECASE):
                return True
                
        return False
    
    def get_progressive_dependencies(self, workbook_path: Path, sheet_name: str, 
                                   cell_address: str, depth: int = 1) -> Optional[List[FormulaComponent]]:
        """Get dependencies at a specific depth level for progressive drill-down"""
        try:
            wb = openpyxl.load_workbook(workbook_path, data_only=False)
            wb_data = openpyxl.load_workbook(workbook_path, data_only=True)
            
            if sheet_name not in wb.sheetnames:
                logger.warning(f"Sheet '{sheet_name}' not found in workbook")
                return None
            
            # Build tree up to the requested depth
            component = self._analyze_cell_recursive(
                wb, wb_data, sheet_name, cell_address, max_depth=depth, current_depth=0
            )
            
            wb.close()
            wb_data.close()
            
            if component:
                return component.dependencies
            return []
            
        except Exception as e:
            logger.error(f"Error getting progressive dependencies: {e}")
            return None