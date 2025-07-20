// Simple manual test for SyntheticDataGenerator
// Run with: node test-synthetic-data.js

class SyntheticDataGenerator {
  static FIRST_NAMES = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica'
  ];

  static LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'
  ];

  static STREET_NAMES = [
    'Main St', 'Oak Ave', 'Pine St', 'Maple Ave', 'Cedar St', 'Elm Ave'
  ];

  static US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA'
  ];

  static CITIES_BY_STATE = {
    'CA': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento'],
    'TX': ['Houston', 'Austin', 'Dallas', 'San Antonio'],
    'NY': ['New York', 'Buffalo', 'Rochester', 'Syracuse']
  };

  static generateVoterRecords(count, state) {
    if (count < 1 || count > 1000) {
      throw new Error('Count must be between 1 and 1000');
    }

    if (state && !this.US_STATES.includes(state.toUpperCase())) {
      throw new Error(`Invalid state code: ${state}`);
    }

    const records = [];
    const usedVoterIds = new Set();

    for (let i = 0; i < count; i++) {
      const record = this.generateSingleRecord(state?.toUpperCase(), usedVoterIds);
      records.push(record);
    }

    return records;
  }

  static generateSingleRecord(state, usedIds) {
    const firstName = this.randomChoice(this.FIRST_NAMES);
    const lastName = this.randomChoice(this.LAST_NAMES);
    
    let voterId;
    do {
      voterId = this.generateVoterId();
    } while (usedIds?.has(voterId));
    usedIds?.add(voterId);

    const selectedState = state || this.randomChoice(this.US_STATES);
    const cities = this.CITIES_BY_STATE[selectedState] || ['Springfield', 'Franklin'];
    const city = this.randomChoice(cities);

    const streetNumber = Math.floor(Math.random() * 9999) + 1;
    const streetName = this.randomChoice(this.STREET_NAMES);
    const address = `${streetNumber} ${streetName}`;

    const zip = String(Math.floor(Math.random() * 90000) + 10000);

    const areaCode = Math.floor(Math.random() * 800) + 200;
    const exchange = Math.floor(Math.random() * 800) + 200;
    const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const phone = `(${areaCode}) ${exchange}-${number}`;

    const emailDomain = this.randomChoice(['gmail.com', 'yahoo.com', 'hotmail.com']);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`;

    return {
      voter_id: voterId,
      first_name: firstName,
      last_name: lastName,
      address,
      city,
      state: selectedState,
      zip,
      phone,
      email
    };
  }

  static generateVoterId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    let id = '';
    for (let i = 0; i < 3; i++) {
      id += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 6; i++) {
      id += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    return id;
  }

  static recordsToCSV(records) {
    const headers = [
      'voter_id', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'phone', 'email'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const record of records) {
      const row = [
        record.voter_id,
        record.first_name,
        record.last_name,
        `"${record.address}"`,
        record.city,
        record.state,
        record.zip,
        record.phone,
        record.email
      ];
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  }

  static randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }
}

// Test the generator
console.log('Testing SyntheticDataGenerator...\n');

// Test 1: Generate 5 records
console.log('Test 1: Generate 5 records');
try {
  const records = SyntheticDataGenerator.generateVoterRecords(5);
  console.log('✓ Generated', records.length, 'records');
  console.log('Sample record:', records[0]);
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 2: Generate records for specific state
console.log('\nTest 2: Generate 3 records for CA');
try {
  const records = SyntheticDataGenerator.generateVoterRecords(3, 'CA');
  console.log('✓ Generated', records.length, 'records for CA');
  console.log('States:', records.map(r => r.state));
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 3: Test CSV conversion
console.log('\nTest 3: Convert to CSV');
try {
  const records = SyntheticDataGenerator.generateVoterRecords(2);
  const csv = SyntheticDataGenerator.recordsToCSV(records);
  console.log('✓ CSV generated');
  console.log('CSV length:', csv.length, 'characters');
  console.log('First few lines:');
  console.log(csv.split('\n').slice(0, 3).join('\n'));
} catch (error) {
  console.log('✗ Error:', error.message);
}

// Test 4: Test error handling
console.log('\nTest 4: Error handling');
try {
  SyntheticDataGenerator.generateVoterRecords(0);
  console.log('✗ Should have thrown error for count=0');
} catch (error) {
  console.log('✓ Correctly threw error for count=0:', error.message);
}

try {
  SyntheticDataGenerator.generateVoterRecords(5, 'XX');
  console.log('✗ Should have thrown error for invalid state');
} catch (error) {
  console.log('✓ Correctly threw error for invalid state:', error.message);
}

console.log('\nAll tests completed!');