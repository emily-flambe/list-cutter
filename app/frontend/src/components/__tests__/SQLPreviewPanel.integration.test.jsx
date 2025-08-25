import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SQLPreviewPanel from '../SQLPreviewPanel'

describe('SQLPreviewPanel Integration - Real User Flow [phase-1]', () => {
  // Mock columns from the actual NPORS dataset
  const mockNPORSColumns = [
    { name: 'Gender', type: 'TEXT' },
    { name: 'Age', type: 'NUMBER' },
    { name: 'Education', type: 'TEXT' },
    { name: 'Income', type: 'NUMBER' },
    { name: 'State', type: 'TEXT' },
    { name: 'Email', type: 'TEXT' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User adds "Gender contains woman" filter', () => {
    it('displays correct SQL with quoted table name and filter', async () => {
      // Start with no filters
      const { rerender } = render(
        <SQLPreviewPanel 
          filters={[]}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      // Initially should show just SELECT without WHERE
      expect(screen.getByTestId('sql-content').textContent).toBe(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"'
      )

      // User adds a filter: Gender contains woman
      // This simulates what happens when user configures filter in FilterPanel
      const filtersAfterAdding = [
        {
          id: Date.now(),
          selectedColumn: 'Gender',  // FilterPanel uses selectedColumn
          column: 'Gender',
          operator: 'contains',
          value: 'woman'
        }
      ]

      rerender(
        <SQLPreviewPanel 
          filters={filtersAfterAdding}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      // Should now show the WHERE clause with the filter
      await waitFor(() => {
        const sqlContent = screen.getByTestId('sql-content').textContent
        expect(sqlContent).toBe(
          'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
          'WHERE "Gender" LIKE \'%woman%\''
        )
      })
    })

    it('handles multiple filters correctly', async () => {
      // Simulate user adding multiple filters
      const multipleFilters = [
        {
          id: 1,
          selectedColumn: 'Gender',
          column: 'Gender',
          operator: 'contains',
          value: 'woman'
        },
        {
          id: 2,
          selectedColumn: 'Age',
          column: 'Age',
          operator: 'greater_than',
          value: '25'  // Note: FilterPanel sends as string
        },
        {
          id: 3,
          selectedColumn: 'State',
          column: 'State',
          operator: 'equals',
          value: 'California'
        }
      ]

      render(
        <SQLPreviewPanel 
          filters={multipleFilters}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      const sqlContent = screen.getByTestId('sql-content').textContent
      expect(sqlContent).toBe(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
        'WHERE "Gender" LIKE \'%woman%\'\n' +
        '  AND "Age" > 25\n' +
        '  AND "State" = \'California\''
      )
    })

    it('handles filter operators that map to SQL differently', async () => {
      const filterTestCases = [
        {
          filter: {
            id: 1,
            selectedColumn: 'Email',
            column: 'Email',
            operator: 'is_empty',  // FilterPanel sends is_empty
            value: ''
          },
          expectedSQL: '"Email" IS NULL'
        },
        {
          filter: {
            id: 2,
            selectedColumn: 'Email',
            column: 'Email',
            operator: 'is_not_empty',  // FilterPanel sends is_not_empty
            value: ''
          },
          expectedSQL: '"Email" IS NOT NULL'
        },
        {
          filter: {
            id: 3,
            selectedColumn: 'Gender',
            column: 'Gender',
            operator: 'not_equals',
            value: 'Prefer not to say'
          },
          expectedSQL: '"Gender" != \'Prefer not to say\''
        },
        {
          filter: {
            id: 4,
            selectedColumn: 'State',
            column: 'State',
            operator: 'starts_with',
            value: 'New'
          },
          expectedSQL: '"State" LIKE \'New%\''
        },
        {
          filter: {
            id: 5,
            selectedColumn: 'State',
            column: 'State',
            operator: 'ends_with',
            value: 'York'
          },
          expectedSQL: '"State" LIKE \'%York\''
        },
        {
          filter: {
            id: 6,
            selectedColumn: 'Education',
            column: 'Education',
            operator: 'not_contains',
            value: 'degree'
          },
          expectedSQL: '"Education" NOT LIKE \'%degree%\''
        }
      ]

      for (const testCase of filterTestCases) {
        const { unmount } = render(
          <SQLPreviewPanel 
            filters={[testCase.filter]}
            columns={mockNPORSColumns}
            isExpanded={true}
            tableName="2025 National Public Opinion Reference Survey"
          />
        )

        const sqlContent = screen.getByTestId('sql-content').textContent
        expect(sqlContent).toBe(
          'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
          'WHERE ' + testCase.expectedSQL
        )

        unmount()
      }
    })

    it('updates SQL in real-time as user modifies filter', async () => {
      const { rerender } = render(
        <SQLPreviewPanel 
          filters={[
            {
              id: 1,
              selectedColumn: 'Gender',
              column: 'Gender',
              operator: 'contains',
              value: 'man'  // Initial value
            }
          ]}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      // Check initial SQL
      expect(screen.getByTestId('sql-content').textContent).toContain(
        'WHERE "Gender" LIKE \'%man%\''
      )

      // User changes the value to 'woman'
      rerender(
        <SQLPreviewPanel 
          filters={[
            {
              id: 1,
              selectedColumn: 'Gender',
              column: 'Gender',
              operator: 'contains',
              value: 'woman'  // Updated value
            }
          ]}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      // SQL should update immediately
      await waitFor(() => {
        expect(screen.getByTestId('sql-content').textContent).toContain(
          'WHERE "Gender" LIKE \'%woman%\''
        )
      })
    })

    it('handles table names without spaces correctly', () => {
      render(
        <SQLPreviewPanel 
          filters={[
            {
              id: 1,
              selectedColumn: 'name',
              column: 'name',
              operator: 'contains',
              value: 'test'
            }
          ]}
          columns={[{ name: 'name', type: 'TEXT' }]}
          isExpanded={true}
          tableName="users"  // Simple table name without spaces
        />
      )

      const sqlContent = screen.getByTestId('sql-content').textContent
      // Table name should NOT be quoted when it doesn't have spaces
      expect(sqlContent).toBe(
        'SELECT * FROM users\n' +
        'WHERE "name" LIKE \'%test%\''
      )
    })

    it('escapes special characters in filter values', () => {
      const specialCharFilters = [
        {
          id: 1,
          selectedColumn: 'Name',
          column: 'Name',
          operator: 'contains',
          value: "O'Brien"  // Contains single quote
        }
      ]

      render(
        <SQLPreviewPanel 
          filters={specialCharFilters}
          columns={[{ name: 'Name', type: 'TEXT' }]}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      const sqlContent = screen.getByTestId('sql-content').textContent
      // Single quote should be escaped
      expect(sqlContent).toContain("LIKE '%O''Brien%'")
    })

    it('handles numeric filters without quotes', () => {
      const numericFilter = [
        {
          id: 1,
          selectedColumn: 'Age',
          column: 'Age',
          operator: 'greater_than',
          value: '25'  // Even though it's a string from the form
        }
      ]

      render(
        <SQLPreviewPanel 
          filters={numericFilter}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      const sqlContent = screen.getByTestId('sql-content').textContent
      // Number should not have quotes
      expect(sqlContent).toContain('WHERE "Age" > 25')
      expect(sqlContent).not.toContain("WHERE \"Age\" > '25'")
    })

    it('handles filters with missing or invalid data gracefully', () => {
      const invalidFilters = [
        {
          id: 1,
          // Missing column
          operator: 'contains',
          value: 'test'
        },
        {
          id: 2,
          selectedColumn: 'Gender',
          column: 'Gender',
          // Missing operator
          value: 'test'
        },
        null,  // Null filter
        undefined  // Undefined filter
      ]

      render(
        <SQLPreviewPanel 
          filters={invalidFilters}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      // Should show base query without crashing
      const sqlContent = screen.getByTestId('sql-content').textContent
      expect(sqlContent).toBe('SELECT * FROM "2025 National Public Opinion Reference Survey"')
    })
  })

  describe('Copy functionality with real filters', () => {
    it('copies the exact SQL that is displayed', async () => {
      const user = userEvent.setup()

      render(
        <SQLPreviewPanel 
          filters={[
            {
              id: 1,
              selectedColumn: 'Gender',
              column: 'Gender',
              operator: 'contains',
              value: 'woman'
            }
          ]}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      const copyButton = screen.getByRole('button', { name: /copy sql/i })
      await user.click(copyButton)

      // Should copy exactly what's displayed
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
        'WHERE "Gender" LIKE \'%woman%\''
      )

      // Should show success message
      expect(await screen.findByText(/SQL copied to clipboard!/)).toBeInTheDocument()
    })
  })

  describe('Real-world filter combinations', () => {
    it('handles a complex real-world filter scenario', () => {
      // Simulate a real user building a complex query
      const complexFilters = [
        {
          id: 1,
          selectedColumn: 'Gender',
          column: 'Gender',
          operator: 'contains',
          value: 'woman'
        },
        {
          id: 2,
          selectedColumn: 'Age',
          column: 'Age',
          operator: 'greater_than',
          value: '18'
        },
        {
          id: 3,
          selectedColumn: 'Age',
          column: 'Age',
          operator: 'less_than',
          value: '65'
        },
        {
          id: 4,
          selectedColumn: 'State',
          column: 'State',
          operator: 'not_equals',
          value: 'Alaska'
        },
        {
          id: 5,
          selectedColumn: 'Email',
          column: 'Email',
          operator: 'is_not_empty',
          value: ''
        }
      ]

      render(
        <SQLPreviewPanel 
          filters={complexFilters}
          columns={mockNPORSColumns}
          isExpanded={true}
          tableName="2025 National Public Opinion Reference Survey"
        />
      )

      const sqlContent = screen.getByTestId('sql-content').textContent
      
      // Verify the complete SQL query
      expect(sqlContent).toBe(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
        'WHERE "Gender" LIKE \'%woman%\'\n' +
        '  AND "Age" > 18\n' +
        '  AND "Age" < 65\n' +
        '  AND "State" != \'Alaska\'\n' +
        '  AND "Email" IS NOT NULL'
      )
    })
  })
})