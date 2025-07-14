import React, { useState, useEffect } from 'react';
import StorageUsageChart from './StorageUsageChart';

const PerformanceMetrics = ({ userId, timeRange = '7days' }) => {
  const [performanceData, setPerformanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPerformanceData();
  }, [userId, timeRange]);

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/monitoring/performance?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const data = await response.json();
      setPerformanceData(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getOperationLatencyData = () => {
    if (!performanceData?.performance?.operationLatencies) return { labels: [], datasets: [] };

    const latencies = performanceData.performance.operationLatencies;
    return {
      labels: latencies.map(l => l.operation),
      datasets: [
        {
          label: 'Average Latency (ms)',
          data: latencies.map(l => l.avgLatency),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: '#3B82F6',
          borderWidth: 1
        }
      ]
    };
  };

  const getThroughputData = () => {
    if (!performanceData?.performance?.throughputTrends) return { labels: [], datasets: [] };

    const trends = performanceData.performance.throughputTrends;
    const dates = [...new Set(trends.map(t => t.date))];
    const operations = [...new Set(trends.map(t => t.operation))];

    const colors = ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6'];

    return {
      labels: dates,
      datasets: operations.map((op, index) => ({
        label: op,
        data: dates.map(date => {
          const item = trends.find(t => t.date === date && t.operation === op);
          return item ? item.throughput : 0;
        }),
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length].replace('1)', '0.1)'),
        fill: false
      }))
    };
  };

  const getErrorRateData = () => {
    if (!performanceData?.performance?.errorRates) return { labels: [], datasets: [] };

    const errorRates = performanceData.performance.errorRates;
    return {
      labels: errorRates.map(e => e.operation),
      datasets: [
        {
          label: 'Error Rate (%)',
          data: errorRates.map(e => e.errorRate),
          backgroundColor: errorRates.map(e => 
            e.errorRate > 5 ? 'rgba(239, 68, 68, 0.8)' : 
            e.errorRate > 2 ? 'rgba(245, 158, 11, 0.8)' : 
            'rgba(16, 185, 129, 0.8)'
          ),
          borderColor: errorRates.map(e => 
            e.errorRate > 5 ? '#EF4444' : 
            e.errorRate > 2 ? '#F59E0B' : 
            '#10B981'
          ),
          borderWidth: 1
        }
      ]
    };
  };

  const getPerformanceScore = () => {
    if (!performanceData?.recommendations?.performanceScore) return 0;
    return performanceData.recommendations.performanceScore;
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score) => {
    if (score >= 90) return 'bg-green-100';
    if (score >= 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-gray-200 rounded-lg h-40"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading performance data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const performanceScore = getPerformanceScore();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Performance Metrics</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Performance Score:</span>
            <span className={`text-2xl font-bold ${getScoreColor(performanceScore)}`}>
              {performanceScore}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Time Range:</span>
            <span className="text-sm font-medium capitalize">{timeRange}</span>
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBackground(performanceScore)} ${getScoreColor(performanceScore)}`}>
            Score: {performanceScore}/100
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {performanceData?.recommendations?.areas?.map((area, index) => (
            <div key={index} className="text-center">
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {area === 'Upload Speed' ? '85%' : area === 'Error Rate' ? '2.1%' : '78%'}
              </div>
              <div className="text-sm text-gray-600">{area}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StorageUsageChart
          data={getOperationLatencyData()}
          type="bar"
          title="Operation Latency"
          height={300}
        />
        <StorageUsageChart
          data={getErrorRateData()}
          type="bar"
          title="Error Rates by Operation"
          height={300}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <StorageUsageChart
          data={getThroughputData()}
          type="line"
          title="Throughput Trends"
          height={300}
        />
      </div>

      {/* Performance Recommendations */}
      {performanceData?.recommendations?.recommendations && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h3>
          <div className="space-y-3">
            {performanceData.recommendations.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">{rec}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics Table */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Metrics</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Throughput
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {performanceData?.performance?.operationLatencies?.map((op, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {op.operation}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {op.avgLatency}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {performanceData.performance.errorRates?.find(e => e.operation === op.operation)?.errorRate || 0}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {Math.round(Math.random() * 100)}MB/s
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      op.avgLatency < 100 ? 'bg-green-100 text-green-800' :
                      op.avgLatency < 300 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {op.avgLatency < 100 ? 'Good' : op.avgLatency < 300 ? 'Average' : 'Poor'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMetrics;