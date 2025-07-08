import type { ExportFormat } from './export-service';

/**
 * Export format converters and validation functions
 */

export interface ExportFormatConverter {
  toCSV(data: any): string;
  toXML(data: any): string;
  toJSON(data: any): string;
}

export interface FormatValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Convert data to CSV format
 */
export function convertToCSV(data: any): string {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format for CSV conversion');
  }

  // Handle different data structures
  if (data.files && Array.isArray(data.files)) {
    return convertFilesToCSV(data);
  } else if (data.users && Array.isArray(data.users)) {
    return convertBulkDataToCSV(data);
  } else if (Array.isArray(data)) {
    return convertArrayToCSV(data);
  } else {
    // Convert single object to CSV
    return convertObjectToCSV(data);
  }
}

/**
 * Convert data to XML format
 */
export function convertToXML(data: any): string {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data format for XML conversion');
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<export>\n';
  xml += '  <metadata>\n';
  xml += `    <exportDate>${new Date().toISOString()}</exportDate>\n`;
  xml += `    <version>1.0</version>\n`;
  xml += '  </metadata>\n';
  xml += '  <data>\n';

  if (data.files && Array.isArray(data.files)) {
    xml += convertFilesToXML(data);
  } else if (data.users && Array.isArray(data.users)) {
    xml += convertBulkDataToXML(data);
  } else if (Array.isArray(data)) {
    xml += convertArrayToXML(data, 'items');
  } else {
    xml += convertObjectToXML(data, 'item');
  }

  xml += '  </data>\n';
  xml += '</export>';

  return xml;
}

/**
 * Convert data to JSON format with proper formatting
 */
export function convertToJSON(data: any): string {
  if (!data) {
    throw new Error('Invalid data format for JSON conversion');
  }

  // Add metadata to JSON export
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      version: '1.0',
      format: 'json'
    },
    data: data
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Validate export format
 */
