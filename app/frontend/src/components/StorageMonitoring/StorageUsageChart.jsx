import React from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { formatBytes, formatCurrency } from '../../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const StorageUsageChart = ({ 
  data, 
  type = 'line', 
  title = 'Storage Usage Over Time',
  className = '',
  height = 400 
}) => {
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            
            if (label.includes('Storage') || label.includes('Usage')) {
              return `${label}: ${formatBytes(value)}`;
            }
            if (label.includes('Cost')) {
              return `${label}: ${formatCurrency(value)}`;
            }
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: type !== 'doughnut' ? {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            if (this.chart.data.datasets[0].label?.includes('Cost')) {
              return formatCurrency(value);
            }
            return formatBytes(value);
          }
        }
      }
    } : undefined
  };

  const getChartData = () => {
    if (type === 'doughnut') {
      return {
        labels: data.labels || ['Used', 'Available'],
        datasets: [{
          data: data.values || [0, 0],
          backgroundColor: [
            '#EF4444',
            '#10B981',
            '#3B82F6',
            '#F59E0B',
            '#8B5CF6'
          ],
          borderColor: [
            '#DC2626',
            '#059669',
            '#2563EB',
            '#D97706',
            '#7C3AED'
          ],
          borderWidth: 2
        }]
      };
    }

    return {
      labels: data.labels || [],
      datasets: data.datasets?.map((dataset, index) => ({
        ...dataset,
        borderColor: dataset.borderColor || [
          '#3B82F6',
          '#10B981',
          '#EF4444',
          '#F59E0B',
          '#8B5CF6'
        ][index],
        backgroundColor: dataset.backgroundColor || [
          'rgba(59, 130, 246, 0.1)',
          'rgba(16, 185, 129, 0.1)',
          'rgba(239, 68, 68, 0.1)',
          'rgba(245, 158, 11, 0.1)',
          'rgba(139, 92, 246, 0.1)'
        ][index],
        fill: type === 'line' ? dataset.fill !== false : false,
        tension: type === 'line' ? 0.4 : 0
      })) || []
    };
  };

  const renderChart = () => {
    const chartData = getChartData();
    
    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={chartOptions} />;
      case 'line':
      default:
        return <Line data={chartData} options={chartOptions} />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div style={{ height: `${height}px` }}>
        {renderChart()}
      </div>
    </div>
  );
};

export default StorageUsageChart;