/**
 * Cuttytabs Incremental Segment Processor
 * 
 * Lightning-fast processing that only handles changed data for maximum efficiency.
 * Uses timestamp-based queries to identify and process only modified records.
 */

import type { Env } from '../types';
import { processGoogleAdsActivations } from './google-ads-activator';

export interface SegmentQuery {
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  logic: 'AND' | 'OR';
}

export interface ProcessingStats {
  segmentsProcessed: number;
  recordsEvaluated: number;
  membershipsAdded: number;
  membershipsRemoved: number;
  activationsQueued: number;
  processingTimeMs: number;
  errors: string[];
}

// Build SQL WHERE clause from segment query (same as in routes/segments.ts)
function buildWhereClause(query: SegmentQuery): string {
  if (!query.conditions || !Array.isArray(query.conditions)) {
    throw new Error('Invalid query format');
  }

  const conditions = query.conditions.map((cond) => {
    const jsonPath = `json_extract(data, '$.${cond.field}')`;
    
    switch (cond.operator) {
      case 'equals':
        return `${jsonPath} = '${cond.value}'`;
      case 'not_equals':
        return `${jsonPath} != '${cond.value}'`;
      case 'contains':
        return `${jsonPath} LIKE '%${cond.value}%'`;
      case 'not_contains':
        return `${jsonPath} NOT LIKE '%${cond.value}%'`;
      case 'greater_than':
        return `CAST(${jsonPath} AS REAL) > ${Number(cond.value)}`;
      case 'less_than':
        return `CAST(${jsonPath} AS REAL) < ${Number(cond.value)}`;
      case 'greater_equal':
        return `CAST(${jsonPath} AS REAL) >= ${Number(cond.value)}`;
      case 'less_equal':
        return `CAST(${jsonPath} AS REAL) <= ${Number(cond.value)}`;
      case 'is_empty':
        return `(${jsonPath} IS NULL OR ${jsonPath} = '')`;
      case 'is_not_empty':
        return `(${jsonPath} IS NOT NULL AND ${jsonPath} != '')`;
      case 'starts_with':
        return `${jsonPath} LIKE '${cond.value}%'`;
      case 'ends_with':
        return `${jsonPath} LIKE '%${cond.value}'`;
      default:
        throw new Error(`Unknown operator: ${cond.operator}`);
    }
  });

  const logic = query.logic === 'OR' ? 'OR' : 'AND';
  return conditions.join(` ${logic} `);
}

/**
 * Process segments incrementally - the heart of real-time segmentation
 * Only looks at records that have changed since the last processing run
 */
