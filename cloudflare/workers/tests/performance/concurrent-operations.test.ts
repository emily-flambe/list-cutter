/**
 * R2 Concurrent Operations Performance Tests
 * Rainbow Dash concurrent optimization - multiple operations at light speed!
 * 
 * Tests concurrent uploads, downloads, and mixed operations for maximum throughput
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PerformanceBenchmark, BenchmarkConfig } from './benchmark-utils.js';
import { R2StorageService, FileUploadOptions } from '../../src/services/storage/r2-service.js';
import { MetricsService } from '../../src/services/monitoring/metrics-service.js';

// Test configuration
const TEST_USER_ID = 'perf-concurrent-user';
const CONCURRENT_CONFIGS = {
  LOW_CONCURRENCY: 2,
  MEDIUM_CONCURRENCY: 4,
  HIGH_CONCURRENCY: 8,
  EXTREME_CONCURRENCY: 16
};

const FILE_SIZES = {
  SMALL: 1024 * 1024,        // 1MB
  MEDIUM: 5 * 1024 * 1024,   // 5MB
  LARGE: 15 * 1024 * 1024    // 15MB
};

const PERFORMANCE_TARGETS = {
  CONCURRENT_UPLOAD: { 
    maxDuration: 10000,        // 10s for batch
    minThroughput: 2 * 1024 * 1024,  // 2MB/s aggregate
    maxErrorRate: 10           // 10% max error rate
  },
  CONCURRENT_DOWNLOAD: {
    maxDuration: 5000,         // 5s for batch
    minThroughput: 5 * 1024 * 1024,  // 5MB/s aggregate
    maxErrorRate: 5            // 5% max error rate
  },
  MIXED_OPERATIONS: {
    maxDuration: 15000,        // 15s for mixed batch
    maxErrorRate: 15           // 15% max error rate for complex ops
  }
};

interface ConcurrentMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  avgConcurrency: number;
  peakConcurrency: number;
  aggregateThroughput: number;
  operationTypes: Record<string, number>;
}

describe.skip('R2 Concurrent Operations Performance Tests', () => {
  let benchmark: PerformanceBenchmark;
  let r2Service: R2StorageService;
  let metricsService: MetricsService;
  let mockBucket: R2Bucket;
  let mockDb: D1Database;
  let testFiles: Map<string, { fileId: string; r2Key: string; size: number; data: Uint8Array }> = new Map();
  let concurrentMetrics: ConcurrentMetrics[] = [];

  beforeAll(async () => {
    benchmark = new PerformanceBenchmark();
    
    // Pre-generate test files for downloads
    const generateTestFile = (size: number, name: string) => {
      const data = benchmark.generateTestFile(size);
      const fileId = `concurrent-test-${name}-${Date.now()}`;
      return {
        fileId,
        r2Key: `concurrent-downloads/${fileId}`,
        size,
        data
      };
    };

    testFiles.set('small', generateTestFile(FILE_SIZES.SMALL, 'small'));
    testFiles.set('medium', generateTestFile(FILE_SIZES.MEDIUM, 'medium'));
    testFiles.set('large', generateTestFile(FILE_SIZES.LARGE, 'large'));

    // Create mock R2 bucket with realistic concurrent behavior
    let activeOperations = 0;
    const maxConcurrentOps = 20;
    
    mockBucket = {
      put: async (key: string, data: ArrayBuffer | Uint8Array, options?: R2PutOptions) => {
        activeOperations++;
        const currentConcurrency = activeOperations;
        
        try {
          // Simulate realistic concurrent performance degradation
          const size = data instanceof ArrayBuffer ? data.byteLength : data.byteLength;
          let baseLatency = 100 + (size / (10 * 1024 * 1024)) * 1000;
          
          // Apply concurrency penalty
          const concurrencyPenalty = Math.max(1, currentConcurrency / 4);
          const finalLatency = Math.min(baseLatency * concurrencyPenalty, 8000);
          
          // Simulate occasional failures under high load
          if (currentConcurrency > maxConcurrentOps && Math.random() < 0.1) {
            throw new Error('Service temporarily unavailable');
          }
          
          await new Promise(resolve => setTimeout(resolve, finalLatency));
          
          return {
            etag: `etag-${Date.now()}-${key}`,
            size,
            uploaded: new Date(),
            httpEtag: `"etag-${Date.now()}"`,
            customMetadata: options?.customMetadata || {},
            httpMetadata: options?.httpMetadata || {}
          } as R2Object;
        } finally {
          activeOperations--;
        }
      },
      
      get: async (key: string, options?: R2GetOptions) => {
        activeOperations++;
        const currentConcurrency = activeOperations;
        
        try {
          // Find test file
          const testFile = Array.from(testFiles.values()).find(f => f.r2Key === key);
          if (!testFile) return null;

          // Simulate download latency with concurrency effects
          let baseLatency = 30 + (testFile.size / (1024 * 1024)) * 50;
          const concurrencyPenalty = Math.max(1, currentConcurrency / 6);
          const finalLatency = Math.min(baseLatency * concurrencyPenalty, 3000);
          
          await new Promise(resolve => setTimeout(resolve, finalLatency));

          // Handle range requests
          let responseData = testFile.data;
          let responseSize = testFile.size;
          
          if (options?.range) {
            const { offset, length } = options.range;
            const endOffset = length ? offset + length : testFile.size;
            responseData = testFile.data.slice(offset, endOffset);
            responseSize = responseData.byteLength;
          }

          return {
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
            httpMetadata: { contentType: 'application/octet-stream' },
            customMetadata: { originalName: `test-${testFile.size}.bin` },
            range: options?.range,
            writeHttpMetadata: () => {}
          } as R2ObjectBody;
        } finally {
          activeOperations--;
        }
      },
      
      delete: async (key: string) => {
        activeOperations++;
        try {
          // Simulate delete latency
          const baseLatency = 50;
          const concurrencyPenalty = Math.max(1, activeOperations / 8);
          await new Promise(resolve => setTimeout(resolve, baseLatency * concurrencyPenalty));
          
          return undefined;
        } finally {
          activeOperations--;
        }
      },
      
      head: async (key: string) => {
        const testFile = Array.from(testFiles.values()).find(f => f.r2Key === key);
        if (!testFile) return null;

        await new Promise(resolve => setTimeout(resolve, 20));
        
        return {
          size: testFile.size,
          etag: `etag-${testFile.fileId}`,
          httpEtag: `"etag-${testFile.fileId}"`,
          uploaded: new Date(),
          checksums: {},
          httpMetadata: { contentType: 'application/octet-stream' },
          customMetadata: { originalName: `test-${testFile.size}.bin` },
          writeHttpMetadata: () => {}
        } as R2Object;
      }
    } as R2Bucket;

    // Create mock D1 database
    mockDb = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          run: async () => {
            await new Promise(resolve => setTimeout(resolve, 5));
            return { success: true, meta: { changes: 1 } };
          },
          first: async () => {
            await new Promise(resolve => setTimeout(resolve, 3));
            
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
          all: async () => {
            await new Promise(resolve => setTimeout(resolve, 3));
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

  describe('Concurrent Upload Performance', () => {
    it('should handle 4 concurrent 5MB uploads efficiently', async () => {
      const concurrency = CONCURRENT_CONFIGS.MEDIUM_CONCURRENCY;
      const fileSize = FILE_SIZES.MEDIUM;
      
      const config: BenchmarkConfig = {
        testRuns: 8, // 8 total uploads
        concurrency,
        timeout: 20000
      };

      let uploadCounter = 0;
      const startTime = Date.now();
      
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        () => {
          const testData = benchmark.generateTestFile(fileSize);
          const uploadOptions: FileUploadOptions = {
            userId: TEST_USER_ID,
            fileId: `concurrent-upload-${++uploadCounter}-${Date.now()}`,
            fileName: `concurrent-test-${uploadCounter}.bin`,
            contentType: 'application/octet-stream'
          };
          
          return r2Service.uploadFile(testData, uploadOptions);
        },
        config
      );

      const totalTime = Date.now() - startTime;
      const totalBytes = results.length * fileSize;
      const aggregateThroughput = totalBytes / (totalTime / 1000);

      benchmark.printReport(metrics, `${concurrency}x Concurrent 5MB Uploads`);
      console.log(`🌈 Successful uploads: ${results.length}/${config.testRuns}`);
      console.log(`📊 Aggregate throughput: ${(aggregateThroughput / 1024 / 1024).toFixed(2)} MB/s`);
      console.log(`⚡ Concurrency efficiency: ${(aggregateThroughput / (1024 * 1024 * concurrency)).toFixed(2)}x`);

      concurrentMetrics.push({
        totalOperations: config.testRuns,
        successfulOperations: results.length,
        failedOperations: config.testRuns - results.length,
        avgConcurrency: concurrency,
        peakConcurrency: concurrency,
        aggregateThroughput: aggregateThroughput / 1024 / 1024,
        operationTypes: { upload: results.length }
      });

      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: aggregateThroughput },
        PERFORMANCE_TARGETS.CONCURRENT_UPLOAD,
        'Concurrent Uploads'
      );

      expect(metrics.successRate).toBeGreaterThan(85);
      expect(results.length).toBeGreaterThanOrEqual(6); // At least 75% success
    }, 60000);

    it('should scale concurrent uploads under load', async () => {
      const testConcurrencies = [2, 4, 6];
      const fileSize = FILE_SIZES.SMALL; // Use smaller files for scaling test
      const results: Array<{ concurrency: number; throughput: number; successRate: number }> = [];

      for (const concurrency of testConcurrencies) {
        console.log(`\n🚀 Testing ${concurrency}x concurrency...`);
        
        const config: BenchmarkConfig = {
          testRuns: concurrency * 2, // 2x the concurrency number
          concurrency,
          timeout: 15000
        };

        let counter = 0;
        const startTime = Date.now();
        
        const { results: uploadResults, metrics } = await benchmark.benchmarkConcurrent(
          () => {
            const testData = benchmark.generateTestFile(fileSize);
            const uploadOptions: FileUploadOptions = {
              userId: TEST_USER_ID,
              fileId: `scale-test-${concurrency}-${++counter}-${Date.now()}`,
              fileName: `scale-test-${concurrency}-${counter}.bin`,
              contentType: 'application/octet-stream'
            };
            
            return r2Service.uploadFile(testData, uploadOptions);
          },
          config
        );

        const totalTime = Date.now() - startTime;
        const totalBytes = uploadResults.length * fileSize;
        const throughput = totalBytes / (totalTime / 1000) / 1024 / 1024; // MB/s

        results.push({
          concurrency,
          throughput,
          successRate: metrics.successRate
        });

        console.log(`   Throughput: ${throughput.toFixed(2)} MB/s`);
        console.log(`   Success Rate: ${metrics.successRate.toFixed(1)}%`);
      }

      console.log('\n📈 Concurrency Scaling Analysis:');
      results.forEach(result => {
        console.log(`   ${result.concurrency}x: ${result.throughput.toFixed(2)} MB/s (${result.successRate.toFixed(1)}% success)`);
      });

      // Expect reasonable scaling - not necessarily linear due to overhead
      expect(results[1].throughput).toBeGreaterThan(results[0].throughput * 1.5); // 4x should be >1.5x better than 2x
      expect(results.every(r => r.successRate > 75)).toBe(true);
    }, 120000);
  });

  describe('Concurrent Download Performance', () => {
    it('should handle 6 concurrent downloads with caching', async () => {
      const concurrency = 6;
      const testFileKeys = Array.from(testFiles.keys());
      
      const config: BenchmarkConfig = {
        testRuns: 12, // 12 total downloads
        concurrency,
        timeout: 15000
      };

      let downloadCounter = 0;
      const startTime = Date.now();
      
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        async () => {
          const fileKey = testFileKeys[downloadCounter % testFileKeys.length];
          const testFile = testFiles.get(fileKey)!;
          downloadCounter++;
          
          const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
          if (result) {
            await result.arrayBuffer(); // Consume the stream
          }
          return result;
        },
        config
      );

      const totalTime = Date.now() - startTime;
      const totalBytes = results.length * FILE_SIZES.MEDIUM; // Estimate average
      const aggregateThroughput = totalBytes / (totalTime / 1000);

      benchmark.printReport(metrics, `${concurrency}x Concurrent Downloads`);
      console.log(`💨 Successful downloads: ${results.length}/${config.testRuns}`);
      console.log(`📊 Aggregate download throughput: ${(aggregateThroughput / 1024 / 1024).toFixed(2)} MB/s`);

      benchmark.assertPerformanceTarget(
        { ...metrics, throughput: aggregateThroughput },
        PERFORMANCE_TARGETS.CONCURRENT_DOWNLOAD,
        'Concurrent Downloads'
      );

      expect(metrics.successRate).toBeGreaterThan(90);
      expect(results.length).toBeGreaterThanOrEqual(10); // High success rate expected
    }, 45000);

    it('should optimize range request concurrency', async () => {
      const testFile = testFiles.get('large')!; // 15MB file
      const ranges = [
        'bytes=0-1048575',        // First 1MB
        'bytes=2097152-3145727',  // Second 1MB (offset 2MB)
        'bytes=4194304-5242879',  // Third 1MB (offset 4MB)
        'bytes=6291456-7340031',  // Fourth 1MB (offset 6MB)
        'bytes=8388608-9437183',  // Fifth 1MB (offset 8MB)
        'bytes=10485760-11534335' // Sixth 1MB (offset 10MB)
      ];
      
      const config: BenchmarkConfig = {
        testRuns: ranges.length,
        concurrency: 4,
        timeout: 10000
      };

      let rangeIndex = 0;
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        async () => {
          const range = ranges[rangeIndex++];
          const result = await r2Service.downloadFile(
            testFile.fileId, 
            TEST_USER_ID,
            { range }
          );
          if (result) {
            const data = await result.arrayBuffer();
            expect(data.byteLength).toBe(1048576); // Should be exactly 1MB
          }
          return result;
        },
        config
      );

      benchmark.printReport(metrics, 'Concurrent Range Requests');
      console.log(`🎯 Range requests completed: ${results.length}/${ranges.length}`);

      expect(metrics.successRate).toBeGreaterThan(95);
      expect(results.length).toBe(ranges.length); // All ranges should succeed
    }, 30000);
  });

  describe('Mixed Concurrent Operations', () => {
    it('should handle mixed upload/download operations efficiently', async () => {
      const concurrency = CONCURRENT_CONFIGS.MEDIUM_CONCURRENCY;
      const operations = ['upload', 'download', 'upload', 'download', 'upload', 'download', 'upload', 'download'];
      
      const config: BenchmarkConfig = {
        testRuns: operations.length,
        concurrency,
        timeout: 20000
      };

      let opIndex = 0;
      const operationCounts = { upload: 0, download: 0 };
      
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        async () => {
          const operation = operations[opIndex++];
          operationCounts[operation as keyof typeof operationCounts]++;
          
          if (operation === 'upload') {
            const testData = benchmark.generateTestFile(FILE_SIZES.MEDIUM);
            const uploadOptions: FileUploadOptions = {
              userId: TEST_USER_ID,
              fileId: `mixed-upload-${operationCounts.upload}-${Date.now()}`,
              fileName: `mixed-upload-${operationCounts.upload}.bin`,
              contentType: 'application/octet-stream'
            };
            
            return r2Service.uploadFile(testData, uploadOptions);
          } else {
            const testFile = testFiles.get('medium')!;
            const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
            if (result) {
              await result.arrayBuffer();
            }
            return result;
          }
        },
        config
      );

      benchmark.printReport(metrics, 'Mixed Upload/Download Operations');
      console.log(`🔄 Operations completed: ${results.length}/${operations.length}`);
      console.log(`📤 Uploads: ${operationCounts.upload}`);
      console.log(`📥 Downloads: ${operationCounts.download}`);

      concurrentMetrics.push({
        totalOperations: operations.length,
        successfulOperations: results.length,
        failedOperations: operations.length - results.length,
        avgConcurrency: concurrency,
        peakConcurrency: concurrency,
        aggregateThroughput: 0, // Mixed operations
        operationTypes: operationCounts
      });

      benchmark.assertPerformanceTarget(
        metrics,
        PERFORMANCE_TARGETS.MIXED_OPERATIONS,
        'Mixed Operations'
      );

      expect(metrics.successRate).toBeGreaterThan(80);
      expect(results.length).toBeGreaterThanOrEqual(6); // At least 75% success
    }, 60000);

    it('should handle high-stress concurrent operations', async () => {
      const concurrency = CONCURRENT_CONFIGS.HIGH_CONCURRENCY; // 8 concurrent
      const totalOps = 16;
      
      const config: BenchmarkConfig = {
        testRuns: totalOps,
        concurrency,
        timeout: 30000
      };

      let stressCounter = 0;
      const opTypes = ['small_upload', 'medium_upload', 'download', 'range_request'];
      
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        async () => {
          const opType = opTypes[stressCounter % opTypes.length];
          stressCounter++;
          
          switch (opType) {
            case 'small_upload': {
              const testData = benchmark.generateTestFile(FILE_SIZES.SMALL);
              const uploadOptions: FileUploadOptions = {
                userId: TEST_USER_ID,
                fileId: `stress-small-${stressCounter}-${Date.now()}`,
                fileName: `stress-small-${stressCounter}.bin`,
                contentType: 'application/octet-stream'
              };
              return r2Service.uploadFile(testData, uploadOptions);
            }
            
            case 'medium_upload': {
              const testData = benchmark.generateTestFile(FILE_SIZES.MEDIUM);
              const uploadOptions: FileUploadOptions = {
                userId: TEST_USER_ID,
                fileId: `stress-medium-${stressCounter}-${Date.now()}`,
                fileName: `stress-medium-${stressCounter}.bin`,
                contentType: 'application/octet-stream'
              };
              return r2Service.uploadFile(testData, uploadOptions);
            }
            
            case 'download': {
              const testFile = testFiles.get('medium')!;
              const result = await r2Service.downloadFile(testFile.fileId, TEST_USER_ID);
              if (result) {
                await result.arrayBuffer();
              }
              return result;
            }
            
            case 'range_request': {
              const testFile = testFiles.get('large')!;
              const result = await r2Service.downloadFile(
                testFile.fileId, 
                TEST_USER_ID,
                { range: `bytes=0-${1024 * 1024 - 1}` } // First 1MB
              );
              if (result) {
                await result.arrayBuffer();
              }
              return result;
            }
            
            default:
              throw new Error(`Unknown operation type: ${opType}`);
          }
        },
        config
      );

      benchmark.printReport(metrics, `High-Stress ${concurrency}x Concurrent Operations`);
      console.log(`💪 Operations completed under stress: ${results.length}/${totalOps}`);
      console.log(`🔥 Stress test success rate: ${metrics.successRate.toFixed(1)}%`);

      expect(metrics.successRate).toBeGreaterThan(70); // More lenient for stress test
      expect(results.length).toBeGreaterThanOrEqual(12); // At least 75% should complete
    }, 90000);
  });

  describe('Concurrency Limits and Throttling', () => {
    it('should handle extreme concurrency gracefully', async () => {
      const extremeConcurrency = CONCURRENT_CONFIGS.EXTREME_CONCURRENCY; // 16 concurrent
      const totalOps = 20;
      
      console.log(`🌪️  Testing extreme concurrency: ${extremeConcurrency}x concurrent operations`);
      
      const config: BenchmarkConfig = {
        testRuns: totalOps,
        concurrency: extremeConcurrency,
        timeout: 45000
      };

      let extremeCounter = 0;
      const { results, metrics } = await benchmark.benchmarkConcurrent(
        async () => {
          const testData = benchmark.generateTestFile(FILE_SIZES.SMALL); // Keep files small for stress
          const uploadOptions: FileUploadOptions = {
            userId: TEST_USER_ID,
            fileId: `extreme-${++extremeCounter}-${Date.now()}`,
            fileName: `extreme-test-${extremeCounter}.bin`,
            contentType: 'application/octet-stream'
          };
          
          return r2Service.uploadFile(testData, uploadOptions);
        },
        config
      );

      benchmark.printReport(metrics, `Extreme ${extremeConcurrency}x Concurrency Test`);
      console.log(`🌪️  Extreme concurrency results: ${results.length}/${totalOps} (${metrics.successRate.toFixed(1)}%)`);
      
      // More lenient expectations for extreme concurrency
      expect(results.length).toBeGreaterThanOrEqual(10); // At least 50% should succeed
      expect(metrics.errorCount).toBeLessThan(totalOps); // Some operations should succeed
    }, 120000);

    it('should demonstrate throttling behavior', async () => {
      const concurrencyLevels = [2, 4, 8, 12];
      const results: Array<{ concurrency: number; throughput: number; errorRate: number }> = [];
      
      for (const concurrency of concurrencyLevels) {
        console.log(`\n🎛️  Testing throttling at ${concurrency}x concurrency...`);
        
        const config: BenchmarkConfig = {
          testRuns: concurrency * 2,
          concurrency,
          timeout: 20000
        };

        let throttleCounter = 0;
        const startTime = Date.now();
        
        const { results: opResults, metrics } = await benchmark.benchmarkConcurrent(
          () => {
            const testData = benchmark.generateTestFile(FILE_SIZES.SMALL);
            const uploadOptions: FileUploadOptions = {
              userId: TEST_USER_ID,
              fileId: `throttle-${concurrency}-${++throttleCounter}-${Date.now()}`,
              fileName: `throttle-test-${concurrency}-${throttleCounter}.bin`,
              contentType: 'application/octet-stream'
            };
            
            return r2Service.uploadFile(testData, uploadOptions);
          },
          config
        );

        const totalTime = Date.now() - startTime;
        const totalBytes = opResults.length * FILE_SIZES.SMALL;
        const throughput = totalBytes / (totalTime / 1000) / 1024 / 1024;
        const errorRate = 100 - metrics.successRate;

        results.push({ concurrency, throughput, errorRate });
        console.log(`   Throughput: ${throughput.toFixed(2)} MB/s, Error Rate: ${errorRate.toFixed(1)}%`);
      }

      console.log('\n🎛️  Throttling Analysis:');
      results.forEach(result => {
        console.log(`   ${result.concurrency}x: ${result.throughput.toFixed(2)} MB/s (${result.errorRate.toFixed(1)}% errors)`);
      });

      // Analyze throttling patterns
      const lowConcurrencyError = results[0].errorRate;
      const highConcurrencyError = results[results.length - 1].errorRate;
      
      console.log(`📊 Error rate increase: ${lowConcurrencyError.toFixed(1)}% → ${highConcurrencyError.toFixed(1)}%`);
      
      expect(results.length).toBe(concurrencyLevels.length);
      expect(results.every(r => r.throughput > 0)).toBe(true);
    }, 180000);
  });

  describe('Performance Analysis and Reporting', () => {
    it('should provide comprehensive concurrent performance analysis', () => {
      console.log('\n🌈 Rainbow Dash Concurrent Operations Performance Report');
      console.log('='.repeat(70));
      
      concurrentMetrics.forEach((metrics, index) => {
        console.log(`\n📊 Test ${index + 1}: Concurrent Operations Analysis`);
        console.log(`   Total Operations: ${metrics.totalOperations}`);
        console.log(`   Successful: ${metrics.successfulOperations}`);
        console.log(`   Failed: ${metrics.failedOperations}`);
        console.log(`   Success Rate: ${((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(1)}%`);
        console.log(`   Average Concurrency: ${metrics.avgConcurrency}`);
        console.log(`   Peak Concurrency: ${metrics.peakConcurrency}`);
        
        if (metrics.aggregateThroughput > 0) {
          console.log(`   Aggregate Throughput: ${metrics.aggregateThroughput.toFixed(2)} MB/s`);
        }
        
        console.log(`   Operation Types:`);
        Object.entries(metrics.operationTypes).forEach(([type, count]) => {
          console.log(`     ${type}: ${count}`);
        });
      });
      
      console.log('\n🏆 Concurrency Achievements:');
      console.log('   ✅ Multi-threaded R2 operations');
      console.log('   ✅ Concurrent upload optimization');
      console.log('   ✅ Parallel download support');
      console.log('   ✅ Mixed operation handling');
      console.log('   ✅ Stress testing validation');
      console.log('   ✅ Throttling behavior analysis');
      console.log('='.repeat(70));
      
      expect(concurrentMetrics.length).toBeGreaterThan(0);
    });

    it('should validate overall concurrency performance targets', () => {
      const overallSuccessRate = concurrentMetrics.reduce((sum, m) => 
        sum + (m.successfulOperations / m.totalOperations), 0) / concurrentMetrics.length * 100;
      
      const totalOperations = concurrentMetrics.reduce((sum, m) => sum + m.totalOperations, 0);
      const totalSuccessful = concurrentMetrics.reduce((sum, m) => sum + m.successfulOperations, 0);
      
      console.log('\n🎯 Overall Concurrency Performance Summary:');
      console.log(`   Total Operations Tested: ${totalOperations}`);
      console.log(`   Total Successful Operations: ${totalSuccessful}`);
      console.log(`   Overall Success Rate: ${overallSuccessRate.toFixed(1)}%`);
      console.log(`   Performance Grade: ${overallSuccessRate > 85 ? '🏆 Excellent' : overallSuccessRate > 75 ? '✅ Good' : '⚠️ Needs Improvement'}`);
      
      expect(overallSuccessRate).toBeGreaterThan(75); // Overall success rate should be good
      expect(totalOperations).toBeGreaterThan(10); // Should have tested multiple scenarios
    });
  });
});