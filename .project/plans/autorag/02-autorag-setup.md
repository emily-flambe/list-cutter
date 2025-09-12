# Phase 2: AutoRAG Setup

## Objective
Configure Cloudflare AutoRAG instance with R2 storage, optimize settings for product chatbot use case, and establish the RAG pipeline for documentation retrieval.

## Prerequisites

- [ ] Cloudflare account with Workers enabled
- [ ] Documentation created in Phase 1
- [ ] R2 storage access
- [ ] Workers AI access
- [ ] AI Gateway configured (optional but recommended)

## Setup Tasks

### 1. R2 Bucket Configuration

#### Create R2 Bucket
```bash
# Create dedicated bucket for documentation
wrangler r2 bucket create cutty-docs

# Verify bucket creation
wrangler r2 bucket list
```

#### Bucket Structure
```
cutty-docs/
├── docs/                    # Main documentation
│   ├── getting-started/
│   ├── features/
│   ├── tutorials/
│   ├── ui-guide/
│   ├── api-reference/
│   ├── troubleshooting/
│   └── faq/
├── metadata/               # Document metadata
│   └── index.json         # Master index file
└── config/                # Configuration files
    └── autorag.json      # AutoRAG configuration
```

### 2. Documentation Upload

#### Upload Script Configuration
Create `.env.r2` file:
```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_BUCKET_NAME=cutty-docs
```

#### Upload Script (`scripts/upload-docs-to-r2.js`)
```javascript
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const matter = require('gray-matter');
const crypto = require('crypto');

// Load environment variables
require('dotenv').config({ path: '.env.r2' });

// Configure R2 client
const r2Client = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Document metadata index
const documentIndex = [];

async function uploadDocument(filePath, basePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = matter(content);
  const relativePath = path.relative(basePath, filePath);
  
  // Generate document ID
  const docId = crypto.createHash('md5').update(relativePath).digest('hex');
  
  // Prepare metadata
  const metadata = {
    id: docId,
    path: relativePath,
    title: parsed.data.title || path.basename(filePath, '.md'),
    category: parsed.data.category || 'general',
    keywords: parsed.data.keywords || [],
    lastModified: new Date().toISOString(),
    contentHash: crypto.createHash('md5').update(content).digest('hex')
  };
  
  // Upload document
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: `docs/${relativePath}`,
    Body: content,
    ContentType: 'text/markdown',
    Metadata: metadata
  }));
  
  // Add to index
  documentIndex.push(metadata);
  
  console.log(`✓ Uploaded: ${relativePath}`);
}

async function uploadAllDocuments() {
  const docsDir = './docs';
  const files = await getAllMarkdownFiles(docsDir);
  
  for (const file of files) {
    await uploadDocument(file, docsDir);
  }
  
  // Upload index
  await r2Client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: 'metadata/index.json',
    Body: JSON.stringify(documentIndex, null, 2),
    ContentType: 'application/json'
  }));
  
  console.log(`\n✅ Uploaded ${files.length} documents`);
  console.log('📄 Index created at metadata/index.json');
}

async function getAllMarkdownFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...await getAllMarkdownFiles(fullPath));
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Run upload
uploadAllDocuments().catch(console.error);
```

### 3. AutoRAG Instance Creation

#### Via Cloudflare Dashboard

1. Navigate to **AI > AutoRAG**
2. Click **Create AutoRAG**
3. Configure settings:

```javascript
{
  "name": "cutty-assistant",
  "description": "Product documentation assistant for Cutty app",
  
  // Data Source Configuration
  "dataSource": {
    "type": "r2",
    "bucket": "cutty-docs",
    "path": "/docs",
    "refreshInterval": "daily"  // Auto-reindex daily
  },
  
  // Chunking Configuration
  "chunking": {
    "strategy": "recursive",
    "chunkSize": 512,
    "chunkOverlap": 128,
    "separators": ["\n\n", "\n", ". ", " "]
  },
  
  // Embedding Configuration
  "embedding": {
    "model": "@cf/baai/bge-m3",  // Multilingual support
    "pooling": "cls",            // Better accuracy
    "batchSize": 100             // Process 100 chunks at a time
  },
  
  // Query Rewriting Configuration
  "queryRewrite": {
    "enabled": true,
    "model": "@cf/meta/llama-3.1-8b-instruct",
    "systemPrompt": "Rewrite the user's question to be more specific and search-friendly for finding relevant documentation about the Cutty app. Focus on technical terms and feature names.",
    "maxTokens": 100
  },
  
  // Retrieval Configuration
  "retrieval": {
    "maxResults": 5,
    "minScore": 0.7,
    "diversityBias": 0.3,  // Balance relevance with diversity
    "reranking": {
      "enabled": true,
      "model": "@cf/baai/bge-reranker-base"
    }
  },
  
  // Generation Configuration
  "generation": {
    "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "systemPrompt": "You are Cutty, a helpful cuttlefish assistant for the Cutty list management application. Answer questions based ONLY on the provided documentation. Be friendly, concise, and accurate. If you don't find the answer in the documentation, say so and suggest where the user might look.",
    "temperature": 0.3,      // Lower for more consistent answers
    "maxTokens": 500,
    "fallbackModel": "@cf/meta/llama-3.1-8b-instruct"
  },
  
  // Caching Configuration
  "caching": {
    "similarityThreshold": 0.95,  // Cache very similar queries
    "ttl": 3600                   // Cache for 1 hour
  },
  
  // AI Gateway Integration
  "aiGateway": {
    "enabled": true,
    "endpoint": "https://gateway.ai.cloudflare.com/v1/{account_id}/cutty-autorag"
  }
}
```

