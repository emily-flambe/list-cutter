---
title: Login Methods
description: Email/password vs Google OAuth authentication options
category: Features
subcategory: Authentication
order: 2
last_updated: 2024-09-09
---

# Login Methods

Cutty supports two secure authentication methods to access your account. Understanding the differences helps you choose the best option for your workflow and security preferences.

## Authentication Options Overview

| Feature | Email & Password | Google OAuth |
|---------|------------------|--------------|
| **Setup Complexity** | Simple | Very Simple |
| **Security** | User-managed | Google-managed |
| **Access Control** | Independent | Tied to Google account |
| **Session Duration** | 10 minutes | 10 minutes |
| **Offline Availability** | Yes | Requires Google access |
| **Password Management** | Self-managed | Google-managed |
| **Two-Factor Auth** | Available separately | Google's 2FA |

## Email and Password Authentication

### How It Works

Email and password authentication uses traditional username/password credentials that you create and manage directly with Cutty.

#### Login Process
1. **Access Login Page**: Navigate to Cutty's login page
2. **Enter Credentials**: Input your registered email and password
3. **Submit**: Click "Login" or "Sign In"
4. **Verification**: Cutty validates your credentials
5. **Access Granted**: Successful login redirects you to your dashboard

#### Session Management
- **Session Duration**: Active sessions last for 10 minutes
- **Automatic Logout**: Sessions expire after 10 minutes of inactivity
- **Refresh Handling**: Sessions refresh automatically during active use
- **Manual Logout**: Use the logout button to end sessions manually

### Benefits of Email/Password Login

#### Independence and Control
- **Self-Managed**: Complete control over your authentication credentials
- **Service Independence**: Not dependent on third-party service availability
- **Universal Compatibility**: Works on any device or browser
- **Custom Security**: Implement your own password management strategy

#### Flexibility
- **Multiple Emails**: Use different email addresses for different purposes
- **Password Control**: Change passwords on your own schedule
- **Access Patterns**: Login from any location without third-party dependencies
- **Backup Access**: Always available even if other services are down

#### Privacy
- **Direct Relationship**: Authentication happens directly with Cutty
- **Minimal Data Sharing**: No need to share information with third parties
- **Audit Trail**: Clear logging of authentication events
- **Data Control**: Complete control over account information

### Email/Password Best Practices

#### Strong Password Guidelines
**Password Complexity**:
- Minimum 12 characters (longer is better)
- Mix of uppercase and lowercase letters
- Numbers and special characters
- Avoid dictionary words and personal information
- Unique password not used elsewhere

**Password Management**:
- Use a reputable password manager (1Password, LastPass, Bitwarden)
- Enable password generator for strong, unique passwords
- Regular password updates (every 90-180 days)
- Never share passwords or write them down insecurely

#### Account Security
**Login Security**:
- Always log out when using shared computers
- Verify you're on the correct Cutty domain before entering credentials
- Use HTTPS connections (check for lock icon in browser)
- Be cautious of phishing attempts requesting your credentials

**Monitoring**:
- Monitor account activity for unauthorized access
- Report suspicious activity immediately
- Keep contact information current for security notifications
- Review account activity logs regularly

## Google OAuth Authentication

### How It Works

Google OAuth leverages your existing Google account for secure authentication without requiring a separate password for Cutty.

#### Login Process
1. **Access Login Page**: Navigate to Cutty's login page
2. **Select Google Option**: Click "Sign in with Google"
3. **Google Redirect**: Browser redirects to Google's authentication page
4. **Google Login**: Log into your Google account (if not already logged in)
5. **Permission Grant**: Confirm permission for Cutty to access basic profile information
6. **Return to Cutty**: Automatic redirect back to Cutty with authenticated session

#### Authentication Flow
- **OAuth 2.0 Protocol**: Industry-standard secure authentication protocol
- **Token-Based**: Uses secure tokens instead of password sharing
- **Limited Scope**: Cutty only accesses essential profile information
- **Revocable Access**: You can revoke Cutty's access from Google settings

### Benefits of Google OAuth

#### Enhanced Security
- **Google's Security Infrastructure**: Benefit from Google's enterprise-grade security
- **Two-Factor Authentication**: Automatically inherit Google's 2FA settings
- **Advanced Threat Detection**: Google's AI-powered security monitoring
- **Regular Security Updates**: Automatic security improvements from Google

#### Convenience
- **Single Sign-On**: Use existing Google credentials
- **No Additional Passwords**: One less password to remember and manage
- **Automatic Updates**: Security improvements happen automatically
- **Quick Access**: Faster login if already logged into Google

#### Trust and Reliability
- **Established Service**: Proven authentication system used by millions
- **High Availability**: Reliable service with minimal downtime
- **Professional Management**: Security managed by Google's expert teams
- **Industry Standards**: Complies with enterprise security standards

### Google OAuth Requirements

#### Google Account Prerequisites
- **Active Google Account**: Must have valid Google/Gmail account
- **Account Standing**: Google account must be in good standing
- **Email Verification**: Google account should have verified email address
- **Browser Requirements**: JavaScript enabled, cookies allowed

#### Permissions and Access
**Information Cutty Requests**:
- **Basic Profile**: Name and profile photo for account display
- **Email Address**: For account identification and communication
- **Account Verification**: Confirmation of valid Google account

