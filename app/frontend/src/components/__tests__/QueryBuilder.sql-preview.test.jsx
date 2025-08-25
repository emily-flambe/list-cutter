import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'

// Mock the API
vi.mock('../../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn()
  }
}))

// Since QueryBuilder is complex, we'll create a simplified test component
// that mimics the Filter + SQL Preview interaction
const SimplifiedQueryBuilderTest = () => {
  const [filters, setFilters] = React.useState([])
  const [sqlPanelExpanded, setSqlPanelExpanded] = React.useState(true)
  
  const columns = [
    { name: 'Gender', type: 'TEXT' },
    { name: 'Age', type: 'NUMBER' },
    { name: 'State', type: 'TEXT' }
  ]
  
  const handleAddFilter = (column, operator, value) => {
    const newFilter = {
      id: Date.now(),
      selectedColumn: column,
      column: column,
      operator: operator,
      value: value
    }
    setFilters([...filters, newFilter])
  }
  
  const handleRemoveFilter = (filterId) => {
    setFilters(filters.filter(f => f.id !== filterId))
  }
  
  const handleClearFilters = () => {
    setFilters([])
  }
  
  return (
    <div>
      <h1>Query Builder Test</h1>
      
      {/* Simplified Filter Panel */}
      <div data-testid="filter-panel">
        <h2>Filters ({filters.length})</h2>
        
        {/* Add Gender contains woman filter button */}
        <button
          data-testid="add-gender-filter"
          onClick={() => handleAddFilter('Gender', 'contains', 'woman')}
        >
          Add "Gender contains woman" Filter
        </button>
        
        {/* Add Age > 25 filter button */}
        <button
          data-testid="add-age-filter"
          onClick={() => handleAddFilter('Age', 'greater_than', '25')}
        >
          Add "Age > 25" Filter
        </button>
        
        {/* Clear all filters */}
        <button
          data-testid="clear-filters"
          onClick={handleClearFilters}
        >
          Clear All Filters
        </button>
        
        {/* Display active filters */}
        <div data-testid="active-filters">
          {filters.map(filter => (
            <div key={filter.id} data-testid={`filter-${filter.id}`}>
              {filter.column} {filter.operator} {filter.value}
              <button 
                onClick={() => handleRemoveFilter(filter.id)}
                data-testid={`remove-filter-${filter.id}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Import the actual SQLPreviewPanel */}
      <div data-testid="sql-preview-container">
        {React.createElement(require('../SQLPreviewPanel').default, {
          filters: filters,
          columns: columns,
          isExpanded: sqlPanelExpanded,
          onToggle: setSqlPanelExpanded,
          tableName: '2025 National Public Opinion Reference Survey'
        })}
      </div>
    </div>
  )
}

describe('QueryBuilder SQL Preview Integration [phase-1]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete user flow: Add filter and see SQL', () => {
    it('shows correct SQL when user adds "Gender contains woman" filter', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <SimplifiedQueryBuilderTest />
        </BrowserRouter>
      )
      
      // Initially, SQL should show no WHERE clause
      const sqlContent = screen.getByTestId('sql-content')
      expect(sqlContent.textContent).toBe(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"'
      )
      
      // User clicks to add Gender filter
      const addGenderButton = screen.getByTestId('add-gender-filter')
      await user.click(addGenderButton)
      
      // Verify filter was added to the panel
      await waitFor(() => {
        const activeFilters = screen.getByTestId('active-filters')
        expect(within(activeFilters).getByText(/Gender contains woman/)).toBeInTheDocument()
      })
      
      // SQL Preview should update immediately
      await waitFor(() => {
        expect(sqlContent.textContent).toBe(
          'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
          'WHERE "Gender" LIKE \'%woman%\''
        )
      })
    })

    it('shows correct SQL with multiple filters', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <SimplifiedQueryBuilderTest />
        </BrowserRouter>
      )
      
      const sqlContent = screen.getByTestId('sql-content')
      
      // Add Gender filter
      await user.click(screen.getByTestId('add-gender-filter'))
      
      // Add Age filter
      await user.click(screen.getByTestId('add-age-filter'))
      
      // SQL should show both filters
      await waitFor(() => {
        expect(sqlContent.textContent).toBe(
          'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
          'WHERE "Gender" LIKE \'%woman%\'\n' +
          '  AND "Age" > 25'
        )
      })
    })

    it('updates SQL when filters are removed', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <SimplifiedQueryBuilderTest />
        </BrowserRouter>
      )
      
      const sqlContent = screen.getByTestId('sql-content')
      
      // Add two filters
      await user.click(screen.getByTestId('add-gender-filter'))
      await user.click(screen.getByTestId('add-age-filter'))
      
      // Verify both filters are in SQL
      await waitFor(() => {
        expect(sqlContent.textContent).toContain('WHERE "Gender" LIKE')
        expect(sqlContent.textContent).toContain('AND "Age" > 25')
      })
      
      // Remove the first filter
      const removeButtons = screen.getAllByText('Remove')
      await user.click(removeButtons[0])
      
      // SQL should only show the Age filter now
      await waitFor(() => {
        expect(sqlContent.textContent).toBe(
          'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
          'WHERE "Age" > 25'
        )
      })
    })

    it('clears SQL when all filters are removed', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <SimplifiedQueryBuilderTest />
        </BrowserRouter>
      )
      
      const sqlContent = screen.getByTestId('sql-content')
      
      // Add filters
      await user.click(screen.getByTestId('add-gender-filter'))
      await user.click(screen.getByTestId('add-age-filter'))
      
      // Clear all filters
      await user.click(screen.getByTestId('clear-filters'))
      
      // SQL should go back to base query
      await waitFor(() => {
        expect(sqlContent.textContent).toBe(
          'SELECT * FROM "2025 National Public Opinion Reference Survey"'
        )
      })
    })

    it('copies SQL to clipboard when copy button is clicked', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <SimplifiedQueryBuilderTest />
        </BrowserRouter>
      )
      
      // Add a filter
      await user.click(screen.getByTestId('add-gender-filter'))
      
      // Wait for SQL to update
      await waitFor(() => {
        const sqlContent = screen.getByTestId('sql-content')
        expect(sqlContent.textContent).toContain('WHERE "Gender" LIKE')
      })
      
      // Click copy button
      const copyButton = screen.getByRole('button', { name: /copy sql/i })
      await user.click(copyButton)
      
      // Verify clipboard was called with correct SQL
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'SELECT * FROM "2025 National Public Opinion Reference Survey"\n' +
        'WHERE "Gender" LIKE \'%woman%\''
      )
      
      // Success message should appear
      expect(await screen.findByText(/SQL copied to clipboard!/)).toBeInTheDocument()
    })
  })

  describe('SQL Panel expansion state', () => {
    it('toggles SQL panel visibility', async () => {
      const user = userEvent.setup()
      
      render(
        <BrowserRouter>
          <SimplifiedQueryBuilderTest />
        </BrowserRouter>
      )
      
      // Panel should be expanded initially
      const sqlContent = screen.getByTestId('sql-content')
      expect(sqlContent).toBeVisible()
      
      // Click to collapse
      const accordionHeader = screen.getByText(/SQL Preview/)
      await user.click(accordionHeader)
      
      // Content should be hidden
      await waitFor(() => {
        expect(sqlContent).not.toBeVisible()
      })
      
      // Click to expand again
      await user.click(accordionHeader)
      
      // Content should be visible again
      await waitFor(() => {
        expect(sqlContent).toBeVisible()
      })
    })
  })

  describe('Real-time updates', () => {
    it('updates SQL immediately as filters change without needing Apply button', async () => {
      const user = userEvent.setup()
      
      const TestComponent = () => {
        const [filter, setFilter] = React.useState({
          id: 1,
          selectedColumn: 'Gender',
          column: 'Gender',
          operator: 'contains',
          value: 'man'
        })
        
        return (
          <div>
            <input
              data-testid="filter-value-input"
              value={filter.value}
              onChange={(e) => setFilter({...filter, value: e.target.value})}
            />
            {React.createElement(require('../SQLPreviewPanel').default, {
              filters: [filter],
              columns: [{ name: 'Gender', type: 'TEXT' }],
              isExpanded: true,
              tableName: '2025 National Public Opinion Reference Survey'
            })}
          </div>
        )
      }
      
      render(<TestComponent />)
      
      const sqlContent = screen.getByTestId('sql-content')
      const input = screen.getByTestId('filter-value-input')
      
      // Initial SQL
      expect(sqlContent.textContent).toContain("LIKE '%man%'")
      
      // Clear and type new value
      await user.clear(input)
      await user.type(input, 'woman')
      
      // SQL should update in real-time
      await waitFor(() => {
        expect(sqlContent.textContent).toContain("LIKE '%woman%'")
      })
    })
  })
})