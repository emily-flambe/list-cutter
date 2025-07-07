import { StorageOperation } from '../../types/metrics.js';

/**
 * Cost calculation service for R2 storage operations
 * Implements Cloudflare R2 pricing tiers and free tier allowances
 */
export class CostCalculator {
  private db: D1Database;
  private pricingCache: Map<string, R2PricingTier[]> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION_MS = 1000 * 60 * 60; // 1 hour

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Calculate costs for storage operations
   */
  async calculateOperationCost(
    userId: string,
    operation: StorageOperation,
    fileSize: number,
    storageClass: 'Standard' | 'InfrequentAccess' = 'Standard',
    date: Date = new Date()
  ): Promise<OperationCost> {
    const metricType = this.getMetricTypeFromOperation(operation);
    const pricing = await this.getPricingForMetric(metricType, storageClass, date);
    
    // Get user's current usage for the month
    const monthlyUsage = await this.getMonthlyUsage(userId, date);
    
    // Calculate cost based on operation type
    switch (metricType) {
      case 'storage_bytes':
        return this.calculateStorageCost(fileSize, pricing, monthlyUsage, storageClass);
      
      case 'requests_class_a':
      case 'requests_class_b':
        return this.calculateRequestCost(1, pricing, monthlyUsage, metricType);
      
      case 'data_transfer_out':
        return this.calculateTransferCost(fileSize, pricing, monthlyUsage, 'data_transfer_out');
      
      case 'data_transfer_in':
        return this.calculateTransferCost(fileSize, pricing, monthlyUsage, 'data_transfer_in');
      
      default:
        return { unitCost: 0, totalCost: 0, freeTierUsed: 0, billableUnits: 0 };
    }
  }

  /**
   * Calculate daily storage costs for a user
   */
  async calculateDailyStorageCost(
    userId: string,
    date: Date = new Date()
  ): Promise<DailyStorageCost> {
    // Get user's current storage usage
    const storageUsage = await this.getCurrentStorageUsage(userId);
    
    // Get pricing for both storage classes
    const standardPricing = await this.getPricingForMetric('storage_bytes', 'Standard', date);
    const iaPricing = await this.getPricingForMetric('storage_bytes', 'InfrequentAccess', date);
    
    // Get monthly usage for free tier calculation
    const monthlyUsage = await this.getMonthlyUsage(userId, date);
    
    // Calculate costs
    const standardCost = this.calculateStorageCost(
      storageUsage.standardBytes,
      standardPricing,
      monthlyUsage,
      'Standard'
    );
    
    const iaCost = this.calculateStorageCost(
      storageUsage.iaBytes,
      iaPricing,
      monthlyUsage,
      'InfrequentAccess'
    );
    
    return {
      userId,
      date: date.toISOString().split('T')[0],
      standardStorageCost: standardCost.totalCost,
      iaStorageCost: iaCost.totalCost,
      totalStorageCost: standardCost.totalCost + iaCost.totalCost,
      standardBytes: storageUsage.standardBytes,
      iaBytes: storageUsage.iaBytes,
      totalBytes: storageUsage.totalBytes,
      freeTierUsed: standardCost.freeTierUsed + iaCost.freeTierUsed
    };
  }

