# Cloudflare R2 Reference

## Overview
R2 is Cloudflare's S3-compatible object storage service with zero egress fees. We use it to store user files and documentation for AutoRAG.

## Our R2 Setup

### Buckets
- **cutty-files-dev**: User uploaded CSV files (development)
- **cutty-files**: User uploaded CSV files (production)  
- **cutty-docs**: Shared documentation bucket for AutoRAG (both dev & prod)

### Authentication Methods

#### 1. Workers Bindings (Preferred for Runtime)
```toml
# In wrangler.toml
[[r2_buckets]]
binding = "FILE_STORAGE"
bucket_name = "cutty-files-dev"

[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "cutty-docs"
```

#### 2. S3-Compatible API Tokens (For Upload Scripts)
Create tokens in Cloudflare Dashboard ’ R2 ’ Manage R2 API Tokens

```env
# .env.r2 (gitignored)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key-id-from-s3-clients>
R2_SECRET_ACCESS_KEY=<secret-from-s3-clients>
R2_BUCKET_NAME=cutty-docs
```

**Important**: Use the "S3 client" credentials, NOT the "Token value"

#### 3. Wrangler CLI (For Manual Operations)
```bash
# Authenticate with Cloudflare
wrangler login

# List buckets
wrangler r2 bucket list

# Upload file
wrangler r2 object put cutty-docs/path/to/file --file=local-file.md

# List objects
wrangler r2 object list cutty-docs
```

## Usage Examples

### From Workers (using bindings)
```javascript
// Upload file
await env.FILE_STORAGE.put(key, file);

// Read file
const object = await env.FILE_STORAGE.get(key);

// List files
const listed = await env.FILE_STORAGE.list({ prefix: 'user/' });

// Delete file
await env.FILE_STORAGE.delete(key);
```

### From Node.js Scripts (using AWS SDK)
```javascript
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const r2Client = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Upload
await r2Client.send(new PutObjectCommand({
  Bucket: 'cutty-docs',
  Key: 'docs/file.md',
  Body: content
}));
```

## Security Notes
- **Never commit credentials** - Always use `.env.r2` (gitignored)
- **Use bindings in Workers** - More secure than API tokens
- **Minimal permissions** - Create tokens with only necessary permissions
- **Bucket isolation** - Keep user files and docs in separate buckets

## Documentation Links
- [R2 Getting Started](https://developers.cloudflare.com/r2/get-started/index.md)
- [R2 API Authentication](https://developers.cloudflare.com/r2/api/tokens/index.md)
- [Workers R2 Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/r2/index.md)
- [S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/api/index.md)
- [Wrangler R2 Commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/index.md)

## Troubleshooting
- **"InvalidAccessKeyId"**: Check you're using S3 client credentials, not the token value
- **"NoSuchBucket"**: Verify bucket name and that it exists in your account
- **"Access Denied"**: Check token permissions include the bucket and operations needed
- **Eventual consistency**: R2 has strong consistency for object operations