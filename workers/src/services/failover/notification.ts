import type { 
  Env, 
  UserNotification, 
  NotificationType, 
  EventSeverity,
  User
} from '../../types';
import { ApiError } from '../../middleware/error';

export class NotificationService {
  private env: Env;
  private maxNotificationsPerUser: number;
  private retentionDays: number;

  constructor(env: Env, maxNotificationsPerUser: number = 100, retentionDays: number = 30) {
    this.env = env;
    this.maxNotificationsPerUser = maxNotificationsPerUser;
    this.retentionDays = retentionDays;
  }

  /**
   * Send notification to a specific user
   */
  async sendUserNotification(
    userId: number,
    type: NotificationType,
    message: string,
    severity: EventSeverity = 'INFO',
    metadata?: Record<string, unknown>
  ): Promise<number> {
    try {
      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Check notification limits
      await this.enforceNotificationLimits(userId);

      // Create notification
      const result = await this.env.DB.prepare(`
        INSERT INTO user_notifications (
          user_id, notification_type, message, severity, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userId,
        type,
        message,
        severity,
        metadata ? JSON.stringify(metadata) : null,
        new Date().toISOString()
      ).run();

      const notificationId = result.meta.last_row_id;
      
      console.log(`Notification sent to user ${userId}: ${type} - ${message}`);
      
      return notificationId;
    } catch (error) {
      console.error('Error sending user notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotifications(
    userIds: number[],
    type: NotificationType,
    message: string,
    severity: EventSeverity = 'INFO',
    metadata?: Record<string, unknown>
  ): Promise<number[]> {
    const notificationIds: number[] = [];
    
    for (const userId of userIds) {
      try {
        const notificationId = await this.sendUserNotification(
          userId,
          type,
          message,
          severity,
          metadata
        );
        notificationIds.push(notificationId);
      } catch (error) {
        console.error(`Error sending notification to user ${userId}:`, error);
      }
    }
    
    return notificationIds;
  }

  /**
   * Send notification to all active users
   */
  async sendSystemNotification(
    type: NotificationType,
    message: string,
    severity: EventSeverity = 'INFO',
    metadata?: Record<string, unknown>
  ): Promise<number> {
    try {
      // Get all active users (users with recent activity)
      const activeUsers = await this.getActiveUsers();
      
      if (activeUsers.length === 0) {
        console.log('No active users to notify');
        return 0;
      }

      const notificationIds = await this.sendBulkNotifications(
        activeUsers.map(u => u.id),
        type,
        message,
        severity,
        metadata
      );

      console.log(`System notification sent to ${notificationIds.length} users`);
      return notificationIds.length;
    } catch (error) {
      console.error('Error sending system notification:', error);
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
      type?: NotificationType;
      severity?: EventSeverity;
    } = {}
  ): Promise<UserNotification[]> {
    try {
      const { limit = 50, offset = 0, unreadOnly = false, type, severity } = options;
      
      let query = `
        SELECT * FROM user_notifications 
        WHERE user_id = ?
      `;
      const params: unknown[] = [userId];

      if (unreadOnly) {
        query += ' AND read_status = 0';
      }

      if (type) {
        query += ' AND notification_type = ?';
        params.push(type);
      }

      if (severity) {
        query += ' AND severity = ?';
        params.push(severity);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await this.env.DB.prepare(query).bind(...params).all();
      return result.results as UserNotification[];
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(notificationId: number): Promise<UserNotification | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT * FROM user_notifications WHERE id = ?
      `).bind(notificationId).first();

      return result as UserNotification | null;
    } catch (error) {
      console.error('Error getting notification by ID:', error);
      return null;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        UPDATE user_notifications 
        SET read_status = 1, acknowledged_at = ?
        WHERE id = ? AND user_id = ?
      `).bind(new Date().toISOString(), notificationId, userId).run();

      return result.changes > 0;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<number> {
    try {
      const result = await this.env.DB.prepare(`
        UPDATE user_notifications 
        SET read_status = 1, acknowledged_at = ?
        WHERE user_id = ? AND read_status = 0
      `).bind(new Date().toISOString(), userId).run();

      return result.changes;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return 0;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: number, userId: number): Promise<boolean> {
    try {
      const result = await this.env.DB.prepare(`
        DELETE FROM user_notifications 
        WHERE id = ? AND user_id = ?
      `).bind(notificationId, userId).run();

      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId: number): Promise<number> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT COUNT(*) as count 
        FROM user_notifications 
        WHERE user_id = ? AND read_status = 0
      `).bind(userId).first();

      return result?.count || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: number): Promise<{
    total: number;
    unread: number;
    by_type: Record<NotificationType, number>;
    by_severity: Record<EventSeverity, number>;
  }> {
    try {
      const [totalResult, unreadResult, typeResult, severityResult] = await Promise.all([
        this.env.DB.prepare(`
          SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ?
        `).bind(userId).first(),
        
        this.env.DB.prepare(`
          SELECT COUNT(*) as count FROM user_notifications 
          WHERE user_id = ? AND read_status = 0
        `).bind(userId).first(),
        
        this.env.DB.prepare(`
          SELECT notification_type, COUNT(*) as count 
          FROM user_notifications 
          WHERE user_id = ? 
          GROUP BY notification_type
        `).bind(userId).all(),
        
        this.env.DB.prepare(`
          SELECT severity, COUNT(*) as count 
          FROM user_notifications 
          WHERE user_id = ? 
          GROUP BY severity
        `).bind(userId).all()
      ]);

      const byType: Record<string, number> = {};
      typeResult.results.forEach(row => {
        byType[row.notification_type] = row.count;
      });

      const bySeverity: Record<string, number> = {};
      severityResult.results.forEach(row => {
        bySeverity[row.severity] = row.count;
      });

      return {
        total: totalResult?.count || 0,
        unread: unreadResult?.count || 0,
        by_type: byType as Record<NotificationType, number>,
        by_severity: bySeverity as Record<EventSeverity, number>
      };
    } catch (error) {
      console.error('Error getting notification stats:', error);
      return {
        total: 0,
        unread: 0,
        by_type: {} as Record<NotificationType, number>,
        by_severity: {} as Record<EventSeverity, number>
      };
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const result = await this.env.DB.prepare(`
        DELETE FROM user_notifications 
        WHERE created_at < ? AND read_status = 1
      `).bind(cutoffDate.toISOString()).run();

      console.log(`Cleaned up ${result.changes} old notifications`);
      return result.changes;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      return 0;
    }
  }

