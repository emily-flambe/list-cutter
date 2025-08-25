/**
 * SQL Preview Compiler
 * Converts filter configurations to SQL WHERE clauses
 */

/**
 * Escapes single quotes in SQL strings
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
export function escapeSQLString(str) {
  if (str === null || str === undefined) return ''
  return String(str).replace(/'/g, "''")
}

/**
 * Escapes special characters in LIKE patterns
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeLikePattern(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/**
 * Compiles a single filter to SQL
 * @param {Object} filter - The filter configuration
 * @param {string} filter.column - Column name
 * @param {string} filter.operator - Filter operator
 * @param {any} filter.value - Filter value
 * @param {string} filter.dataType - Data type (TEXT, NUMBER, DATE, BOOLEAN)
 * @returns {string} - SQL WHERE clause fragment
 */
export function compileFilterToSQL(filter) {
  const quotedColumn = `"${filter.column}"`
  
  // Handle NULL checks
  if (filter.operator === 'is_null') {
    return `${quotedColumn} IS NULL`
  }
  if (filter.operator === 'is_not_null') {
    return `${quotedColumn} IS NOT NULL`
  }
  
  switch (filter.dataType) {
    case 'TEXT':
      return compileTextFilter(quotedColumn, filter)
    case 'NUMBER':
      return compileNumberFilter(quotedColumn, filter)
    case 'DATE':
      return compileDateFilter(quotedColumn, filter)
    case 'BOOLEAN':
      return compileBooleanFilter(quotedColumn, filter)
    default:
      // Fallback for unknown types
      return `${quotedColumn} = '${escapeSQLString(filter.value)}'`
  }
}

/**
 * Compiles text filter to SQL
 */
function compileTextFilter(quotedColumn, filter) {
  const value = filter.value
  
  switch (filter.operator) {
    case 'equals':
      return `${quotedColumn} = '${escapeSQLString(value)}'`
    
    case 'not_equals':
      return `${quotedColumn} != '${escapeSQLString(value)}'`
    
    case 'contains': {
      const escaped = escapeLikePattern(value)
      return `${quotedColumn} LIKE '%${escaped}%'`
    }
    
    case 'starts_with': {
      const escaped = escapeLikePattern(value)
      return `${quotedColumn} LIKE '${escaped}%'`
    }
    
    case 'ends_with': {
      const escaped = escapeLikePattern(value)
      return `${quotedColumn} LIKE '%${escaped}'`
    }
    
    case 'not_contains': {
      const escaped = escapeLikePattern(value)
      return `${quotedColumn} NOT LIKE '%${escaped}%'`
    }
    
    default:
      return `${quotedColumn} = '${escapeSQLString(value)}'`
  }
}

/**
 * Compiles numeric filter to SQL
 */
function compileNumberFilter(quotedColumn, filter) {
  const value = filter.value
  
  switch (filter.operator) {
    case 'equals':
      return `${quotedColumn} = ${value}`
    
    case 'not_equals':
      return `${quotedColumn} != ${value}`
    
    case 'greater_than':
      return `${quotedColumn} > ${value}`
    
    case 'less_than':
      return `${quotedColumn} < ${value}`
    
    case 'greater_than_or_equal':
      return `${quotedColumn} >= ${value}`
    
    case 'less_than_or_equal':
      return `${quotedColumn} <= ${value}`
    
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return `${quotedColumn} BETWEEN ${value[0]} AND ${value[1]}`
      }
      return `${quotedColumn} = ${value}`
    
    default:
      return `${quotedColumn} = ${value}`
  }
}

/**
 * Compiles date filter to SQL
 */
function compileDateFilter(quotedColumn, filter) {
  const value = filter.value
  
  switch (filter.operator) {
    case 'equals':
      return `${quotedColumn} = '${value}'`
    
    case 'greater_than':
    case 'after':
      return `${quotedColumn} > '${value}'`
    
    case 'less_than':
    case 'before':
      return `${quotedColumn} < '${value}'`
    
    case 'greater_than_or_equal':
      return `${quotedColumn} >= '${value}'`
    
    case 'less_than_or_equal':
      return `${quotedColumn} <= '${value}'`
    
    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return `${quotedColumn} BETWEEN '${value[0]}' AND '${value[1]}'`
      }
      return `${quotedColumn} = '${value}'`
    
    default:
      return `${quotedColumn} = '${value}'`
  }
}

/**
 * Compiles boolean filter to SQL
 */
function compileBooleanFilter(quotedColumn, filter) {
  switch (filter.operator) {
    case 'is_true':
      return `${quotedColumn} = TRUE`
    
    case 'is_false':
      return `${quotedColumn} = FALSE`
    
    default:
      return `${quotedColumn} = ${filter.value ? 'TRUE' : 'FALSE'}`
  }
}

/**
 * Compiles multiple filters to a complete SQL query
 * @param {Array} filters - Array of filter configurations
 * @param {Object} options - Compilation options
 * @param {string} options.tableName - Table name (default: 'data')
 * @param {boolean} options.format - Whether to format the SQL (default: true)
 * @returns {string} - Complete SQL SELECT statement
 */
export function compileFiltersToSQL(filters, options = {}) {
  const {
    tableName = 'data',
    format = true
  } = options
  
  // Quote table name if it contains spaces or special characters
  const quotedTableName = tableName.includes(' ') || tableName.includes('-') || tableName.includes('.') 
    ? `"${tableName}"` 
    : tableName
  
  if (!filters || filters.length === 0) {
    return `SELECT * FROM ${quotedTableName}`
  }
  
  const whereClauses = filters.map(filter => compileFilterToSQL(filter))
  
  if (format) {
    const formattedClauses = whereClauses.join('\n  AND ')
    return `SELECT * FROM ${quotedTableName}\nWHERE ${formattedClauses}`
  } else {
    const compactClauses = whereClauses.join(' AND ')
    return `SELECT * FROM ${quotedTableName} WHERE ${compactClauses}`
  }
}

/**
 * Formats SQL string with proper indentation
 * @param {string} sql - SQL string to format
 * @returns {string} - Formatted SQL string
 */
export function formatSQL(sql) {
  // Simple formatter for WHERE clauses
  return sql
    .replace(/WHERE /i, 'WHERE ')
    .replace(/ AND /gi, '\n  AND ')
    .replace(/SELECT \* FROM (\w+) WHERE/i, 'SELECT * FROM $1\nWHERE')
}