---
title: Frequently Asked Questions
category: FAQ
keywords: faq, questions, help, support, common questions
difficulty: all
---

# Frequently Asked Questions

## Quick answers to common questions about Cutty

Find immediate answers to the most frequently asked questions about using Cutty for CSV processing and data analysis.

## Getting Started

### What is Cutty?
Cutty is a web-based CSV processing tool that helps you upload, filter, analyze, and transform CSV files without needing technical expertise. Think of it as smart scissors for your spreadsheet data.

### Do I need to create an account?
No, you can use basic features without an account. However, creating a free account lets you save files, access history, and use advanced features like Cuttytabs and Query Builder.

### Is Cutty free to use?
Yes, Cutty offers free access to core features. There are no hidden fees or premium tiers currently.

### What browsers work with Cutty?
Cutty works best with modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (limited features)

## File Upload & Management

### What file types can I upload?
Cutty accepts:
- CSV files (.csv)
- Tab-separated files (.tsv)
- Text files with delimited data (.txt)

### What's the maximum file size?
Files can be up to 50MB. For larger files, you'll need to split them into smaller chunks before uploading.

### Can I upload multiple files at once?
Yes, you can select multiple files during upload. Each file will be processed separately and appear in your file list.

### How long are my files stored?
- With account: Files are stored until you delete them
- Without account: Files are available during your session only
- Anonymous uploads: Cleared after 24 hours

### Can I rename files after uploading?
Yes, go to Manage Files, click on the file name, and enter a new name.

### How do I delete files?
Navigate to Manage Files, select the files you want to remove, and click Delete. This action cannot be undone.

## Data Processing

### What is CSV cutting?
CSV cutting means selecting specific columns and rows from your data - like cutting out only the parts you need from a larger dataset.

### How do I filter my data?
Three ways to filter:
1. **CSV Cutter**: Basic text filtering
2. **CSV Cutter Plus**: Advanced filters with AND/OR logic
3. **Query Builder**: Visual SQL-like filtering

### Can I combine multiple filters?
Yes, use Query Builder to combine filters with AND/OR logic. You can create complex filter combinations and save them for reuse.

### What's the difference between AND and OR filters?
- **AND**: All conditions must be true (more restrictive)
- **OR**: Any condition can be true (less restrictive)

### Can I save my filter configurations?
Yes, when logged in, you can save filter configurations in Query Builder and reapply them to new files.

### How do I undo changes?
Cutty doesn't modify your original files. Each operation creates a new result, so you can always go back to your original upload.

## Cuttytabs (Crosstabs)

### What is a Cuttytab?
A Cuttytab is Cutty's version of a crosstab or pivot table - it summarizes data by showing relationships between two variables in a table format.

### When should I use Cuttytabs?
Use Cuttytabs when you want to:
- See counts or sums by category
- Understand relationships between variables
- Create summary statistics
- Generate frequency tables

### Why does Cuttytabs say "too many unique values"?
Cuttytabs works best with categorical data. If a field has too many unique values (like individual dates or IDs), try grouping them into categories first.

### Can I export Cuttytab results?
Yes, click the Export button to download your crosstab as a CSV file that you can open in Excel.

## Query Builder

### What is Query Builder?
Query Builder is a visual tool for creating complex data queries without writing SQL code. It generates SQL for you based on your visual selections.

### Do I need to know SQL?
No, Query Builder creates SQL automatically. However, you can view and learn from the generated SQL if interested.

### Can I save queries?
Yes, when logged in, you can save queries and reuse them on different files with similar structure.

### Can I edit the generated SQL?
Currently, SQL is read-only. Use the visual interface to modify your query.

### How do I export SQL?
Click the "Copy SQL" button to copy the generated SQL to your clipboard for use in other applications.

## Synthetic Data Generator

### What is synthetic data?
Synthetic data is fake but realistic data generated for testing, demos, or learning purposes.

### What types of data can I generate?
- Names and addresses
- Email addresses
- Phone numbers
- Dates
- Numbers (integers and decimals)
- Categories
- Boolean values

### How many rows can I generate?
You can generate up to 10,000 rows of synthetic data at once.

### Can I customize the generated data?
Yes, you can specify:
- Column names
- Data types
- Value ranges
- Number of rows

