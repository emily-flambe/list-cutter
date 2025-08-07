# Phase 2: Frontend Display Options

## Goal
Add percentage toggle controls to crosstab table without breaking existing display.

## Files to Modify
- `app/frontend/src/components/CuttytabsTable.jsx`
- `app/frontend/src/components/Cuttytabs.jsx` (minor update)

## Changes Required

### 1. Add Display Mode State
Add to CuttytabsTable component:
```jsx
const [displayMode, setDisplayMode] = useState('counts'); // 'counts', 'row', 'column', 'total'
```

### 2. Add Toggle Controls
Add radio buttons before table:
```jsx
<Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
  <FormControl component="fieldset">
    <RadioGroup row value={displayMode} onChange={(e) => setDisplayMode(e.target.value)}>
      <FormControlLabel value="counts" control={<Radio />} label="Counts" />
      <FormControlLabel value="row" control={<Radio />} label="Row %" />
      <FormControlLabel value="column" control={<Radio />} label="Column %" />
      <FormControlLabel value="total" control={<Radio />} label="Total %" />
    </RadioGroup>
  </FormControl>
</Box>
```

### 3. Update Cell Display Logic
Replace existing cell rendering with:
```jsx
const getCellDisplay = (rowKey, colKey) => {
  const count = crosstab[rowKey]?.[colKey] || 0;
  
  switch (displayMode) {
    case 'row':
      const rowPct = data.rowPercentages[rowKey]?.[colKey] || 0;
      return `${count} (${rowPct.toFixed(1)}%)`;
    case 'column':
      const colPct = data.columnPercentages[rowKey]?.[colKey] || 0;
      return `${count} (${colPct.toFixed(1)}%)`;
    case 'total':
      const totalPct = data.totalPercentages[rowKey]?.[colKey] || 0;
      return `${count} (${totalPct.toFixed(1)}%)`;
    default:
      return count;
  }
};
```

### 4. Update Cell Rendering
Change table cell content to:
```jsx
<TableCell align="center">
  {getCellDisplay(rowKey, colKey)}
</TableCell>
```

### 5. Add Import
Add to imports:
```jsx
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
```

## Testing
Verify toggle switches work and percentages calculate correctly for NPORS demo data.