### 4. Wrangler Configuration

Update `wrangler.toml`:
```toml
name = "cutty-worker"
main = "src/index.ts"
compatibility_date = "2025-01-01"
node_compat = true

# AutoRAG Workers AI Binding
[[ai]]
binding = "AI"

# R2 Bucket for documentation
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "cutty-docs"

# AI Gateway (optional)
[ai_gateway]
binding = "AI_GATEWAY"
endpoint = "https://gateway.ai.cloudflare.com/v1/{account_id}/cutty-autorag"

# Environment variables
[vars]
AUTORAG_INSTANCE_NAME = "cutty-assistant"

# Development environment
[env.development]
vars = { ENVIRONMENT = "development" }

# Production environment
[env.production]
vars = { ENVIRONMENT = "production" }
```

### 5. Monitoring Setup

#### AI Gateway Configuration

1. Navigate to **AI > AI Gateway**
2. Create new gateway: `cutty-autorag`
3. Configure monitoring:
   - Enable request logging
   - Set up caching rules
   - Configure rate limiting
   - Set up alerts for errors

#### Metrics to Track

```javascript
const metrics = {
  // Response Quality
  responseRelevance: {
    description: 'Relevance score from AutoRAG',
    threshold: 0.7,
    alert: 'below'
  },
  
  // Performance
  responseTime: {
    description: 'Time to generate response',
    threshold: 2000,  // 2 seconds
    alert: 'above'
  },
  
  // Usage
  queriesPerHour: {
    description: 'Number of queries processed',
    threshold: 1000,
    alert: 'above'
  },
  
  // Costs
  tokensPerQuery: {
    description: 'Average tokens per query',
    threshold: 1000,
    alert: 'above'
  },
  
  // Cache Performance
  cacheHitRate: {
    description: 'Percentage of cached responses',
    target: 0.3,  // 30% cache hit rate
    alert: 'below'
  }
};
```

### 6. Testing AutoRAG Instance

#### Test Script (`scripts/test-autorag.js`)
```javascript
export default {
  async fetch(request, env) {
    const testQueries = [
      "How do I upload a CSV file?",
      "What are the file size limits?",
      "How do I create a cross-tab analysis?",
      "Can I export to Excel?",
      "How do I generate synthetic data?"
    ];
    
    const results = [];
    
    for (const query of testQueries) {
      const response = await env.AI
        .autorag('cutty-assistant')
        .aiSearch({
          query,
          rewriteQuery: true,
          maxResults: 3
        });
      
      results.push({
        query,
        answer: response.answer,
        sources: response.sources.length,
        confidence: response.confidence
      });
    }
    
    return Response.json({
      timestamp: new Date().toISOString(),
      results
    });
  }
};
```

### 7. Indexing Verification

#### Check Indexing Status
```bash
# Via Cloudflare Dashboard
# Navigate to AI > AutoRAG > cutty-assistant > Indexing Status

# Check for:
# - Total documents indexed
# - Last indexing time
# - Any indexing errors
# - Vector count
```

#### Verify Search Quality
Test various query types:
1. **Direct questions**: "How do I upload a file?"
2. **Feature questions**: "What is Cuttytabs?"
3. **Troubleshooting**: "Why is my upload failing?"
4. **Capability questions**: "Can I export to Excel?"
5. **Limit questions**: "What is the maximum file size?"

## Configuration Optimization

### Model Selection Strategy

| Use Case | Model Choice | Rationale |
|----------|-------------|-----------|
| Embedding | `@cf/baai/bge-m3` | Multilingual, high quality |
| Query Rewrite | `@cf/meta/llama-3.1-8b-instruct` | Fast, good understanding |
| Generation (Primary) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Best quality, 2-4x faster |
| Generation (Fallback) | `@cf/meta/llama-3.1-8b-instruct` | Budget option for high load |
| Reranking | `@cf/baai/bge-reranker-base` | Improved relevance |

### Chunking Strategy

```javascript
// Optimal chunking for documentation
{
  "chunkSize": 512,      // Balance between context and precision
  "chunkOverlap": 128,   // 25% overlap for context continuity
  "strategy": "recursive" // Respect document structure
}
```

### Retrieval Tuning

```javascript
// Balanced retrieval settings
{
  "maxResults": 5,        // Enough context without overwhelming
  "minScore": 0.7,        // High relevance threshold
  "diversityBias": 0.3    // Some variety in sources
}
```

## Troubleshooting

### Common Issues

1. **Indexing Not Starting**
   - Check R2 bucket permissions
   - Verify file format (must be markdown)
   - Check AutoRAG instance status

2. **Poor Response Quality**
   - Increase `minScore` threshold
   - Enable reranking
   - Improve documentation quality
   - Add more examples to docs

3. **Slow Responses**
   - Enable caching
   - Use faster generation model
   - Reduce `maxResults`
   - Check AI Gateway metrics

4. **High Costs**
   - Use smaller generation model
   - Implement aggressive caching
   - Batch similar queries
   - Monitor token usage

## Success Checklist

- [ ] R2 bucket created and configured
- [ ] Documentation uploaded successfully
- [ ] AutoRAG instance created
- [ ] Indexing completed
- [ ] Test queries returning relevant results
- [ ] Monitoring configured
- [ ] Performance metrics acceptable
- [ ] Costs within budget

## Next Phase
Once AutoRAG is configured and tested, proceed to Phase 3: Integration Development

---

*Phase Status: Ready to Implement*
*Estimated Setup Time: 2-4 hours*
*Dependencies: Documentation from Phase 1*