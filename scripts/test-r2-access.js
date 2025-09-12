#!/usr/bin/env node

/**
 * Test R2 bucket access and list contents
 * This helps diagnose AutoRAG connection issues
 */

import { S3Client, ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.r2 file
dotenv.config({ path: resolve(__dirname, '../.env.r2') });

// R2 configuration
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error('❌ Missing required environment variables in .env.r2:');
  console.error('   - CLOUDFLARE_ACCOUNT_ID');
  console.error('   - R2_ACCESS_KEY_ID');
  console.error('   - R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

// Create S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

async function testR2Access() {
  console.log('🔍 Testing R2 bucket access for AutoRAG...\n');
  
  const bucketName = 'cutty-docs';
  
  try {
    // Test 1: Check if bucket exists and is accessible
    console.log(`1️⃣  Checking if bucket "${bucketName}" exists...`);
    const headCommand = new HeadBucketCommand({ Bucket: bucketName });
    await s3Client.send(headCommand);
    console.log(`✅ Bucket "${bucketName}" exists and is accessible\n`);
    
    // Test 2: List objects in the bucket
    console.log(`2️⃣  Listing objects in bucket "${bucketName}"...`);
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 10, // List first 10 objects
    });
    
    const response = await s3Client.send(listCommand);
    
    if (!response.Contents || response.Contents.length === 0) {
      console.log(`⚠️  Bucket "${bucketName}" is empty!`);
      console.log('   AutoRAG needs documents in the bucket to index.');
      return;
    }
    
    console.log(`✅ Found ${response.KeyCount} objects (showing first 10):`);
    response.Contents.forEach(obj => {
      const size = (obj.Size / 1024).toFixed(2);
      console.log(`   - ${obj.Key} (${size} KB)`);
    });
    
    // Test 3: Check file types
    console.log('\n3️⃣  Checking file types...');
    const fileTypes = new Set();
    response.Contents.forEach(obj => {
      const ext = obj.Key.split('.').pop().toLowerCase();
      fileTypes.add(ext);
    });
    
    console.log(`   Found file types: ${Array.from(fileTypes).join(', ')}`);
    
    const supportedTypes = ['md', 'txt', 'html', 'pdf', 'json', 'csv'];
    const unsupportedTypes = Array.from(fileTypes).filter(ext => !supportedTypes.includes(ext));
    
    if (unsupportedTypes.length > 0) {
      console.log(`   ⚠️  Warning: Some file types may not be supported by AutoRAG: ${unsupportedTypes.join(', ')}`);
    } else {
      console.log('   ✅ All file types are supported by AutoRAG');
    }
    
    // Test 4: Check total size
    if (response.Contents) {
      const totalSize = response.Contents.reduce((sum, obj) => sum + obj.Size, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      console.log(`\n4️⃣  Total size of objects: ${totalSizeMB} MB`);
      
      if (totalSize > 100 * 1024 * 1024) {
        console.log('   ⚠️  Warning: Large amount of data may take time to index');
      }
    }
    
    console.log('\n✅ R2 bucket is properly configured for AutoRAG!');
    console.log('\n📝 Next steps to fix AutoRAG:');
    console.log('   1. Go to Cloudflare Dashboard → AI → AutoRAG');
    console.log('   2. Create a new AutoRAG instance');
    console.log('   3. Select "cutty-docs" as the R2 bucket');
    console.log('   4. Use default embedding and LLM models');
    console.log('   5. Name it "cutty-rag"');
    console.log('   6. Make sure to create/select a Service API token');
    console.log('   7. Wait for indexing to complete (check status in dashboard)');
    console.log('\n🔧 If it still fails:');
    console.log('   - Try creating a new Service API token with full permissions');
    console.log('   - Ensure the R2 bucket has public read access or proper CORS settings');
    console.log('   - Check if there\'s an existing Vectorize index with conflicts');
    console.log('   - Try deleting and recreating the AutoRAG instance');
    
  } catch (error) {
    console.error(`❌ Error accessing bucket "${bucketName}":`, error.message);
    
    if (error.name === 'NoSuchBucket') {
      console.error('\n   The bucket does not exist. Create it first with:');
      console.error('   npx wrangler r2 bucket create cutty-docs');
    } else if (error.name === 'AccessDenied' || error.name === 'InvalidAccessKeyId') {
      console.error('\n   Access denied. Check your R2 API credentials.');
      console.error('   You may need to create new R2 API tokens in Cloudflare Dashboard.');
    } else {
      console.error('\n   An unexpected error occurred. Check your configuration.');
    }
  }
}

// Run the test
testR2Access().catch(console.error);