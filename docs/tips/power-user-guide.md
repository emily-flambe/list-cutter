---
title: Power User Tips and Shortcuts
category: Tips
keywords: tips, shortcuts, power user, productivity, advanced
difficulty: advanced
---

# Power User Tips and Shortcuts

## Master Cutty Like a Pro

Learn advanced techniques and hidden features to maximize your productivity with Cutty.

## Keyboard Shortcuts

### Navigation
- **Tab**: Move between form fields
- **Shift+Tab**: Move backwards through fields
- **Enter**: Submit forms or confirm actions
- **Escape**: Close dialogs and popups

### File Operations
- **Ctrl/Cmd+O**: Open file upload dialog
- **Ctrl/Cmd+S**: Save current work (when available)
- **Ctrl/Cmd+Z**: Undo last action (in text fields)
- **Ctrl/Cmd+Y**: Redo action (in text fields)

### Data Selection
- **Ctrl/Cmd+A**: Select all (in text fields)
- **Ctrl/Cmd+Click**: Multi-select items
- **Shift+Click**: Select range of items
- **Space**: Toggle checkbox selection

### Browser Shortcuts (Work in Cutty)
- **Ctrl/Cmd+R**: Refresh page
- **Ctrl/Cmd+Shift+R**: Hard refresh (clear cache)
- **F12**: Open developer tools
- **Ctrl/Cmd+Plus**: Zoom in
- **Ctrl/Cmd+Minus**: Zoom out
- **Ctrl/Cmd+0**: Reset zoom

## Hidden Features

### URL Parameters
Access specific features directly:
- `/cut?file=ID` - Open Query Builder with specific file
- `/synthetic-data?rows=1000` - Pre-fill row count
- `/cuttytabs?demo=true` - Load with demo data

### Drag and Drop
- **Multiple files**: Drag multiple CSVs at once
- **From email**: Drag attachments directly from email
- **Between tabs**: Drag files between browser tabs

### Right-Click Context Menus
- **On data cells**: Copy cell value
- **On column headers**: Copy column name
- **On download links**: Save with custom name

## Performance Optimization Tips

### Browser Configuration
1. **Increase memory allocation**:
   - Chrome: `--max-old-space-size=4096`
   - Firefox: Increase `dom.max_script_runtime`

2. **Disable unnecessary extensions**:
   - Ad blockers can slow processing
   - Disable during large operations

3. **Use incognito/private mode**:
   - Cleaner memory footprint
   - No extension interference

### File Preparation
1. **Pre-sort data**: Sorted data processes faster
2. **Remove formatting**: Plain CSV is fastest
3. **Consistent encoding**: UTF-8 prevents issues
4. **Optimal chunking**: 10MB chunks for large files

## Advanced Filtering Techniques

### Query Builder Pro Tips
1. **Parentheses for complex logic**:
   ```
   (status = 'active' AND region = 'North') OR (priority = 'high')
   ```

2. **Null handling**:
   - Use `IS NULL` not `= ''`
   - Use `IS NOT NULL` for non-empty

3. **Pattern matching**:
   - `LIKE '%pattern%'` for contains
   - `LIKE 'pattern%'` for starts with
   - `LIKE '%pattern'` for ends with

4. **Case-insensitive search**:
   - Most text comparisons ignore case
   - Use UPPER() for explicit control

### Filter Combinations
1. **Date ranges**:
   ```
   date >= '2024-01-01' AND date <= '2024-12-31'
   ```

2. **Multiple values**:
   ```
   status IN ('active', 'pending', 'review')
   ```

3. **Exclusion patterns**:
   ```
   NOT (category = 'test' OR email LIKE '%spam%')
   ```

## Data Processing Strategies

### Batch Processing
1. **Process by date**: Monthly/weekly batches
2. **Process by category**: Segment large datasets
3. **Incremental processing**: Add new data only
4. **Parallel processing**: Multiple browser tabs

### Memory Management
1. **Clear between operations**: Refresh page
2. **Process in stages**: Don't chain operations
3. **Export frequently**: Free up browser memory
4. **Use sampling**: Test on 1000 rows first

## Workflow Automation

### Browser Automation
Use browser automation tools:
1. **Bookmarklets**: Save common operations
2. **Browser macros**: Automate repetitive tasks
3. **Selenium scripts**: Full automation
4. **API integration**: Programmatic access

### Template Creation
1. **Save filter sets**: Reuse complex filters
2. **Export configurations**: Share with team
3. **Document workflows**: Create SOPs
4. **Version control**: Track changes

## Advanced Cuttytabs Usage

### Multi-Dimensional Analysis
1. **Layer variables**: Add third dimension manually
2. **Sequential crosstabs**: Build insight progressively
3. **Comparative analysis**: Run multiple crosstabs
4. **Export and combine**: Merge in Excel

