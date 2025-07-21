import { describe, it, expect } from 'vitest';
import { SyntheticDataGenerator } from '../../src/services/synthetic-data-generator';

describe('SyntheticDataGenerator', () => {
  describe('generateVoterRecords', () => {
    it('should generate the correct number of records', async () => {
      const count = 10;
      const records = await SyntheticDataGenerator.generateVoterRecords(count);
      
      expect(records).toHaveLength(count);
    });

    it('should generate records with all required fields', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(1);
      const record = records[0];
      
      expect(record).toHaveProperty('voter_id');
      expect(record).toHaveProperty('first_name');
      expect(record).toHaveProperty('last_name');
      expect(record).toHaveProperty('address');
      expect(record).toHaveProperty('city');
      expect(record).toHaveProperty('state');
      expect(record).toHaveProperty('zip');
      expect(record).toHaveProperty('phone');
      expect(record).toHaveProperty('email');
      
      // Check that all fields have values
      expect(record.voter_id).toBeTruthy();
      expect(record.first_name).toBeTruthy();
      expect(record.last_name).toBeTruthy();
      expect(record.address).toBeTruthy();
      expect(record.city).toBeTruthy();
      expect(record.state).toBeTruthy();
      expect(record.zip).toBeTruthy();
      expect(record.phone).toBeTruthy();
      expect(record.email).toBeTruthy();
    });

    it('should generate unique voter IDs', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(100);
      const voterIds = records.map(r => r.voter_id);
      const uniqueIds = new Set(voterIds);
      
      expect(uniqueIds.size).toBe(records.length);
    });

    it('should filter by state when provided', async () => {
      const state = 'CA';
      const records = await SyntheticDataGenerator.generateVoterRecords(10, state);
      
      records.forEach(record => {
        expect(record.state).toBe(state);
      });
    });

    it('should throw error for invalid count', async () => {
      await expect(SyntheticDataGenerator.generateVoterRecords(0))
        .rejects.toThrow('Count must be between 1 and 1000');
      
      await expect(SyntheticDataGenerator.generateVoterRecords(1001))
        .rejects.toThrow('Count must be between 1 and 1000');
    });

    it('should throw error for invalid state', async () => {
      await expect(SyntheticDataGenerator.generateVoterRecords(10, 'XX'))
        .rejects.toThrow('Invalid state code(s): XX');
    });

    it('should generate valid email format', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(5);
      
      records.forEach(record => {
        expect(record.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });

    it('should generate valid phone format', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(5);
      
      records.forEach(record => {
        expect(record.phone).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
      });
    });

    it('should generate valid ZIP code format', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(5);
      
      records.forEach(record => {
        expect(record.zip).toMatch(/^\d{5}$/);
      });
    });
  });

  describe('recordsToCSV', () => {
    it('should convert records to CSV format', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(2);
      const csv = SyntheticDataGenerator.recordsToCSV(records);
      
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3); // header + 2 records
      
      // Check header
      expect(lines[0]).toBe('voter_id,first_name,last_name,address,city,state,zip,phone,email');
      
      // Check that each record line has the correct number of fields
      lines.slice(1).forEach(line => {
        const fields = line.split(',');
        expect(fields).toHaveLength(9);
      });
    });

    it('should properly quote addresses that may contain commas', async () => {
      const records = await SyntheticDataGenerator.generateVoterRecords(1);
      const csv = SyntheticDataGenerator.recordsToCSV(records);
      
      const lines = csv.split('\n');
      const recordLine = lines[1];
      
      // Address should be the 4th field and should be quoted
      const fields = recordLine.split(',');
      expect(fields[3]).toMatch(/^".*"$/);
    });
  });
});