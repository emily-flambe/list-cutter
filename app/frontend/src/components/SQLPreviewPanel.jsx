import React, { useState, useMemo, useEffect } from 'react'
import { 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Typography,
  Button,
  Box,
  Snackbar,
  Alert
} from '@mui/material'
import { 
  ExpandMore as ExpandMoreIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material'
import Prism from 'prismjs'
import 'prismjs/components/prism-sql'
import 'prismjs/themes/prism-tomorrow.css'
import { compileFiltersToSQL } from '../utils/sqlPreviewCompiler'

/**
 * SQL Preview Panel Component
 * Displays SQL query generated from filters with syntax highlighting
 */
export default function SQLPreviewPanel({ 
  filters = [], 
  columns = [], 
  isExpanded = false, 
  onToggle,
  persistState = false,
  tableName = 'data'
}) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [expanded, setExpanded] = useState(isExpanded)
  const [updateAnnouncement, setUpdateAnnouncement] = useState('')

  // Load expansion state from localStorage if persistence is enabled
  useEffect(() => {
    if (persistState && typeof window !== 'undefined') {
      const saved = localStorage.getItem('sqlPanelExpanded')
      if (saved !== null) {
        setExpanded(saved === 'true')
      }
    }
  }, [persistState])

  // Sync with external isExpanded prop
  useEffect(() => {
    setExpanded(isExpanded)
  }, [isExpanded])

  // Generate SQL from filters
  const sql = useMemo(() => {
    try {
      // Map filters to SQL-compatible format and add dataType
      const sqlFilters = (filters || []).filter(f => 
        f && (f.column || f.selectedColumn) && f.operator
      ).map(filter => {
        // Determine column name (handle both column and selectedColumn)
        const columnName = filter.column || filter.selectedColumn
        
        // Find column metadata to determine dataType
        const columnMeta = columns.find(c => c.name === columnName)
        
        // Map operator for SQL (handle is_empty/is_not_empty)
        let sqlOperator = filter.operator
        if (filter.operator === 'is_empty') {
          sqlOperator = 'is_null'
        } else if (filter.operator === 'is_not_empty') {
          sqlOperator = 'is_not_null'
        }
        
        return {
          column: columnName,
          operator: sqlOperator,
          value: filter.value || null,
          dataType: columnMeta?.type || 'TEXT' // Default to TEXT if type unknown
        }
      })
      
      return compileFiltersToSQL(sqlFilters, { tableName, format: true })
    } catch (error) {
      console.error('Error compiling SQL:', error)
      return 'SELECT * FROM data -- Error generating SQL'
    }
  }, [filters, columns, tableName])

  // Apply syntax highlighting
  const highlightedSQL = useMemo(() => {
    try {
      return Prism.highlight(sql, Prism.languages.sql, 'sql')
    } catch (error) {
      console.error('Error highlighting SQL:', error)
      return sql
    }
  }, [sql])

  // Announce SQL updates to screen readers
  useEffect(() => {
    if (sql && expanded) {
      setUpdateAnnouncement('SQL query updated')
      const timer = setTimeout(() => setUpdateAnnouncement(''), 1000)
      return () => clearTimeout(timer)
    }
  }, [sql, expanded])

  const handleToggle = (event, newExpanded) => {
    setExpanded(newExpanded)
    
    // Persist state if enabled
    if (persistState && typeof window !== 'undefined') {
      localStorage.setItem('sqlPanelExpanded', String(newExpanded))
    }
    
    // Call external handler if provided
    if (onToggle) {
      onToggle(newExpanded)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql)
      setCopySuccess(true)
      setCopyError(false)
    } catch (error) {
      console.error('Failed to copy SQL:', error)
      setCopyError(true)
      setCopySuccess(false)
    }
  }

  return (
    <>
      <Accordion 
        expanded={expanded} 
        onChange={handleToggle}
        data-testid="sql-preview-panel"
        aria-expanded={expanded}
        aria-label="SQL Preview Panel"
      >
        <AccordionSummary 
          expandIcon={<ExpandMoreIcon />}
          aria-controls="sql-preview-content"
          id="sql-preview-header"
        >
          <Typography>📝 SQL Preview</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ width: '100%' }}>
            {/* SQL Content with syntax highlighting */}
            <Box
              data-testid="sql-content"
              component="pre"
              sx={{ 
                backgroundColor: '#2d2d2d', 
                color: '#f8f8f2',
                padding: 2,
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: '400px',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineHeight: 1.5,
                margin: 0
              }}
              dangerouslySetInnerHTML={{ __html: highlightedSQL }}
            />
            
            {/* Action buttons */}
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button 
                startIcon={<CopyIcon />}
                onClick={handleCopy}
                variant="outlined"
                size="small"
                aria-label="Copy SQL"
              >
                Copy SQL
              </Button>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>
      
      {/* Copy success notification */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={2000}
        onClose={() => setCopySuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setCopySuccess(false)} 
          severity="success" 
          sx={{ width: '100%' }}
        >
          SQL copied to clipboard!
        </Alert>
      </Snackbar>
      
      {/* Copy error notification */}
      <Snackbar
        open={copyError}
        autoHideDuration={3000}
        onClose={() => setCopyError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setCopyError(false)} 
          severity="error" 
          sx={{ width: '100%' }}
        >
          Failed to copy SQL to clipboard
        </Alert>
      </Snackbar>
      
      {/* Screen reader announcement */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden'
        }}
      >
        {updateAnnouncement}
      </div>
    </>
  )
}