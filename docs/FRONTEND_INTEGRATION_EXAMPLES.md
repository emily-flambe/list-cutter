# Frontend Integration Examples

This document provides comprehensive examples for integrating the R2 storage monitoring system with various frontend frameworks including React, Vue.js, Angular, and vanilla JavaScript.

## Table of Contents
1. [React Integration](#react-integration)
2. [Vue.js Integration](#vuejs-integration)
3. [Angular Integration](#angular-integration)
4. [Vanilla JavaScript](#vanilla-javascript)
5. [API Reference](#api-reference)
6. [Authentication](#authentication)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)

## React Integration

### 1. React Hook for Storage Monitoring

```jsx
// hooks/useStorageMonitoring.js
import { useState, useEffect, useCallback } from 'react';

export const useStorageMonitoring = (timeRange = '7days') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/user/storage/usage?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
```

### 2. React Storage Dashboard Component

```jsx
// components/StorageDashboard.jsx
import React, { useState } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import { useStorageMonitoring } from '../hooks/useStorageMonitoring';
import { formatBytes, formatCurrency } from '../utils/formatters';

const StorageDashboard = () => {
  const [timeRange, setTimeRange] = useState('7days');
  const { data, loading, error, refetch } = useStorageMonitoring(timeRange);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatBytes(value)}`;
          }
        }
      }
    }
  };

  const getUsageChartData = () => {
    if (!data?.overview?.storageByDate) return { labels: [], datasets: [] };

    const storageData = data.overview.storageByDate;
    return {
      labels: storageData.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [{
        label: 'Storage Usage',
        data: storageData.map(d => d.totalBytes),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }]
    };
  };

  const getCostBreakdownData = () => {
    if (!data?.costs?.breakdown) return { labels: [], datasets: [] };

    const breakdown = data.costs.breakdown;
    return {
      labels: Object.keys(breakdown),
      datasets: [{
        data: Object.values(breakdown),
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'
        ]
      }]
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <h3 className="text-red-800 font-medium">Error loading storage data</h3>
        <p className="text-red-600 mt-1">{error}</p>
        <button 
          onClick={refetch}
          className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Storage Monitoring</h1>
        <select 
          value={timeRange} 
          onChange={(e) => setTimeRange(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="24hours">24 Hours</option>
          <option value="7days">7 Days</option>
          <option value="30days">30 Days</option>
          <option value="90days">90 Days</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Storage</h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatBytes(data?.overview?.totalBytes || 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Files</h3>
          <p className="text-2xl font-bold text-gray-900">
            {data?.overview?.totalFiles || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Monthly Cost</h3>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(data?.overview?.monthlyCost || 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Operations</h3>
          <p className="text-2xl font-bold text-gray-900">
            {data?.overview?.totalOperations || 0}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Storage Usage Over Time</h3>
          <Line data={getUsageChartData()} options={chartOptions} />
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
          <Doughnut data={getCostBreakdownData()} />
        </div>
      </div>
    </div>
  );
};

export default StorageDashboard;
```

### 3. React Context Provider

```jsx
// context/StorageMonitoringContext.jsx
import React, { createContext, useContext, useReducer } from 'react';

const StorageMonitoringContext = createContext();

const initialState = {
  usage: null,
  costs: null,
  performance: null,
  alerts: [],
  settings: {
    autoRefresh: true,
    refreshInterval: 30000,
    timeRange: '7days'
  }
};

const storageReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USAGE':
      return { ...state, usage: action.payload };
    case 'SET_COSTS':
      return { ...state, costs: action.payload };
    case 'SET_PERFORMANCE':
      return { ...state, performance: action.payload };
    case 'ADD_ALERT':
      return { ...state, alerts: [...state.alerts, action.payload] };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    default:
      return state;
  }
};

export const StorageMonitoringProvider = ({ children }) => {
  const [state, dispatch] = useReducer(storageReducer, initialState);

  const updateUsage = (usage) => dispatch({ type: 'SET_USAGE', payload: usage });
  const updateCosts = (costs) => dispatch({ type: 'SET_COSTS', payload: costs });
  const updatePerformance = (performance) => dispatch({ type: 'SET_PERFORMANCE', payload: performance });
  const addAlert = (alert) => dispatch({ type: 'ADD_ALERT', payload: alert });
  const updateSettings = (settings) => dispatch({ type: 'UPDATE_SETTINGS', payload: settings });

  return (
    <StorageMonitoringContext.Provider value={{
      ...state,
      updateUsage,
      updateCosts,
      updatePerformance,
      addAlert,
      updateSettings
    }}>
      {children}
    </StorageMonitoringContext.Provider>
  );
};

export const useStorageMonitoringContext = () => {
  const context = useContext(StorageMonitoringContext);
  if (!context) {
    throw new Error('useStorageMonitoringContext must be used within StorageMonitoringProvider');
  }
  return context;
};
```

## Vue.js Integration

### 1. Vue Composition API Hook

```javascript
// composables/useStorageMonitoring.js
import { ref, reactive, computed, onMounted, watch } from 'vue';

export function useStorageMonitoring(timeRange = ref('7days')) {
  const data = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const fetchData = async () => {
    try {
      loading.value = true;
      error.value = null;

      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/user/storage/usage?timeRange=${timeRange.value}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      data.value = result.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  // Computed properties
  const totalStorage = computed(() => data.value?.overview?.totalBytes || 0);
  const totalFiles = computed(() => data.value?.overview?.totalFiles || 0);
  const monthlyCost = computed(() => data.value?.overview?.monthlyCost || 0);

  // Watchers
  watch(timeRange, fetchData, { immediate: true });

  onMounted(() => {
    fetchData();
  });

  return {
    data,
    loading,
    error,
    totalStorage,
    totalFiles,
    monthlyCost,
    refetch: fetchData
  };
}
```

### 2. Vue Storage Dashboard Component

```vue
<!-- components/StorageDashboard.vue -->
<template>
  <div class="storage-dashboard">
    <!-- Header -->
    <div class="dashboard-header">
      <h1>Storage Monitoring</h1>
      <select v-model="timeRange" @change="refetch">
        <option value="24hours">24 Hours</option>
        <option value="7days">7 Days</option>
        <option value="30days">30 Days</option>
        <option value="90days">90 Days</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-spinner">
      <div class="spinner"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-message">
      <h3>Error loading storage data</h3>
      <p>{{ error }}</p>
      <button @click="refetch" class="retry-button">Retry</button>
    </div>

    <!-- Dashboard Content -->
    <div v-else class="dashboard-content">
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Total Storage</h3>
          <p>{{ formatBytes(totalStorage) }}</p>
        </div>
        <div class="stat-card">
          <h3>Total Files</h3>
          <p>{{ totalFiles }}</p>
        </div>
        <div class="stat-card">
          <h3>Monthly Cost</h3>
          <p>{{ formatCurrency(monthlyCost) }}</p>
        </div>
        <div class="stat-card">
          <h3>Operations</h3>
          <p>{{ data?.overview?.totalOperations || 0 }}</p>
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-grid">
        <div class="chart-container">
          <h3>Storage Usage Over Time</h3>
          <canvas ref="usageChart"></canvas>
        </div>
        <div class="chart-container">
          <h3>Cost Breakdown</h3>
          <canvas ref="costChart"></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { Chart } from 'chart.js/auto';
import { useStorageMonitoring } from '../composables/useStorageMonitoring';
import { formatBytes, formatCurrency } from '../utils/formatters';

const timeRange = ref('7days');
const usageChart = ref(null);
const costChart = ref(null);

const { data, loading, error, totalStorage, totalFiles, monthlyCost, refetch } = 
  useStorageMonitoring(timeRange);

let usageChartInstance = null;
let costChartInstance = null;

const createUsageChart = () => {
  if (!data.value?.overview?.storageByDate) return;

  const storageData = data.value.overview.storageByDate;
  
  if (usageChartInstance) {
    usageChartInstance.destroy();
  }

  usageChartInstance = new Chart(usageChart.value, {
    type: 'line',
    data: {
      labels: storageData.map(d => new Date(d.date).toLocaleDateString()),
      datasets: [{
        label: 'Storage Usage',
        data: storageData.map(d => d.totalBytes),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `Storage: ${formatBytes(context.parsed.y)}`
          }
        }
      }
    }
  });
};

const createCostChart = () => {
  if (!data.value?.costs?.breakdown) return;

  const breakdown = data.value.costs.breakdown;
  
  if (costChartInstance) {
    costChartInstance.destroy();
  }

  costChartInstance = new Chart(costChart.value, {
    type: 'doughnut',
    data: {
      labels: Object.keys(breakdown),
      datasets: [{
        data: Object.values(breakdown),
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (context) => `${context.label}: ${formatCurrency(context.parsed)}`
          }
        }
      }
    }
  });
};

onMounted(async () => {
  await nextTick();
  if (data.value) {
    createUsageChart();
    createCostChart();
  }
});

// Watch for data changes and recreate charts
watch(data, async () => {
  await nextTick();
  createUsageChart();
  createCostChart();
});
</script>

<style scoped>
.storage-dashboard {
  padding: 2rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.chart-container {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-spinner {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 2s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #fee;
  border: 1px solid #fcc;
  color: #c33;
  padding: 1rem;
  border-radius: 0.5rem;
  text-align: center;
}

.retry-button {
  background-color: #c33;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  cursor: pointer;
  margin-top: 1rem;
}
</style>
```

### 3. Vue Store (Vuex/Pinia)

```javascript
// stores/storageMonitoring.js (Pinia)
import { defineStore } from 'pinia';

export const useStorageMonitoringStore = defineStore('storageMonitoring', {
  state: () => ({
    usage: null,
    costs: null,
    performance: null,
    alerts: [],
    settings: {
      autoRefresh: true,
      refreshInterval: 30000,
      timeRange: '7days'
    },
    loading: {
      usage: false,
      costs: false,
      performance: false
    },
    errors: {
      usage: null,
      costs: null,
      performance: null
    }
  }),

  getters: {
    totalStorage: (state) => state.usage?.overview?.totalBytes || 0,
    totalFiles: (state) => state.usage?.overview?.totalFiles || 0,
    monthlyCost: (state) => state.costs?.currentMonthEstimate || 0,
    isLoading: (state) => Object.values(state.loading).some(Boolean),
    hasErrors: (state) => Object.values(state.errors).some(Boolean)
  },

  actions: {
    async fetchUsage(timeRange = '7days') {
      this.loading.usage = true;
      this.errors.usage = null;

      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/user/storage/usage?timeRange=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.usage = result.data;
      } catch (error) {
        this.errors.usage = error.message;
        console.error('Error fetching usage:', error);
      } finally {
        this.loading.usage = false;
      }
    },

    async fetchCosts(timeRange = '30days') {
      this.loading.costs = true;
      this.errors.costs = null;

      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/user/storage/costs?timeRange=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.costs = result.data;
      } catch (error) {
        this.errors.costs = error.message;
        console.error('Error fetching costs:', error);
      } finally {
        this.loading.costs = false;
      }
    },

    async fetchPerformance(timeRange = '7days') {
      this.loading.performance = true;
      this.errors.performance = null;

      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/user/storage/performance?timeRange=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        this.performance = result.data;
      } catch (error) {
        this.errors.performance = error.message;
        console.error('Error fetching performance:', error);
      } finally {
        this.loading.performance = false;
      }
    },

    addAlert(alert) {
      this.alerts.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...alert
      });
    },

    removeAlert(alertId) {
      this.alerts = this.alerts.filter(alert => alert.id !== alertId);
    },

    updateSettings(newSettings) {
      this.settings = { ...this.settings, ...newSettings };
    }
  }
});
```

## Angular Integration

### 1. Angular Service

```typescript
// services/storage-monitoring.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface StorageUsage {
  overview: {
    totalBytes: number;
    totalFiles: number;
    monthlyCost: number;
    totalOperations: number;
    storageByDate: Array<{ date: string; totalBytes: number }>;
  };
  quotaStatus: {
    maxStorageBytes: number;
    usagePercentage: number;
  };
}

