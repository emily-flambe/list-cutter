#!/usr/bin/env node

/**
 * D1 Schema Documentation Generator
 * Creates a dedicated d1_schema.md file with complete database documentation
 * Uses live D1 database queries for accurate, up-to-date information
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCHEMA_JSON_FILE = '.project/database-schema.json';
const SCHEMA_MD_FILE = '.project/contexts/d1_schema.md';
const WORKERS_DIR = 'cloudflare/workers';

// Schema introspection queries for SQLite/D1
const SCHEMA_QUERIES = {
  tables: `
    SELECT 
      name as table_name,
      sql as create_sql
    FROM sqlite_master 
    WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      AND name NOT LIKE 'd1_migrations'
    ORDER BY name;
  `,
  
  table_info: `
    SELECT 
      m.name as table_name,
      p.cid,
      p.name as column_name,
      p.type as data_type,
      p.notnull,
      p.dflt_value,
      p.pk
    FROM sqlite_master m
    LEFT JOIN pragma_table_info(m.name) p ON 1=1
    WHERE m.type = 'table' 
      AND m.name NOT LIKE 'sqlite_%'
      AND m.name NOT LIKE 'd1_migrations'
    ORDER BY m.name, p.cid;
  `,
  
  indexes: `
    SELECT 
      name as index_name,
      tbl_name as table_name,
      sql as create_sql
    FROM sqlite_master 
    WHERE type = 'index' 
      AND name NOT LIKE 'sqlite_%'
      AND sql IS NOT NULL
    ORDER BY tbl_name, name;
  `,
  
  foreign_keys: `
    SELECT DISTINCT
      m.name as table_name,
      f."table" as references_table,
      f."from" as column_name,
      f."to" as references_column
    FROM sqlite_master m, pragma_foreign_key_list(m.name) f
    WHERE m.type = 'table' 
      AND m.name NOT LIKE 'sqlite_%'
      AND m.name NOT LIKE 'd1_migrations'
    ORDER BY m.name;
  `
};

/**
 * Execute a D1 query and return parsed results
 */
