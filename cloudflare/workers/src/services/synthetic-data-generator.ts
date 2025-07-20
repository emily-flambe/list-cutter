import type { SyntheticVoterRecord } from '../types';

/**
 * Synthetic Data Generator Service
 * Generates fake voter registration data for testing purposes
 */
export class SyntheticDataGenerator {
  private static readonly FIRST_NAMES = [
    'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
    'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
    'Thomas', 'Sarah', 'Christopher', 'Karen', 'Charles', 'Nancy', 'Daniel', 'Lisa',
    'Matthew', 'Betty', 'Anthony', 'Helen', 'Mark', 'Sandra', 'Donald', 'Donna',
    'Steven', 'Carol', 'Paul', 'Ruth', 'Andrew', 'Sharon', 'Joshua', 'Michelle',
    'Kenneth', 'Laura', 'Kevin', 'Sarah', 'Brian', 'Kimberly', 'George', 'Deborah',
    'Timothy', 'Dorothy', 'Ronald', 'Lisa', 'Jason', 'Nancy', 'Edward', 'Karen',
    'Jeffrey', 'Betty', 'Ryan', 'Helen', 'Jacob', 'Sandra', 'Gary', 'Donna'
  ];

  private static readonly LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
    'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
    'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker'
  ];

  private static readonly STREET_NAMES = [
    'Main St', 'Oak Ave', 'Pine St', 'Maple Ave', 'Cedar St', 'Elm Ave', 'Washington St',
    'Park Ave', 'Lincoln St', 'Jefferson Ave', 'Madison St', 'Monroe Ave', 'Jackson St',
    'Adams Ave', 'Franklin St', 'Roosevelt Ave', 'Wilson St', 'Kennedy Ave', 'Church St',
    'School Ave', 'Mill St', 'River Ave', 'Lake St', 'Hill Ave', 'Valley St', 'Spring Ave',
    'Water St', 'Forest Ave', 'Garden St', 'Sunset Ave', 'Sunrise St', 'Highland Ave'
  ];

  private static readonly US_STATES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  private static readonly CITIES_BY_STATE: Record<string, string[]> = {
    'CA': ['Los Angeles', 'San Francisco', 'San Diego', 'Sacramento', 'Oakland', 'Fresno'],
    'TX': ['Houston', 'Austin', 'Dallas', 'San Antonio', 'Fort Worth', 'El Paso'],
    'NY': ['New York', 'Buffalo', 'Rochester', 'Syracuse', 'Albany', 'Yonkers'],
    'FL': ['Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Tallahassee', 'Fort Lauderdale'],
    'IL': ['Chicago', 'Aurora', 'Rockford', 'Joliet', 'Naperville', 'Springfield'],
    'PA': ['Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading', 'Scranton'],
    'OH': ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
    'GA': ['Atlanta', 'Augusta', 'Columbus', 'Savannah', 'Athens', 'Macon'],
    'NC': ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
    'MI': ['Detroit', 'Grand Rapids', 'Warren', 'Sterling Heights', 'Lansing', 'Ann Arbor']
  };

  /**
   * Generate synthetic voter records
   * @param count Number of records to generate (1-1000)
   * @param state Optional state filter
   * @returns Array of synthetic voter records
   */
  public static generateVoterRecords(count: number, state?: string): SyntheticVoterRecord[] {
    if (count < 1 || count > 1000) {
      throw new Error('Count must be between 1 and 1000');
    }

    if (state && !this.US_STATES.includes(state.toUpperCase())) {
      throw new Error(`Invalid state code: ${state}`);
    }

    const records: SyntheticVoterRecord[] = [];
    const usedVoterIds = new Set<string>();

    for (let i = 0; i < count; i++) {
      const record = this.generateSingleRecord(state?.toUpperCase(), usedVoterIds);
      records.push(record);
    }

    return records;
  }

  /**
   * Generate a single voter record
   */
  private static generateSingleRecord(state?: string, usedIds?: Set<string>): SyntheticVoterRecord {
    const firstName = this.randomChoice(this.FIRST_NAMES);
    const lastName = this.randomChoice(this.LAST_NAMES);
    
    // Generate unique voter ID
    let voterId: string;
    do {
      voterId = this.generateVoterId();
    } while (usedIds?.has(voterId));
    usedIds?.add(voterId);

    // Use provided state or random state
    const selectedState = state || this.randomChoice(this.US_STATES);
    
    // Get city for the state (fallback to generic cities if state not in our list)
    const cities = this.CITIES_BY_STATE[selectedState] || ['Springfield', 'Franklin', 'Georgetown', 'Madison', 'Clinton'];
    const city = this.randomChoice(cities);

    // Generate address
    const streetNumber = Math.floor(Math.random() * 9999) + 1;
    const streetName = this.randomChoice(this.STREET_NAMES);
    const address = `${streetNumber} ${streetName}`;

    // Generate ZIP code (simplified - just random 5 digits)
    const zip = String(Math.floor(Math.random() * 90000) + 10000);

    // Generate phone number
    const areaCode = Math.floor(Math.random() * 800) + 200; // 200-999
    const exchange = Math.floor(Math.random() * 800) + 200; // 200-999
    const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const phone = `(${areaCode}) ${exchange}-${number}`;

    // Generate email
    const emailDomain = this.randomChoice(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com']);
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

  /**
   * Generate a unique voter ID
   */
  private static generateVoterId(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    
    // Format: ABC123456 (3 letters + 6 numbers)
    let id = '';
    for (let i = 0; i < 3; i++) {
      id += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 6; i++) {
      id += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    
    return id;
  }

  /**
   * Convert records to CSV format
   */
  public static recordsToCSV(records: SyntheticVoterRecord[]): string {
    const headers = [
      'voter_id', 'first_name', 'last_name', 'address', 'city', 'state', 'zip', 'phone', 'email'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const record of records) {
      const row = [
        record.voter_id,
        record.first_name,
        record.last_name,
        `"${record.address}"`, // Quote address in case it contains commas
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

  /**
   * Utility function to pick random item from array
   */
  private static randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}