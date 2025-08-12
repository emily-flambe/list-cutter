/**
 * Demo Data Service
 * 
 * Copies the actual demo files (NYC Squirrel Census and NPORS 2025) for new users
 */

import type { Env } from '../types';

interface DemoFile {
  sourceKey: string;
  filename: string;
  displayName: string;
  description: string;
}

/**
 * Demo files to copy for new users - same files used for anonymous demo mode
 */
const getDemoFiles = (): DemoFile[] => {
  return [
    {
      sourceKey: 'demo/squirrel-data.csv',
      filename: 'NYC_Squirrel_Census.csv',
      displayName: 'NYC Squirrel Census',
      description: 'NYC Squirrel Census data - Perfect for exploring animal behavior patterns!'
    },
    {
      sourceKey: 'demo/NPORS_2025.csv', 
      filename: 'NPORS_2025.csv',
      displayName: '2025 National Public Opinion Reference Survey',
      description: 'Comprehensive survey data on demographics, politics, and social attitudes'
    }
  ];
};

/**
 * Creates demo files for a new user by copying from R2 demo storage
 */
export async function createDemoFilesForUser(userId: number | string, env: Env): Promise<void> {
  try {
    const demoFiles = getDemoFiles();
    let filesCreated = 0;
    
    for (const demoFile of demoFiles) {
      try {
        // Get the demo file from R2
        const sourceObject = await env.FILE_STORAGE.get(demoFile.sourceKey);
        
        if (!sourceObject) {
          console.warn(`Demo file not found in R2: ${demoFile.sourceKey}`);
          continue;
        }
        
        // Read the content
        const content = await sourceObject.text();
        const fileSize = content.length;
        
        // Generate unique file ID for user's copy
        const fileId = crypto.randomUUID();
        const userFileKey = `${userId}/${fileId}`;
        
        // Store copy in user's R2 space
        await env.FILE_STORAGE.put(userFileKey, content, {
          customMetadata: {
            'original-filename': demoFile.filename,
            'content-type': 'text/csv',
            'user-id': userId.toString(),
            'description': demoFile.description,
            'demo-file': 'true',
            'source': 'demo-copy'
          }
        });
        
        // Add file record to database
        await env.DB.prepare(
          `INSERT INTO files (id, user_id, filename, original_filename, file_size, mime_type, r2_key, upload_status, tags) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          fileId,
          userId.toString(),
          demoFile.filename,
          demoFile.filename,
          fileSize,
          'text/csv',
          userFileKey,
          'completed',
          JSON.stringify(['demo', 'sample', 'starter'])
        ).run();
        
        filesCreated++;
        console.log(`Created demo file "${demoFile.filename}" for user ${userId}`);
      } catch (fileError) {
        console.error(`Failed to create demo file "${demoFile.filename}" for user ${userId}:`, fileError);
        // Continue with other files even if one fails
      }
    }
    
    console.log(`Created ${filesCreated} demo files for user ${userId}`);
  } catch (error) {
    console.error('Error creating demo files for user:', userId, error);
    // Don't throw - we don't want registration to fail if demo files can't be created
  }
}