function executeD1Query(query, database = 'cutty-dev') {
  try {
    console.log(`🔍 Executing D1 query on ${database}...`);
    
    const cwd = path.resolve(WORKERS_DIR);
    const command = `wrangler d1 execute ${database} --remote --command="${query.replace(/"/g, '\\"')}"`;
    
    const result = execSync(command, {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Parse the wrangler output - it should be JSON
    try {
      return JSON.parse(result);
    } catch (parseError) {
      console.warn('⚠️ Non-JSON response, attempting to parse text output...');
      return parseTextOutput(result);
    }
    
  } catch (error) {
    console.error(`❌ Error executing D1 query:`, error.message);
    
    // If development database fails, try production as fallback
    if (database === 'cutty-dev') {
      console.log('🔄 Trying production database as fallback...');
      return executeD1Query(query, 'cutty-prod');
    }
    
    throw error;
  }
}

/**
 * Parse text output when JSON parsing fails
 */
function parseTextOutput(output) {
  const lines = output.split('\n').filter(line => line.trim());
  const results = [];
  
  for (const line of lines) {
    if (line.includes('|') || line.includes('\t')) {
      const parts = line.split(/[|\t]/).map(part => part.trim()).filter(part => part);
      if (parts.length > 0) {
        results.push(parts);
      }
    }
  }
  
  return { results };
}

/**
 * Transform table info into structured column data
 */
function transformTableInfo(tableInfoResults) {
  const tables = {};
  
  if (!tableInfoResults || !Array.isArray(tableInfoResults.results)) {
    return tables;
  }
  
  for (const row of tableInfoResults.results) {
    const tableName = row.table_name || row[0];
    const columnName = row.column_name || row[2];
    const dataType = row.data_type || row[3];
    const notNull = row.notnull || row[4];
    const defaultValue = row.dflt_value || row[5];
    const isPrimaryKey = row.pk || row[6];
    
    if (!tableName || !columnName) continue;
    
    if (!tables[tableName]) {
      tables[tableName] = {
        columns: {},
        constraints: [],
        indexes: []
      };
    }
    
    tables[tableName].columns[columnName] = {
      type: dataType,
      nullable: !notNull,
      primary_key: Boolean(isPrimaryKey),
      unique: Boolean(isPrimaryKey),
      default: defaultValue,
      auto_increment: dataType.includes('INTEGER') && Boolean(isPrimaryKey)
    };
  }
  
  return tables;
}

/**
 * Generate comprehensive D1 schema markdown documentation
 */
function generateSchemaMarkdown(schema) {
  const timestamp = new Date().toISOString();
  const tableCount = Object.keys(schema.tables).length;
  
  let markdown = `# D1 Database Schema Documentation\n\n`;
  
  // Header with auto-generation info
  markdown += `> 🤖 **Auto-Generated Documentation**\n`;
  markdown += `> \n`;
  markdown += `> - **Generated**: ${timestamp}\n`;
  markdown += `> - **Source**: Live D1 Database Query\n`;
  markdown += `> - **Tables**: ${tableCount}\n`;
  markdown += `> - **Method**: \`wrangler d1 execute --remote\`\n`;
  markdown += `> \n`;
  markdown += `> ⚠️ **DO NOT EDIT MANUALLY** - This file is automatically updated by GitHub Actions\n\n`;
  
  // Table of Contents
  markdown += `## Table of Contents\n\n`;
  const tableNames = Object.keys(schema.tables).sort();
  for (const tableName of tableNames) {
    markdown += `- [${tableName}](#${tableName.toLowerCase().replace(/_/g, '-')})\n`;
  }
  markdown += `\n`;
  
  // Database Overview
  markdown += `## Database Overview\n\n`;
  markdown += `### Statistics\n`;
  markdown += `- **Total Tables**: ${tableCount}\n`;
  markdown += `- **Total Indexes**: ${Object.values(schema.indexes).flat().length}\n`;
  markdown += `- **Database Type**: SQLite (Cloudflare D1)\n`;
  markdown += `- **Environment**: Cloudflare Edge\n\n`;
  
  // Table Categories
  const categories = categorizeTables(tableNames);
  markdown += `### Table Categories\n\n`;
  for (const [category, tables] of Object.entries(categories)) {
    markdown += `**${category}**: ${tables.join(', ')}\n\n`;
  }
  
  // Individual Table Documentation
  markdown += `## Table Schemas\n\n`;
  
  for (const tableName of tableNames) {
    const table = schema.tables[tableName];
    markdown += generateTableMarkdown(tableName, table);
  }
  
  // Indexes Section
  if (Object.keys(schema.indexes).length > 0) {
    markdown += `## Database Indexes\n\n`;
    for (const [tableName, indexes] of Object.entries(schema.indexes)) {
      if (indexes && indexes.length > 0) {
        markdown += `### ${tableName} Indexes\n\n`;
        for (const index of indexes) {
          const uniqueStr = index.unique ? ' (UNIQUE)' : '';
          markdown += `- **${index.name}**${uniqueStr}: \`${index.columns.join(', ')}\`\n`;
        }
        markdown += `\n`;
      }
    }
  }
  
  // Footer
  markdown += `---\n\n`;
  markdown += `*Last updated: ${timestamp}*\n\n`;
  markdown += `*Generated by: Cutty D1 Schema Documentation System*\n`;
  
  return markdown;
}

/**
 * Generate markdown documentation for a single table
 */
function generateTableMarkdown(tableName, table) {
  let markdown = `### ${tableName}\n\n`;
  
  // Columns table
  markdown += `| Column | Type | Nullable | Default | Primary Key | Unique |\n`;
  markdown += `|--------|------|----------|---------|-------------|--------|\n`;
  
  for (const [columnName, column] of Object.entries(table.columns)) {
    const nullable = column.nullable ? '✅' : '❌';
    const pk = column.primary_key ? '🔑' : '';
    const unique = column.unique ? '🔒' : '';
    const defaultValue = column.default || '';
    
    markdown += `| **${columnName}** | \`${column.type}\` | ${nullable} | \`${defaultValue}\` | ${pk} | ${unique} |\n`;
  }
  
  markdown += `\n`;
  
  // Constraints
  if (table.constraints && table.constraints.length > 0) {
    markdown += `**Constraints:**\n`;
    for (const constraint of table.constraints) {
      if (constraint.type === 'FOREIGN KEY') {
        markdown += `- **Foreign Key**: \`${constraint.column}\` → \`${constraint.references_table}.${constraint.references_column}\`\n`;
      }
    }
    markdown += `\n`;
  }
  
  // Indexes
  if (table.indexes && table.indexes.length > 0) {
    markdown += `**Indexes:**\n`;
    for (const index of table.indexes) {
      const uniqueStr = index.unique ? ' (UNIQUE)' : '';
      markdown += `- **${index.name}**${uniqueStr}: \`(${index.columns.join(', ')})\`\n`;
    }
    markdown += `\n`;
  }
  
  markdown += `---\n\n`;
  
  return markdown;
}

/**
 * Categorize tables by their purpose
 */
function categorizeTables(tableNames) {
  const categories = {
    'Core Application': [],
    'Authentication & Security': [],
    'File Management': [],
    'Monitoring & Analytics': [],
    'System & Configuration': []
  };
  
  for (const tableName of tableNames) {
    if (tableName.includes('oauth') || tableName.includes('api_key') || tableName.includes('security') || tableName === 'users') {
      categories['Authentication & Security'].push(tableName);
    } else if (tableName.includes('file') || tableName.includes('upload') || tableName.includes('storage')) {
      categories['File Management'].push(tableName);
    } else if (tableName.includes('metric') || tableName.includes('log') || tableName.includes('analytic') || tableName.includes('audit')) {
      categories['Monitoring & Analytics'].push(tableName);
    } else if (tableName.includes('config') || tableName.includes('schema') || tableName.includes('alert') || tableName.includes('backup')) {
      categories['System & Configuration'].push(tableName);
    } else {
      categories['Core Application'].push(tableName);
    }
  }
  
  return categories;
}

/**
 * Extract complete database schema from D1
 */
async function extractSchema() {
  console.log('🚀 Starting D1 schema extraction...');
  
  try {
    console.log('📊 Fetching table information...');
    const tableInfoResults = executeD1Query(SCHEMA_QUERIES.table_info);
    
    console.log('📋 Fetching index information...');
    const indexResults = executeD1Query(SCHEMA_QUERIES.indexes);
    
    console.log('🔗 Fetching foreign key information...');
    const foreignKeyResults = executeD1Query(SCHEMA_QUERIES.foreign_keys);
    
    // Transform and combine results
    let tables = transformTableInfo(tableInfoResults);
    tables = addIndexesToTables(tables, indexResults);
    tables = addForeignKeysToTables(tables, foreignKeyResults);
    
    console.log(`✅ Successfully extracted schema for ${Object.keys(tables).length} tables`);
    
    return {
      tables,
      indexes: extractIndexesByTable(tables),
      triggers: {}
    };
    
  } catch (error) {
    console.error('❌ Error extracting schema:', error.message);
    throw error;
  }
}

/**
 * Add index information to tables (simplified from original)
 */
function addIndexesToTables(tables, indexResults) {
  if (!indexResults || !indexResults.results) {
    return tables;
  }
  
  for (const row of indexResults.results) {
    const indexName = row.index_name || row[0];
    const tableName = row.table_name || row[1];
    const createSql = row.create_sql || row[2];
    
    if (!tableName || !indexName || !tables[tableName]) continue;
    
    const columns = parseIndexColumns(createSql);
    const isUnique = createSql && createSql.toLowerCase().includes('unique');
    
    tables[tableName].indexes.push({
      name: indexName,
      columns,
      unique: isUnique
    });
  }
  
  return tables;
}

/**
 * Parse column names from CREATE INDEX statement
 */
function parseIndexColumns(createSql) {
  if (!createSql) return [];
  
  const match = createSql.match(/\((.*?)\)/);
  if (!match) return [];
  
  return match[1].split(',').map(col => col.trim().replace(/["`]/g, ''));
}

/**
 * Add foreign key constraints to tables
 */
function addForeignKeysToTables(tables, foreignKeyResults) {
  if (!foreignKeyResults || !foreignKeyResults.results) {
    return tables;
  }
  
  for (const row of foreignKeyResults.results) {
    const tableName = row.table_name || row[0];
    const referencesTable = row.references_table || row[1];
    const columnName = row.column_name || row[2];
    const referencesColumn = row.references_column || row[3];
    
    if (!tableName || !tables[tableName]) continue;
    
    tables[tableName].constraints.push({
      type: 'FOREIGN KEY',
      column: columnName,
      references_table: referencesTable,
      references_column: referencesColumn
    });
  }
  
  return tables;
}

/**
 * Extract indexes organized by table
 */
function extractIndexesByTable(tables) {
  const indexes = {};
  
  for (const [tableName, tableData] of Object.entries(tables)) {
    if (tableData.indexes && tableData.indexes.length > 0) {
      indexes[tableName] = tableData.indexes;
    }
  }
  
  return indexes;
}

/**
 * Update the schema JSON file and generate markdown
 */
function updateSchemaFiles(schema) {
  console.log('📝 Updating schema files...');
  
  // Update JSON file
  const schemaData = {
    version: "1.0.0",
    last_updated: new Date().toISOString(),
    migration_path: "D1 Live Database",
    latest_migration: "Live Schema Extraction",
    schema: schema,
    metadata: {
      auto_generated: true,
      source: "D1 Schema Introspection via GitHub Actions",
      warning: "DO NOT EDIT MANUALLY - This file is automatically generated from live D1 database",
      table_count: Object.keys(schema.tables).length,
      total_indexes: Object.values(schema.indexes).flat().length,
      extraction_method: "wrangler d1 execute --remote"
    }
  };
  
  fs.writeFileSync(SCHEMA_JSON_FILE, JSON.stringify(schemaData, null, 2));
  console.log(`✅ Schema JSON updated: ${SCHEMA_JSON_FILE}`);
  
  // Generate and write markdown documentation
  const markdown = generateSchemaMarkdown(schema);
  fs.writeFileSync(SCHEMA_MD_FILE, markdown);
  console.log(`✅ Schema markdown created: ${SCHEMA_MD_FILE}`);
  
  console.log(`📊 Found ${schemaData.metadata.table_count} tables and ${schemaData.metadata.total_indexes} indexes`);
}


/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting D1 schema documentation generation...');
  
  try {
    const schema = await extractSchema();
    updateSchemaFiles(schema);
    
    console.log('✨ D1 schema documentation generation completed successfully!');
    
    // Output summary for GitHub Actions
    console.log('\n📋 SUMMARY:');
    console.log(`Tables documented: ${Object.keys(schema.tables).length}`);
    console.log(`Files created: ${SCHEMA_JSON_FILE}, ${SCHEMA_MD_FILE}`);
    console.log(`Tables: ${Object.keys(schema.tables).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error generating D1 schema documentation:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { extractSchema, generateSchemaMarkdown };