### Statistical Insights
1. **Chi-square interpretation**: Relationship significance
2. **Percentage analysis**: Row vs column percentages
3. **Marginal totals**: Overall distributions
4. **Cell highlighting**: Identify patterns

## SQL Generation Mastery

### Understanding Generated SQL
1. **SELECT clause**: Columns being retrieved
2. **FROM clause**: Source table/file
3. **WHERE clause**: Filter conditions
4. **ORDER BY**: Sort order
5. **LIMIT**: Row restrictions

### Modifying SQL
1. **Copy to database tool**: Use in actual database
2. **Add aggregations**: SUM, COUNT, AVG
3. **Create views**: Save complex queries
4. **Build reports**: Use as report base

## File Management Pro Tips

### Organization Strategies
1. **Naming conventions**: `YYYY-MM-DD_category_description`
2. **Folder structure**: Organize by project/date
3. **Version tracking**: Append v1, v2, etc.
4. **Archive old files**: Download and delete

### Backup Best Practices
1. **Regular exports**: Weekly backups
2. **Multiple formats**: CSV and JSON
3. **Cloud storage**: Secondary backup
4. **Documentation**: Track transformations

## Troubleshooting Like a Pro

### Debug Mode
1. **Browser console**: F12 for error details
2. **Network tab**: Monitor API calls
3. **Performance tab**: Identify bottlenecks
4. **Memory profiler**: Find memory leaks

### Common Fixes
1. **Clear everything**: Cache, cookies, storage
2. **Try different browser**: Isolate browser issues
3. **Check file locally**: Validate before upload
4. **Simplify operation**: Break complex tasks

## Integration Tips

### Excel Integration
1. **Power Query**: Import Cutty exports
2. **VBA macros**: Automate import/export
3. **Pivot tables**: Further analysis
4. **Charts**: Visualization

### Database Integration
1. **Import scripts**: Load CSV to database
2. **Scheduled jobs**: Regular processing
3. **ETL pipelines**: Include Cutty step
4. **API webhooks**: Trigger on completion

## Time-Saving Tricks

### Quick Actions
1. **Double-click**: Quick edit/open
2. **Hover previews**: See details without clicking
3. **Bulk selection**: Shift+click for range
4. **Quick filters**: Type to filter lists

### Reusable Components
1. **Browser bookmarks**: Save frequent pages
2. **Password manager**: Quick login
3. **Clipboard manager**: Reuse values
4. **Text expander**: Common patterns

## Advanced Security

### Data Protection
1. **Sensitive data**: Process locally first
2. **Encryption**: Use HTTPS always
3. **Access control**: Strong passwords
4. **Session management**: Logout when done

### Privacy Tips
1. **Anonymous mode**: Use without account
2. **Temporary email**: For testing
3. **VPN usage**: Additional privacy
4. **Clear traces**: Delete after use

## Power User Workflows

### Daily Reporting
1. Upload morning data
2. Apply standard filters
3. Generate crosstab
4. Export results
5. Clear for next day

### Data Validation
1. Upload new data
2. Run quality checks
3. Compare with previous
4. Flag anomalies
5. Export clean data

### Multi-Source Analysis
1. Upload multiple files
2. Process separately
3. Apply same filters
4. Compare results
5. Combine insights

## Community Tips

### From Power Users
- "Always test with 100 rows first"
- "Save queries, not files"
- "Use Chrome for best performance"
- "Name files with dates"
- "Export before logging out"

### Common Patterns
- Morning uploads, evening exports
- Weekly batch processing
- Monthly summary generation
- Quarterly deep analysis

## Experimental Features

### Beta Access
Some features in testing:
- WebSocket connections
- Real-time collaboration
- Advanced visualizations
- Machine learning integration

### Feature Requests
Popular requests:
- Scheduled processing
- Email notifications
- Team workspaces
- API webhooks

## Learning Resources

### Master Cutty
1. **Practice datasets**: Use synthetic data
2. **Experiment freely**: Can't break anything
3. **Try all features**: Explore everything
4. **Read the docs**: Comprehensive guides
5. **Ask the assistant**: Built-in help

### Stay Updated
- Check for new features
- Read release notes
- Follow best practices
- Share tips with others

## Pro Tips Summary

### Essential Habits
1. Test before processing
2. Save work frequently
3. Document workflows
4. Use keyboard shortcuts
5. Keep files organized

### Efficiency Maximizers
1. Batch similar tasks
2. Reuse configurations
3. Automate repetitive work
4. Process during off-peak
5. Learn SQL basics

### Remember
- Cutty is stateless - save important work
- Browser limits apply - respect them
- Features evolve - stay informed
- Community helps - share knowledge
- Practice makes perfect - keep learning