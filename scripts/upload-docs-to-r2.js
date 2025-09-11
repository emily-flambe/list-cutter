#!/usr/bin/env node

/**
 * Upload Documentation to Cloudflare R2
 * 
 * This script uploads all markdown documentation files to R2 storage
 * for use with Cloudflare AutoRAG
 */

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const matter = require('gray-matter');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.r2');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.log('Note: .env.r2 file not found. Using environment variables.');
}

// Validate required environment variables
const requiredEnvVars = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('\nPlease create a .env.r2 file with:');
  console.error('R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com');
  console.error('R2_ACCESS_KEY_ID=<your-access-key>');
  console.error('R2_SECRET_ACCESS_KEY=<your-secret-key>');
  console.error('R2_BUCKET_NAME=cutty-docs');
  process.exit(1);
}

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
const uploadErrors = [];

/**
 * Get all markdown files recursively
 */
async function getAllMarkdownFiles(dir) {
  const files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Recursively get files from subdirectories
        const subFiles = await getAllMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (item.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

/**
 * Extract title from filename if not in frontmatter
 */
function extractTitle(filename) {
  const name = path.basename(filename, '.md');
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Upload a single document to R2
 */
async function uploadDocument(filePath, basePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    const relativePath = path.relative(basePath, filePath);
    
    // Generate document ID
    const docId = crypto.createHash('md5').update(relativePath).digest('hex');
    
    // Prepare metadata
    const metadata = {
      id: docId,
      path: relativePath,
      title: parsed.data.title || extractTitle(filePath),
      category: parsed.data.category || 'General',
      subcategory: parsed.data.subcategory || '',
      keywords: Array.isArray(parsed.data.keywords) 
        ? parsed.data.keywords.join(',') 
        : (parsed.data.keywords || ''),
      difficulty: parsed.data.difficulty || 'intermediate',
      lastModified: new Date().toISOString(),
      contentHash: crypto.createHash('md5').update(content).digest('hex')
    };
    
    // Upload document to R2
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: `docs/${relativePath}`,
      Body: content,
      ContentType: 'text/markdown',
      Metadata: metadata
    });
    
    await r2Client.send(command);
    
    // Add to index
    documentIndex.push({
      ...metadata,
      keywords: parsed.data.keywords || [],
      size: content.length
    });
    
    console.log(`✓ Uploaded: ${relativePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to upload ${filePath}:`, error.message);
    uploadErrors.push({ file: filePath, error: error.message });
    return false;
  }
}

/**
 * Upload the document index
 */
async function uploadIndex() {
  try {
    const indexContent = JSON.stringify(documentIndex, null, 2);
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: 'metadata/index.json',
      Body: indexContent,
      ContentType: 'application/json',
      Metadata: {
        documentCount: String(documentIndex.length),
        lastUpdated: new Date().toISOString()
      }
    });
    
    await r2Client.send(command);
    console.log('📄 Index uploaded to metadata/index.json');
    return true;
  } catch (error) {
    console.error('✗ Failed to upload index:', error.message);
    return false;
  }
}

/**
 * List existing objects in bucket (for verification)
 */
async function listBucketContents() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: 'docs/',
      MaxKeys: 10
    });
    
    const response = await r2Client.send(command);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('\nExisting files in bucket (first 10):');
      response.Contents.forEach(item => {
        console.log(`  - ${item.Key} (${item.Size} bytes)`);
      });
    }
  } catch (error) {
    console.error('Could not list bucket contents:', error.message);
  }
}

/**
 * Main upload function
 */
async function uploadAllDocuments() {
  console.log('Starting documentation upload to R2...\n');
  console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
  console.log(`Endpoint: ${process.env.R2_ENDPOINT}\n`);
  
  // Find documentation directory
  const docsDir = path.join(__dirname, '..', 'docs');
  
  if (!fs.existsSync(docsDir)) {
    console.error(`Documentation directory not found: ${docsDir}`);
    console.error('Please run this script from the project root or scripts directory.');
    process.exit(1);
  }
  
  // Get all markdown files
  console.log('Scanning for documentation files...');
  const files = await getAllMarkdownFiles(docsDir);
  
  if (files.length === 0) {
    console.error('No markdown files found in docs directory.');
    process.exit(1);
  }
  
  console.log(`Found ${files.length} documentation files\n`);
  
  // Upload each file
  let successCount = 0;
  for (const file of files) {
    const success = await uploadDocument(file, docsDir);
    if (success) successCount++;
  }
  
  // Upload index
  if (documentIndex.length > 0) {
    console.log('\nUploading document index...');
    await uploadIndex();
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Upload Summary:');
  console.log(`✅ Successfully uploaded: ${successCount}/${files.length} files`);
  
  if (uploadErrors.length > 0) {
    console.log(`❌ Failed uploads: ${uploadErrors.length}`);
    console.log('\nFailed files:');
    uploadErrors.forEach(err => {
      console.log(`  - ${path.basename(err.file)}: ${err.error}`);
    });
  }
  
  // List bucket contents for verification
  if (successCount > 0) {
    await listBucketContents();
  }
  
  console.log('\n✨ Documentation upload complete!');
  
  if (successCount === files.length) {
    console.log('All files uploaded successfully. AutoRAG can now index the documentation.');
  } else {
    console.log('Some files failed to upload. Please check the errors above.');
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

// Run the upload
uploadAllDocuments().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});