  /**
   * Calculate monthly billing summary
   */
  async calculateMonthlyBilling(
    userId: string,
    month: Date
  ): Promise<MonthlyBilling> {
    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    
    // Get daily snapshots for the month
    const dailySnapshots = await this.db
      .prepare(`
        SELECT * FROM daily_storage_snapshots 
        WHERE user_id = ? AND snapshot_date >= ? AND snapshot_date <= ?
        ORDER BY snapshot_date
      `)
      .bind(userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
      .all();

    // Get operation metrics for the month
    const operationMetrics = await this.db
      .prepare(`
        SELECT 
          metric_type,
          storage_class,
          SUM(total_operations) as total_operations,
          SUM(total_bytes) as total_bytes,
          SUM(total_cost_usd) as total_cost_usd
        FROM storage_metrics 
        WHERE user_id = ? AND metric_date >= ? AND metric_date <= ?
        GROUP BY metric_type, storage_class
      `)
      .bind(userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0])
      .all();

    // Calculate average storage usage
    const avgStorageBytes = this.calculateAverageStorage(dailySnapshots.results as any[]);
    
    // Aggregate costs
    let totalCost = 0;
    let storageCost = 0;
    let classACost = 0;
    let classBCost = 0;
    let transferOutCost = 0;
    let transferInCost = 0;
    
    let totalClassAOps = 0;
    let totalClassBOps = 0;
    let totalTransferOut = 0;
    let totalTransferIn = 0;

    for (const metric of operationMetrics.results as any[]) {
      totalCost += metric.total_cost_usd;
      
      switch (metric.metric_type) {
        case 'storage_bytes':
          storageCost += metric.total_cost_usd;
          break;
        case 'requests_class_a':
          classACost += metric.total_cost_usd;
          totalClassAOps += metric.total_operations;
          break;
        case 'requests_class_b':
          classBCost += metric.total_cost_usd;
          totalClassBOps += metric.total_operations;
          break;
        case 'data_transfer_out':
          transferOutCost += metric.total_cost_usd;
          totalTransferOut += metric.total_bytes;
          break;
        case 'data_transfer_in':
          transferInCost += metric.total_cost_usd;
          totalTransferIn += metric.total_bytes;
          break;
      }
    }

    // Calculate free tier usage
    const freeTierUsage = await this.calculateFreeTierUsage(userId, month);

    return {
      userId,
      billingMonth: startDate.toISOString().split('T')[0],
      avgStorageBytes,
      totalClassAOperations: totalClassAOps,
      totalClassBOperations: totalClassBOps,
      totalBytesTransferredOut: totalTransferOut,
      totalBytesTransferredIn: totalTransferIn,
      storageCostUsd: storageCost,
      classACostUsd: classACost,
      classBCostUsd: classBCost,
      transferOutCostUsd: transferOutCost,
      transferInCostUsd: transferInCost,
      totalMonthlyCostUsd: totalCost,
      freeTierUsage
    };
  }

  /**
   * Update daily storage snapshot with cost calculations
   */
  async updateDailySnapshot(
    userId: string,
    date: Date = new Date()
  ): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    
    // Get current storage usage
    const storageUsage = await this.getCurrentStorageUsage(userId);
    
    // Get daily operations
    const dailyOps = await this.getDailyOperations(userId, date);
    
    // Calculate costs
    const dailyCost = await this.calculateDailyStorageCost(userId, date);
    
    // Calculate operation costs
    const classACost = await this.calculateOperationCost(
      userId, 'upload_single', 0, 'Standard', date
    );
    const classBCost = await this.calculateOperationCost(
      userId, 'download', 0, 'Standard', date
    );
    const transferOutCost = await this.calculateOperationCost(
      userId, 'download', dailyOps.bytesTransferredOut, 'Standard', date
    );
    const transferInCost = await this.calculateOperationCost(
      userId, 'upload_single', dailyOps.bytesTransferredIn, 'Standard', date
    );
    
