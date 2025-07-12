/**
 * Benchmark utilities for R2 storage performance testing
 * Rainbow Dash performance optimization toolkit
 */

export interface PerformanceMetrics {
  duration: number;           // Total time in milliseconds
  throughput: number;         // Bytes per second
  avgResponseTime: number;    // Average response time in ms
  minResponseTime: number;    // Minimum response time in ms
  maxResponseTime: number;    // Maximum response time in ms
  successRate: number;        // Percentage of successful operations
  errorCount: number;         // Number of failed operations
  memoryUsage?: number;       // Peak memory usage in bytes
}

export interface BenchmarkConfig {
  warmupRuns?: number;        // Number of warmup iterations
  testRuns: number;           // Number of test iterations
  concurrency?: number;       // Number of concurrent operations
  timeout?: number;           // Timeout in milliseconds
  targetDuration?: number;    // Target duration threshold in ms
  targetThroughput?: number;  // Target throughput in bytes/sec
}

export class PerformanceBenchmark {
  private metrics: number[] = [];
  private errors: Error[] = [];
  private startTime = 0;
  private endTime = 0;

  /**
   * Execute a performance benchmark with timing
   */
  async benchmark<T>(
    operation: () => Promise<T>,
    config: BenchmarkConfig
  ): Promise<{ result: T[]; metrics: PerformanceMetrics }> {
    const { warmupRuns = 2, testRuns, timeout = 30000 } = config;
    
    // Warmup phase
    console.log(`🔥 Warming up with ${warmupRuns} runs...`);
    for (let i = 0; i < warmupRuns; i++) {
      try {
        await this.timeoutWrapper(operation(), timeout);
      } catch (error) {
        console.warn(`Warmup run ${i + 1} failed:`, error);
      }
    }

    // Reset metrics for actual test
    this.reset();
    
    console.log(`🚀 Starting benchmark with ${testRuns} runs...`);
    const results: T[] = [];
    this.startTime = performance.now();

    // Execute test runs
    for (let i = 0; i < testRuns; i++) {
      const runStart = performance.now();
      try {
        const result = await this.timeoutWrapper(operation(), timeout);
        results.push(result);
        this.metrics.push(performance.now() - runStart);
      } catch (error) {
        this.errors.push(error as Error);
        this.metrics.push(performance.now() - runStart);
      }
    }

    this.endTime = performance.now();
    
    return {
      result: results,
      metrics: this.calculateMetrics()
    };
  }

  /**
   * Execute concurrent operations benchmark
   */
  async benchmarkConcurrent<T>(
    operation: () => Promise<T>,
    config: BenchmarkConfig
  ): Promise<{ results: T[]; metrics: PerformanceMetrics }> {
    const { concurrency = 4, testRuns, timeout = 30000 } = config;
    
    console.log(`🌈 Running ${testRuns} operations with ${concurrency} concurrent threads...`);
    
    this.reset();
    this.startTime = performance.now();
    
    const batches = Math.ceil(testRuns / concurrency);
    const results: T[] = [];
    
    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, testRuns - batch * concurrency);
      const promises: Promise<T>[] = [];
      
      for (let i = 0; i < batchSize; i++) {
        const runStart = performance.now();
        const promise = this.timeoutWrapper(operation(), timeout)
          .then(result => {
            this.metrics.push(performance.now() - runStart);
            return result;
          })
          .catch(error => {
            this.errors.push(error as Error);
            this.metrics.push(performance.now() - runStart);
            throw error;
          });
        promises.push(promise);
      }
      
