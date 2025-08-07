# Phase 1: Backend Percentage Calculations

## Goal
Add percentage calculations to CrosstabProcessor without breaking existing functionality.

## Files to Modify
- `cloudflare/workers/src/services/crosstab-processor.ts`
- `cloudflare/workers/src/types.ts`

## Changes Required

### 1. Update CrosstabData Type
Add percentage matrices to existing type:
```typescript
export interface CrosstabData {
  crosstab: Record<string, Record<string, number>>;
  rowTotals: Record<string, number>;
  columnTotals: Record<string, number>;
  grandTotal: number;
  // ADD THESE:
  rowPercentages: Record<string, Record<string, number>>;
  columnPercentages: Record<string, Record<string, number>>;
  totalPercentages: Record<string, Record<string, number>>;
}
```

### 2. Add calculatePercentages Method
Add new method to CrosstabProcessor class:
```typescript
static calculatePercentages(crosstab, rowTotals, columnTotals, grandTotal) {
  const rowPercentages = {};
  const columnPercentages = {};
  const totalPercentages = {};
  
  for (const rowKey in crosstab) {
    rowPercentages[rowKey] = {};
    for (const colKey in crosstab[rowKey]) {
      const count = crosstab[rowKey][colKey];
      
      // Row %: count / row_total * 100
      rowPercentages[rowKey][colKey] = (count / rowTotals[rowKey]) * 100;
      
      // Column %: count / column_total * 100
      if (!columnPercentages[rowKey]) columnPercentages[rowKey] = {};
      columnPercentages[rowKey][colKey] = (count / columnTotals[colKey]) * 100;
      
      // Total %: count / grand_total * 100
      if (!totalPercentages[rowKey]) totalPercentages[rowKey] = {};
      totalPercentages[rowKey][colKey] = (count / grandTotal) * 100;
    }
  }
  
  return { rowPercentages, columnPercentages, totalPercentages };
}
```

### 3. Update generateCrosstab Method
Call calculatePercentages and include results in return:
```typescript
// After existing crosstab calculation, ADD:
const percentages = this.calculatePercentages(crosstab, rowTotals, columnTotals, grandTotal);

return {
  crosstab,
  rowTotals,
  columnTotals,
  grandTotal,
  ...percentages
};
```

## Testing
Verify existing API endpoints still return same data structure plus new percentage fields.