**Information NOT Accessed**:
- Gmail messages or email content
- Google Drive files or documents
- Calendar events or schedule information
- Contacts or address book
- Search history or browsing data
- Location information
- Payment information

### Managing Google OAuth Access

#### Google Account Settings
You can manage Cutty's access through your Google account:

1. **Google Account Settings**: Go to myaccount.google.com
2. **Security Section**: Navigate to "Security" settings
3. **Third-party Apps**: Find "Third-party apps with account access"
4. **Cutty Access**: Locate Cutty in the list of connected apps
5. **Manage Access**: View or revoke access as needed

#### Revoking Access
If you need to revoke Cutty's access:
- **From Google**: Remove Cutty from your Google account's connected apps
- **Effect**: You'll need to use email/password method or re-authorize Google access
- **Data Retention**: Your Cutty account remains active with existing data

## Choosing the Right Method

### Email/Password Is Best For:

#### Maximum Control Users
- **Security Professionals**: Those who prefer complete control over authentication
- **Enterprise Users**: Organizations with specific security requirements
- **Privacy-Focused Users**: Those minimizing third-party data sharing
- **Independent Access**: Users who want service-independent authentication

#### Specific Scenarios
- **Multiple Google Accounts**: Users with multiple Google accounts who want clarity
- **Corporate Restrictions**: Organizations that limit OAuth usage
- **Backup Access**: Users who want backup authentication method
- **Audit Requirements**: Environments requiring direct authentication logs

### Google OAuth Is Best For:

#### Convenience-Focused Users
- **Google Ecosystem Users**: Those already using Gmail, Google Drive, etc.
- **Security-Conscious Users**: Those who trust Google's security infrastructure
- **Busy Professionals**: Users who want minimal password management
- **Quick Access Users**: Those prioritizing fast, easy login

#### Specific Scenarios
- **Single Google Account**: Users with one primary Google account
- **Mobile Access**: Frequent mobile users benefit from OAuth convenience
- **Team Environments**: Teams already using Google Workspace
- **Security-First Organizations**: Those requiring enterprise-grade authentication

## Switching Between Methods

### Adding Authentication Methods

#### From Email/Password to Google OAuth
1. **Login with Email**: Use your current email/password credentials
2. **Account Settings**: Navigate to account settings or profile section
3. **Link Google Account**: Look for option to "Connect Google Account"
4. **Google Authorization**: Complete Google OAuth authorization process
5. **Dual Access**: You can now use either method to log in

#### Account Conversion Considerations
- **Data Preservation**: All your data, files, and settings remain unchanged
- **Access History**: Previous login history is maintained
- **Session Management**: Existing sessions continue normally
- **Backup Method**: Keep email/password as backup authentication

### Migration Best Practices

#### Planning Your Switch
1. **Test New Method**: Ensure new authentication method works before removing old one
2. **Update Bookmarks**: Update any saved login bookmarks or shortcuts
3. **Inform Team Members**: If sharing account access, coordinate the change
4. **Security Review**: Review security settings after switching methods

#### Maintaining Security
- **Regular Reviews**: Periodically review connected accounts and permissions
- **Access Monitoring**: Monitor account activity regardless of authentication method
- **Backup Plans**: Maintain alternative access methods for emergencies
- **Documentation**: Keep secure records of authentication method choices

## Troubleshooting Login Issues

### Email/Password Problems

#### Forgot Password
1. **Password Reset**: Use "Forgot Password" link on login page
2. **Check Email**: Look for password reset email (check spam folders)
3. **Reset Link**: Click the reset link in the email
4. **New Password**: Create a new strong password
5. **Login**: Use new password to access your account

#### Account Locked
- **Wait Period**: Account lockouts typically resolve after 15-30 minutes
- **Contact Support**: Reach out if lockout persists
- **Security Review**: Consider if account compromise is possible

### Google OAuth Problems

#### OAuth Authorization Errors
1. **Browser Issues**: Clear cookies and cache, try different browser
2. **Google Account**: Ensure you're logged into correct Google account
3. **Permissions**: Review and re-grant permissions if requested
4. **Account Status**: Verify Google account is in good standing

#### Connection Problems
- **Network Issues**: Check internet connection stability
- **Firewall Settings**: Ensure OAuth redirects aren't blocked
- **Browser Settings**: Enable JavaScript and allow third-party cookies
- **Try Alternative**: Use email/password method if OAuth fails

## Security Considerations

### Session Security
- **Secure Connections**: Always use HTTPS connections
- **Public Computers**: Log out completely when using shared devices
- **Session Timeouts**: Understand that sessions expire after 10 minutes
- **Multiple Sessions**: Be aware of active sessions across devices

### Account Monitoring
- **Regular Review**: Check account activity and login history
- **Suspicious Activity**: Report unusual login patterns immediately
- **Access Logs**: Review successful and failed login attempts
- **Device Management**: Monitor which devices have accessed your account

### Emergency Access
- **Backup Methods**: Maintain alternative authentication methods
- **Recovery Planning**: Know how to recover access if primary method fails
- **Contact Information**: Keep recovery email and contact info current
- **Support Channels**: Know how to reach Cutty support for authentication issues

Both authentication methods provide secure access to your Cutty account. Choose the method that best fits your security requirements, convenience preferences, and organizational policies.