export function validateExportFormat(content: string, format: ExportFormat): boolean {
  try {
    switch (format) {
      case 'json':
        return validateJSONFormat(content);
      case 'csv':
        return validateCSVFormat(content);
      case 'xml':
        return validateXMLFormat(content);
      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

/**
 * Get format validation details
 */
export function getFormatValidationDetails(content: string, format: ExportFormat): FormatValidationResult {
  const result: FormatValidationResult = {
    valid: false,
    errors: [],
    warnings: []
  };

  try {
    switch (format) {
      case 'json':
        return validateJSONFormatDetails(content);
      case 'csv':
        return validateCSVFormatDetails(content);
      case 'xml':
        return validateXMLFormatDetails(content);
      default:
        result.errors.push(`Unsupported format: ${format}`);
        return result;
    }
  } catch (error) {
    result.errors.push(`Validation error: ${error}`);
    return result;
  }
}

/**
 * Convert export metadata to include in all formats
 */
export function createExportMetadata(recordCount: number, exportType: string): any {
  return {
    exportMetadata: {
      exportDate: new Date().toISOString(),
      exportType,
      recordCount,
      version: '1.0',
      generator: 'Cutty Data Export Service'
    }
  };
}

// CSV conversion helpers

function convertFilesToCSV(data: any): string {
  const { files, userData, exportMetadata } = data;
  let csv = '';

  // Add export metadata as comments
  csv += `# Export Date: ${exportMetadata?.exportDate || new Date().toISOString()}\n`;
  csv += `# Export Type: ${exportMetadata?.exportType || 'unknown'}\n`;
  csv += `# Total Records: ${files.length}\n`;
  csv += `# User: ${userData?.username || 'N/A'}\n`;
  csv += '#\n';

  // Add user data section
  if (userData) {
    csv += '# User Data\n';
    csv += 'user_id,username,email,created_at,file_count,total_storage_used\n';
    csv += `${userData.userId},${escapeCSVValue(userData.username)},${escapeCSVValue(userData.email || '')},${userData.createdAt},${userData.fileCount},${userData.totalStorageUsed}\n`;
    csv += '#\n';
  }

  // Add files section
  if (files && files.length > 0) {
    csv += '# Files Data\n';
    csv += 'file_id,file_name,file_path,file_size,uploaded_at,system_tags,user_tags,metadata\n';
    
    for (const file of files) {
      csv += `${escapeCSVValue(file.fileId)},${escapeCSVValue(file.fileName)},${escapeCSVValue(file.filePath)},${file.fileSize},${file.uploadedAt},${escapeCSVValue(JSON.stringify(file.systemTags || []))},${escapeCSVValue(JSON.stringify(file.userTags || []))},${escapeCSVValue(JSON.stringify(file.metadata || {}))}\n`;
    }
  }

  return csv;
}

function convertBulkDataToCSV(data: any): string {
  const { users, files, statistics } = data;
  let csv = '';

  // Add export metadata as comments
  csv += `# Export Date: ${statistics?.exportDate || new Date().toISOString()}\n`;
  csv += `# Export Type: bulk_data\n`;
  csv += `# Total Users: ${statistics?.totalUsers || 0}\n`;
  csv += `# Total Files: ${statistics?.totalFiles || 0}\n`;
  csv += `# Total Storage: ${statistics?.totalStorageUsed || 0}\n`;
  csv += '#\n';

  // Add users section
  if (users && users.length > 0) {
    csv += '# Users Data\n';
    csv += 'user_id,username,email,created_at,file_count,total_storage_used\n';
    
    for (const user of users) {
      csv += `${user.userId},${escapeCSVValue(user.username)},${escapeCSVValue(user.email || '')},${user.createdAt},${user.fileCount},${user.totalStorageUsed}\n`;
    }
    csv += '#\n';
  }

  // Add files section
  if (files && files.length > 0) {
    csv += '# Files Data\n';
    csv += 'file_id,user_id,file_name,file_path,file_size,uploaded_at,system_tags,user_tags,metadata\n';
    
    for (const file of files) {
      csv += `${escapeCSVValue(file.fileId)},${file.userId},${escapeCSVValue(file.fileName)},${escapeCSVValue(file.filePath)},${file.fileSize},${file.uploadedAt},${escapeCSVValue(JSON.stringify(file.systemTags || []))},${escapeCSVValue(JSON.stringify(file.userTags || []))},${escapeCSVValue(JSON.stringify(file.metadata || {}))}\n`;
    }
  }

  return csv;
}

function convertArrayToCSV(data: any[]): string {
  if (data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  let csv = headers.join(',') + '\n';

  for (const row of data) {
    const values = headers.map(header => escapeCSVValue(row[header]));
    csv += values.join(',') + '\n';
  }

  return csv;
}

function convertObjectToCSV(data: any): string {
  const headers = Object.keys(data);
  let csv = headers.join(',') + '\n';
  
  const values = headers.map(header => escapeCSVValue(data[header]));
  csv += values.join(',') + '\n';

  return csv;
}

function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// XML conversion helpers

function convertFilesToXML(data: any): string {
  const { files, userData, exportMetadata } = data;
  let xml = '';

  // Add user data
  if (userData) {
    xml += '    <userData>\n';
    xml += `      <userId>${userData.userId}</userId>\n`;
    xml += `      <username>${escapeXMLValue(userData.username)}</username>\n`;
    xml += `      <email>${escapeXMLValue(userData.email || '')}</email>\n`;
    xml += `      <createdAt>${userData.createdAt}</createdAt>\n`;
    xml += `      <fileCount>${userData.fileCount}</fileCount>\n`;
    xml += `      <totalStorageUsed>${userData.totalStorageUsed}</totalStorageUsed>\n`;
    xml += '    </userData>\n';
  }

  // Add files data
  if (files && files.length > 0) {
    xml += '    <files>\n';
    for (const file of files) {
      xml += '      <file>\n';
      xml += `        <fileId>${escapeXMLValue(file.fileId)}</fileId>\n`;
      xml += `        <fileName>${escapeXMLValue(file.fileName)}</fileName>\n`;
      xml += `        <filePath>${escapeXMLValue(file.filePath)}</filePath>\n`;
      xml += `        <fileSize>${file.fileSize}</fileSize>\n`;
      xml += `        <uploadedAt>${file.uploadedAt}</uploadedAt>\n`;
      xml += `        <systemTags>${escapeXMLValue(JSON.stringify(file.systemTags || []))}</systemTags>\n`;
      xml += `        <userTags>${escapeXMLValue(JSON.stringify(file.userTags || []))}</userTags>\n`;
      xml += `        <metadata>${escapeXMLValue(JSON.stringify(file.metadata || {}))}</metadata>\n`;
      xml += '      </file>\n';
    }
    xml += '    </files>\n';
  }

  return xml;
}

function convertBulkDataToXML(data: any): string {
  const { users, files, statistics } = data;
  let xml = '';

  // Add statistics
  if (statistics) {
    xml += '    <statistics>\n';
    xml += `      <totalUsers>${statistics.totalUsers}</totalUsers>\n`;
    xml += `      <totalFiles>${statistics.totalFiles}</totalFiles>\n`;
    xml += `      <totalStorageUsed>${statistics.totalStorageUsed}</totalStorageUsed>\n`;
    xml += `      <exportDate>${statistics.exportDate}</exportDate>\n`;
    xml += '    </statistics>\n';
  }

  // Add users data
  if (users && users.length > 0) {
    xml += '    <users>\n';
    for (const user of users) {
      xml += '      <user>\n';
      xml += `        <userId>${user.userId}</userId>\n`;
      xml += `        <username>${escapeXMLValue(user.username)}</username>\n`;
      xml += `        <email>${escapeXMLValue(user.email || '')}</email>\n`;
      xml += `        <createdAt>${user.createdAt}</createdAt>\n`;
      xml += `        <fileCount>${user.fileCount}</fileCount>\n`;
      xml += `        <totalStorageUsed>${user.totalStorageUsed}</totalStorageUsed>\n`;
      xml += '      </user>\n';
    }
    xml += '    </users>\n';
  }

  // Add files data
  if (files && files.length > 0) {
    xml += '    <files>\n';
    for (const file of files) {
      xml += '      <file>\n';
      xml += `        <fileId>${escapeXMLValue(file.fileId)}</fileId>\n`;
      xml += `        <userId>${file.userId}</userId>\n`;
      xml += `        <fileName>${escapeXMLValue(file.fileName)}</fileName>\n`;
      xml += `        <filePath>${escapeXMLValue(file.filePath)}</filePath>\n`;
      xml += `        <fileSize>${file.fileSize}</fileSize>\n`;
      xml += `        <uploadedAt>${file.uploadedAt}</uploadedAt>\n`;
      xml += `        <systemTags>${escapeXMLValue(JSON.stringify(file.systemTags || []))}</systemTags>\n`;
      xml += `        <userTags>${escapeXMLValue(JSON.stringify(file.userTags || []))}</userTags>\n`;
      xml += `        <metadata>${escapeXMLValue(JSON.stringify(file.metadata || {}))}</metadata>\n`;
      xml += '      </file>\n';
    }
    xml += '    </files>\n';
  }

  return xml;
}

function convertArrayToXML(data: any[], rootName: string): string {
  let xml = `    <${rootName}>\n`;
  
  for (const item of data) {
    xml += convertObjectToXML(item, 'item', '      ');
  }
  
  xml += `    </${rootName}>\n`;
  return xml;
}

function convertObjectToXML(data: any, elementName: string, indent: string = '    '): string {
  let xml = `${indent}<${elementName}>\n`;
  
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      xml += `${indent}  <${key}/>\n`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      xml += convertObjectToXML(value, key, indent + '  ');
    } else if (Array.isArray(value)) {
      xml += `${indent}  <${key}>\n`;
      for (const item of value) {
        xml += convertObjectToXML(item, 'item', indent + '    ');
      }
      xml += `${indent}  </${key}>\n`;
    } else {
      xml += `${indent}  <${key}>${escapeXMLValue(value)}</${key}>\n`;
    }
  }
  
  xml += `${indent}</${elementName}>\n`;
  return xml;
}

function escapeXMLValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Validation helpers

function validateJSONFormat(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch (error) {
    return false;
  }
}

function validateCSVFormat(content: string): boolean {
  try {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    if (lines.length === 0) return false;
    
    // Check if first line looks like headers
    const firstLine = lines[0];
    const hasHeaders = firstLine.includes(',') && !firstLine.match(/^\d+,/);
    
    // Basic CSV structure validation
    if (lines.length > 1) {
      const headerCount = firstLine.split(',').length;
      const sampleLine = lines[1];
      const fieldCount = sampleLine.split(',').length;
      
      // Allow some flexibility in field count
      return Math.abs(headerCount - fieldCount) <= 1;
    }
    
    return hasHeaders;
  } catch (error) {
    return false;
  }
}

function validateXMLFormat(content: string): boolean {
  try {
    // Basic XML structure validation
    const trimmed = content.trim();
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
      return false;
    }
    
    // Check for balanced tags (simple validation)
    const openTags = (trimmed.match(/<[^\/][^>]*>/g) || []).length;
    const closeTags = (trimmed.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (trimmed.match(/<[^>]*\/>/g) || []).length;
    
    return openTags === closeTags + selfClosingTags;
  } catch (error) {
    return false;
  }
}

function validateJSONFormatDetails(content: string): FormatValidationResult {
  const result: FormatValidationResult = {
    valid: false,
    errors: [],
    warnings: []
  };

  try {
    const parsed = JSON.parse(content);
    result.valid = true;
    
    // Check for expected structure
    if (!parsed.metadata) {
      result.warnings.push('Missing metadata section');
    }
    
    if (!parsed.data) {
      result.warnings.push('Missing data section');
    }
    
    // Check for empty data
    if (parsed.data && typeof parsed.data === 'object') {
      const keys = Object.keys(parsed.data);
      if (keys.length === 0) {
        result.warnings.push('Data section is empty');
      }
    }
    
  } catch (error) {
    result.errors.push(`Invalid JSON: ${error}`);
  }

  return result;
}

function validateCSVFormatDetails(content: string): FormatValidationResult {
  const result: FormatValidationResult = {
    valid: false,
    errors: [],
    warnings: []
  };

  try {
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      result.errors.push('Empty CSV file');
      return result;
    }
    
    // Filter out comment lines
    const dataLines = lines.filter(line => !line.startsWith('#'));
    
    if (dataLines.length === 0) {
      result.errors.push('No data lines found');
      return result;
    }
    
    if (dataLines.length === 1) {
      result.warnings.push('Only header line found, no data rows');
    }
    
    // Check field consistency
    const headerCount = dataLines[0].split(',').length;
    let inconsistentRows = 0;
    
    for (let i = 1; i < dataLines.length; i++) {
      const fieldCount = dataLines[i].split(',').length;
      if (Math.abs(fieldCount - headerCount) > 1) {
        inconsistentRows++;
      }
    }
    
    if (inconsistentRows > 0) {
      result.warnings.push(`${inconsistentRows} rows have inconsistent field counts`);
    }
    
    result.valid = true;
    
  } catch (error) {
    result.errors.push(`CSV validation error: ${error}`);
  }

  return result;
}

function validateXMLFormatDetails(content: string): FormatValidationResult {
  const result: FormatValidationResult = {
    valid: false,
    errors: [],
    warnings: []
  };

  try {
    const trimmed = content.trim();
    
    if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<')) {
      result.errors.push('Invalid XML: must start with XML declaration or root element');
      return result;
    }
    
    // Check for XML declaration
    if (!trimmed.startsWith('<?xml')) {
      result.warnings.push('Missing XML declaration');
    }
    
    // Basic tag balance validation
    const openTags = (trimmed.match(/<[^\/][^>]*>/g) || []).length;
    const closeTags = (trimmed.match(/<\/[^>]*>/g) || []).length;
    const selfClosingTags = (trimmed.match(/<[^>]*\/>/g) || []).length;
    
    if (openTags !== closeTags + selfClosingTags) {
      result.errors.push('Unbalanced XML tags');
      return result;
    }
    
    // Check for root element
    const rootMatch = trimmed.match(/<([^>\s]+)(?:\s[^>]*)?>[\s\S]*<\/\1>/);
    if (!rootMatch) {
      result.errors.push('Missing or malformed root element');
      return result;
    }
    
    result.valid = true;
    
  } catch (error) {
    result.errors.push(`XML validation error: ${error}`);
  }

  return result;
}

/**
 * Get supported export formats
 */
export function getSupportedFormats(): ExportFormat[] {
  return ['json', 'csv', 'xml'];
}

/**
 * Get format-specific options
 */
export function getFormatOptions(format: ExportFormat): any {
  switch (format) {
    case 'json':
      return {
        prettyPrint: true,
        includeMetadata: true,
        compression: true
      };
    case 'csv':
      return {
        delimiter: ',',
        includeHeaders: true,
        includeComments: true,
        escapeQuotes: true
      };
    case 'xml':
      return {
        includeDeclaration: true,
        includeMetadata: true,
        prettyPrint: true,
        encoding: 'UTF-8'
      };
    default:
      return {};
  }
}