      const batchResults = await Promise.allSettled(promises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      });
    }
    
    this.endTime = performance.now();
    
    return {
      results,
      metrics: this.calculateMetrics()
    };
  }

  /**
   * Benchmark file operation with size tracking
   */
  async benchmarkFileOperation<T>(
    operation: () => Promise<T>,
    fileSize: number,
    config: BenchmarkConfig
  ): Promise<{ results: T[]; metrics: PerformanceMetrics; throughputMBps: number }> {
    const { result, metrics } = await this.benchmark(operation, config);
    
    const throughputMBps = (fileSize * config.testRuns) / (1024 * 1024) / (metrics.duration / 1000);
    
    return {
      results: result,
      metrics,
      throughputMBps
    };
  }

  /**
   * Assert performance targets are met
   */
  assertPerformanceTarget(
    metrics: PerformanceMetrics,
    target: {
      maxDuration?: number;
      minThroughput?: number;
      maxErrorRate?: number;
    },
    operation: string
  ): void {
    if (target.maxDuration && metrics.avgResponseTime > target.maxDuration) {
      throw new Error(
        `🐌 ${operation} failed performance target! ` +
        `Average: ${metrics.avgResponseTime.toFixed(2)}ms > Target: ${target.maxDuration}ms`
      );
    }
    
    if (target.minThroughput && metrics.throughput < target.minThroughput) {
      throw new Error(
        `🐌 ${operation} throughput too low! ` +
        `Actual: ${(metrics.throughput / 1024 / 1024).toFixed(2)} MB/s < ` +
        `Target: ${(target.minThroughput / 1024 / 1024).toFixed(2)} MB/s`
      );
    }
    
    if (target.maxErrorRate) {
      const errorRate = (100 - metrics.successRate);
      if (errorRate > target.maxErrorRate) {
        throw new Error(
          `💥 ${operation} error rate too high! ` +
          `Actual: ${errorRate.toFixed(2)}% > Target: ${target.maxErrorRate}%`
        );
      }
    }
    
    console.log(`✅ ${operation} meets all performance targets!`);
  }

  /**
   * Generate test file data of specified size
   */
  generateTestFile(sizeInBytes: number): Uint8Array {
    console.log(`📄 Generating ${(sizeInBytes / 1024 / 1024).toFixed(2)} MB test file...`);
    
    // Use repeating pattern for predictable data
    const pattern = 'RainbowDash-PerformanceTest-';
    const patternBytes = new TextEncoder().encode(pattern);
    const result = new Uint8Array(sizeInBytes);
    
    for (let i = 0; i < sizeInBytes; i++) {
      result[i] = patternBytes[i % patternBytes.length];
    }
    
    return result;
  }

  /**
   * Generate random test file data (for real-world scenarios)
   */
  generateRandomTestFile(sizeInBytes: number): Uint8Array {
    console.log(`🎲 Generating ${(sizeInBytes / 1024 / 1024).toFixed(2)} MB random test file...`);
    
    const result = new Uint8Array(sizeInBytes);
    for (let i = 0; i < sizeInBytes; i++) {
      result[i] = Math.floor(Math.random() * 256);
    }
    
    return result;
  }

  /**
   * Create CSV file data for testing
   */
  generateCSVTestFile(rows: number, columns: number = 10): Uint8Array {
    console.log(`📊 Generating CSV with ${rows} rows and ${columns} columns...`);
    
    let csv = '';
    // Header
    csv += Array.from({ length: columns }, (_, i) => `column_${i + 1}`).join(',') + '\n';
    
    // Data rows
    for (let row = 0; row < rows; row++) {
      const rowData = Array.from({ length: columns }, (_, col) => 
        `data_${row}_${col}_${Math.random().toString(36).substring(2, 8)}`
      );
      csv += rowData.join(',') + '\n';
    }
    
    return new TextEncoder().encode(csv);
  }

  /**
   * Timeout wrapper for operations
   */
  private async timeoutWrapper<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Reset metrics for new benchmark
   */
  private reset(): void {
    this.metrics = [];
    this.errors = [];
    this.startTime = 0;
    this.endTime = 0;
  }

  /**
   * Calculate performance metrics from collected data
   */
  private calculateMetrics(): PerformanceMetrics {
    const totalDuration = this.endTime - this.startTime;
    const totalOps = this.metrics.length;
    const successfulOps = totalOps - this.errors.length;
    
    const avgResponseTime = this.metrics.reduce((a, b) => a + b, 0) / totalOps;
    const minResponseTime = Math.min(...this.metrics);
    const maxResponseTime = Math.max(...this.metrics);
    
    // Calculate bytes per second (assuming this will be set by caller)
    const throughput = 0; // Will be calculated by specific test methods
    
    return {
      duration: totalDuration,
      throughput,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      successRate: (successfulOps / totalOps) * 100,
      errorCount: this.errors.length
    };
  }

  /**
   * Print detailed performance report
   */
  printReport(metrics: PerformanceMetrics, operation: string, fileSize?: number): void {
    console.log(`\n🌈 Performance Report: ${operation}`);
    console.log('='.repeat(50));
    console.log(`⏱️  Total Duration: ${metrics.duration.toFixed(2)} ms`);
    console.log(`📊 Average Response: ${metrics.avgResponseTime.toFixed(2)} ms`);
    console.log(`⚡ Min Response: ${metrics.minResponseTime.toFixed(2)} ms`);
    console.log(`🐌 Max Response: ${metrics.maxResponseTime.toFixed(2)} ms`);
    console.log(`✅ Success Rate: ${metrics.successRate.toFixed(2)}%`);
    console.log(`💥 Error Count: ${metrics.errorCount}`);
    
    if (fileSize && metrics.throughput > 0) {
      console.log(`🚀 Throughput: ${(metrics.throughput / 1024 / 1024).toFixed(2)} MB/s`);
      console.log(`📁 File Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
    }
    
    console.log('='.repeat(50));
  }

  /**
   * Get current memory usage (if available)
   */
  getMemoryUsage(): number | undefined {
    // Note: In Cloudflare Workers, memory info is limited
    // This is a placeholder for potential future memory monitoring
    return undefined;
  }
}