import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SQLPreviewPanel from '../SQLPreviewPanel'

describe('Exact User Flow - Gender contains woman [phase-1]', () => {
  it('reproduces the exact issue: Gender contains woman filter with NPORS 2025 dataset', async () => {
    // This test reproduces the exact scenario reported:
    // 1. User has NPORS 2025 dataset loaded
    // 2. User adds filter: Gender contains woman
    // 3. User clicks "Apply Filters"
    // 4. SQL Preview should show the filter
    
    const nporsColumns = [
      { name: 'Gender', type: 'TEXT' },
      { name: 'Age', type: 'NUMBER' },
      { name: 'Race', type: 'TEXT' },
      { name: 'Education', type: 'TEXT' },
      { name: 'Income', type: 'NUMBER' }
    ]
    
    // Step 1: Initial render with no filters
    const { rerender } = render(
      <SQLPreviewPanel 
        filters={[]}
        columns={nporsColumns}
        isExpanded={true}
        tableName="2025 National Public Opinion Reference Survey"
        persistState={false}
      />
    )
    
    // Verify initial state - should show table name in quotes, no WHERE clause
    let sqlContent = screen.getByTestId('sql-content')
    expect(sqlContent.textContent).toBe(
      'SELECT * FROM "2025 National Public Opinion Reference Survey"'
    )
    
    // Step 2: User adds "Gender contains woman" filter
    // This is the exact filter structure from FilterPanel
    const filterAfterUserAdds = {
      id: 1706543210000,  // Timestamp ID like FilterPanel generates
      selectedColumn: 'Gender',  // FilterPanel uses selectedColumn
      column: 'Gender',
      operator: 'contains',
      value: 'woman'
    }
    
    // Step 3: User clicks "Apply Filters" - filters are passed to SQLPreviewPanel
    rerender(
      <SQLPreviewPanel 
        filters={[filterAfterUserAdds]}
        columns={nporsColumns}
        isExpanded={true}
        tableName="2025 National Public Opinion Reference Survey"
        persistState={false}
      />
    )
    
    // Step 4: Verify SQL now shows the filter correctly
    await waitFor(() => {
      sqlContent = screen.getByTestId('sql-content')
      const sql = sqlContent.textContent
      
      // Check that table name is properly quoted
      expect(sql).toContain('"2025 National Public Opinion Reference Survey"')
      
      // Check that WHERE clause exists
      expect(sql).toContain('WHERE')
      
      // Check that Gender column is referenced
      expect(sql).toContain('"Gender"')
      
      // Check that LIKE operator is used for contains
      expect(sql).toContain('LIKE')
      
      // Check that the value is properly formatted
      expect(sql).toContain("'%woman%'")
      
      // Check the complete SQL
      expect(sql).toBe(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
        'WHERE "Gender" LIKE \'%woman%\''
      )
    })
    
    console.log('✅ Test passed: SQL correctly shows "Gender contains woman" filter')
  })
  
  it('handles the complete filter lifecycle', async () => {
    const user = userEvent.setup()
    const nporsColumns = [{ name: 'Gender', type: 'TEXT' }]
    
    // Track filter changes
    let currentFilters = []
    
    const TestWrapper = () => {
      const [filters, setFilters] = React.useState(currentFilters)
      
      return (
        <div>
          <button 
            onClick={() => {
              // Simulate adding filter
              const newFilter = {
                id: Date.now(),
                selectedColumn: 'Gender',
                column: 'Gender',
                operator: 'contains',
                value: 'woman'
              }
              currentFilters = [...currentFilters, newFilter]
              setFilters(currentFilters)
            }}
            data-testid="add-filter-btn"
          >
            Add Filter
          </button>
          
          <button 
            onClick={() => {
              // Simulate applying filters (no-op, just for clarity)
              console.log('Filters applied:', currentFilters)
            }}
            data-testid="apply-filters-btn"
          >
            Apply Filters
          </button>
          
          <SQLPreviewPanel 
            filters={filters}
            columns={nporsColumns}
            isExpanded={true}
            tableName="2025 National Public Opinion Reference Survey"
          />
        </div>
      )
    }
    
    const React = await import('react')
    render(<TestWrapper />)
    
    // Initially no filters
    expect(screen.getByTestId('sql-content').textContent).toBe(
      'SELECT * FROM "2025 National Public Opinion Reference Survey"'
    )
    
    // Add filter
    await user.click(screen.getByTestId('add-filter-btn'))
    
    // SQL should update immediately (real-time)
    await waitFor(() => {
      expect(screen.getByTestId('sql-content').textContent).toBe(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
        'WHERE "Gender" LIKE \'%woman%\''
      )
    })
    
    // Click Apply (shouldn't change anything, SQL already updated)
    await user.click(screen.getByTestId('apply-filters-btn'))
    
    // SQL should remain the same
    expect(screen.getByTestId('sql-content').textContent).toBe(
      'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
      'WHERE "Gender" LIKE \'%woman%\''
    )
  })
  
  it('verifies all fixes are working', () => {
    // Test case to verify both reported issues are fixed
    
    const testCases = [
      {
        name: 'Table name with spaces is quoted',
        filters: [],
        tableName: '2025 National Public Opinion Reference Survey',
        expectedSQL: 'SELECT * FROM "2025 National Public Opinion Reference Survey"'
      },
      {
        name: 'Filter is shown in WHERE clause',
        filters: [{
          id: 1,
          selectedColumn: 'Gender',
          column: 'Gender',
          operator: 'contains',
          value: 'woman'
        }],
        tableName: '2025 National Public Opinion Reference Survey',
        expectedSQL: 'SELECT * FROM "2025 National Public Opinion Reference Survey"\nWHERE "Gender" LIKE \'%woman%\''
      },
      {
        name: 'Table without spaces is not quoted',
        filters: [],
        tableName: 'users',
        expectedSQL: 'SELECT * FROM users'
      },
      {
        name: 'Table with hyphen is quoted',
        filters: [],
        tableName: 'user-data',
        expectedSQL: 'SELECT * FROM "user-data"'
      }
    ]
    
    testCases.forEach(testCase => {
      const { unmount } = render(
        <SQLPreviewPanel 
          filters={testCase.filters}
          columns={[{ name: 'Gender', type: 'TEXT' }]}
          isExpanded={true}
          tableName={testCase.tableName}
        />
      )
      
      const sql = screen.getByTestId('sql-content').textContent
      expect(sql).toBe(testCase.expectedSQL)
      console.log(`✅ ${testCase.name}: PASSED`)
      
      unmount()
    })
  })
})