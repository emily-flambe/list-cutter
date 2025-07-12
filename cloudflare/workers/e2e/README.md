# Pinkie Pie's E2E Testing Suite 🎉

Welcome to the most fun and comprehensive E2E testing setup for our CSV Cutter application! This testing suite covers the complete user journey from registration to file processing and download.

## 🎯 What We Test

### Authentication Flows
- User registration with validation
- Login/logout functionality
- Session management
- Password strength validation
- Error handling for invalid credentials

### Complete User Journeys
- Register → Login → Upload → Process → Download
- Multiple file processing workflows
- Session persistence across navigation
- Performance measurement
- Error recovery scenarios

### CSV Processing
- Basic CSV file processing
- Large files (1000+ rows)
- Special characters and encoding
- Empty and malformed files
- Column selection and filtering
- Row range selection
- Concurrent processing
- Data integrity verification

### Error Handling & Validation
- Network errors and timeouts
- File size and type restrictions
- Processing errors
- Session expiry handling
- CSRF protection
- UI error recovery
- Data validation

## 🏗️ Test Structure

```
e2e/
├── tests/                  # Test files
│   ├── auth.spec.ts       # Authentication tests
│   ├── user-journey.spec.ts # Complete user flow tests
│   ├── csv-processing.spec.ts # CSV processing tests
│   └── error-handling.spec.ts # Error handling tests
├── page-objects/          # Page Object Models
│   ├── AppPage.ts        # Main application page
│   ├── LoginPage.ts      # Login page actions
│   ├── RegisterPage.ts   # Registration page actions
│   └── CSVCutterPage.ts  # CSV processing page actions
├── fixtures/              # Test data
│   └── test-data-generator.ts # Test data generation utilities
├── utils/                 # Test utilities
│   └── test-helpers.ts   # Common test helper functions
├── global-setup.ts       # Global test setup
└── global-teardown.ts    # Global test teardown
```

## 🚀 Running Tests

### Install Dependencies
```bash
npm install
```

### Run All E2E Tests
```bash
npm run test:e2e
```

### Run Tests with UI
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode
```bash
npm run test:e2e:headed
```

### Debug Tests
```bash
npm run test:e2e:debug
```

### Run Specific Test File
```bash
npx playwright test auth.spec.ts
```

### Run Tests in Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## 🔧 Configuration

The tests are configured via `playwright.config.ts` with:

- **Multi-browser support**: Chrome, Firefox, Safari, Mobile browsers
- **Automatic server startup**: Backend (port 8788) and Frontend (port 5173)
- **Retry logic**: Automatic retries on CI
- **Screenshots**: Captured on failure
- **Video recording**: Retained on failure
- **HTML reports**: Generated for all test runs

## 🧪 Test Data Generation

The `TestDataGenerator` class provides:

- **User accounts**: Random valid user data
- **CSV content**: Various scenarios (basic, large, special-chars, empty, malformed)
- **Test files**: Generated files with specific properties
- **API test data**: Headers, tokens, payloads
- **Random data**: For stress testing

## 📋 Page Object Models

### AppPage
Central hub for navigation and common app functionality:
- User authentication status
- Navigation between pages
- Complete user journey orchestration
- Notification handling

### LoginPage
Login form interactions:
- Email/password input
- Form submission
- Error message handling
- Navigation to registration

### RegisterPage
Registration form interactions:
- User data input
- Form validation
- Terms acceptance
- Success/error handling

### CSVCutterPage
CSV processing functionality:
- File upload
- Preview data inspection
- Processing options
- File download
- Error handling

## 🛠️ Test Utilities

### TestHelpers
Common testing operations:
- Safe element interactions
- File upload handling
- Download management
- Screenshot capture
- Accessibility validation
- Network condition simulation

## 🎯 Testing Best Practices

1. **Isolation**: Each test is independent and cleans up after itself
2. **Reliability**: Retry logic and safe element interactions
3. **Readability**: Clear test descriptions and page object patterns
4. **Performance**: Timing measurements and threshold validation
5. **Accessibility**: Built-in accessibility checks
6. **Error Recovery**: Graceful handling of failures

## 🚨 Troubleshooting

### Test Failures
- Check console logs in test output
- Review screenshots in `test-results/`
- Use `--headed` mode to see tests running
- Enable debug mode for step-by-step execution

### Server Issues
- Ensure backend is running on port 8788
- Ensure frontend is running on port 5173
- Check global setup logs for service readiness

### Environment Variables
```bash
export FRONTEND_URL=http://localhost:5173
export BACKEND_URL=http://localhost:8788
```

## 📊 Performance Monitoring

Tests include performance measurement for:
- Registration time
- Login time
- Navigation time
- File upload time
- Processing time
- Download time

Thresholds are configured to ensure good user experience.

## 🎉 Happy Testing!

These tests ensure that our CSV Cutter application provides a delightful user experience from start to finish. Each test is designed to verify not just functionality, but also performance, accessibility, and error handling.

Remember: Good tests are like a good party - they should be comprehensive, reliable, and leave everyone feeling confident! 

---

*Created with ❤️ by Pinkie Pie - Making E2E testing as fun as a party!*