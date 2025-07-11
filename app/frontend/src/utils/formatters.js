/**
 * Utility functions for formatting data in the monitoring dashboard
 */

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted string
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format currency values
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === 0) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage values
 * @param {number} value - Value to format as percentage
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

/**
 * Format date for charts and displays
 * @param {string|Date} date - Date to format
 * @param {string} format - Format type ('short', 'medium', 'long')
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'short') => {
  const dateObj = new Date(date);
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    case 'medium':
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    case 'long':
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    default:
      return dateObj.toLocaleDateString();
  }
};

/**
 * Format throughput values
 * @param {number} bps - Bytes per second
 * @returns {string} Formatted throughput string
 */
export const formatThroughput = (bps) => {
  if (bps === 0) return '0 B/s';
  
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  
  const i = Math.floor(Math.log(bps) / Math.log(k));
  
  return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format large numbers with abbreviations
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  if (num === 0) return '0';
  
  const k = 1000;
  const sizes = ['', 'K', 'M', 'B', 'T'];
  
  const i = Math.floor(Math.log(num) / Math.log(k));
  
  if (i === 0) return num.toString();
  
  return parseFloat((num / Math.pow(k, i)).toFixed(1)) + sizes[i];
};

/**
 * Format time ago
 * @param {string|Date} date - Date to format
 * @returns {string} Time ago string
 */
export const formatTimeAgo = (date) => {
  const now = new Date();
  const dateObj = new Date(date);
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return formatDate(date, 'medium');
};

/**
 * Get color based on usage percentage
 * @param {number} percentage - Usage percentage
 * @returns {object} Color object with text and background classes
 */
export const getUsageColor = (percentage) => {
  if (percentage >= 95) {
    return {
      text: 'text-red-600',
      bg: 'bg-red-100',
      border: 'border-red-200'
    };
  } else if (percentage >= 80) {
    return {
      text: 'text-yellow-600',
      bg: 'bg-yellow-100',
      border: 'border-yellow-200'
    };
  } else {
    return {
      text: 'text-green-600',
      bg: 'bg-green-100',
      border: 'border-green-200'
    };
  }
};

/**
 * Get status badge color
 * @param {string} status - Status string
 * @returns {string} CSS classes for badge
 */
export const getStatusBadgeColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'healthy':
    case 'good':
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'warning':
    case 'average':
      return 'bg-yellow-100 text-yellow-800';
    case 'error':
    case 'poor':
    case 'critical':
      return 'bg-red-100 text-red-800';
    case 'info':
    case 'pending':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};