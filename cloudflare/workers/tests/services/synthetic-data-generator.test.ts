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

    it('should generate geographically accurate city/state/zip combinations', async () => {
      // Test with specific states that have location data
      const statesWithData = ['CA', 'TX', 'NY', 'FL'];
      
      for (const state of statesWithData) {
        const records = await SyntheticDataGenerator.generateVoterRecords(10, state);
        
        records.forEach(record => {
          // Verify state matches requested state
          expect(record.state).toBe(state);
          
          // Verify city and ZIP are not random - they should be from the location data
          // Check some known combinations
          if (state === 'CA') {
            const validCACombos = [
              { city: 'Los Angeles', zips: ['90001', '90210'] },
              { city: 'San Francisco', zips: ['94102', '94107'] },
              { city: 'San Diego', zips: ['92101', '92128'] },
              { city: 'Sacramento', zips: ['95814'] },
              { city: 'Oakland', zips: ['94612'] },
              { city: 'Fresno', zips: ['93721'] },
              { city: 'San Jose', zips: ['95113'] },
              { city: 'Palo Alto', zips: ['94301'] },
              { city: 'Pasadena', zips: ['91101'] }
            ];
            
            // Verify that the city/zip combination exists in our valid data
            const cityData = validCACombos.find(combo => combo.city === record.city);
            if (cityData) {
              expect(cityData.zips).toContain(record.zip);
            }
          } else if (state === 'TX') {
            const validTXCombos = [
              { city: 'Houston', zips: ['77001', '77056'] },
              { city: 'Austin', zips: ['78701', '78759'] },
              { city: 'Dallas', zips: ['75201', '75225'] },
              { city: 'San Antonio', zips: ['78205'] },
              { city: 'Fort Worth', zips: ['76102'] },
              { city: 'El Paso', zips: ['79901'] },
              { city: 'Plano', zips: ['75074'] }
            ];
            
            const cityData = validTXCombos.find(combo => combo.city === record.city);
            if (cityData) {
              expect(cityData.zips).toContain(record.zip);
            }
          }
          
          // All generated ZIPs should be 5 digits
          expect(record.zip).toMatch(/^\d{5}$/);
        });
      }
    });

    it('should distribute records evenly across multiple states', async () => {
      const states = ['CA', 'TX', 'NY'];
      const totalRecords = 30;
      const records = await SyntheticDataGenerator.generateVoterRecords(totalRecords, states);
      
      // Count records per state
      const stateCounts = records.reduce((acc, record) => {
        acc[record.state] = (acc[record.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Each state should have approximately equal number of records
      states.forEach(state => {
        expect(stateCounts[state]).toBe(10); // 30 records / 3 states = 10 each
      });
    });

    it('should generate area codes that match the city', async () => {
      // Test PA cities with known area codes
      const paRecords = await SyntheticDataGenerator.generateVoterRecords(50, 'PA');
      
      paRecords.forEach(record => {
        const areaCode = record.phone.match(/\((\d{3})\)/)?.[1];
        expect(areaCode).toBeTruthy();
        
        // Check specific city-area code mappings
        if (record.city === 'Lancaster') {
          expect(areaCode).toBe('717');
        } else if (record.city === 'Philadelphia') {
          expect(['215', '267']).toContain(areaCode);
        } else if (record.city === 'Pittsburgh') {
          expect(['412', '878']).toContain(areaCode);
        } else if (record.city === 'Allentown') {
          expect(areaCode).toBe('484');
        } else if (record.city === 'Erie') {
          expect(areaCode).toBe('814');
        } else if (record.city === 'Scranton') {
          expect(areaCode).toBe('570');
        } else if (record.city === 'Reading') {
          expect(areaCode).toBe('610');
        }
      });
      
      // Test TX cities
      const txRecords = await SyntheticDataGenerator.generateVoterRecords(30, 'TX');
      
      txRecords.forEach(record => {
        const areaCode = record.phone.match(/\((\d{3})\)/)?.[1];
        
        if (record.city === 'Austin') {
          expect(['512', '737']).toContain(areaCode);
        } else if (record.city === 'Houston') {
          expect(['281', '713', '832']).toContain(areaCode);
        } else if (record.city === 'Dallas') {
          expect(['214', '469', '972']).toContain(areaCode);
        } else if (record.city === 'Fort Worth') {
          expect(areaCode).toBe('817');
        } else if (record.city === 'El Paso') {
          expect(areaCode).toBe('915');
        }
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