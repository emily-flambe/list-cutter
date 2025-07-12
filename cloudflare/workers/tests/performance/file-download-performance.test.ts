/**
 * R2 File Download Performance Tests with Caching
 * Rainbow Dash speed optimization - downloads at sonic speed!
 * 
 * Performance Target: < 2 seconds for download operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceBenchmark, BenchmarkConfig } from './benchmark-utils.js';
import { R2StorageService } from '../../src/services/storage/r2-service.js';
import { MetricsService } from '../../src/services/monitoring/metrics-service.js';

// Test configuration
const TEST_USER_ID = 'perf-download-user';
const TEST_FILE_SIZES = {
  SMALL: 512 * 1024,         // 512KB
  MEDIUM: 5 * 1024 * 1024,   // 5MB
  LARGE: 20 * 1024 * 1024    // 20MB
};

const PERFORMANCE_TARGETS = {
  SMALL_DOWNLOAD: { maxDuration: 500, minThroughput: 1024 * 1024 },      // 500ms, 1MB/s
  MEDIUM_DOWNLOAD: { maxDuration: 2000, minThroughput: 2.5 * 1024 * 1024 }, // 2s, 2.5MB/s
  LARGE_DOWNLOAD: { maxDuration: 8000, minThroughput: 2.5 * 1024 * 1024 },  // 8s, 2.5MB/s
  CACHED_DOWNLOAD: { maxDuration: 200, minThroughput: 10 * 1024 * 1024 },   // 200ms, 10MB/s
  MAX_ERROR_RATE: 3 // 3% max error rate for downloads
};

interface TestFileRecord {
  fileId: string;
  r2Key: string;
  size: number;
  data: Uint8Array;
}

describe('R2 File Download Performance Tests', () => {
  let benchmark: PerformanceBenchmark;
  let r2Service: R2StorageService;
  let metricsService: MetricsService;
  let mockBucket: R2Bucket;
  let mockDb: D1Database;
  let testFiles: Map<string, TestFileRecord> = new Map();
  let downloadCache: Map<string, { data: R2ObjectBody; cachedAt: number }> = new Map();

  beforeAll(async () => {
    benchmark = new PerformanceBenchmark();
    
    // Create test files for download testing
    const createTestFile = (size: number, name: string): TestFileRecord => {
      const data = benchmark.generateTestFile(size);
      const fileId = `download-test-${name}-${Date.now()}`;
      const r2Key = `test-downloads/${fileId}`;
      
      return {
        fileId,
        r2Key,
        size,
        data
      };
    };

    // Pre-generate test files
    testFiles.set('small', createTestFile(TEST_FILE_SIZES.SMALL, 'small'));
    testFiles.set('medium', createTestFile(TEST_FILE_SIZES.MEDIUM, 'medium'));
    testFiles.set('large', createTestFile(TEST_FILE_SIZES.LARGE, 'large'));

    // Create mock R2 bucket with caching simulation
    mockBucket = {
      get: async (key: string, options?: R2GetOptions) => {
        // Check cache first
        const cacheKey = `${key}-${JSON.stringify(options || {})}`;
        const cached = downloadCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.cachedAt) < 30000) { // 30s cache
          // Simulate cache hit speed (very fast)
          await new Promise(resolve => setTimeout(resolve, 5));
          return cached.data;
        }

        // Find test file
        const testFile = Array.from(testFiles.values()).find(f => f.r2Key === key);
        if (!testFile) return null;

        // Simulate network latency based on file size and options
        let latency = 50 + (testFile.size / (1024 * 1024)) * 100; // 50ms base + size-based
        
        // Range requests are faster
        if (options?.range) {
          const rangeSize = options.range.length || testFile.size - options.range.offset;
          latency = 30 + (rangeSize / (1024 * 1024)) * 50;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.min(latency, 2000)));

        // Create mock R2ObjectBody
        let responseData = testFile.data;
        let responseSize = testFile.size;
        
        if (options?.range) {
          const { offset, length } = options.range;
          const endOffset = length ? offset + length : testFile.size;
          responseData = testFile.data.slice(offset, endOffset);
          responseSize = responseData.byteLength;
        }

        const mockR2Object: R2ObjectBody = {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(responseData);
              controller.close();
            }
          }),
          bodyUsed: false,
          arrayBuffer: async () => responseData.buffer.slice(responseData.byteOffset, responseData.byteOffset + responseData.byteLength),
          text: async () => new TextDecoder().decode(responseData),
          json: async () => JSON.parse(new TextDecoder().decode(responseData)),
          blob: async () => new Blob([responseData]),
          size: responseSize,
          etag: `etag-${testFile.fileId}`,
          httpEtag: `"etag-${testFile.fileId}"`,
          uploaded: new Date(),
          checksums: {},
          httpMetadata: {
            contentType: 'application/octet-stream',
            cacheControl: 'private, max-age=3600'
          },
          customMetadata: {
            originalName: `test-${testFile.size}.bin`,
            userId: TEST_USER_ID
          },
          range: options?.range,
          writeHttpMetadata: () => {}
        };

        // Cache the result
        downloadCache.set(cacheKey, { data: mockR2Object, cachedAt: Date.now() });
        
        return mockR2Object;
      },
      head: async (key: string) => {
        const testFile = Array.from(testFiles.values()).find(f => f.r2Key === key);
        if (!testFile) return null;

        await new Promise(resolve => setTimeout(resolve, 20)); // Head request latency
        
        return {
          size: testFile.size,
          etag: `etag-${testFile.fileId}`,
          httpEtag: `"etag-${testFile.fileId}"`,
          uploaded: new Date(),
          checksums: {},
          httpMetadata: {
            contentType: 'application/octet-stream'
          },
          customMetadata: {
            originalName: `test-${testFile.size}.bin`,
            userId: TEST_USER_ID
          },
          writeHttpMetadata: () => {}
        } as R2Object;
      }
    } as R2Bucket;

    // Create mock D1 database with file records
    mockDb = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          run: async () => ({ success: true, meta: { changes: 1 } }),
          first: async () => {
            if (sql.includes('SELECT r2_key, filename')) {
              const fileId = params[0] as string;
              const testFile = Array.from(testFiles.values()).find(f => f.fileId === fileId);
              
              if (testFile) {
                return {
                  r2_key: testFile.r2Key,
                  filename: `test-${testFile.size}.bin`,
                  mime_type: 'application/octet-stream',
                  file_size: testFile.size
                };
              }
            }
            return null;
          },
          all: async () => ({ results: [] })
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

  describe('Standard Download Performance', () => {
    it('should download 512KB file under 500ms', async () => {
      const testFile = testFiles.get('small')!;
      
      const config: BenchmarkConfig = {
        testRuns: 10,
        warmupRuns: 3,
        timeout: 5000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          // Consume the stream to measure actual download time
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        testFile.size,
        config
      );

      benchmark.printReport(metrics, '512KB Download', testFile.size);
      console.log(`⚡ Small file throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.SMALL_DOWNLOAD,
        '512KB Download (Lightning Fast!)'
      );

      expect(metrics.successRate).toBeGreaterThan(97);
      expect(metrics.avgResponseTime).toBeLessThan(500);
    }, 30000);

    it('should download 5MB file under 2 seconds (Rainbow Dash target!)', async () => {
      const testFile = testFiles.get('medium')!;
      
      const config: BenchmarkConfig = {
        testRuns: 5,
        warmupRuns: 2,
        timeout: 10000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        testFile.size,
        config
      );

      benchmark.printReport(metrics, '5MB Download', testFile.size);
      console.log(`🌈 Medium file throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.MEDIUM_DOWNLOAD,
        '5MB Download (Rainbow Dash Speed!)'
      );

      expect(metrics.successRate).toBeGreaterThan(95);
      expect(metrics.avgResponseTime).toBeLessThan(2000); // Hard 2s limit
    }, 60000);

    it('should download 20MB file efficiently', async () => {
      const testFile = testFiles.get('large')!;
      
      const config: BenchmarkConfig = {
        testRuns: 3,
        warmupRuns: 1,
        timeout: 15000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        testFile.size,
        config
      );

      benchmark.printReport(metrics, '20MB Download', testFile.size);
      console.log(`🚀 Large file throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.LARGE_DOWNLOAD,
        '20MB Download'
      );

      expect(metrics.successRate).toBeGreaterThan(90);
    }, 60000);
  });

  describe('Cached Download Performance', () => {
    it('should serve cached downloads in under 200ms', async () => {
      const testFile = testFiles.get('medium')!;
      
      // First download to warm cache
      await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
      
      const config: BenchmarkConfig = {
        testRuns: 8,
        warmupRuns: 2,
        timeout: 5000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Cached 5MB Download');
      console.log(`💨 Cache hit performance: ${metrics.avgResponseTime.toFixed(2)}ms avg`);
      
      expect(metrics.successRate).toBeGreaterThan(98);
      expect(metrics.avgResponseTime).toBeLessThan(200); // Cache should be super fast
      expect(metrics.maxResponseTime).toBeLessThan(500); // Even max should be reasonable
    }, 30000);

    it('should handle cache misses gracefully', async () => {
      // Clear cache first
      downloadCache.clear();
      
      const testFile = testFiles.get('small')!;
      
      const config: BenchmarkConfig = {
        testRuns: 5,
        warmupRuns: 1,
        timeout: 5000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Cache Miss Downloads');
      
      expect(metrics.successRate).toBeGreaterThan(95);
      // Should be slower than cached but still reasonable
      expect(metrics.avgResponseTime).toBeLessThan(1000);
    }, 30000);
  });

  describe('Range Request Performance', () => {
    it('should handle range requests efficiently', async () => {
      const testFile = testFiles.get('large')!;
      
      const config: BenchmarkConfig = {
        testRuns: 6,
        warmupRuns: 2,
        timeout: 5000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          // Request first 1MB of the file
          const result = await r2Service.downloadFile(
            testFile.fileId, 
            TEST_USER_ID,
            { range: 'bytes=0-1048575' } // First 1MB
          );
          expect(result).toBeTruthy();
          if (result) {
            const data = await result.arrayBuffer();
            expect(data.byteLength).toBe(1048576); // 1MB
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Range Request (1MB from 20MB file)');
      
      expect(metrics.successRate).toBeGreaterThan(95);
      expect(metrics.avgResponseTime).toBeLessThan(800); // Range requests should be fast
    }, 30000);

    it('should handle multiple range requests efficiently', async () => {
      const testFile = testFiles.get('medium')!;
      const ranges = [
        'bytes=0-524287',        // First 512KB
        'bytes=1048576-1572863', // Middle 512KB  
        'bytes=4194304-4718591'  // Last 512KB
      ];
      
      let rangeIndex = 0;
      const config: BenchmarkConfig = {
        testRuns: 6,
        warmupRuns: 1,
        timeout: 5000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          const range = ranges[rangeIndex % ranges.length];
          rangeIndex++;
          
          const result = await r2Service.downloadFile(
            testFile.fileId, 
            TEST_USER_ID,
            { range }
          );
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Multiple Range Requests');
      
      expect(metrics.successRate).toBeGreaterThan(95);
      expect(metrics.avgResponseTime).toBeLessThan(600);
    }, 30000);
  });

  describe('Concurrent Download Performance', () => {
    it('should handle concurrent downloads efficiently', async () => {
      const testFiles_array = Array.from(testFiles.values());
      
      const config: BenchmarkConfig = {
        testRuns: 12, // 12 total downloads
        concurrency: 4, // 4 concurrent
        timeout: 10000
      };

      let fileIndex = 0;
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        async () => {
          const testFile = testFiles_array[fileIndex % testFiles_array.length];
          fileIndex++;
          
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Concurrent Downloads (4x concurrent)');
      console.log(`📊 Completed downloads: ${results.length}`);
      
      expect(metrics.successRate).toBeGreaterThan(90);
      expect(results.length).toBeGreaterThan(8); // Most should succeed
    }, 60000);

    it('should maintain performance under download stress', async () => {
      const testFile = testFiles.get('small')!;
      
      const config: BenchmarkConfig = {
        testRuns: 20, // Many rapid downloads
        warmupRuns: 2,
        timeout: 8000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Download Stress Test (20x rapid downloads)');
      
      expect(metrics.successRate).toBeGreaterThan(85);
      expect(metrics.avgResponseTime).toBeLessThan(1500); // Should stay reasonable
    }, 60000);
  });

  describe('Download Error Handling', () => {
    it('should handle non-existent files gracefully', async () => {
      const config: BenchmarkConfig = {
        testRuns: 5,
        warmupRuns: 1,
        timeout: 3000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          const result = await r2Service.downloadFile('non-existent-file', TEST_USER_ID);
          expect(result).toBeNull();
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Non-existent File Handling');
      
      expect(metrics.successRate).toBe(100); // Should "succeed" at returning null
      expect(metrics.avgResponseTime).toBeLessThan(500); // Should fail fast
    }, 20000);

    it('should handle network simulation gracefully', async () => {
      // Clear cache to force fresh downloads
      downloadCache.clear();
      
      const testFile = testFiles.get('medium')!;
      
      const config: BenchmarkConfig = {
        testRuns: 3,
        warmupRuns: 1,
        timeout: 8000
      };

      const { metrics } = await benchmark.benchmark(
        async () => {
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          expect(result).toBeTruthy();
          if (result) {
            await result.arrayBuffer();
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Network Simulation Downloads');
      
      expect(metrics.successRate).toBeGreaterThan(80);
    }, 30000);
  });
});