# Cloudflare AutoRAG Implementation Guide

## Key Lessons Learned

### 1. Response Structure
AutoRAG returns a different structure than expected:
- The answer is in `response` field (not `answer`)
- Sources are in `data` field (not `sources`)
- Always check the actual API response structure

### 2. System Prompt Configuration
**CRITICAL**: The system prompt should be configured in the Cloudflare Dashboard, NOT in the query itself.
- Navigate to Cloudflare Dashboard → AutoRAG instance → Settings → System Prompt
- Configure both Generation and Query Rewrite prompts
- This is where personality and response formatting should be defined

### 3. Authentication & Public Access
- AutoRAG can be accessed publicly without authentication
- Use IP-based rate limiting for anonymous users
- Set generic user IDs like 'anonymous' for public queries

### 4. Workers AI Binding
Correct usage pattern:
```javascript
// CORRECT - Simple and clean
const response = await env.AI.autorag("instance-name").aiSearch({
  query: userQuestion,
  max_num_results: 5,
  rewrite_query: true
});

// WRONG - Don't try to inject prompts in the query
const response = await env.AI.autorag("instance-name").aiSearch({
  query: `You are an assistant. ${userQuestion}. Be concise.`
});
```

### 5. Document Reference Removal
AutoRAG tends to include file references in responses. These must be removed:
- Use aggressive regex patterns to strip all file paths
- Remove markdown links `[text](url)`
- Remove phrases like "as described in..."
- Clean up in post-processing, not in the query

### 6. Response Length Control
- Control length primarily through the system prompt
- Use `max_num_results` to limit context (affects response quality)
- Post-process to truncate at sentence boundaries if needed
- Balance between conciseness and helpfulness

### 7. Query Optimization
- Enable `rewrite_query: true` for better retrieval
- Keep queries simple - let AutoRAG handle optimization
- Don't add context or instructions to the query itself

### 8. Testing Approach
Test with simple curls first:
```bash
curl -X POST https://your-worker.com/api/v1/assistant/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Cutty?"}'
```

### 9. R2 Integration
- Documents are stored in R2 bucket (e.g., cutty-docs)
- AutoRAG automatically indexes documents from R2
- Check indexing status in Cloudflare Dashboard
- Verify document count matches expected files

### 10. Error Handling
Common issues and solutions:
- **Blank responses**: Check response field mapping
- **Wrong endpoint**: Verify frontend calls correct API path
- **No documentation found**: Check R2 bucket and indexing status
- **Authentication errors**: Make endpoint public if needed

## Configuration Checklist

### Cloudflare Dashboard
- [ ] AutoRAG instance created
- [ ] R2 bucket connected as data source
- [ ] Documents successfully indexed
- [ ] System prompt configured
- [ ] Query rewrite prompt configured (optional)

### Worker Configuration
- [ ] AI binding in wrangler.toml: `[ai] binding = "AI"`
- [ ] Environment variable for instance name
- [ ] Proper error handling for AI binding

### Frontend Integration
- [ ] Correct API endpoint (/api/v1/assistant/query)
- [ ] Handle both 'answer' and 'response' fields
- [ ] Display sources appropriately
- [ ] Show loading states during queries

## Best Practices

1. **Keep It Simple**: Let AutoRAG do the heavy lifting with its built-in capabilities
2. **Configure in Dashboard**: Use the Cloudflare Dashboard for all AutoRAG configuration
3. **Test Incrementally**: Start with basic queries, then add complexity
4. **Monitor Performance**: Track response times and adjust max_num_results
5. **Clean Responses**: Always post-process to remove unwanted references
6. **Version Control**: Document your system prompts in the repository
7. **Rate Limiting**: Implement appropriate rate limits for public access
8. **Cache Wisely**: AutoRAG has built-in similarity caching - use it
9. **Error Messages**: Provide helpful fallback messages when AutoRAG fails
10. **Iterate on Prompts**: Test and refine system prompts based on actual usage

## Example System Prompt Structure

```
PERSONALITY:
- Define the assistant's character and tone
- Keep it consistent with your brand

CORE KNOWLEDGE:
- List key features and capabilities
- Focus on what users need to know

RESPONSE GUIDELINES:
1. Be concise (specify length)
2. Never reference files or documentation
3. Focus on actionable information
4. Handle unknown queries gracefully

EXAMPLES:
- Provide 3-5 example Q&A pairs
- Show the desired response format
```

## Debugging Tips

1. Check the Cloudflare Dashboard for:
   - Indexing status and document count
   - Query logs and response times
   - System prompt configuration

2. Test with minimal code:
   ```javascript
   const response = await env.AI.autorag("instance").aiSearch({
     query: "test"
   });
   console.log(JSON.stringify(response, null, 2));
   ```

3. Verify R2 bucket contents:
   - Use wrangler or Cloudflare Dashboard
   - Check file formats and structure
   - Ensure documents are properly formatted

4. Monitor rate limits:
   - Track IP-based limits for anonymous users
   - Implement exponential backoff for retries

## Common Pitfalls to Avoid

1. **Don't** try to control AutoRAG through query manipulation
2. **Don't** forget to configure the system prompt in the dashboard
3. **Don't** assume response structure - always verify
4. **Don't** skip post-processing for file reference removal
5. **Don't** set max_num_results too low (affects quality)
6. **Don't** ignore the Query Rewrite feature
7. **Don't** hardcode instance names - use environment variables
8. **Don't** forget to handle errors gracefully
9. **Don't** expose internal file structures in responses
10. **Don't** make the assistant overly verbose

## Resources

- [AutoRAG Documentation](https://developers.cloudflare.com/autorag/)
- [Workers AI Binding](https://developers.cloudflare.com/autorag/usage/workers-binding/)
- [System Prompt Configuration](https://developers.cloudflare.com/autorag/configuration/system-prompt/)
- [R2 Data Source](https://developers.cloudflare.com/autorag/configuration/data-source/r2/)