import React, { useState, useEffect } from 'react';
import StorageUsageChart from './StorageUsageChart';
import { formatCurrency, formatBytes } from '../../utils/formatters';

const CostAnalyticsDashboard = ({ userId, timeRange = '30days' }) => {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCostData();
  }, [userId, timeRange]);

  const fetchCostData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/monitoring/costs?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cost data');
      }

      const data = await response.json();
      setCostData(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCostBreakdownData = () => {
    if (!costData?.costs?.breakdown) return { labels: [], values: [] };

    const breakdown = costData.costs.breakdown;
    return {
      labels: Object.keys(breakdown),
      values: Object.values(breakdown)
    };
  };

  const getCostTrendsData = () => {
    if (!costData?.costs?.trends) return { labels: [], datasets: [] };

    const trends = costData.costs.trends;
    return {
      labels: trends.map(t => t.date),
      datasets: [
        {
          label: 'Daily Cost',
          data: trends.map(t => t.cost),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true
        }
      ]
    };
  };

  const getOptimizationRecommendations = () => {
    if (!costData?.forecast) return [];

    const recommendations = [];
    const { currentMonthEstimate, optimizationPotential } = costData.forecast;

    if (optimizationPotential > 0) {
      recommendations.push({
        type: 'cost_optimization',
        title: 'Cost Optimization Opportunity',
        description: `You could save up to ${formatCurrency(optimizationPotential)} per month by optimizing your storage usage.`,
        severity: 'medium',
        actions: [
          'Move infrequently accessed files to Infrequent Access storage',
          'Delete unnecessary duplicate files',
          'Compress large files before uploading'
        ]
      });
    }

    if (currentMonthEstimate > 50) {
      recommendations.push({
        type: 'high_usage',
        title: 'High Monthly Usage',
        description: `Your estimated monthly cost is ${formatCurrency(currentMonthEstimate)}. Consider reviewing your usage patterns.`,
        severity: 'high',
        actions: [
          'Review your largest files and consider archiving',
          'Implement automated cleanup policies',
          'Consider upgrading to a higher tier for better rates'
        ]
      });
    }

    return recommendations;
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
            <h3 className="text-sm font-medium text-red-800">Error loading cost data</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const recommendations = getOptimizationRecommendations();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Cost Analytics</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Time Range:</span>
          <span className="text-sm font-medium capitalize">{timeRange}</span>
        </div>
      </div>

      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Current Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(costData?.forecast?.currentMonthEstimate || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Next Month Forecast</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(costData?.forecast?.nextMonthForecast || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Annual Forecast</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(costData?.forecast?.annualForecast || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Optimization Potential</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(costData?.forecast?.optimizationPotential || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cost Breakdown and Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StorageUsageChart
          data={getCostBreakdownData()}
          type="doughnut"
          title="Cost Breakdown by Type"
          height={300}
        />
        <StorageUsageChart
          data={getCostTrendsData()}
          type="line"
          title="Cost Trends Over Time"
          height={300}
        />
      </div>

      {/* Optimization Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Optimization Recommendations</h3>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className={`border rounded-lg p-4 ${
                rec.severity === 'high' ? 'border-red-200 bg-red-50' :
                rec.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                'border-blue-200 bg-blue-50'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      rec.severity === 'high' ? 'bg-red-100' :
                      rec.severity === 'medium' ? 'bg-yellow-100' :
                      'bg-blue-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        rec.severity === 'high' ? 'text-red-600' :
                        rec.severity === 'medium' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <h4 className={`text-sm font-medium ${
                      rec.severity === 'high' ? 'text-red-900' :
                      rec.severity === 'medium' ? 'text-yellow-900' :
                      'text-blue-900'
                    }`}>
                      {rec.title}
                    </h4>
                    <p className={`text-sm mt-1 ${
                      rec.severity === 'high' ? 'text-red-700' :
                      rec.severity === 'medium' ? 'text-yellow-700' :
                      'text-blue-700'
                    }`}>
                      {rec.description}
                    </p>
                    <div className="mt-2">
                      <p className={`text-sm font-medium ${
                        rec.severity === 'high' ? 'text-red-900' :
                        rec.severity === 'medium' ? 'text-yellow-900' :
                        'text-blue-900'
                      }`}>
                        Recommended Actions:
                      </p>
                      <ul className={`text-sm mt-1 space-y-1 ${
                        rec.severity === 'high' ? 'text-red-700' :
                        rec.severity === 'medium' ? 'text-yellow-700' :
                        'text-blue-700'
                      }`}>
                        {rec.actions.map((action, actionIndex) => (
                          <li key={actionIndex} className="flex items-start">
                            <span className="flex-shrink-0 w-1.5 h-1.5 bg-current rounded-full mt-2 mr-2"></span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CostAnalyticsDashboard;