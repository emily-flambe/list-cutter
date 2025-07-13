import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import StorageUsageCard from './StorageUsageCard';
import StorageUsageChart from './StorageUsageChart';
import CostAnalyticsDashboard from './CostAnalyticsDashboard';
import PerformanceMetrics from './PerformanceMetrics';

const StorageMonitoringDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7days');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id, timeRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/monitoring/usage?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStorageUsageData = () => {
    if (!dashboardData?.overview?.storageByDate) return { labels: [], datasets: [] };

    const storageData = dashboardData.overview.storageByDate;
    return {
      labels: storageData.map(d => d.date),
      datasets: [
        {
          label: 'Storage Usage (GB)',
          data: storageData.map(d => d.totalBytes / (1024 * 1024 * 1024)),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true
        }
      ]
    };
  };

  const getOperationBreakdownData = () => {
    if (!dashboardData?.overview?.operationBreakdown) return { labels: [], values: [] };

    const operations = dashboardData.overview.operationBreakdown;
    return {
      labels: operations.map(op => op.operation),
      values: operations.map(op => op.count)
    };
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'storage', name: 'Storage', icon: '💾' },
    { id: 'costs', name: 'Costs', icon: '💰' },
    { id: 'performance', name: 'Performance', icon: '⚡' }
  ];

  const timeRanges = [
    { value: '24hours', label: '24 Hours' },
    { value: '7days', label: '7 Days' },
    { value: '30days', label: '30 Days' },
    { value: '90days', label: '90 Days' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-gray-200 rounded-lg h-40"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading dashboard</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={fetchDashboardData}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 font-medium"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Storage Monitoring</h1>
            <p className="mt-2 text-sm text-gray-600">Monitor your storage usage, costs, and performance</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              {timeRanges.map(range => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Storage</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.overview?.totalBytes 
                        ? `${(dashboardData.overview.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                        : '0 GB'
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Files</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.overview?.totalFiles || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Monthly Cost</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${dashboardData?.overview?.monthlyCost?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Operations</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {dashboardData?.overview?.totalOperations || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Usage Card */}
            <StorageUsageCard
              usage={dashboardData?.overview?.totalBytes || 0}
              quota={dashboardData?.quotaStatus?.maxStorageBytes || 0}
            />

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StorageUsageChart
                data={getStorageUsageData()}
                type="line"
                title="Storage Usage Over Time"
                height={300}
              />
              <StorageUsageChart
                data={getOperationBreakdownData()}
                type="doughnut"
                title="Operations Breakdown"
                height={300}
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {dashboardData?.recentActivity?.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.operationType} operation
                      </p>
                      <p className="text-sm text-gray-500">
                        {activity.operations} operations, {(activity.bytes / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {activity.date}
                    </div>
                  </div>
                )) || []}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'storage' && (
          <div className="space-y-6">
            <StorageUsageCard
              usage={dashboardData?.overview?.totalBytes || 0}
              quota={dashboardData?.quotaStatus?.maxStorageBytes || 0}
            />
            <StorageUsageChart
              data={getStorageUsageData()}
              type="line"
              title="Storage Usage Trends"
              height={400}
            />
          </div>
        )}

        {activeTab === 'costs' && (
          <CostAnalyticsDashboard userId={user?.id} timeRange={timeRange} />
        )}

        {activeTab === 'performance' && (
          <PerformanceMetrics userId={user?.id} timeRange={timeRange} />
        )}
      </div>
    </div>
  );
};

export default StorageMonitoringDashboard;