/**
 * R2 File Upload Performance Tests
 * Rainbow Dash speed optimization - gotta go fast!
 * 
 * Performance Targets:
 * - 10MB upload: < 5 seconds
 * - 100MB upload: < 30 seconds
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceBenchmark, BenchmarkConfig } from './benchmark-utils.js';
import { R2StorageService, FileUploadOptions } from '../../src/services/storage/r2-service.js';
import { MetricsService } from '../../src/services/monitoring/metrics-service.js';

// Test configuration
const TEST_USER_ID = 'perf-test-user';
const TEST_FILE_SIZES = {
  SMALL: 1024 * 1024,        // 1MB for baseline
  MEDIUM: 10 * 1024 * 1024,  // 10MB target: <5s
  LARGE: 100 * 1024 * 1024   // 100MB target: <30s
};

const PERFORMANCE_TARGETS = {
  SMALL_UPLOAD: { maxDuration: 2000, minThroughput: 512 * 1024 },     // 2s, 512KB/s
  MEDIUM_UPLOAD: { maxDuration: 5000, minThroughput: 2 * 1024 * 1024 }, // 5s, 2MB/s
  LARGE_UPLOAD: { maxDuration: 30000, minThroughput: 3.5 * 1024 * 1024 }, // 30s, 3.5MB/s
  MAX_ERROR_RATE: 5 // 5% max error rate
};

describe('R2 File Upload Performance Tests', () => {
  let benchmark: PerformanceBenchmark;
  let r2Service: R2StorageService;
  let metricsService: MetricsService;
  let mockBucket: R2Bucket;
  let mockDb: D1Database;

  beforeAll(async () => {
    benchmark = new PerformanceBenchmark();
    
    // Create mock R2 bucket for performance testing
    mockBucket = {
      put: async (key: string, data: ArrayBuffer | Uint8Array, options?: R2PutOptions) => {
        // Simulate network latency based on file size
        const size = data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
        const latency = Math.min(100 + (size / (10 * 1024 * 1024)) * 1000, 5000); // 100ms base + size-based
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
        await new Promise(resolve => setTimeout(resolve, 50)); // Setup latency
        return {
          uploadId: `upload-${Date.now()}-${key}`,
          complete: async (parts: R2UploadedPart[]) => {
            // Simulate completion time based on parts count
            await new Promise(resolve => setTimeout(resolve, parts.length * 10));
            const totalSize = parts.length * 5 * 1024 * 1024; // Assume 5MB parts
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

    // Create mock D1 database
    mockDb = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          run: async () => ({ success: true, meta: { changes: 1 } }),
          first: async () => null,
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

  describe('Single File Upload Performance', () => {
    it('should upload 1MB file within baseline performance', async () => {
      const testData = benchmark.generateTestFile(TEST_FILE_SIZES.SMALL);
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `perf-test-1mb-${Date.now()}`,
        fileName: 'test-1mb.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 5,
        warmupRuns: 2,
        timeout: 10000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        TEST_FILE_SIZES.SMALL,
        config
      );

      benchmark.printReport(metrics, '1MB Single Upload', TEST_FILE_SIZES.SMALL);
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.SMALL_UPLOAD,
        '1MB Upload'
      );

      expect(metrics.successRate).toBeGreaterThan(95);
      expect(metrics.avgResponseTime).toBeLessThan(PERFORMANCE_TARGETS.SMALL_UPLOAD.maxDuration);
    }, 60000);

    it('should upload 10MB file under 5 seconds (Rainbow Dash speed!)', async () => {
      const testData = benchmark.generateTestFile(TEST_FILE_SIZES.MEDIUM);
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `perf-test-10mb-${Date.now()}`,
        fileName: 'test-10mb.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 3,
        warmupRuns: 1,
        timeout: 15000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        TEST_FILE_SIZES.MEDIUM,
        config
      );

      benchmark.printReport(metrics, '10MB Single Upload', TEST_FILE_SIZES.MEDIUM);
      console.log(`🌈 10MB Throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.MEDIUM_UPLOAD,
        '10MB Upload (Rainbow Dash Target!)'
      );

      expect(metrics.successRate).toBeGreaterThan(95);
      expect(metrics.avgResponseTime).toBeLessThan(5000); // Hard 5s limit
    }, 60000);

    it('should upload CSV file efficiently', async () => {
      const csvData = benchmark.generateCSVTestFile(50000, 15); // ~50k rows
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `perf-test-csv-${Date.now()}`,
        fileName: 'test-large.csv',
        contentType: 'text/csv'
      };

      const config: BenchmarkConfig = {
        testRuns: 3,
        warmupRuns: 1,
        timeout: 20000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(csvData, uploadOptions),
        csvData.byteLength,
        config
      );

      benchmark.printReport(metrics, 'Large CSV Upload', csvData.byteLength);
      console.log(`📊 CSV size: ${(csvData.byteLength / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📈 CSV throughput: ${throughputMBps.toFixed(2)} MB/s`);

      expect(metrics.successRate).toBeGreaterThan(90);
      expect(throughputMBps).toBeGreaterThan(1); // At least 1 MB/s for CSV
    }, 60000);
  });

  describe('Multipart Upload Performance', () => {
    it('should upload 100MB file under 30 seconds using multipart', async () => {
      const testData = benchmark.generateTestFile(TEST_FILE_SIZES.LARGE);
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `perf-test-100mb-${Date.now()}`,
        fileName: 'test-100mb.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 2, // Fewer runs for large files
        warmupRuns: 1,
        timeout: 45000 // 45s timeout
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        TEST_FILE_SIZES.LARGE,
        config
      );

      benchmark.printReport(metrics, '100MB Multipart Upload', TEST_FILE_SIZES.LARGE);
      console.log(`🚀 100MB Throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: (throughputMBps * 1024 * 1024) },
        PERFORMANCE_TARGETS.LARGE_UPLOAD,
        '100MB Multipart Upload (Ultimate Speed!)'
      );

      expect(metrics.successRate).toBeGreaterThan(90);
      expect(metrics.avgResponseTime).toBeLessThan(30000); // Hard 30s limit
    }, 120000);

    it('should handle streaming upload efficiently', async () => {
      // Create a readable stream from test data
      const testData = benchmark.generateTestFile(20 * 1024 * 1024); // 20MB
      const stream = new ReadableStream({
        start(controller) {
          const chunkSize = 1024 * 1024; // 1MB chunks
          let offset = 0;
          
          const pump = () => {
            if (offset < testData.length) {
              const chunk = testData.slice(offset, offset + chunkSize);
              controller.enqueue(chunk);
              offset += chunkSize;
              setTimeout(pump, 10); // Simulate streaming delay
            } else {
              controller.close();
            }
          };
          
          pump();
        }
      });

      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `perf-test-stream-${Date.now()}`,
        fileName: 'test-stream.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 2,
        warmupRuns: 1,
        timeout: 30000
      };

      const { metrics } = await benchmark.benchmark(
        () => r2Service.uploadFile(stream, uploadOptions),
        config
      );

      benchmark.printReport(metrics, '20MB Streaming Upload');
      
      expect(metrics.successRate).toBeGreaterThan(90);
      expect(metrics.avgResponseTime).toBeLessThan(25000); // 25s for streaming
    }, 90000);
  });

  describe('Upload Stress Testing', () => {
    it('should maintain performance under rapid succession uploads', async () => {
      const testData = benchmark.generateTestFile(2 * 1024 * 1024); // 2MB files
      
      const config: BenchmarkConfig = {
        testRuns: 10, // 10 rapid uploads
        warmupRuns: 2,
        timeout: 10000
      };

      let fileCounter = 0;
      const { metrics } = await benchmark.benchmark(
        () => {
          const uploadOptions: FileUploadOptions = {
            userId: TEST_USER_ID,
            fileId: `perf-stress-${Date.now()}-${++fileCounter}`,
            fileName: `stress-test-${fileCounter}.bin`,
            contentType: 'application/octet-stream'
          };
          return r2Service.uploadFile(testData, uploadOptions);
        },
        config
      );

      benchmark.printReport(metrics, 'Rapid Succession Uploads (10x 2MB)');
      
      expect(metrics.successRate).toBeGreaterThan(85);
      expect(metrics.avgResponseTime).toBeLessThan(8000); // Should stay reasonable
    }, 120000);

    it('should handle mixed file sizes efficiently', async () => {
      const testSizes = [
        1024 * 1024,      // 1MB
        5 * 1024 * 1024,  // 5MB
        15 * 1024 * 1024, // 15MB
        3 * 1024 * 1024,  // 3MB
        8 * 1024 * 1024   // 8MB
      ];

      let sizeIndex = 0;
      const config: BenchmarkConfig = {
        testRuns: 5,
        warmupRuns: 1,
        timeout: 20000
      };

      const { metrics } = await benchmark.benchmark(
        () => {
          const size = testSizes[sizeIndex % testSizes.length];
          const testData = benchmark.generateTestFile(size);
          const uploadOptions: FileUploadOptions = {
            userId: TEST_USER_ID,
            fileId: `perf-mixed-${Date.now()}-${++sizeIndex}`,
            fileName: `mixed-test-${sizeIndex}.bin`,
            contentType: 'application/octet-stream'
          };
          return r2Service.uploadFile(testData, uploadOptions);
        },
        config
      );

      benchmark.printReport(metrics, 'Mixed File Sizes Upload');
      
      expect(metrics.successRate).toBeGreaterThan(90);
    }, 120000);
  });

  describe('Performance Degradation Testing', () => {
    it('should handle network simulation gracefully', async () => {
      // Simulate slower network by using random test data (more realistic compression)
      const testData = benchmark.generateRandomTestFile(5 * 1024 * 1024); // 5MB random
      const uploadOptions: FileUploadOptions = {
        userId: TEST_USER_ID,
        fileId: `perf-network-${Date.now()}`,
        fileName: 'test-network-sim.bin',
        contentType: 'application/octet-stream'
      };

      const config: BenchmarkConfig = {
        testRuns: 3,
        warmupRuns: 1,
        timeout: 15000
      };

      const { metrics, throughputMBps } = await benchmark.benchmarkFileOperation(
        () => r2Service.uploadFile(testData, uploadOptions),
        testData.byteLength,
        config
      );

      benchmark.printReport(metrics, '5MB Random Data Upload (Network Sim)', testData.byteLength);
      console.log(`🌐 Network simulation throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      expect(metrics.successRate).toBeGreaterThan(80);
      // More lenient timing for random data
      expect(metrics.avgResponseTime).toBeLessThan(12000);
    }, 60000);
  });
});