  /**
   * Service-specific notification helpers
   */

  /**
   * Notify about service degradation
   */
  async notifyServiceDegradation(
    serviceName: string,
    reason: string,
    affectedUsers?: number[]
  ): Promise<void> {
    const message = `Service ${serviceName} is experiencing issues: ${reason}. Some features may be temporarily unavailable.`;
    
    if (affectedUsers && affectedUsers.length > 0) {
      await this.sendBulkNotifications(
        affectedUsers,
        'SERVICE_DEGRADED',
        message,
        'WARNING',
        { serviceName, reason }
      );
    } else {
      await this.sendSystemNotification(
        'SERVICE_DEGRADED',
        message,
        'WARNING',
        { serviceName, reason }
      );
    }
  }

  /**
   * Notify about service recovery
   */
  async notifyServiceRecovery(serviceName: string): Promise<void> {
    const message = `Service ${serviceName} has been restored and is now operating normally.`;
    
    await this.sendSystemNotification(
      'SERVICE_DEGRADED', // Using same type for consistency
      message,
      'INFO',
      { serviceName, recovered: true }
    );
  }

  /**
   * Notify about queued operations
   */
  async notifyOperationQueued(
    userId: number,
    operationType: string,
    operationId: string,
    estimatedCompletion?: Date
  ): Promise<void> {
    const message = `Your ${operationType.toLowerCase()} operation has been queued and will be processed shortly.`;
    
    await this.sendUserNotification(
      userId,
      'OPERATION_QUEUED',
      message,
      'INFO',
      { 
        operationType, 
        operationId, 
        estimatedCompletion: estimatedCompletion?.toISOString() 
      }
    );
  }

