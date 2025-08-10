# End-to-End Tests

## Authentication Flow Tests

The authentication flow tests ensure that the login and registration systems work correctly and prevent regression of critical bugs.

### Running the Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run only authentication flow tests
npm run test:e2e:auth

# Run auth tests with browser visible (for debugging)
npm run test:e2e:auth:headed

# Run tests with UI mode (interactive)
npm run test:e2e:ui
```

### Critical Test Coverage

The `auth-flow.spec.ts` test suite covers:

1. **Login with Username OR Email**
   - Verifies users can login with either username or email
   - Ensures proper token storage in localStorage
   - Confirms redirect to home page (not CUT page)

2. **Auto-login After Registration**
   - Tests automatic login after successful registration
   - Verifies tokens are stored correctly
   - Ensures redirect to home page

3. **Token Persistence**
   - Validates JWT tokens are stored in localStorage
   - Tests token format and structure
   - Verifies tokens persist across navigation

4. **Protected Page Access**
   - Tests navigation to Do Stuff and Manage Files
   - Ensures no "not logged in" errors when authenticated
   - Validates API calls with authentication headers

5. **Logout Functionality**
   - Verifies tokens are cleared on logout
   - Tests redirect behavior after logout

6. **Required Fields**
   - Ensures email field is marked as required
   - Validates form validation

### Test Environment

Tests run against the development environment by default. To test against production:

```bash
PLAYWRIGHT_BASE_URL=https://cutty.emilycogsdill.com npm run test:e2e:auth
```

### Debugging Failed Tests

If tests fail:

1. Run with headed mode to see what's happening:
   ```bash
   npm run test:e2e:auth:headed
   ```

2. Use debug mode for step-by-step execution:
   ```bash
   npx playwright test e2e/tests/auth-flow.spec.ts --debug
   ```

3. Check screenshots and traces in `test-results/` directory

### Adding New Auth Tests

When adding new authentication features, ensure you:

1. Add test cases to `auth-flow.spec.ts`
2. Update this README with new coverage areas
3. Run tests locally before committing
4. Include tests in CI/CD pipeline

### Known Issues

- Tests assume a clean database state
- Some tests may need adjustment for production environment
- Rate limiting may affect rapid test execution