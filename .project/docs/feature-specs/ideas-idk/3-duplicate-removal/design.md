# Design: Duplicate Removal During Import

## Overview
A minimal implementation that adds duplicate removal as an option during CSV import, integrated directly into the existing import flow.

## Architecture

### No New Components
- Integrates into existing CSV processing pipeline
- Uses streaming to handle large files efficiently
- No new tables, services, or UI screens

## Implementation

### Import Flow Enhancement

```typescript
// Add to existing CSV import handler
interface ImportOptions {
  removeDuplicates?: boolean;
  duplicateCheckFields?: ('email' | 'phone')[];
}

class CSVImporter {
  async processCSV(file: File, options: ImportOptions) {
    const seen = new Set<string>();
    let duplicateCount = 0;
    
    // Stream process the CSV
    for await (const row of this.streamCSV(file)) {
      if (options.removeDuplicates) {
        const key = this.getDuplicateKey(row, options.duplicateCheckFields);
        
        if (seen.has(key)) {
          duplicateCount++;
          continue; // Skip duplicate
        }
        
        seen.add(key);
      }
      
      // Process row normally
      await this.saveRecord(row);
    }
    
    return { 
      imported: seen.size, 
      duplicatesRemoved: duplicateCount 
    };
  }
  
  private getDuplicateKey(row: any, fields: string[] = ['email']): string {
    const parts = [];
    
    if (fields.includes('email') && row.email) {
      parts.push(row.email.toLowerCase().trim());
    }
    
    if (fields.includes('phone') && row.phone) {
      parts.push(row.phone.replace(/\D/g, ''));
    }
    
    return parts.join('|');
  }
}
```

### UI Changes

```tsx
// Add to existing import component
function ImportCSV() {
  const [removeDuplicates, setRemoveDuplicates] = useState(
    localStorage.getItem('removeDuplicates') === 'true'
  );
  
  return (
    <div>
      {/* Existing file upload UI */}
      
      <FormControlLabel
        control={
          <Checkbox
            checked={removeDuplicates}
            onChange={(e) => {
              setRemoveDuplicates(e.target.checked);
              localStorage.setItem('removeDuplicates', e.target.checked.toString());
            }}
          />
        }
        label="Remove duplicate records (based on email address)"
      />
      
      {/* Rest of import UI */}
    </div>
  );
}

// Import results display
function ImportResults({ results }) {
  return (
    <Alert severity="success">
      Successfully imported {results.imported} records
      {results.duplicatesRemoved > 0 && 
        ` (${results.duplicatesRemoved} duplicates removed)`
      }
    </Alert>
  );
}
```

### API Changes

```typescript
// Modify existing import endpoint
app.post('/api/v1/files/process', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  const removeDuplicates = formData.get('removeDuplicates') === 'true';
  
  const results = await csvImporter.processCSV(file, {
    removeDuplicates,
    duplicateCheckFields: ['email'] // Hardcoded for v1
  });
  
  return c.json(results);
});
```

## Database

No new tables required. Import process remains the same, just with fewer records.

## Performance Optimization

### Memory Management
- Use Set for O(1) duplicate lookups
- Stream processing to handle large files
- Clear Set after import completes

### Speed
- Email normalization: Simple lowercase + trim
- Phone normalization: Regex replace (cached)
- No database lookups during import

## Testing

### Unit Tests
```typescript
describe('Duplicate Removal', () => {
  it('removes exact email duplicates', async () => {
    const csv = `email,name
john@example.com,John Smith
jane@example.com,Jane Doe
john@example.com,John S.`;
    
    const results = await importer.processCSV(csv, { removeDuplicates: true });
    expect(results.imported).toBe(2);
    expect(results.duplicatesRemoved).toBe(1);
  });
  
  it('handles case-insensitive email matching', async () => {
    const csv = `email,name
John@Example.com,John
john@example.com,John`;
    
    const results = await importer.processCSV(csv, { removeDuplicates: true });
    expect(results.imported).toBe(1);
    expect(results.duplicatesRemoved).toBe(1);
  });
});
```

## Implementation Timeline

### Day 1-2: Backend
- Add duplicate detection to CSV processor
- Update import endpoint
- Write tests

### Day 3: Frontend
- Add checkbox to import UI
- Update results display
- Save preference to localStorage

### Day 4: Testing & Polish
- End-to-end testing
- Performance testing with large files
- Documentation

## Future Enhancements (Not in v1)
- Additional duplicate criteria (name, address)
- Configuration of which fields to check
- Preview of duplicates before removal
- Duplicate detection across existing lists