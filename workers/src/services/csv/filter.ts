import { ApiError } from '../../middleware/error';

export function parseWhereClause(value: string, condition: string): boolean {
  if (!condition || condition.trim() === '') {
    return true;
  }

  const match = condition.match(/^([<>!=]=?|BETWEEN|IN)\s*(.+)$/i);
  if (!match || !match[1] || !match[2]) {
    throw new ApiError(400, `Invalid WHERE clause format: ${condition}`);
  }

  const [, operator, expression] = match;
  const upperOperator = operator.toUpperCase();

  const numValue = parseFloat(value);
  const isNumber = !isNaN(numValue);
  const cleanValue = value.trim();

  if (upperOperator === 'BETWEEN') {
    const bounds = expression.replace(/AND/i, '').trim().split(/\s+/);
    if (bounds.length !== 2) {
      throw new ApiError(400, `Invalid BETWEEN clause: ${condition}`);
    }
    const [lowerStr, upperStr] = bounds;
    if (!lowerStr || !upperStr) {
      throw new ApiError(400, `Invalid BETWEEN clause: ${condition}`);
    }
    const [lower, upper] = [parseFloat(lowerStr), parseFloat(upperStr)];
    return isNumber && numValue >= lower && numValue <= upper;
  }

  if (upperOperator === 'IN') {
    const cleanExpression = expression.replace(/[()]/g, '').trim();
    const values = cleanExpression
      .split(',')
      .map(v => v.trim().replace(/['"]/g, ''));
    return values.includes(cleanValue);
  }

  if (isNumber) {
    const compareValue = parseFloat(expression);
    switch (operator) {
      case '>': return numValue > compareValue;
      case '<': return numValue < compareValue;
      case '>=': return numValue >= compareValue;
      case '<=': return numValue <= compareValue;
      case '!=': return numValue !== compareValue;
      case '=':
      case '==': return numValue === compareValue;
    }
  }

  const cleanExpression = expression.replace(/['"]/g, '').trim();
  switch (operator) {
    case '!=': return cleanValue !== cleanExpression;
    case '=':
    case '==': return cleanValue === cleanExpression;
    default: return true;
  }
}

export function applyFilters(
  records: Record<string, string>[],
  filters: Record<string, string>
): Record<string, string>[] {
  return records.filter(row => {
    for (const [column, whereClause] of Object.entries(filters)) {
      if (column in row && row[column] !== undefined) {
        try {
          if (!parseWhereClause(row[column], whereClause)) {
            return false;
          }
        } catch (error) {
          return false;
        }
      }
    }
    return true;
  });
}