export async function processSegments(env: Env): Promise<ProcessingStats> {
  const startTime = Date.now();
  const stats: ProcessingStats = {
    segmentsProcessed: 0,
    recordsEvaluated: 0,
    membershipsAdded: 0,
    membershipsRemoved: 0,
    activationsQueued: 0,
    processingTimeMs: 0,
    errors: []
  };

  try {
    // Get segments that need processing (haven't been processed in the last minute)
    const segments = await env.DB.prepare(`
      SELECT * FROM segments 
      WHERE datetime(last_processed) < datetime('now', '-1 minute')
      OR last_processed IS NULL
      ORDER BY updated_at ASC
      LIMIT 50
    `).all();

    console.log(`Found ${segments.results.length} segments to process`);

    for (const segment of segments.results) {
      try {
        const segmentId = segment.id;
        const fileId = segment.file_id;
        const lastProcessed = segment.last_processed || '1970-01-01 00:00:00';
        
        // Parse segment query
        const query: SegmentQuery = JSON.parse(segment.query);
        const whereClause = buildWhereClause(query);
        
        // Find records that have been updated since last processing
        const changedRecords = await env.DB.prepare(`
          SELECT id, data FROM csv_data
          WHERE file_id = ?
          AND datetime(updated_at) > datetime(?)
          ORDER BY updated_at ASC
        `).bind(fileId, lastProcessed).all();

        stats.recordsEvaluated += changedRecords.results.length;

        if (changedRecords.results.length > 0) {
          console.log(`Processing ${changedRecords.results.length} changed records for segment ${segment.name}`);

          // Evaluate which changed records match the segment criteria
          const matchingRecords = await env.DB.prepare(`
            SELECT id FROM csv_data
            WHERE file_id = ?
            AND datetime(updated_at) > datetime(?)
            AND ${whereClause}
          `).bind(fileId, lastProcessed).all();

          // Add new members (use INSERT OR IGNORE to avoid duplicates)
          if (matchingRecords.results.length > 0) {
            const memberValues = matchingRecords.results.map((record: any) => 
              `('${segmentId}', '${record.id}')`
            ).join(', ');

            const insertResult = await env.DB.prepare(`
              INSERT OR IGNORE INTO segment_members (segment_id, record_id)
              VALUES ${memberValues}
            `).run();

            stats.membershipsAdded += insertResult.changes || 0;

            // Queue for activation if Google Ads is enabled
            if (segment.google_ads_enabled && segment.google_ads_customer_id && segment.google_ads_list_id) {
              const recordIds = matchingRecords.results.map((r: any) => r.id);
              
              await env.DB.prepare(`
                INSERT INTO activation_queue (segment_id, record_ids, platform, status)
                VALUES (?, ?, 'google_ads', 'pending')
              `).bind(segmentId, JSON.stringify(recordIds)).run();

              stats.activationsQueued++;
            }
          }

          // Remove members that no longer match (records that were updated but don't match anymore)
          const nonMatchingRecords = await env.DB.prepare(`
            SELECT cd.id FROM csv_data cd
            INNER JOIN segment_members sm ON cd.id = sm.record_id
            WHERE cd.file_id = ?
            AND sm.segment_id = ?
            AND datetime(cd.updated_at) > datetime(?)
            AND NOT (${whereClause})
          `).bind(fileId, segmentId, lastProcessed).all();

          if (nonMatchingRecords.results.length > 0) {
            const recordIds = nonMatchingRecords.results.map((r: any) => `'${r.id}'`).join(', ');
            
            const deleteResult = await env.DB.prepare(`
              DELETE FROM segment_members 
              WHERE segment_id = ? 
              AND record_id IN (${recordIds})
            `).bind(segmentId).run();

            stats.membershipsRemoved += deleteResult.changes || 0;
          }
        }

        // Update segment metadata
        const totalMembersResult = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM segment_members 
          WHERE segment_id = ?
        `).bind(segmentId).first();

        await env.DB.prepare(`
          UPDATE segments 
          SET 
            last_processed = datetime('now'),
            member_count = ?
          WHERE id = ?
        `).bind(totalMembersResult?.count || 0, segmentId).run();

        stats.segmentsProcessed++;

      } catch (segmentError) {
        const errorMsg = `Error processing segment ${segment.name}: ${segmentError}`;
        console.error(errorMsg);
        stats.errors.push(errorMsg);
      }
    }

  } catch (error) {
    const errorMsg = `Critical error in processSegments: ${error}`;
    console.error(errorMsg);
    stats.errors.push(errorMsg);
  }

  stats.processingTimeMs = Date.now() - startTime;
  
  console.log('Segment processing complete:', {
    segmentsProcessed: stats.segmentsProcessed,
    recordsEvaluated: stats.recordsEvaluated,
    membershipsAdded: stats.membershipsAdded,
    membershipsRemoved: stats.membershipsRemoved,
    activationsQueued: stats.activationsQueued,
    processingTimeMs: stats.processingTimeMs,
    errorsCount: stats.errors.length
  });

  return stats;
}

/**
 * Process activation queue - sends segment data to external platforms
 * Handles Google Ads Customer Match uploads securely
 */
export async function processActivationQueue(env: Env): Promise<ProcessingStats> {
  const startTime = Date.now();
  const stats: ProcessingStats = {
    segmentsProcessed: 0,
    recordsEvaluated: 0,
    membershipsAdded: 0,
    membershipsRemoved: 0,
    activationsQueued: 0,
    processingTimeMs: 0,
    errors: []
  };

  try {
    // Process Google Ads activations using secure service
    const googleAdsStats = await processGoogleAdsActivations(env);
    
    stats.segmentsProcessed = googleAdsStats.successful;
    stats.recordsEvaluated = googleAdsStats.processed;
    stats.errors = googleAdsStats.errors;

    console.log('Activation processing delegated to Google Ads service:', googleAdsStats);

  } catch (error) {
    const errorMsg = `Critical error in processActivationQueue: ${error}`;
    console.error(errorMsg);
    stats.errors.push(errorMsg);
  }

  stats.processingTimeMs = Date.now() - startTime;
  return stats;
}

/**
 * Main entry point for cron job - processes both segments and activations
 */
export async function runIncrementalProcessing(env: Env): Promise<ProcessingStats> {
  console.log('Starting incremental processing...');
  
  const segmentStats = await processSegments(env);
  const activationStats = await processActivationQueue(env);

  // Combine stats
  const combinedStats: ProcessingStats = {
    segmentsProcessed: segmentStats.segmentsProcessed,
    recordsEvaluated: segmentStats.recordsEvaluated + activationStats.recordsEvaluated,
    membershipsAdded: segmentStats.membershipsAdded,
    membershipsRemoved: segmentStats.membershipsRemoved,
    activationsQueued: segmentStats.activationsQueued,
    processingTimeMs: segmentStats.processingTimeMs + activationStats.processingTimeMs,
    errors: [...segmentStats.errors, ...activationStats.errors]
  };

  console.log('Incremental processing complete:', combinedStats);
  return combinedStats;
}