### Is synthetic data random?
Yes, each generation creates unique random data following the patterns you specify.

## Authentication & Security

### Is my data secure?
Yes, Cutty uses:
- HTTPS encryption for all transfers
- Secure cloud storage
- JWT authentication
- No data sharing with third parties

### Can others see my files?
No, files are private to your account. Even support cannot access your files without permission.

### What happens if I forget my password?
Click "Forgot Password" on the login page. You'll receive an email with reset instructions.

### Can I use Google to sign in?
Yes, click "Sign in with Google" for quick authentication using your Google account.

### How do I change my password?
Currently, use the "Forgot Password" flow to set a new password.

### Why was I logged out?
Sessions expire after 24 hours of inactivity for security. Simply log in again to continue.

## Export & Download

### What export formats are available?
- **CSV**: Universal spreadsheet format
- **JSON**: For developers and applications
- **SQL**: Query code for databases

### Can I exclude headers when exporting?
Yes, there's a checkbox option to exclude headers when exporting CSV files.

### Why is my download blocked?
Check:
- Browser popup blocker settings
- Antivirus software
- Ad blocker extensions
Allow downloads from cutty.emilycogsdill.com

### Can I schedule exports?
Not currently, but you can save queries and run them manually when needed.

## Performance & Limits

### Why is processing slow?
Possible causes:
- Large file size
- Complex filters
- Many unique values
- Browser memory limits
- Internet connection speed

### What are the system limits?
- Max file size: 50MB
- Max rows: ~1 million (depends on columns)
- Max columns: 1000
- Session timeout: 24 hours
- Synthetic data: 10,000 rows

### Which browser is fastest?
Chrome typically offers the best performance for Cutty, especially with large files.

### Can I process files offline?
No, Cutty requires an internet connection as it's a cloud-based application.

## Troubleshooting

### Why can't I see my uploaded file?
- Check you're logged into the correct account
- Refresh the page
- Clear browser cache
- Try re-uploading

### Why did my session expire?
Sessions expire after 24 hours for security. Log in again to continue.

### The page is frozen/unresponsive
- Refresh the page
- Clear browser cache
- Try a different browser
- Process smaller data chunks

### I'm getting an error message
- Take a screenshot of the error
- Note what you were doing
- Try the operation again
- Check the Troubleshooting guide

## API & Integration

### Does Cutty have an API?
Yes, Cutty offers API access for programmatic file processing. API documentation is available for registered users.

### Can I automate file processing?
With API access, you can automate uploads, processing, and downloads programmatically.

### Does Cutty integrate with other tools?
Currently, integration is through file import/export. Direct integrations are planned for future releases.

### Can I embed Cutty in my application?
Not currently, but API access allows you to use Cutty's processing capabilities in your applications.

## Getting Help

### How do I contact support?
- Use the chat assistant for immediate help
- Check documentation for detailed guides
- Email support for complex issues

### Is there a user guide?
Yes, comprehensive documentation is available covering all features with examples.

### Can I request new features?
Yes, we welcome feature requests. Contact support with your suggestions.

### How do I report bugs?
Report bugs through:
- The chat assistant
- Email to support
- Include steps to reproduce and screenshots

### Are there video tutorials?
Text documentation is currently available. Video tutorials are planned for future release.

## Advanced Features

### Can I use regular expressions?
Basic pattern matching is available in filters. Full regex support is on the roadmap.

### Can I create calculated columns?
Not directly, but you can export data and add calculations in Excel, then re-upload.

### Can I merge multiple files?
Currently, process files individually. File merging is a planned feature.

### Can I schedule recurring tasks?
Not yet, but you can save configurations for manual re-runs.

### Is there a command-line interface?
No CLI currently, but the API allows programmatic access from command-line tools.

## Billing & Account

### How do I upgrade my account?
All features are currently free. Premium features may be added in the future.

### Can I transfer files between accounts?
Not directly. Download from one account and upload to another.

### How do I delete my account?
Contact support to request account deletion. This will permanently remove all your data.

### Can I have multiple accounts?
Yes, but each requires a unique email address.

### Is there a team/organization plan?
Not currently, but team features are under consideration for future development.