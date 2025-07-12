/**
 * Pinkie Pie's Test Data Generator 🎉
 * Creating all the fun test data for our E2E party!
 */

export class TestDataGenerator {
  /**
   * Generate a unique test user with random but valid data
   */
  static generateTestUser() {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    
    return {
      email: `test.user.${timestamp}.${randomId}@example.com`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      username: `testuser_${timestamp}_${randomId}`,
    };
  }

  /**
   * Generate test CSV content with various scenarios
   */
  static generateCSVContent(scenario: 'basic' | 'large' | 'special-chars' | 'empty' | 'malformed' = 'basic') {
    switch (scenario) {
      case 'basic':
        return `name,email,phone,department
John Doe,john.doe@example.com,555-1234,Engineering
Jane Smith,jane.smith@example.com,555-5678,Marketing
Bob Johnson,bob.johnson@example.com,555-9012,Sales
Alice Brown,alice.brown@example.com,555-3456,HR`;

      case 'large':
        const rows = ['name,email,phone,department'];
        for (let i = 1; i <= 1000; i++) {
          rows.push(`User ${i},user${i}@example.com,555-${i.toString().padStart(4, '0')},Dept${i % 5}`);
        }
        return rows.join('\n');

      case 'special-chars':
        return `name,email,phone,department
"Smith, John",john@example.com,555-1234,"R&D, Special Projects"
María García,maria@example.com,555-5678,Español
李小明,li@example.com,555-9012,中文部门
François Müller,francois@example.com,555-3456,"Café & Restaurant"`;

      case 'empty':
        return 'name,email,phone,department';

      case 'malformed':
        return `name,email,phone
John Doe,john.doe@example.com,555-1234,Engineering,ExtraColumn
Jane Smith,jane.smith@example.com
Bob Johnson,bob.johnson@example.com,555-9012`;

      default:
        return this.generateCSVContent('basic');
    }
  }

  /**
   * Generate test file with specific properties
   */
  static generateTestFile(name: string, content: string, type: string = 'text/csv') {
    const blob = new Blob([content], { type });
    const file = new File([blob], name, { type });
    return file;
  }

  /**
   * Generate various CSV test files for different scenarios
   */
  static generateTestFiles() {
    return {
      basic: this.generateTestFile('basic-test.csv', this.generateCSVContent('basic')),
      large: this.generateTestFile('large-test.csv', this.generateCSVContent('large')),
      specialChars: this.generateTestFile('special-chars-test.csv', this.generateCSVContent('special-chars')),
      empty: this.generateTestFile('empty-test.csv', this.generateCSVContent('empty')),
      malformed: this.generateTestFile('malformed-test.csv', this.generateCSVContent('malformed')),
      nonCSV: this.generateTestFile('not-a-csv.txt', 'This is not a CSV file', 'text/plain'),
      tooLarge: this.generateTestFile('too-large.csv', 'x'.repeat(60 * 1024 * 1024), 'text/csv'), // 60MB
    };
  }

  /**
   * Generate API test data
   */
  static generateAPITestData() {
    return {
      validHeaders: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      invalidAuthToken: 'invalid.jwt.token',
      malformedJSON: '{"invalid": json}',
      emptyPayload: {},
    };
  }

  /**
   * Generate test configurations for different environments
   */
  static generateTestConfig() {
    return {
      timeouts: {
        short: 5000,
        medium: 15000,
        long: 30000,
        fileUpload: 60000,
      },
      retries: {
        flaky: 2,
        stable: 0,
      },
      waitConditions: {
        networkIdle: 'networkidle',
        domContentLoaded: 'domcontentloaded',
        load: 'load',
      } as const,
    };
  }

  /**
   * Generate random test data for stress testing
   */
  static generateRandomData(count: number = 100) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        value: Math.random() * 1000,
        active: Math.random() > 0.5,
        created: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    return data;
  }

  /**
   * Generate cleanup patterns for test data
   */
  static generateCleanupPatterns() {
    return {
      testUserEmailPattern: /test\.user\.\d+\.[a-z0-9]+@example\.com/,
      testFileNamePattern: /.*-test\.(csv|txt)$/,
      testUsernamePattern: /^testuser_\d+_[a-z0-9]+$/,
    };
  }
}