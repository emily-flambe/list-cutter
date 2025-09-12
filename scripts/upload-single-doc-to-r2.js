#!/usr/bin/env node

/**
 * Upload a single documentation file to R2
 * This script uploads the new Cutty origin story to trigger re-indexing
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from .env.r2
dotenv.config({ path: path.resolve(__dirname, '../.env.r2') });

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

async function uploadNewDocument() {
  const bucketName = 'cutty-docs';
  const filePath = path.resolve(__dirname, '../docs/lore/cutty-origin-story.md');
  const key = 'docs/lore/cutty-origin-story.md';
  
  console.log('📚 Uploading new document to R2 for AutoRAG indexing...\n');
  console.log(`📁 Bucket: ${bucketName}`);
  console.log(`📄 File: ${filePath}`);
  console.log(`🔑 Key: ${key}\n`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log(`📊 File size: ${fileContent.length} bytes`);
    
    // Generate metadata
    const contentHash = crypto.createHash('md5').update(fileContent).digest('hex');
    const metadata = {
      'content-type': 'text/markdown',
      'content-hash': contentHash,
      'upload-date': new Date().toISOString(),
      'document-title': 'The Legend of Cutty the Cuttlefish',
      'document-category': 'lore',
      'document-keywords': 'cutty,cuttlefish,origin,story,mascot,assistant,legend'
    };
    
    // Upload to R2
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'text/markdown',
      Metadata: metadata
    });
    
    console.log('⬆️  Uploading to R2...');
    const startTime = Date.now();
    const result = await s3Client.send(uploadCommand);
    const uploadTime = Date.now() - startTime;
    
    console.log(`✅ Upload successful! (${uploadTime}ms)`);
    console.log(`📝 ETag: ${result.ETag}`);
    console.log(`🔗 Version ID: ${result.VersionId || 'N/A'}`);
    console.log('\n📊 Metadata attached:');
    Object.entries(metadata).forEach(([key, value]) => {
      console.log(`   - ${key}: ${value}`);
    });
    
    console.log('\n🎉 Success! New document uploaded to R2.');
    console.log('\n📌 Next steps:');
    console.log('1. Go to Cloudflare Dashboard → AI → AutoRAG');
    console.log('2. Select the "cutty-rag" instance');
    console.log('3. Click "Re-index" or wait for automatic indexing');
    console.log('4. You should now have 17 documents instead of 16');
    console.log('\n🔍 To verify the upload, run:');
    console.log('   node scripts/test-r2-access.js');
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    if (error.name === 'NoSuchBucket') {
      console.error(`\n📦 The bucket "${bucketName}" doesn't exist.`);
      console.error('   Create it in the Cloudflare Dashboard first.');
    } else if (error.name === 'InvalidAccessKeyId') {
      console.error('\n🔑 Invalid access key ID.');
      console.error('   Check your R2 API token configuration.');
    } else if (error.name === 'SignatureDoesNotMatch') {
      console.error('\n🔐 Invalid secret access key.');
      console.error('   Check your R2 API token configuration.');
    }
    process.exit(1);
  }
}

// Run the upload
uploadNewDocument().catch(console.error);