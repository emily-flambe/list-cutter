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

export default function SQLPreviewPanel({ 
  filters = [], 
  columns = [], 
  isExpanded = false, 
  onToggle,
  tableName = 'data'
}) {
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [updateAnnouncement, setUpdateAnnouncement] = useState('')

  const sql = useMemo(() => {
    try {
      const sqlFilters = (filters || []).filter(f => 
        f && (f.column || f.selectedColumn) && f.operator
      ).map(filter => {
        const columnName = filter.column || filter.selectedColumn
        const columnMeta = columns.find(c => c.name === columnName)
        
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
          dataType: columnMeta?.type || 'TEXT'
        }
      })
      
      return compileFiltersToSQL(sqlFilters, { tableName, format: true })
    } catch (error) {
      console.error('Error compiling SQL:', error)
      return 'SELECT * FROM data -- Error generating SQL'
    }
  }, [filters, columns, tableName])

  const highlightedSQL = useMemo(() => {
    try {
      return Prism.highlight(sql, Prism.languages.sql, 'sql')
    } catch (error) {
      console.error('Error highlighting SQL:', error)
      return sql
    }
  }, [sql])

  useEffect(() => {
    if (sql && isExpanded) {
      setUpdateAnnouncement('SQL query updated')
      const timer = setTimeout(() => setUpdateAnnouncement(''), 1000)
      return () => clearTimeout(timer)
    }
  }, [sql, isExpanded])

  const handleToggle = (event, newExpanded) => {
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
        expanded={isExpanded} 
        onChange={handleToggle}
        data-testid="sql-preview-panel"
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