export interface CostData {
  costs: {
    breakdown: Record<string, number>;
    trends: Array<{ date: string; cost: number }>;
  };
  forecast: {
    currentMonthEstimate: number;
    nextMonthForecast: number;
    annualForecast: number;
    optimizationPotential: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class StorageMonitoringService {
  private readonly baseUrl = '/api';
  private usageSubject = new BehaviorSubject<StorageUsage | null>(null);
  private costsSubject = new BehaviorSubject<CostData | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public usage$ = this.usageSubject.asObservable();
  public costs$ = this.costsSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('authToken');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = `HTTP ${error.status}: ${error.statusText}`;
    }
    
    this.errorSubject.next(errorMessage);
    return throwError(errorMessage);
  }

  fetchUsage(timeRange: string = '7days'): Observable<StorageUsage> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<{ success: boolean; data: StorageUsage }>(
      `${this.baseUrl}/user/storage/usage`,
      { 
        headers: this.getHeaders(),
        params: { timeRange }
      }
    ).pipe(
      map(response => {
        this.usageSubject.next(response.data);
        this.loadingSubject.next(false);
        return response.data;
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  fetchCosts(timeRange: string = '30days'): Observable<CostData> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<{ success: boolean; data: CostData }>(
      `${this.baseUrl}/user/storage/costs`,
      { 
        headers: this.getHeaders(),
        params: { timeRange }
      }
    ).pipe(
      map(response => {
        this.costsSubject.next(response.data);
        this.loadingSubject.next(false);
        return response.data;
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  updateQuota(quota: { maxStorageBytes: number; maxMonthlyCostUsd: number }): Observable<any> {
    this.loadingSubject.next(true);
    
    return this.http.put(
      `${this.baseUrl}/user/storage/quota`,
      quota,
      { headers: this.getHeaders() }
    ).pipe(
      map(response => {
        this.loadingSubject.next(false);
        return response;
      }),
      catchError(error => {
        this.loadingSubject.next(false);
        return this.handleError(error);
      })
    );
  }

  clearError(): void {
    this.errorSubject.next(null);
  }
}
```

### 2. Angular Component

```typescript
// components/storage-dashboard.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Chart, ChartConfiguration } from 'chart.js/auto';
import { StorageMonitoringService, StorageUsage, CostData } from '../services/storage-monitoring.service';

@Component({
  selector: 'app-storage-dashboard',
  templateUrl: './storage-dashboard.component.html',
  styleUrls: ['./storage-dashboard.component.css']
})
export class StorageDashboardComponent implements OnInit, OnDestroy {
  usage: StorageUsage | null = null;
  costs: CostData | null = null;
  loading = false;
  error: string | null = null;
  timeRange = '7days';

  private subscriptions: Subscription[] = [];
  private usageChart: Chart | null = null;
  private costChart: Chart | null = null;

  timeRanges = [
    { value: '24hours', label: '24 Hours' },
    { value: '7days', label: '7 Days' },
    { value: '30days', label: '30 Days' },
    { value: '90days', label: '90 Days' }
  ];

  constructor(private storageService: StorageMonitoringService) {}

  ngOnInit(): void {
    this.subscribeToData();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.usageChart) this.usageChart.destroy();
    if (this.costChart) this.costChart.destroy();
  }

  private subscribeToData(): void {
    this.subscriptions.push(
      this.storageService.usage$.subscribe(usage => {
        this.usage = usage;
        if (usage) this.createUsageChart();
      }),
      
      this.storageService.costs$.subscribe(costs => {
        this.costs = costs;
        if (costs) this.createCostChart();
      }),

      this.storageService.loading$.subscribe(loading => {
        this.loading = loading;
      }),

      this.storageService.error$.subscribe(error => {
        this.error = error;
      })
    );
  }

  loadData(): void {
    this.storageService.fetchUsage(this.timeRange).subscribe();
    this.storageService.fetchCosts(this.timeRange).subscribe();
  }

  onTimeRangeChange(): void {
    this.loadData();
  }

  retry(): void {
    this.storageService.clearError();
    this.loadData();
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  private createUsageChart(): void {
    if (!this.usage?.overview?.storageByDate) return;

    const canvas = document.getElementById('usageChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.usageChart) {
      this.usageChart.destroy();
    }

    const storageData = this.usage.overview.storageByDate;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: storageData.map(d => new Date(d.date).toLocaleDateString()),
        datasets: [{
          label: 'Storage Usage',
          data: storageData.map(d => d.totalBytes),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `Storage: ${this.formatBytes(context.parsed.y)}`
            }
          }
        }
      }
    };

    this.usageChart = new Chart(canvas, config);
  }

  private createCostChart(): void {
    if (!this.costs?.costs?.breakdown) return;

    const canvas = document.getElementById('costChart') as HTMLCanvasElement;
    if (!canvas) return;

    if (this.costChart) {
      this.costChart.destroy();
    }

    const breakdown = this.costs.costs.breakdown;

    const config: ChartConfiguration = {
      type: 'doughnut',
      data: {
        labels: Object.keys(breakdown),
        datasets: [{
          data: Object.values(breakdown),
          backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${this.formatCurrency(context.parsed)}`
            }
          }
        }
      }
    };

    this.costChart = new Chart(canvas, config);
  }
}
```

### 3. Angular Component Template

```html
<!-- storage-dashboard.component.html -->
<div class="storage-dashboard">
  <!-- Header -->
  <div class="dashboard-header">
    <h1>Storage Monitoring</h1>
    <select [(ngModel)]="timeRange" (change)="onTimeRangeChange()" class="time-range-select">
      <option *ngFor="let range of timeRanges" [value]="range.value">
        {{ range.label }}
      </option>
    </select>
  </div>

  <!-- Loading State -->
  <div *ngIf="loading" class="loading-container">
    <div class="spinner"></div>
    <p>Loading storage data...</p>
  </div>

  <!-- Error State -->
  <div *ngIf="error && !loading" class="error-container">
    <h3>Error loading storage data</h3>
    <p>{{ error }}</p>
    <button (click)="retry()" class="retry-button">Retry</button>
  </div>

  <!-- Dashboard Content -->
  <div *ngIf="!loading && !error" class="dashboard-content">
    <!-- Stats Cards -->
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Storage</h3>
        <p class="stat-value">{{ formatBytes(usage?.overview?.totalBytes || 0) }}</p>
      </div>
      <div class="stat-card">
        <h3>Total Files</h3>
        <p class="stat-value">{{ usage?.overview?.totalFiles || 0 }}</p>
      </div>
      <div class="stat-card">
        <h3>Monthly Cost</h3>
        <p class="stat-value">{{ formatCurrency(usage?.overview?.monthlyCost || 0) }}</p>
      </div>
      <div class="stat-card">
        <h3>Operations</h3>
        <p class="stat-value">{{ usage?.overview?.totalOperations || 0 }}</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="charts-grid">
      <div class="chart-container">
        <h3>Storage Usage Over Time</h3>
        <canvas id="usageChart"></canvas>
      </div>
      <div class="chart-container">
        <h3>Cost Breakdown</h3>
        <canvas id="costChart"></canvas>
      </div>
    </div>

    <!-- Usage Progress -->
    <div *ngIf="usage?.quotaStatus" class="quota-container">
      <h3>Storage Quota</h3>
      <div class="quota-bar">
        <div 
          class="quota-fill" 
          [style.width.%]="usage.quotaStatus.usagePercentage"
          [class.warning]="usage.quotaStatus.usagePercentage >= 80"
          [class.critical]="usage.quotaStatus.usagePercentage >= 95">
        </div>
      </div>
      <p>{{ usage.quotaStatus.usagePercentage.toFixed(1) }}% of quota used</p>
    </div>
  </div>
</div>
```

## Vanilla JavaScript

### 1. ES6 Module

```javascript
// js/storage-monitoring.js
export class StorageMonitoring {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api';
    this.authToken = localStorage.getItem('authToken');
    this.refreshInterval = options.refreshInterval || 30000;
    this.autoRefresh = options.autoRefresh || false;
    
    this.data = {
      usage: null,
      costs: null,
      performance: null
    };
    
    this.loading = false;
    this.error = null;
    this.callbacks = {};
    
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  // Event system
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  // API methods
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      this.error = error.message;
      this.emit('error', error.message);
      throw error;
    }
  }

  async fetchUsage(timeRange = '7days') {
    try {
      this.loading = true;
      this.emit('loading', true);

      const result = await this.request(`/user/storage/usage?timeRange=${timeRange}`);
      this.data.usage = result.data;
      this.emit('usage', result.data);
      
      return result.data;
    } finally {
      this.loading = false;
      this.emit('loading', false);
    }
  }

  async fetchCosts(timeRange = '30days') {
    try {
      this.loading = true;
      this.emit('loading', true);

      const result = await this.request(`/user/storage/costs?timeRange=${timeRange}`);
      this.data.costs = result.data;
      this.emit('costs', result.data);
      
      return result.data;
    } finally {
      this.loading = false;
      this.emit('loading', false);
    }
  }

  async fetchPerformance(timeRange = '7days') {
    try {
      this.loading = true;
      this.emit('loading', true);

      const result = await this.request(`/user/storage/performance?timeRange=${timeRange}`);
      this.data.performance = result.data;
      this.emit('performance', result.data);
      
      return result.data;
    } finally {
      this.loading = false;
      this.emit('loading', false);
    }
  }

  async updateQuota(quota) {
    return this.request('/user/storage/quota', {
      method: 'PUT',
      body: JSON.stringify(quota)
    });
  }

  // Auto-refresh functionality
  startAutoRefresh() {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => {
      this.fetchUsage();
      this.fetchCosts();
    }, this.refreshInterval);
  }

  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Utility methods
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  destroy() {
    this.stopAutoRefresh();
    this.callbacks = {};
  }
}

// Chart helper
export class StorageChart {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = {
      type: 'line',
      responsive: true,
      ...options
    };
    this.chart = null;
  }

  async loadChart() {
    // Dynamically import Chart.js
    const { Chart } = await import('chart.js/auto');
    return Chart;
  }

  async create(data) {
    const Chart = await this.loadChart();
    
    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(this.ctx, {
      type: this.options.type,
      data: data,
      options: this.options
    });
  }

  update(data) {
    if (this.chart) {
      this.chart.data = data;
      this.chart.update();
    }
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
```

### 2. HTML Implementation

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Storage Monitoring Dashboard</title>
    <style>
        .dashboard {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .dashboard-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        
        .stat-card h3 {
            margin: 0 0 0.5rem 0;
            color: #6b7280;
            font-size: 0.875rem;
            font-weight: 500;
        }
        
        .stat-value {
            margin: 0;
            font-size: 1.875rem;
            font-weight: bold;
            color: #111827;
        }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        
        .chart-container {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        
        .chart-container h3 {
            margin: 0 0 1rem 0;
            color: #111827;
            font-size: 1.125rem;
            font-weight: 600;
        }
        
        .loading {
            text-align: center;
            padding: 2rem;
        }
        
        .error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 0 auto;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .quota-container {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e5e7eb;
        }
        
        .quota-bar {
            width: 100%;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin: 1rem 0;
        }
        
        .quota-fill {
            height: 100%;
            background: #3b82f6;
            transition: width 0.3s ease;
        }
        
        .quota-fill.warning {
            background: #f59e0b;
        }
        
        .quota-fill.critical {
            background: #ef4444;
        }
    </style>
</head>
<body>
    <div class="dashboard">
        <!-- Header -->
        <div class="dashboard-header">
            <h1>Storage Monitoring</h1>
            <select id="timeRange">
                <option value="24hours">24 Hours</option>
                <option value="7days" selected>7 Days</option>
                <option value="30days">30 Days</option>
                <option value="90days">90 Days</option>
            </select>
        </div>

        <!-- Loading State -->
        <div id="loading" class="loading" style="display: none;">
            <div class="spinner"></div>
            <p>Loading storage data...</p>
        </div>

        <!-- Error State -->
        <div id="error" class="error" style="display: none;">
            <h3>Error loading storage data</h3>
            <p id="errorMessage"></p>
            <button onclick="retry()">Retry</button>
        </div>

        <!-- Dashboard Content -->
        <div id="dashboard" style="display: none;">
            <!-- Stats Cards -->
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Total Storage</h3>
                    <p class="stat-value" id="totalStorage">0 Bytes</p>
                </div>
                <div class="stat-card">
                    <h3>Total Files</h3>
                    <p class="stat-value" id="totalFiles">0</p>
                </div>
                <div class="stat-card">
                    <h3>Monthly Cost</h3>
                    <p class="stat-value" id="monthlyCost">$0.00</p>
                </div>
                <div class="stat-card">
                    <h3>Operations</h3>
                    <p class="stat-value" id="totalOperations">0</p>
                </div>
            </div>

            <!-- Charts -->
            <div class="charts-grid">
                <div class="chart-container">
                    <h3>Storage Usage Over Time</h3>
                    <canvas id="usageChart"></canvas>
                </div>
                <div class="chart-container">
                    <h3>Cost Breakdown</h3>
                    <canvas id="costChart"></canvas>
                </div>
            </div>

            <!-- Quota Usage -->
            <div class="quota-container">
                <h3>Storage Quota</h3>
                <div class="quota-bar">
                    <div id="quotaFill" class="quota-fill" style="width: 0%"></div>
                </div>
                <p id="quotaText">0% of quota used</p>
            </div>
        </div>
    </div>

    <script type="module">
        import { StorageMonitoring, StorageChart } from './js/storage-monitoring.js';

        // Initialize storage monitoring
        const storage = new StorageMonitoring({
            autoRefresh: true,
            refreshInterval: 30000
        });

        // Initialize charts
        const usageChart = new StorageChart(document.getElementById('usageChart'), {
            type: 'line'
        });

        const costChart = new StorageChart(document.getElementById('costChart'), {
            type: 'doughnut'
        });

        // DOM elements
        const elements = {
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            dashboard: document.getElementById('dashboard'),
            errorMessage: document.getElementById('errorMessage'),
            timeRange: document.getElementById('timeRange'),
            totalStorage: document.getElementById('totalStorage'),
            totalFiles: document.getElementById('totalFiles'),
            monthlyCost: document.getElementById('monthlyCost'),
            totalOperations: document.getElementById('totalOperations'),
            quotaFill: document.getElementById('quotaFill'),
            quotaText: document.getElementById('quotaText')
        };

        // Event listeners
        storage.on('loading', (loading) => {
            elements.loading.style.display = loading ? 'block' : 'none';
            if (!loading) {
                elements.error.style.display = 'none';
                elements.dashboard.style.display = 'block';
            }
        });

        storage.on('error', (error) => {
            elements.error.style.display = 'block';
            elements.errorMessage.textContent = error;
            elements.dashboard.style.display = 'none';
        });

        storage.on('usage', (data) => {
            updateStats(data);
            updateQuota(data);
            createUsageChart(data);
        });

        storage.on('costs', (data) => {
            createCostChart(data);
        });

        elements.timeRange.addEventListener('change', (e) => {
            loadData(e.target.value);
        });

        // Functions
        function updateStats(data) {
            elements.totalStorage.textContent = storage.formatBytes(data.overview?.totalBytes || 0);
            elements.totalFiles.textContent = data.overview?.totalFiles || 0;
            elements.monthlyCost.textContent = storage.formatCurrency(data.overview?.monthlyCost || 0);
            elements.totalOperations.textContent = data.overview?.totalOperations || 0;
        }

        function updateQuota(data) {
            if (data.quotaStatus) {
                const percentage = data.quotaStatus.usagePercentage;
                elements.quotaFill.style.width = `${Math.min(percentage, 100)}%`;
                elements.quotaText.textContent = `${percentage.toFixed(1)}% of quota used`;
                
                // Update color based on usage
                elements.quotaFill.className = 'quota-fill';
                if (percentage >= 95) {
                    elements.quotaFill.classList.add('critical');
                } else if (percentage >= 80) {
                    elements.quotaFill.classList.add('warning');
                }
            }
        }

        async function createUsageChart(data) {
            if (!data.overview?.storageByDate) return;

            const storageData = data.overview.storageByDate;
            const chartData = {
                labels: storageData.map(d => new Date(d.date).toLocaleDateString()),
                datasets: [{
                    label: 'Storage Usage',
                    data: storageData.map(d => d.totalBytes),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }]
            };

            await usageChart.create(chartData);
        }

        async function createCostChart(data) {
            if (!data.costs?.breakdown) return;

            const breakdown = data.costs.breakdown;
            const chartData = {
                labels: Object.keys(breakdown),
                datasets: [{
                    data: Object.values(breakdown),
                    backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
                }]
            };

            await costChart.create(chartData);
        }

        function loadData(timeRange = '7days') {
            storage.fetchUsage(timeRange);
            storage.fetchCosts(timeRange);
        }

        window.retry = function() {
            const timeRange = elements.timeRange.value;
            loadData(timeRange);
        };

        // Initialize
        loadData();
    </script>
</body>
</html>
```

## API Reference

### Authentication

All API requests require authentication using a Bearer token:

```javascript
const token = localStorage.getItem('authToken');
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};
```

### Endpoints

#### Get Storage Usage
```
GET /api/user/storage/usage?timeRange={timeRange}
```

**Parameters:**
- `timeRange`: `24hours`, `7days`, `30days`, `90days`

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBytes": 1073741824,
      "totalFiles": 150,
      "monthlyCost": 2.5,
      "totalOperations": 1250,
      "storageByDate": [
        { "date": "2024-01-01", "totalBytes": 1000000000 },
        { "date": "2024-01-02", "totalBytes": 1073741824 }
      ]
    },
    "quotaStatus": {
      "maxStorageBytes": 5368709120,
      "usagePercentage": 20.0
    }
  }
}
```

#### Get Cost Analytics
```
GET /api/user/storage/costs?timeRange={timeRange}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "costs": {
      "breakdown": {
        "storage": 1.5,
        "operations": 0.8,
        "transfer": 0.2
      },
      "trends": [
        { "date": "2024-01-01", "cost": 2.3 },
        { "date": "2024-01-02", "cost": 2.5 }
      ]
    },
    "forecast": {
      "currentMonthEstimate": 2.5,
      "nextMonthForecast": 3.2,
      "annualForecast": 35.0,
      "optimizationPotential": 8.5
    }
  }
}
```

#### Get Performance Metrics
```
GET /api/user/storage/performance?timeRange={timeRange}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "performance": {
      "operationLatencies": [
        { "operation": "upload", "avgLatency": 150 },
        { "operation": "download", "avgLatency": 80 }
      ],
      "errorRates": [
        { "operation": "upload", "errorRate": 2.1 },
        { "operation": "download", "errorRate": 0.5 }
      ]
    },
    "recommendations": {
      "performanceScore": 85,
      "recommendations": [
        "Use multipart uploads for files larger than 100MB",
        "Implement client-side compression"
      ]
    }
  }
}
```

#### Update Quota
```
PUT /api/user/storage/quota
```

**Request Body:**
```json
{
  "maxStorageBytes": 5368709120,
  "maxMonthlyCostUsd": 50.0
}
```

## Error Handling

### Common Error Scenarios

#### Network Errors
```javascript
try {
  const response = await fetch('/api/user/storage/usage');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
} catch (error) {
  if (error instanceof TypeError) {
    // Network error
    console.error('Network error:', error.message);
  } else {
    // HTTP error
    console.error('API error:', error.message);
  }
}
```

#### Authentication Errors
```javascript
if (response.status === 401) {
  // Token expired or invalid
  localStorage.removeItem('authToken');
  window.location.href = '/login';
}
```

#### Rate Limiting
```javascript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  setTimeout(() => {
    // Retry request
    fetchData();
  }, (retryAfter || 60) * 1000);
}
```

## Best Practices

### 1. Caching
```javascript
// Implement client-side caching
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getCachedData(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  
  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

### 2. Error Retry Logic
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (response.status >= 500 && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }
}
```

### 3. Performance Optimization
```javascript
// Debounce frequent updates
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

const debouncedRefresh = debounce(() => {
  storage.fetchUsage();
}, 1000);
```

### 4. Memory Management
```javascript
// Clean up resources
class StorageDashboard {
  constructor() {
    this.charts = [];
    this.subscriptions = [];
  }
  
  destroy() {
    // Destroy charts
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
    
    // Clear subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    // Clear timers
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }
}
```

---

This comprehensive integration guide provides examples for all major frontend frameworks and includes best practices for building robust storage monitoring interfaces.