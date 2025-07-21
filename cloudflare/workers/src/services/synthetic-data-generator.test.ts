import { describe, it, expect } from 'vitest';
import { SyntheticDataGenerator } from './synthetic-data-generator';

describe('SyntheticDataGenerator', () => {
  describe('generateVoterRecords', () => {
    it('should generate records with real city/ZIP combinations', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(10, 'CA');
      
      expect(records).toHaveLength(10);
      
      // Check that all records have California data
      records.forEach(record => {
        expect(record.state).toBe('CA');
        
        // Check for real California cities
        const californiaCities = ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Oakland', 'Fresno', 'San Jose', 'Palo Alto', 'Pasadena'];
        expect(californiaCities).toContain(record.city);
        
        // Check for real California ZIP codes (5 digits)
        expect(record.zip).toMatch(/^\d{5}$/);
        
        // Check for real California area codes
        const californiaAreaCodes = ['213', '310', '323', '415', '510', '619', '626', '650', '714', '818', '916', '925', '949'];
        const phoneAreaCode = record.phone.match(/\((\d{3})\)/)?.[1];
        expect(californiaAreaCodes).toContain(phoneAreaCode);
      });
    });

    it('should generate records for multiple states', async () => {
      const states = ['NY', 'TX', 'FL'];
      const records = await SyntheticDataGenerator.generateVoterRecords(30, states);
      
      expect(records).toHaveLength(30);
      
      // Check that records are distributed among the requested states
      const stateCount = new Map<string, number>();
      records.forEach(record => {
        expect(states).toContain(record.state);
        stateCount.set(record.state, (stateCount.get(record.state) || 0) + 1);
      });
      
      // Each state should have at least one record
      states.forEach(state => {
        expect(stateCount.get(state)).toBeGreaterThan(0);
      });
    });

    it('should handle no state filter', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(5);
      
      expect(records).toHaveLength(5);
      
      // Records should have valid US states
      const usStates = [
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
      ];
      
      records.forEach(record => {
        expect(usStates).toContain(record.state);
      });
    });

    it('should generate unique voter IDs', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(100);
      const voterIds = records.map(r => r.voter_id);
      const uniqueIds = new Set(voterIds);
      
      expect(uniqueIds.size).toBe(100);
    });

    it('should validate count range', async () => {
      await expect(SyntheticDataGenerator.generateVoterRecords(0)).rejects.toThrow('Count must be between 1 and 1000');
      await expect(SyntheticDataGenerator.generateVoterRecords(1001)).rejects.toThrow('Count must be between 1 and 1000');
    });

    it('should validate state codes', async () => {
      await expect(SyntheticDataGenerator.generateVoterRecords(10, 'XX')).rejects.toThrow('Invalid state code(s): XX');
      await expect(SyntheticDataGenerator.generateVoterRecords(10, ['CA', 'XX', 'YY'])).rejects.toThrow('Invalid state code(s): XX, YY');
    });
  });

  describe('recordsToCSV', () => {
    it('should convert records to CSV format', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(2, 'NY');
      const csv = SyntheticDataGenerator.recordsToCSV(records);
      
      const lines = csv.split('\n');
      expect(lines[0]).toBe('voter_id,first_name,last_name,address,city,state,zip,phone,email');
      expect(lines).toHaveLength(3); // Header + 2 records
      
      // Check that addresses are quoted (they may contain commas)
      expect(lines[1]).toMatch(/"[^"]+"/); // Contains quoted field
    });
  });
});