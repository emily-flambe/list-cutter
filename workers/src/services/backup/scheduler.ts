import type { Env } from '../../types';
import { createBackupService } from './r2-backup';

export interface ScheduleConfig {
  bucketName: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  timezone: string;
  retentionDays: number;
  enabled: boolean;
}

export interface BackupSchedule {
  id: string;
  bucketName: string;
  schedule: string;
  nextRunTime: string;
  lastRunTime?: string;
  status: 'active' | 'paused' | 'error';
  failureCount: number;
  lastError?: string;
  created_at: string;
  updated_at: string;
}

export class BackupScheduler {
  private env: Env;
  private config: ScheduleConfig;

  constructor(env: Env, config: ScheduleConfig) {
    this.env = env;
    this.config = config;
  }

  /**
   * Initialize backup scheduler
   */
  async initializeScheduler(): Promise<void> {
    // Create or update backup schedule in database
    await this.env.DB.prepare(`
      INSERT OR REPLACE INTO backup_schedules (
        id, bucket_name, schedule_pattern, next_run_time, status, 
        failure_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      this.generateScheduleId(),
      this.config.bucketName,
      this.config.schedule,
      this.calculateNextRunTime(),
      'active',
      0,
      new Date().toISOString(),
      new Date().toISOString()
    ).run();
  }

  /**
   * Execute scheduled backup
   */
  async executeScheduledBackup(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Backup scheduler is disabled');
      return;
    }

    try {
      const backupService = createBackupService(this.env);
      
      // Log backup start
      console.log(`Starting scheduled backup for bucket: ${this.config.bucketName}`);
      
      // Execute backup
      await backupService.scheduleDailyBackup();
      
      // Update last run time
      await this.updateLastRunTime();
      
      // Reset failure count on success
      await this.resetFailureCount();
      
      console.log(`Scheduled backup completed for bucket: ${this.config.bucketName}`);
    } catch (error) {
      console.error('Scheduled backup failed:', error);
      await this.incrementFailureCount(error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Check if backup should run now
   */
  async shouldRunBackup(): Promise<boolean> {
    const schedule = await this.getSchedule();
    if (!schedule || schedule.status !== 'active') {
      return false;
    }

    const nextRunTime = new Date(schedule.nextRunTime);
    const now = new Date();
    
    return now >= nextRunTime;
  }

  /**
   * Get backup schedule from database
   */
  private async getSchedule(): Promise<BackupSchedule | null> {
    const result = await this.env.DB.prepare(`
      SELECT * FROM backup_schedules 
      WHERE bucket_name = ? AND schedule_pattern = ?
    `).bind(this.config.bucketName, this.config.schedule).first();

    return result as BackupSchedule | null;
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRunTime(): string {
    const now = new Date();
    let nextRun = new Date(now);

    switch (this.config.schedule) {
      case 'daily':
        nextRun.setDate(now.getDate() + 1);
        nextRun.setHours(2, 0, 0, 0); // Run at 2 AM
        break;
      case 'weekly':
        nextRun.setDate(now.getDate() + (7 - now.getDay())); // Next Sunday
        nextRun.setHours(2, 0, 0, 0);
        break;
      case 'monthly':
        nextRun.setMonth(now.getMonth() + 1, 1); // First day of next month
        nextRun.setHours(2, 0, 0, 0);
        break;
    }

    return nextRun.toISOString();
  }

  /**
   * Update last run time and calculate next run time
   */
  private async updateLastRunTime(): Promise<void> {
    const nextRunTime = this.calculateNextRunTime();
    
    await this.env.DB.prepare(`
      UPDATE backup_schedules 
      SET last_run_time = ?, next_run_time = ?, updated_at = ?
      WHERE bucket_name = ? AND schedule_pattern = ?
    `).bind(
      new Date().toISOString(),
      nextRunTime,
      new Date().toISOString(),
      this.config.bucketName,
      this.config.schedule
    ).run();
  }

  /**
   * Reset failure count on successful backup
   */
  private async resetFailureCount(): Promise<void> {
    await this.env.DB.prepare(`
      UPDATE backup_schedules 
      SET failure_count = 0, last_error = NULL, status = 'active', updated_at = ?
      WHERE bucket_name = ? AND schedule_pattern = ?
    `).bind(
      new Date().toISOString(),
      this.config.bucketName,
      this.config.schedule
    ).run();
  }

  /**
   * Increment failure count and update error
   */
  private async incrementFailureCount(error: string): Promise<void> {
    const schedule = await this.getSchedule();
    const failureCount = (schedule?.failureCount || 0) + 1;
    const status = failureCount >= 3 ? 'error' : 'active';

    await this.env.DB.prepare(`
      UPDATE backup_schedules 
      SET failure_count = ?, last_error = ?, status = ?, updated_at = ?
      WHERE bucket_name = ? AND schedule_pattern = ?
    `).bind(
      failureCount,
      error,
      status,
      new Date().toISOString(),
      this.config.bucketName,
      this.config.schedule
    ).run();
  }

  /**
   * Generate unique schedule ID
   */
  private generateScheduleId(): string {
    return `schedule_${this.config.bucketName}_${this.config.schedule}_${Date.now()}`;
  }
}

/**
 * Backup trigger integration for R2 operations
 */
export class BackupTrigger {
  private env: Env;
  private backupService: ReturnType<typeof createBackupService>;

  constructor(env: Env) {
    this.env = env;
    this.backupService = createBackupService(env);
  }

  /**
   * Trigger incremental backup after significant file operations
   */
  async triggerIncrementalBackup(reason: string): Promise<void> {
    try {
      // Check if we should trigger backup based on recent activity
      const shouldTrigger = await this.shouldTriggerBackup();
      
      if (!shouldTrigger) {
        console.log('Backup trigger skipped - not needed');
        return;
      }

      console.log(`Triggering incremental backup: ${reason}`);
      await this.backupService.createIncrementalBackup();
    } catch (error) {
      console.error('Backup trigger failed:', error);
      // Don't throw - backup failure shouldn't break main operations
    }
  }

  /**
   * Check if backup should be triggered
   */
  private async shouldTriggerBackup(): Promise<boolean> {
    // Get last backup time
    const lastBackup = await this.env.DB.prepare(`
      SELECT backup_date FROM r2_backups 
      WHERE bucket_name = ? AND status = 'completed'
      ORDER BY backup_date DESC LIMIT 1
    `).bind('cutty-files').first();

    if (!lastBackup) {
      return true; // No previous backup
    }

    // Trigger if last backup was more than 6 hours ago
    const lastBackupTime = new Date(lastBackup.backup_date);
    const sixHoursAgo = new Date();
    sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

    return lastBackupTime < sixHoursAgo;
  }
}

/**
 * Scheduled task handler for Cloudflare Workers
 */
export async function handleScheduledBackup(
  env: Env,
  scheduledTime: number
): Promise<void> {
  const config: ScheduleConfig = {
    bucketName: 'cutty-files',
    schedule: 'daily',
    timezone: 'UTC',
    retentionDays: parseInt(env.BACKUP_RETENTION_DAYS || '30'),
    enabled: env.BACKUP_SCHEDULE !== 'disabled'
  };

  const scheduler = new BackupScheduler(env, config);
  
  try {
    if (await scheduler.shouldRunBackup()) {
      await scheduler.executeScheduledBackup();
      console.log('Scheduled backup completed successfully');
    } else {
      console.log('Scheduled backup skipped - not due yet');
    }
  } catch (error) {
    console.error('Scheduled backup failed:', error);
    // Consider sending alerts or notifications here
  }
}

/**
 * Factory function to create backup scheduler
 */
export function createBackupScheduler(env: Env): BackupScheduler {
  const config: ScheduleConfig = {
    bucketName: 'cutty-files',
    schedule: env.BACKUP_SCHEDULE as 'daily' | 'weekly' | 'monthly' || 'daily',
    timezone: 'UTC',
    retentionDays: parseInt(env.BACKUP_RETENTION_DAYS || '30'),
    enabled: env.BACKUP_SCHEDULE !== 'disabled'
  };

  return new BackupScheduler(env, config);
}

/**
 * Factory function to create backup trigger
 */
export function createBackupTrigger(env: Env): BackupTrigger {
  return new BackupTrigger(env);
}