  /**
   * Notify about completed operations
   */
  async notifyOperationCompleted(
    userId: number,
    operationType: string,
    operationId: string,
    result?: any
  ): Promise<void> {
    const message = `Your ${operationType.toLowerCase()} operation has been completed successfully.`;
    
    await this.sendUserNotification(
      userId,
      'OPERATION_COMPLETED',
      message,
      'INFO',
      { operationType, operationId, result }
    );
  }

  /**
   * Notify about failed operations
   */
  async notifyOperationFailed(
    userId: number,
    operationType: string,
    operationId: string,
    error: string
  ): Promise<void> {
    const message = `Your ${operationType.toLowerCase()} operation failed: ${error}`;
    
    await this.sendUserNotification(
      userId,
      'OPERATION_FAILED',
      message,
      'ERROR',
      { operationType, operationId, error }
    );
  }

  /**
   * Private methods
   */

  private async getUserById(userId: number): Promise<User | null> {
    try {
      const result = await this.env.DB.prepare(`
        SELECT id, username, email, created_at FROM users WHERE id = ?
      `).bind(userId).first();

      return result as User | null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  private async getActiveUsers(): Promise<User[]> {
    try {
      // Get users who have been active in the last 24 hours
      const result = await this.env.DB.prepare(`
        SELECT DISTINCT u.id, u.username, u.email, u.created_at
        FROM users u
        INNER JOIN saved_files sf ON u.id = sf.user_id
        WHERE sf.uploaded_at > datetime('now', '-24 hours')
        ORDER BY u.id
      `).all();

      return result.results as User[];
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  private async enforceNotificationLimits(userId: number): Promise<void> {
    try {
      const currentCount = await this.env.DB.prepare(`
        SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ?
      `).bind(userId).first();

      if (currentCount && currentCount.count >= this.maxNotificationsPerUser) {
        // Delete oldest notifications to make room
        const deleteCount = currentCount.count - this.maxNotificationsPerUser + 1;
        await this.env.DB.prepare(`
          DELETE FROM user_notifications 
          WHERE user_id = ? 
          AND id IN (
            SELECT id FROM user_notifications 
            WHERE user_id = ? 
            ORDER BY created_at ASC 
            LIMIT ?
          )
        `).bind(userId, userId, deleteCount).run();
      }
    } catch (error) {
      console.error('Error enforcing notification limits:', error);
    }
  }
}

// Notification formatting utilities
export class NotificationFormatter {
  /**
   * Format notification message for display
   */
  static formatMessage(notification: UserNotification): string {
    const timestamp = new Date(notification.created_at).toLocaleString();
    const severityIcon = this.getSeverityIcon(notification.severity);
    
    return `${severityIcon} ${notification.message} (${timestamp})`;
  }

  /**
   * Get severity icon for notifications
   */
  static getSeverityIcon(severity: EventSeverity): string {
    switch (severity) {
      case 'INFO':
        return 'ℹ️';
      case 'WARNING':
        return '⚠️';
      case 'ERROR':
        return '❌';
      case 'CRITICAL':
        return '🚨';
      default:
        return '📢';
    }
  }

  /**
   * Format notification for email (if email notifications are implemented)
   */
  static formatForEmail(notification: UserNotification): {
    subject: string;
    body: string;
  } {
    const subject = `${notification.notification_type.replace('_', ' ')} - Cutty`;
    const body = `
      Hello,

      ${notification.message}

      This notification was sent on ${new Date(notification.created_at).toLocaleString()}.

      If you have any questions, please contact support.

      Best regards,
      Cutty Team
    `;

    return { subject, body };
  }

  /**
   * Format notification metadata for display
   */
  static formatMetadata(notification: UserNotification): Record<string, unknown> {
    if (!notification.metadata) {
      return {};
    }

    try {
      return JSON.parse(notification.metadata);
    } catch (error) {
      console.error('Error parsing notification metadata:', error);
      return {};
    }
  }
}