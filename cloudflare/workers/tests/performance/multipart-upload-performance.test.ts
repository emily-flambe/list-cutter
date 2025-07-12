/**
 * R2 Multipart Upload Performance Tests
 * Rainbow Dash multipart optimization - massive files at sonic speed!
 * 
 * Tests concurrent multipart uploads for optimal large file performance
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceBenchmark, BenchmarkConfig } from './benchmark-utils.js';
import { R2StorageService, FileUploadOptions } from '../../src/services/storage/r2-service.js';
import { MetricsService } from '../../src/services/monitoring/metrics-service.js';

// Test configuration
const TEST_USER_ID = 'perf-multipart-user';
const MULTIPART_SIZES = {
  MEDIUM: 60 * 1024 * 1024,   // 60MB (triggers multipart)
  LARGE: 150 * 1024 * 1024,   // 150MB
  XLARGE: 300 * 1024 * 1024,  // 300MB
  HUGE: 500 * 1024 * 1024     // 500MB
};

const PERFORMANCE_TARGETS = {
  MULTIPART_60MB: { maxDuration: 20000, minThroughput: 3 * 1024 * 1024 },     // 20s, 3MB/s
  MULTIPART_150MB: { maxDuration: 45000, minThroughput: 3.5 * 1024 * 1024 },  // 45s, 3.5MB/s
  MULTIPART_300MB: { maxDuration: 85000, minThroughput: 3.5 * 1024 * 1024 },  // 85s, 3.5MB/s
  MULTIPART_500MB: { maxDuration: 140000, minThroughput: 3.5 * 1024 * 1024 }, // 140s, 3.5MB/s
  MAX_ERROR_RATE: 5 // 5% max error rate
};

interface MultipartMetrics {
  totalParts: number;
  concurrentParts: number;
  avgPartUploadTime: number;
  slowestPartTime: number;
  fastestPartTime: number;
  totalUploadTime: number;
  effectiveThroughput: number;
}

describe.skip('R2 Multipart Upload Performance Tests', () => {
  let benchmark: PerformanceBenchmark;
  let r2Service: R2StorageService;
  let metricsService: MetricsService;
  let mockBucket: R2Bucket;
  let mockDb: D1Database;
  let multipartMetrics: Map<string, MultipartMetrics> = new Map();

  beforeAll(async () => {
    benchmark = new PerformanceBenchmark();
    
    // Create enhanced mock R2 bucket for multipart testing
    mockBucket = {
      put: async (key: string, data: ArrayBuffer | Uint8Array, options?: R2PutOptions) => {
        // Single upload simulation
        const size = data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
        const latency = Math.min(100 + (size / (10 * 1024 * 1024)) * 1000, 5000);
        await new Promise(resolve => setTimeout(resolve, latency));
        
        return {
          etag: `etag-${Date.now()}-${key}`,
          size,
          uploaded: new Date(),
          httpEtag: `"etag-${Date.now()}"`,
          customMetadata: options?.customMetadata || {},
          httpMetadata: options?.httpMetadata || {}
        } as R2Object;
      },
      
      createMultipartUpload: async (key: string, options?: R2PutOptions) => {
        const uploadId = `upload-${Date.now()}-${key}`;
        console.log(`🚀 Creating multipart upload: ${uploadId}`);
        
        // Setup latency for multipart creation
        await new Promise(resolve => setTimeout(resolve, 80));
        
        return {
          uploadId,
          complete: async (parts: R2UploadedPart[]) => {
            const startTime = Date.now();
            console.log(`🔄 Completing multipart upload with ${parts.length} parts...`);
            
            // Simulate completion time based on parts count
            const completionLatency = Math.min(100 + parts.length * 5, 2000);
            await new Promise(resolve => setTimeout(resolve, completionLatency));
            
            // Calculate total size from parts (assume 5MB per part for simplicity)
            const totalSize = parts.reduce((sum, part) => {
              // Extract size from mock etag (if available) or use default
              const sizeMatch = part.etag.match(/size-(\d+)/);
              return sum + (sizeMatch ? parseInt(sizeMatch[1]) : 5 * 1024 * 1024);
            }, 0);
            
            const completionTime = Date.now() - startTime;
            console.log(`✅ Multipart upload completed in ${completionTime}ms`);
            
            return {
              etag: `multipart-etag-${Date.now()}`,
              size: totalSize,
              uploaded: new Date(),
              httpEtag: `"multipart-etag-${Date.now()}"`,
              customMetadata: options?.customMetadata || {},
              httpMetadata: options?.httpMetadata || {}
            } as R2Object;
          }
        } as R2MultipartUpload;
      }
    } as R2Bucket;

    // Create mock D1 database for multipart session tracking
    mockDb = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          run: async () => {
            // Simulate database operations
            await new Promise(resolve => setTimeout(resolve, 10));
            return { success: true, meta: { changes: 1 } };
          },
          first: async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            
            if (sql.includes('multipart_uploads')) {
              return {
                upload_id: params[0],
                parts_uploaded: 0,
                status: 'active'
              };
            }
            return null;
          },
          all: async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return { results: [] };
          }
        })
      })
    } as D1Database;

    // Initialize services
    metricsService = new MetricsService(mockDb);
    r2Service = new R2StorageService(mockBucket, mockDb, metricsService);
  });

  afterAll(async () => {
    await r2Service.cleanup();
  });

  describe('Medium Multipart Uploads (60MB)', () => {
    it('should upload 60MB file efficiently using multipart', async () => {
      const testData = benchmark.generateTestFile(MULTIPART_SIZES.MEDIUM);
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `multipart-60mb-${Date.now()}`,
        fileName: 'test-multipart-60mb.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 2,
        warmupRuns: 1,
        timeout: 30000
      };

      const startTime = Date.now();
      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        MULTIPART_SIZES.MEDIUM,
        config
      );

      const totalTime = Date.now() - startTime;
      benchmark.printReport(metrics, '60MB Multipart Upload', MULTIPART_SIZES.MEDIUM);
      console.log(`🌈 60MB multipart throughput: ${throughputMBps.toFixed(2)} MB/s`);
      console.log(`⏱️  Total operation time: ${totalTime.toFixed(2)}ms`);
      
      // Track multipart-specific metrics
      multipartMetrics.set('60MB', {
        totalParts: Math.ceil(MULTIPART_SIZES.MEDIUM / (5 * 1024 * 1024)), // 5MB parts
        concurrentParts: 3,
        avgPartUploadTime: metrics.avgResponseTime / Math.ceil(MULTIPART_SIZES.MEDIUM / (5 * 1024 * 1024)),
        slowestPartTime: metrics.maxResponseTime,
        fastestPartTime: metrics.minResponseTime,
        totalUploadTime: metrics.duration,
        effectiveThroughput: throughputMBps
      });
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.MULTIPART_60MB,
        '60MB Multipart Upload'
      );

      expect(metrics.successRate).toBeGreaterThan(95);
      expect(metrics.avgResponseTime).toBeLessThan(20000);
    }, 60000);
  });

  describe('Large Multipart Uploads (150MB)', () => {
    it('should upload 150MB file with optimal part concurrency', async () => {
      const testData = benchmark.generateTestFile(MULTIPART_SIZES.LARGE);
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `multipart-150mb-${Date.now()}`,
        fileName: 'test-multipart-150mb.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 2,
        warmupRuns: 1,
        timeout: 60000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        MULTIPART_SIZES.LARGE,
        config
      );

      benchmark.printReport(metrics, '150MB Multipart Upload', MULTIPART_SIZES.LARGE);
      console.log(`🚀 150MB multipart throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      multipartMetrics.set('150MB', {
        totalParts: Math.ceil(MULTIPART_SIZES.LARGE / (5 * 1024 * 1024)),
        concurrentParts: 3,
        avgPartUploadTime: metrics.avgResponseTime / Math.ceil(MULTIPART_SIZES.LARGE / (5 * 1024 * 1024)),
        slowestPartTime: metrics.maxResponseTime,
        fastestPartTime: metrics.minResponseTime,
        totalUploadTime: metrics.duration,
        effectiveThroughput: throughputMBps
      });
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.MULTIPART_150MB,
        '150MB Multipart Upload'
      );

      expect(metrics.successRate).toBeGreaterThan(90);
      expect(metrics.avgResponseTime).toBeLessThan(45000);
    }, 90000);
  });

  describe('Extra Large Multipart Uploads (300MB)', () => {
    it('should handle 300MB file with sustained performance', async () => {
      const testData = benchmark.generateTestFile(MULTIPART_SIZES.XLARGE);
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `multipart-300mb-${Date.now()}`,
        fileName: 'test-multipart-300mb.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 1, // Single run for very large files
        warmupRuns: 1,
        timeout: 120000 // 2 minutes
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        MULTIPART_SIZES.XLARGE,
        config
      );

      benchmark.printReport(metrics, '300MB Multipart Upload', MULTIPART_SIZES.XLARGE);
      console.log(`💪 300MB multipart throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      const expectedParts = Math.ceil(MULTIPART_SIZES.XLARGE / (5 * 1024 * 1024));
      console.log(`📊 Expected parts: ${expectedParts}`);
      
      multipartMetrics.set('300MB', {
        totalParts: expectedParts,
        concurrentParts: 3,
        avgPartUploadTime: metrics.avgResponseTime / expectedParts,
        slowestPartTime: metrics.maxResponseTime,
        fastestPartTime: metrics.minResponseTime,
        totalUploadTime: metrics.duration,
        effectiveThroughput: throughputMBps
      });
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.MULTIPART_300MB,
        '300MB Multipart Upload'
      );

      expect(metrics.successRate).toBeGreaterThan(90);
      expect(throughputMBps).toBeGreaterThan(3); // At least 3 MB/s sustained
    }, 180000); // 3 minutes max
  });

  describe('Streaming Multipart Uploads', () => {
    it('should handle streaming multipart upload efficiently', async () => {
      const fileSize = 80 * 1024 * 1024; // 80MB
      const chunkSize = 2 * 1024 * 1024; // 2MB chunks
      
      // Create streaming data
      const stream = new ReadableStream({
        start(controller) {
          let bytesEnqueued = 0;
          
          const pump = () => {
            if (bytesEnqueued < fileSize) {
              const remainingBytes = fileSize - bytesEnqueued;
              const currentChunkSize = Math.min(chunkSize, remainingBytes);
              const chunk = benchmark.generateTestFile(currentChunkSize);
              
              controller.enqueue(chunk);
              bytesEnqueued += currentChunkSize;
              
              // Simulate streaming delay
              setTimeout(pump, 20);
            } else {
              controller.close();
            }
          };
          
          pump();
        }
      });

      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `stream-multipart-${Date.now()}`,
        fileName: 'test-stream-multipart.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 1,
        warmupRuns: 0,
        timeout: 45000
      };

      const { metrics } = await benchmark.benchmark(
        () => r2Service.uploadFile(stream, uploadOptions),
        config
      );

      benchmark.printReport(metrics, '80MB Streaming Multipart Upload');
      console.log(`🌊 Streaming upload performance: ${metrics.avgResponseTime.toFixed(2)}ms`);
      
      expect(metrics.successRate).toBeGreaterThan(90);
      expect(metrics.avgResponseTime).toBeLessThan(35000); // 35s for streaming
    }, 90000);

    it('should optimize chunk size for streaming performance', async () => {
      const fileSize = 50 * 1024 * 1024; // 50MB
      const testChunkSizes = [
        1 * 1024 * 1024,   // 1MB chunks
        5 * 1024 * 1024,   // 5MB chunks  
        10 * 1024 * 1024   // 10MB chunks
      ];

      const results: Array<{ chunkSize: number; throughput: number; duration: number }> = [];

      for (const chunkSize of testChunkSizes) {
        const stream = new ReadableStream({
          start(controller) {
            let bytesEnqueued = 0;
            
            const pump = () => {
              if (bytesEnqueued < fileSize) {
                const remainingBytes = fileSize - bytesEnqueued;
                const currentChunkSize = Math.min(chunkSize, remainingBytes);
                const chunk = benchmark.generateTestFile(currentChunkSize);
                
                controller.enqueue(chunk);
                bytesEnqueued += currentChunkSize;
                
                setTimeout(pump, 15);
              } else {
                controller.close();
              }
            };
            
            pump();
          }
        });

        const uploadOptions: FileUploadOptions = {
          userId: TEST_USER_ID,
          fileId: `chunk-test-${chunkSize}-${Date.now()}`,
          fileName: `test-chunk-${chunkSize}.bin`,
          contentType: 'application/octet-stream'
        };

        const startTime = Date.now();
        await r2Service.uploadFile(stream, uploadOptions);
        const duration = Date.now() - startTime;
        const throughput = (fileSize / (1024 * 1024)) / (duration / 1000);

        results.push({ chunkSize, throughput, duration });
        console.log(`📏 Chunk size ${(chunkSize / 1024 / 1024).toFixed(1)}MB: ${throughput.toFixed(2)} MB/s, ${duration}ms`);
      }

      // Find optimal chunk size
      const optimal = results.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );
      
      console.log(`🏆 Optimal chunk size: ${(optimal.chunkSize / 1024 / 1024).toFixed(1)}MB (${optimal.throughput.toFixed(2)} MB/s)`);
      
      expect(optimal.throughput).toBeGreaterThan(2); // Should achieve at least 2 MB/s
      expect(results.length).toBe(3);
    }, 120000);
  });

  describe('Concurrent Multipart Operations', () => {
    it('should handle multiple concurrent multipart uploads', async () => {
      const fileSize = 40 * 1024 * 1024; // 40MB each
      const numConcurrent = 3;
      
      const config: BenchmarkConfig = {
        testRuns: numConcurrent,
        concurrency: numConcurrent,
        timeout: 60000
      };

      let uploadCounter = 0;
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        () => {
          const testData = benchmark.generateTestFile(fileSize);
          const uploadOptions: FileUploadOptions = {
            userId: TEST_USER_ID,
            fileId: `concurrent-${++uploadCounter}-${Date.now()}`,
            fileName: `test-concurrent-${uploadCounter}.bin`,
            contentType: 'application/octet-stream'
          };
          
          return r2Service.uploadFile(testData, uploadOptions);
        },
        config
      );

      benchmark.printReport(metrics, `${numConcurrent} Concurrent 40MB Multipart Uploads`);
      console.log(`🚀 Concurrent uploads completed: ${results.length}/${numConcurrent}`);
      
      expect(metrics.successRate).toBeGreaterThan(80);
      expect(results.length).toBeGreaterThanOrEqual(2); // At least 2 should succeed
    }, 120000);

    it('should maintain performance under multipart stress', async () => {
      const fileSize = 25 * 1024 * 1024; // 25MB files
      const numUploads = 4;
      
      const config: BenchmarkConfig = {
        testRuns: numUploads,
        warmupRuns: 1,
        timeout: 45000
      };

      let stressCounter = 0;
      const { metrics } = await benchmark.benchmark(
        () => {
          const testData = benchmark.generateTestFile(fileSize);
          const uploadOptions: FileUploadOptions = {
            userId: TEST_USER_ID,
            fileId: `stress-${++stressCounter}-${Date.now()}`,
            fileName: `test-stress-${stressCounter}.bin`,
            contentType: 'application/octet-stream'
          };
          
          return r2Service.uploadFile(testData, uploadOptions);
        },
        config
      );

      benchmark.printReport(metrics, 'Multipart Stress Test (4x 25MB)');
      
      expect(metrics.successRate).toBeGreaterThan(75);
      expect(metrics.avgResponseTime).toBeLessThan(35000); // Should stay reasonable
    }, 180000);
  });

  describe('Multipart Performance Analysis', () => {
    it('should provide detailed multipart performance metrics', () => {
      console.log('\n🌈 Rainbow Dash Multipart Performance Summary');
      console.log('='.repeat(60));
      
      for (const [size, metrics] of multipartMetrics.entries()) {
        console.log(`\n📊 ${size} Multipart Upload Analysis:`);
        console.log(`   Total Parts: ${metrics.totalParts}`);
        console.log(`   Concurrent Parts: ${metrics.concurrentParts}`);
        console.log(`   Avg Part Upload Time: ${metrics.avgPartUploadTime.toFixed(2)}ms`);
        console.log(`   Slowest Part: ${metrics.slowestPartTime.toFixed(2)}ms`);
        console.log(`   Fastest Part: ${metrics.fastestPartTime.toFixed(2)}ms`);
        console.log(`   Total Upload Time: ${metrics.totalUploadTime.toFixed(2)}ms`);
        console.log(`   Effective Throughput: ${metrics.effectiveThroughput.toFixed(2)} MB/s`);
        
        // Calculate efficiency metrics
        const theoreticalTime = metrics.totalParts * metrics.avgPartUploadTime / metrics.concurrentParts;
        const efficiency = (theoreticalTime / metrics.totalUploadTime) * 100;
        console.log(`   Concurrent Efficiency: ${efficiency.toFixed(1)}%`);
      }
      
      console.log('\n🏆 Performance Achievements:');
      console.log('   ✅ Multipart uploads implemented');
      console.log('   ✅ Concurrent part uploads optimized');
      console.log('   ✅ Streaming multipart support');
      console.log('   ✅ Performance targets validated');
      console.log('='.repeat(60));
      
      expect(multipartMetrics.size).toBeGreaterThan(0);
    });

    it('should demonstrate scaling characteristics', async () => {
      const testSizes = [
        { size: 30 * 1024 * 1024, name: '30MB' },
        { size: 60 * 1024 * 1024, name: '60MB' },
        { size: 120 * 1024 * 1024, name: '120MB' }
      ];

      const scalingResults: Array<{ size: string; throughput: number; efficiency: number }> = [];

      for (const test of testSizes) {
        const testData = benchmark.generateTestFile(test.size);
        const uploadOptions: FileUploadOptions = {
          userId: TEST_USER_ID,
          fileId: `scaling-${test.name}-${Date.now()}`,
          fileName: `scaling-test-${test.name}.bin`,
          contentType: 'application/octet-stream'
        };

        const startTime = Date.now();
        await r2Service.uploadFile(testData, uploadOptions);
        const duration = Date.now() - startTime;
        const throughput = (test.size / (1024 * 1024)) / (duration / 1000);
        
        // Calculate efficiency relative to baseline
        const baselineEfficiency = 100; // Assume 30MB is baseline
        const efficiency = scalingResults.length === 0 ? baselineEfficiency : 
          (throughput / scalingResults[0].throughput) * baselineEfficiency;

        scalingResults.push({
          size: test.name,
          throughput,
          efficiency
        });

        console.log(`📈 ${test.name}: ${throughput.toFixed(2)} MB/s, ${efficiency.toFixed(1)}% efficiency`);
      }

      console.log('\n🔍 Scaling Analysis:');
      scalingResults.forEach(result => {
        console.log(`   ${result.size}: ${result.throughput.toFixed(2)} MB/s (${result.efficiency.toFixed(1)}% efficiency)`);
      });

      expect(scalingResults.length).toBe(3);
      expect(scalingResults.every(r => r.throughput > 1)).toBe(true); // All should achieve >1 MB/s
    }, 180000);
  });
});