    // Upsert daily snapshot
    await this.db
      .prepare(`
        INSERT INTO daily_storage_snapshots (
          user_id, snapshot_date, total_objects, total_bytes,
          standard_objects, standard_bytes, ia_objects, ia_bytes,
          class_a_operations, class_b_operations, 
          bytes_transferred_out, bytes_transferred_in,
          storage_cost_usd, class_a_cost_usd, class_b_cost_usd,
          transfer_out_cost_usd, transfer_in_cost_usd, total_daily_cost_usd
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
          total_objects = excluded.total_objects,
          total_bytes = excluded.total_bytes,
          standard_objects = excluded.standard_objects,
          standard_bytes = excluded.standard_bytes,
          ia_objects = excluded.ia_objects,
          ia_bytes = excluded.ia_bytes,
          class_a_operations = excluded.class_a_operations,
          class_b_operations = excluded.class_b_operations,
          bytes_transferred_out = excluded.bytes_transferred_out,
          bytes_transferred_in = excluded.bytes_transferred_in,
          storage_cost_usd = excluded.storage_cost_usd,
          class_a_cost_usd = excluded.class_a_cost_usd,
          class_b_cost_usd = excluded.class_b_cost_usd,
          transfer_out_cost_usd = excluded.transfer_out_cost_usd,
          transfer_in_cost_usd = excluded.transfer_in_cost_usd,
          total_daily_cost_usd = excluded.total_daily_cost_usd,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(
        userId, dateStr, storageUsage.totalObjects, storageUsage.totalBytes,
        storageUsage.standardObjects, storageUsage.standardBytes,
        storageUsage.iaObjects, storageUsage.iaBytes,
        dailyOps.classAOperations, dailyOps.classBOperations,
        dailyOps.bytesTransferredOut, dailyOps.bytesTransferredIn,
        dailyCost.totalStorageCost, classACost.totalCost * dailyOps.classAOperations,
        classBCost.totalCost * dailyOps.classBOperations,
        transferOutCost.totalCost, transferInCost.totalCost,
        dailyCost.totalStorageCost + 
        (classACost.totalCost * dailyOps.classAOperations) +
        (classBCost.totalCost * dailyOps.classBOperations) +
        transferOutCost.totalCost + transferInCost.totalCost
      )
      .run();
  }

  /**
   * Get pricing for a specific metric type
   */
  private async getPricingForMetric(
    metricType: string,
    storageClass: 'Standard' | 'InfrequentAccess',
    date: Date
  ): Promise<R2PricingTier[]> {
    const cacheKey = `${metricType}_${storageClass}_${date.toISOString().split('T')[0]}`;
    
    // Check cache
    if (this.pricingCache.has(cacheKey) && Date.now() < this.cacheExpiry) {
      return this.pricingCache.get(cacheKey)!;
    }
    
    const dateStr = date.toISOString().split('T')[0];
    const pricing = await this.db
      .prepare(`
        SELECT * FROM r2_pricing_tiers 
        WHERE metric_type = ? AND storage_class = ? 
        AND effective_from <= ? 
        AND (effective_until IS NULL OR effective_until > ?)
        ORDER BY min_units
      `)
      .bind(metricType, storageClass, dateStr, dateStr)
      .all();

    const tiers = pricing.results as R2PricingTier[];
    
    // Cache the result
    this.pricingCache.set(cacheKey, tiers);
    this.cacheExpiry = Date.now() + this.CACHE_DURATION_MS;
    
    return tiers;
  }

  /**
   * Calculate storage cost with tiered pricing
   */
  private calculateStorageCost(
    bytes: number,
    pricing: R2PricingTier[],
    monthlyUsage: MonthlyUsage,
    storageClass: 'Standard' | 'InfrequentAccess'
  ): OperationCost {
    if (bytes <= 0) {
      return { unitCost: 0, totalCost: 0, freeTierUsed: 0, billableUnits: 0 };
    }

    // Convert bytes to GB for pricing calculation
    const gb = bytes / (1024 * 1024 * 1024);
    let totalCost = 0;
    let freeTierUsed = 0;
    let remainingGb = gb;

    // Get current free tier usage for storage
    const currentFreeTierUsage = storageClass === 'Standard' 
      ? monthlyUsage.freeStorageUsedBytes 
      : 0; // IA doesn't have free tier

    for (const tier of pricing) {
      if (remainingGb <= 0) break;

      const tierMinGb = tier.min_units / (1024 * 1024 * 1024);
      const tierMaxGb = tier.max_units ? tier.max_units / (1024 * 1024 * 1024) : Infinity;
      
      // Calculate how much of this tier we can use
      const availableInTier = tierMaxGb - Math.max(tierMinGb, currentFreeTierUsage / (1024 * 1024 * 1024));
      const useInTier = Math.min(remainingGb, availableInTier);
      
      if (useInTier > 0) {
        if (tier.unit_cost_usd === 0) {
          // Free tier
          freeTierUsed += useInTier * (1024 * 1024 * 1024);
        } else {
          // Paid tier - daily cost is monthly cost / 30
          totalCost += (useInTier * tier.unit_cost_usd) / 30;
        }
        
        remainingGb -= useInTier;
      }
    }

    return {
      unitCost: pricing.length > 0 ? pricing[pricing.length - 1].unit_cost_usd : 0,
      totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
      freeTierUsed,
      billableUnits: gb - (freeTierUsed / (1024 * 1024 * 1024))
    };
  }

  /**
   * Calculate request cost with tiered pricing
   */
  private calculateRequestCost(
    requests: number,
    pricing: R2PricingTier[],
    monthlyUsage: MonthlyUsage,
    metricType: 'requests_class_a' | 'requests_class_b'
  ): OperationCost {
    if (requests <= 0) {
      return { unitCost: 0, totalCost: 0, freeTierUsed: 0, billableUnits: 0 };
    }

    let totalCost = 0;
    let freeTierUsed = 0;
    let remainingRequests = requests;

    // Get current free tier usage for requests
    const currentFreeTierUsage = metricType === 'requests_class_a' 
      ? monthlyUsage.freeClassAUsed 
      : monthlyUsage.freeClassBUsed;

    for (const tier of pricing) {
      if (remainingRequests <= 0) break;

      const tierMin = tier.min_units;
      const tierMax = tier.max_units || Infinity;
      
      // Calculate how much of this tier we can use
      const availableInTier = tierMax - Math.max(tierMin, currentFreeTierUsage);
      const useInTier = Math.min(remainingRequests, availableInTier);
      
      if (useInTier > 0) {
        if (tier.unit_cost_usd === 0) {
          // Free tier
          freeTierUsed += useInTier;
        } else {
          // Paid tier - cost per 1000 requests
          totalCost += (useInTier / 1000) * tier.unit_cost_usd;
        }
        
        remainingRequests -= useInTier;
      }
    }

    return {
      unitCost: pricing.length > 0 ? pricing[pricing.length - 1].unit_cost_usd : 0,
      totalCost: Math.round(totalCost * 10000) / 10000,
      freeTierUsed,
      billableUnits: requests - freeTierUsed
    };
  }

  /**
   * Calculate data transfer cost
   */
  private calculateTransferCost(
    bytes: number,
    pricing: R2PricingTier[],
    monthlyUsage: MonthlyUsage,
    metricType: 'data_transfer_out' | 'data_transfer_in'
  ): OperationCost {
    if (bytes <= 0 || metricType === 'data_transfer_in') {
      return { unitCost: 0, totalCost: 0, freeTierUsed: 0, billableUnits: 0 };
    }

    // Convert bytes to GB for pricing calculation
    const gb = bytes / (1024 * 1024 * 1024);
    let totalCost = 0;
    let freeTierUsed = 0;
    let remainingGb = gb;

    // Get current free tier usage for data transfer
    const currentFreeTierUsage = monthlyUsage.freeTransferOutUsedBytes / (1024 * 1024 * 1024);

    for (const tier of pricing) {
      if (remainingGb <= 0) break;

      const tierMinGb = tier.min_units / (1024 * 1024 * 1024);
      const tierMaxGb = tier.max_units ? tier.max_units / (1024 * 1024 * 1024) : Infinity;
      
      // Calculate how much of this tier we can use
      const availableInTier = tierMaxGb - Math.max(tierMinGb, currentFreeTierUsage);
      const useInTier = Math.min(remainingGb, availableInTier);
      
      if (useInTier > 0) {
        if (tier.unit_cost_usd === 0) {
          // Free tier
          freeTierUsed += useInTier * (1024 * 1024 * 1024);
        } else {
          // Paid tier
          totalCost += useInTier * tier.unit_cost_usd;
        }
        
        remainingGb -= useInTier;
      }
    }

    return {
      unitCost: pricing.length > 0 ? pricing[pricing.length - 1].unit_cost_usd : 0,
      totalCost: Math.round(totalCost * 10000) / 10000,
      freeTierUsed,
      billableUnits: gb - (freeTierUsed / (1024 * 1024 * 1024))
    };
  }

  /**
   * Get metric type from storage operation
   */
  private getMetricTypeFromOperation(operation: StorageOperation): string {
    switch (operation) {
      case 'upload_single':
      case 'upload_multipart':
      case 'upload_part':
      case 'complete_multipart':
        return 'requests_class_a';
      case 'download':
        return 'data_transfer_out';
      case 'delete':
      case 'list':
      case 'head':
      case 'abort_multipart':
        return 'requests_class_b';
      default:
        return 'requests_class_b';
    }
  }

  /**
   * Get user's current storage usage
   */
  private async getCurrentStorageUsage(userId: string): Promise<StorageUsage> {
    const result = await this.db
      .prepare(`
        SELECT 
          COUNT(*) as total_objects,
          SUM(file_size) as total_bytes,
          COUNT(CASE WHEN storage_class = 'Standard' THEN 1 END) as standard_objects,
          SUM(CASE WHEN storage_class = 'Standard' THEN file_size ELSE 0 END) as standard_bytes,
          COUNT(CASE WHEN storage_class = 'InfrequentAccess' THEN 1 END) as ia_objects,
          SUM(CASE WHEN storage_class = 'InfrequentAccess' THEN file_size ELSE 0 END) as ia_bytes
        FROM files 
        WHERE user_id = ?
      `)
      .bind(userId)
      .first();

    return {
      totalObjects: result?.total_objects || 0,
      totalBytes: result?.total_bytes || 0,
      standardObjects: result?.standard_objects || 0,
      standardBytes: result?.standard_bytes || 0,
      iaObjects: result?.ia_objects || 0,
      iaBytes: result?.ia_bytes || 0
    };
  }

  /**
   * Get user's monthly usage
   */
  private async getMonthlyUsage(userId: string, date: Date): Promise<MonthlyUsage> {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    
    const result = await this.db
      .prepare(`
        SELECT 
          COALESCE(free_storage_used_bytes, 0) as free_storage_used_bytes,
          COALESCE(free_class_a_used, 0) as free_class_a_used,
          COALESCE(free_class_b_used, 0) as free_class_b_used,
          COALESCE(free_transfer_out_used_bytes, 0) as free_transfer_out_used_bytes
        FROM monthly_billing_summary
        WHERE user_id = ? AND billing_month = ?
      `)
      .bind(userId, monthStartStr)
      .first();

    return {
      freeStorageUsedBytes: result?.free_storage_used_bytes || 0,
      freeClassAUsed: result?.free_class_a_used || 0,
      freeClassBUsed: result?.free_class_b_used || 0,
      freeTransferOutUsedBytes: result?.free_transfer_out_used_bytes || 0
    };
  }

  /**
   * Get daily operations for a user
   */
  private async getDailyOperations(userId: string, date: Date): Promise<DailyOperations> {
    const dateStr = date.toISOString().split('T')[0];
    
    const result = await this.db
      .prepare(`
        SELECT 
          SUM(CASE WHEN action IN ('upload', 'process') THEN 1 ELSE 0 END) as class_a_operations,
          SUM(CASE WHEN action IN ('download') THEN 1 ELSE 0 END) as class_b_operations,
          SUM(CASE WHEN action = 'download' THEN bytes_transferred ELSE 0 END) as bytes_transferred_out,
          SUM(CASE WHEN action = 'upload' THEN bytes_transferred ELSE 0 END) as bytes_transferred_in
        FROM file_access_logs
        WHERE user_id = ? AND DATE(created_at) = ?
      `)
      .bind(userId, dateStr)
      .first();

    return {
      classAOperations: result?.class_a_operations || 0,
      classBOperations: result?.class_b_operations || 0,
      bytesTransferredOut: result?.bytes_transferred_out || 0,
      bytesTransferredIn: result?.bytes_transferred_in || 0
    };
  }

  /**
   * Calculate average storage usage from daily snapshots
   */
  private calculateAverageStorage(snapshots: any[]): number {
    if (snapshots.length === 0) return 0;
    
    const totalBytes = snapshots.reduce((sum, snapshot) => sum + (snapshot.total_bytes || 0), 0);
    return Math.round(totalBytes / snapshots.length);
  }

  /**
   * Calculate free tier usage for a month
   */
  private async calculateFreeTierUsage(userId: string, month: Date): Promise<FreeTierUsage> {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    
    // Get aggregated usage from storage metrics
    const usage = await this.db
      .prepare(`
        SELECT 
          metric_type,
          SUM(total_bytes) as total_bytes,
          SUM(total_operations) as total_operations
        FROM storage_metrics
        WHERE user_id = ? AND metric_date >= ? AND metric_date <= ?
        GROUP BY metric_type
      `)
      .bind(
        userId,
        monthStart.toISOString().split('T')[0],
        monthEnd.toISOString().split('T')[0]
      )
      .all();

    const freeTierUsage: FreeTierUsage = {
      storageUsedBytes: 0,
      classAUsed: 0,
      classBUsed: 0,
      transferOutUsedBytes: 0
    };

    for (const metric of usage.results as any[]) {
      switch (metric.metric_type) {
        case 'storage_bytes':
          freeTierUsage.storageUsedBytes = Math.min(metric.total_bytes, 10 * 1024 * 1024 * 1024); // 10GB limit
          break;
        case 'requests_class_a':
          freeTierUsage.classAUsed = Math.min(metric.total_operations, 1000000); // 1M limit
          break;
        case 'requests_class_b':
          freeTierUsage.classBUsed = Math.min(metric.total_operations, 10000000); // 10M limit
          break;
        case 'data_transfer_out':
          freeTierUsage.transferOutUsedBytes = Math.min(metric.total_bytes, 10 * 1024 * 1024 * 1024); // 10GB limit
          break;
      }
    }

    return freeTierUsage;
  }
}

// Type definitions
interface R2PricingTier {
  tier_name: string;
  metric_type: string;
  storage_class: string;
  min_units: number;
  max_units: number | null;
  unit_cost_usd: number;
  region: string;
  effective_from: string;
  effective_until: string | null;
}

interface OperationCost {
  unitCost: number;
  totalCost: number;
  freeTierUsed: number;
  billableUnits: number;
}

interface DailyStorageCost {
  userId: string;
  date: string;
  standardStorageCost: number;
  iaStorageCost: number;
  totalStorageCost: number;
  standardBytes: number;
  iaBytes: number;
  totalBytes: number;
  freeTierUsed: number;
}

interface MonthlyBilling {
  userId: string;
  billingMonth: string;
  avgStorageBytes: number;
  totalClassAOperations: number;
  totalClassBOperations: number;
  totalBytesTransferredOut: number;
  totalBytesTransferredIn: number;
  storageCostUsd: number;
  classACostUsd: number;
  classBCostUsd: number;
  transferOutCostUsd: number;
  transferInCostUsd: number;
  totalMonthlyCostUsd: number;
  freeTierUsage: FreeTierUsage;
}

interface StorageUsage {
  totalObjects: number;
  totalBytes: number;
  standardObjects: number;
  standardBytes: number;
  iaObjects: number;
  iaBytes: number;
}

interface MonthlyUsage {
  freeStorageUsedBytes: number;
  freeClassAUsed: number;
  freeClassBUsed: number;
  freeTransferOutUsedBytes: number;
}

interface DailyOperations {
  classAOperations: number;
  classBOperations: number;
  bytesTransferredOut: number;
  bytesTransferredIn: number;
}

interface FreeTierUsage {
  storageUsedBytes: number;
  classAUsed: number;
  classBUsed: number;
  transferOutUsedBytes: number;
}