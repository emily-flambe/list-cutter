import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SQLPreviewPanel from '../SQLPreviewPanel'

describe('SQL Preview Panel Component [phase-1]', () => {
  const mockColumns = [
    { name: 'age', type: 'NUMBER' },
    { name: 'city', type: 'TEXT' },
    { name: 'active', type: 'BOOLEAN' },
    { name: 'created', type: 'DATE' }
  ]

  const mockFilters = [
    { column: 'age', operator: 'greater_than', value: 25, dataType: 'NUMBER' }
  ]

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('renders SQL preview when filters exist', () => {
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      expect(screen.getByText(/WHERE "age" > 25/)).toBeInTheDocument()
    })

    it('shows placeholder when no filters', () => {
      render(
        <SQLPreviewPanel 
          filters={[]} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      expect(screen.getByText(/SELECT \* FROM data/)).toBeInTheDocument()
    })

    it('renders collapsed state correctly', () => {
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={false}
        />
      )
      
      // Title should be visible but content should not
      expect(screen.getByText(/SQL Preview/)).toBeInTheDocument()
      expect(screen.queryByText(/WHERE "age" > 25/)).not.toBeVisible()
    })

    it('shows SQL icon in header', () => {
      const { container } = render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={false}
        />
      )
      
      expect(screen.getByText(/📝 SQL Preview/)).toBeInTheDocument()
    })
  })

  describe('Real-time updates', () => {
    it('updates preview when filters change', async () => {
      const { rerender } = render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      expect(screen.getByText(/WHERE "age" > 25/)).toBeInTheDocument()
      
      const newFilters = [
        ...mockFilters,
        { column: 'city', operator: 'equals', value: 'NYC', dataType: 'TEXT' }
      ]
      
      rerender(
        <SQLPreviewPanel 
          filters={newFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      await waitFor(() => {
        const sqlText = screen.getByTestId('sql-content').textContent
        expect(sqlText).toContain('WHERE "age" > 25')
        expect(sqlText).toContain('AND "city" = \'NYC\'')
      })
    })

    it('handles filter removal', async () => {
      const { rerender } = render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      expect(screen.getByText(/WHERE "age" > 25/)).toBeInTheDocument()
      
      rerender(
        <SQLPreviewPanel 
          filters={[]} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      await waitFor(() => {
        expect(screen.queryByText(/WHERE/)).not.toBeInTheDocument()
        expect(screen.getByText(/SELECT \* FROM data/)).toBeInTheDocument()
      })
    })

    it('updates immediately without debounce', () => {
      const { rerender } = render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const updatedFilters = [
        { column: 'status', operator: 'equals', value: 'active', dataType: 'TEXT' }
      ]
      
      rerender(
        <SQLPreviewPanel 
          filters={updatedFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      // Should update immediately
      expect(screen.getByText(/WHERE "status" = 'active'/)).toBeInTheDocument()
    })
  })

  describe('Copy functionality', () => {
    it('copies SQL to clipboard on button click', async () => {
      const user = userEvent.setup()
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const copyButton = screen.getByRole('button', { name: /copy sql/i })
      await user.click(copyButton)
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('WHERE "age" > 25')
      )
    })

    it('shows confirmation message after copy', async () => {
      const user = userEvent.setup()
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const copyButton = screen.getByRole('button', { name: /copy sql/i })
      await user.click(copyButton)
      
      expect(await screen.findByText(/SQL copied to clipboard!/)).toBeInTheDocument()
    })

    it('handles copy errors gracefully', async () => {
      const user = userEvent.setup()
      
      // Mock clipboard to fail
      navigator.clipboard.writeText.mockRejectedValueOnce(new Error('Copy failed'))
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const copyButton = screen.getByRole('button', { name: /copy sql/i })
      await user.click(copyButton)
      
      // Should show error message
      expect(await screen.findByText(/Failed to copy/)).toBeInTheDocument()
    })

    it('copies formatted SQL with multiple filters', async () => {
      const user = userEvent.setup()
      
      const multipleFilters = [
        { column: 'age', operator: 'greater_than', value: 25, dataType: 'NUMBER' },
        { column: 'city', operator: 'equals', value: 'NYC', dataType: 'TEXT' },
        { column: 'active', operator: 'is_true', value: true, dataType: 'BOOLEAN' }
      ]
      
      render(
        <SQLPreviewPanel 
          filters={multipleFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const copyButton = screen.getByRole('button', { name: /copy sql/i })
      await user.click(copyButton)
      
      const copiedText = navigator.clipboard.writeText.mock.calls[0][0]
      expect(copiedText).toContain('WHERE "age" > 25')
      expect(copiedText).toContain('AND "city" = \'NYC\'')
      expect(copiedText).toContain('AND "active" = TRUE')
    })
  })

  describe('Security', () => {
    it('properly escapes HTML in SQL to prevent XSS', () => {
      // Create a filter with malicious HTML that could cause XSS
      const maliciousFilter = {
        column: 'name',
        operator: 'equals',
        value: '<script>alert("XSS")</script>',
        dataType: 'TEXT'
      }
      
      render(
        <SQLPreviewPanel 
          filters={[maliciousFilter]} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const sqlContent = screen.getByTestId('sql-content')
      
      // Verify no actual script tags are rendered
      expect(sqlContent.innerHTML).not.toContain('<script>')
      expect(sqlContent.innerHTML).not.toContain('</script>')
      
      // Verify the content is properly escaped
      expect(sqlContent.innerHTML).toContain('&lt;script&gt;')
      expect(sqlContent.innerHTML).toContain('&lt;/script&gt;')
    })
  })

  describe('Panel expansion state', () => {
    it('toggles expansion state when header is clicked', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={false}
          onToggle={onToggle}
        />
      )
      
      const header = screen.getByText(/SQL Preview/)
      await user.click(header)
      
      expect(onToggle).toHaveBeenCalled()
    })

    it('persists expansion state to localStorage', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={false}
          onToggle={onToggle}
          persistState={true}
        />
      )
      
      const header = screen.getByText(/SQL Preview/)
      await user.click(header)
      
      expect(localStorage.setItem).toHaveBeenCalledWith('sqlPanelExpanded', 'true')
    })

    it('loads expansion state from localStorage on mount', () => {
      localStorage.getItem.mockReturnValueOnce('true')
      
      const onToggle = vi.fn()
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          persistState={true}
          onToggle={onToggle}
        />
      )
      
      expect(localStorage.getItem).toHaveBeenCalledWith('sqlPanelExpanded')
    })
  })

  describe('Syntax highlighting', () => {
    it('applies syntax highlighting to SQL keywords', () => {
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const sqlContent = screen.getByTestId('sql-content')
      const html = sqlContent.innerHTML
      
      // Check for Prism classes
      expect(html).toContain('token')
      expect(html).toContain('keyword')
    })

    it('highlights different SQL elements correctly', () => {
      const complexFilters = [
        { column: 'name', operator: 'contains', value: 'John', dataType: 'TEXT' },
        { column: 'age', operator: 'between', value: [25, 65], dataType: 'NUMBER' }
      ]
      
      render(
        <SQLPreviewPanel 
          filters={complexFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const sqlContent = screen.getByTestId('sql-content')
      const html = sqlContent.innerHTML
      
      // Should highlight keywords, strings, numbers
      expect(html).toContain('token keyword') // SELECT, WHERE, AND
      expect(html).toContain('token string') // String values
      expect(html).toContain('token number') // Numeric values
    })
  })

  describe('Accessibility', () => {
    it('has accessible button labels', () => {
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      expect(screen.getByRole('button', { name: /copy sql/i })).toBeInTheDocument()
    })

    it('announces SQL updates to screen readers', async () => {
      const { rerender } = render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const newFilters = [
        { column: 'status', operator: 'equals', value: 'active', dataType: 'TEXT' }
      ]
      
      rerender(
        <SQLPreviewPanel 
          filters={newFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      // Check for aria-live region
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveTextContent('SQL query updated')
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      // Tab to copy button
      await user.tab()
      expect(screen.getByRole('button', { name: /copy sql/i })).toHaveFocus()
      
      // Enter to activate
      await user.keyboard('{Enter}')
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })

    it('has proper ARIA attributes', () => {
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      const panel = screen.getByTestId('sql-preview-panel')
      expect(panel).toHaveAttribute('aria-expanded', 'true')
      expect(panel).toHaveAttribute('aria-label', 'SQL Preview Panel')
    })
  })

  describe('Edge cases', () => {
    it('handles empty columns array', () => {
      render(
        <SQLPreviewPanel 
          filters={mockFilters} 
          columns={[]}
          isExpanded={true}
        />
      )
      
      // Should still render SQL
      expect(screen.getByText(/WHERE "age" > 25/)).toBeInTheDocument()
    })

    it('handles undefined filters gracefully', () => {
      render(
        <SQLPreviewPanel 
          filters={undefined} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      expect(screen.getByText(/SELECT \* FROM data/)).toBeInTheDocument()
    })

    it('handles malformed filter objects', () => {
      const malformedFilters = [
        { column: 'test' }, // Missing operator and value
        { operator: 'equals', value: 'test' }, // Missing column
        null, // Null filter
        undefined // Undefined filter
      ]
      
      render(
        <SQLPreviewPanel 
          filters={malformedFilters} 
          columns={mockColumns}
          isExpanded={true}
        />
      )
      
      // Should not crash
      expect(screen.getByTestId('sql-preview-panel')).toBeInTheDocument()
    })
  })
})