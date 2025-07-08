import React from 'react';
import { formatBytes, formatCurrency } from '../../utils/formatters';

const StorageUsageCard = ({ usage, quota, className = '' }) => {
  const usagePercentage = quota ? (usage / quota) * 100 : 0;
  const isWarning = usagePercentage >= 80;
  const isDanger = usagePercentage >= 95;

  const getStatusColor = () => {
    if (isDanger) return 'text-red-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (isDanger) return 'bg-red-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Storage Usage</h3>
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {usagePercentage.toFixed(1)}% Used
        </span>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Used</span>
          <span className="text-sm font-medium">{formatBytes(usage)}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Quota</span>
          <span className="text-sm font-medium">{formatBytes(quota)}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Available</span>
          <span className="text-sm font-medium">{formatBytes(quota - usage)}</span>
        </div>
        
        {isDanger && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Storage quota exceeded
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>You are using {usagePercentage.toFixed(1)}% of your storage quota. Please delete some files or upgrade your plan.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {isWarning && !isDanger && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Storage quota warning
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>You are using {usagePercentage.toFixed(1)}% of your storage quota. Consider cleaning up old files.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageUsageCard;