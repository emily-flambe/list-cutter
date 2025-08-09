import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Download as ExportIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import FilterPanel from './FilterPanel';

/**
 * QueryBuilder - Main CUT (Cutty Ultimate Tool) interface
 * 
 * Charlie's Feature Implementation:
 * - Smart performance strategies based on file size
 * - Real-time filtering for small files (<10k rows)
 * - Debounced updates for medium files (10k-50k rows) 
 * - Manual "Apply Filters" for large files (>50k rows)
 * - Export filtered data as new CSV files
 * - Integration with existing authentication and file management
 */
const QueryBuilder = ({ fileId: propFileId, onClose }) => {
  const { token } = useContext(AuthContext);
  const { fileId: routeFileId } = useParams();
  const navigate = useNavigate();
  const [fileId, setFileId] = useState(propFileId || routeFileId || '');
  const [fileInfo, setFileInfo] = useState(null);
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Performance strategy state
  const [updateStrategy, setUpdateStrategy] = useState('manual');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState(null);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Initialize when fileId is provided
  useEffect(() => {
    if (fileId && token) {
      initializeFile();
    }
  }, [fileId, token]);

  // Auto-update logic based on performance strategy
  useEffect(() => {
    if (filters.length > 0 && updateStrategy === 'realtime' && autoUpdate) {
      executeQuery(true);
    } else if (filters.length > 0 && updateStrategy === 'debounced' && autoUpdate) {
      // Clear previous timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      // Set new debounced timer
      const timer = setTimeout(() => {
        executeQuery(true);
      }, performance?.updateInterval || 500);
      
      setDebounceTimer(timer);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [filters, updateStrategy, autoUpdate, performance]);

  const initializeFile = async () => {
    setLoading(true);
    setError('');
    
    try {
      console.log(`🐱 Initializing CUT for file ${fileId}`);

      // Load column metadata and performance strategy in parallel
      const [columnsResponse, performanceResponse] = await Promise.all([
        api.get(`/api/v1/files/${fileId}/columns`),
        api.get(`/api/v1/files/${fileId}/performance`)
      ]);

      if (!columnsResponse.data.success) {
        throw new Error(columnsResponse.data.error || 'Failed to load column metadata');
      }

      setColumns(columnsResponse.data.columns || []);
      setFileInfo(columnsResponse.data.fileInfo || {});
      
      // Set up performance strategy
      if (performanceResponse.data) {
        setPerformance(performanceResponse.data);
        setUpdateStrategy(performanceResponse.data.strategy);
        setAutoUpdate(performanceResponse.data.strategy !== 'manual');
        
        console.log(`🐱 Performance strategy: ${performanceResponse.data.strategy} for ${performanceResponse.data.estimatedRows} rows`);
      }

      setSuccessMessage(`File loaded! ${columnsResponse.data.columns?.length || 0} columns detected. ${performanceResponse.data?.strategy === 'realtime' ? 'Real-time filtering enabled.' : performanceResponse.data?.strategy === 'debounced' ? 'Smart debounced filtering enabled.' : 'Manual filtering mode (large file).'}`);
      
    } catch (err) {
      console.error('🐱 File initialization failed:', err);
      const message = err.response?.data?.message || err.message || 'Failed to initialize file';
      setError(`File loading failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = useCallback(async (isAutoUpdate = false) => {
    if (!fileId || filters.length === 0) {
      setFilteredData(null);
      return;
    }

    setFiltering(true);
    setError('');

    try {
      console.log(`🐱 Executing query with ${filters.length} filters (auto: ${isAutoUpdate})`);

      const queryRequest = {
        filters,
        includePreview: true,
        previewLimit: 100,
        includeAnalysis: false
      };

      const response = await api.post(`/api/v1/files/${fileId}/query`, queryRequest);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Query execution failed');
      }

      setFilteredData(response.data.data);
      setPage(0); // Reset pagination
      
      if (!isAutoUpdate) {
        const resultCount = response.data.data.filteredCount;
        const totalCount = response.data.data.totalRows;
        setSuccessMessage(`Query complete! ${resultCount.toLocaleString()} of ${totalCount.toLocaleString()} rows match your filters.`);
      }

    } catch (err) {
      console.error('🐱 Query execution failed:', err);
      const message = err.response?.data?.message || err.message || 'Query execution failed';
      setError(`Query failed: ${message}`);
      setFilteredData(null);
    } finally {
      setFiltering(false);
    }
  }, [fileId, filters]);

  const handleFiltersChange = (newFilters) => {
    console.log(`🐱 Filters updated: ${newFilters.length} active filters`);
    setFilters(newFilters);
  };

  const handleManualRefresh = () => {
    executeQuery(false);
  };

  const handleExport = async () => {
    if (!filteredData || filteredData.filteredCount === 0) {
      setError('No filtered data to export. Apply some filters first.');
      return;
    }

    setExporting(true);
    setError('');

    try {
      console.log(`🐱 Exporting ${filteredData.filteredCount} filtered rows`);

      const exportRequest = {
        filters,
        includeMetadata: true
      };

      const response = await api.post(`/api/v1/files/${fileId}/export/filtered`, exportRequest);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Export failed');
      }

      // Trigger download
      const downloadUrl = response.data.downloadUrl;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = response.data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMessage(`Export complete! ${response.data.filename} has been saved to your files and downloaded.`);

    } catch (err) {
      console.error('🐱 Export failed:', err);
      const message = err.response?.data?.message || err.message || 'Export failed';
      setError(`Export failed: ${message}`);
    } finally {
      setExporting(false);
    }
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getPerformanceIndicator = () => {
    if (!performance) return null;

    const indicators = {
      realtime: { color: 'success', label: 'Real-time', icon: '⚡' },
      debounced: { color: 'info', label: 'Smart Updates', icon: '🧠' },
      manual: { color: 'warning', label: 'Manual Mode', icon: '👆' }
    };

    const indicator = indicators[updateStrategy] || indicators.manual;

    return (
      <Chip
        size="small"
        color={indicator.color}
        label={`${indicator.icon} ${indicator.label}`}
        sx={{ ml: 1 }}
      />
    );
  };

  const displayedRows = filteredData?.filteredRows ? 
    filteredData.filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : [];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        🔨 CUT - Cutty Ultimate Tool
        {getPerformanceIndicator()}
        {(onClose || routeFileId) && (
          <Button 
            onClick={onClose || (() => navigate('/manage_files'))} 
            sx={{ ml: 'auto' }} 
            variant="outlined"
          >
            Back to Files
          </Button>
        )}
      </Typography>
      
      <Typography variant="h6" component="h2" color="text.secondary" sx={{ mb: 3 }}>
        The ultimate tool for cutting data into the shape of your dreams
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading file analysis...</Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {/* File Info Panel */}
          {fileInfo && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    📄 File Information
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Filename: <strong>{fileInfo.filename}</strong>
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Columns: <strong>{columns.length}</strong>
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2" color="text.secondary">
                        Estimated Rows: <strong>{performance?.estimatedRows?.toLocaleString() || 'Unknown'}</strong>
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Filter Panel */}
          <Grid item xs={12} lg={4}>
            <FilterPanel
              columns={columns}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              updateStrategy={updateStrategy}
              isFiltering={filtering}
            />
          </Grid>

          {/* Results Panel */}
          <Grid item xs={12} lg={8}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    🎯 Filtered Results
                    {filteredData && (
                      <Typography component="span" color="text.secondary" sx={{ ml: 2, fontSize: '0.9em' }}>
                        {filteredData.filteredCount.toLocaleString()} of {filteredData.totalRows.toLocaleString()} rows
                      </Typography>
                    )}
                  </Typography>
                  
                  <Box>
                    {updateStrategy === 'manual' && (
                      <Tooltip title="Apply current filters">
                        <IconButton 
                          onClick={handleManualRefresh}
                          disabled={filtering || filters.length === 0}
                          color="primary"
                        >
                          {filtering ? <CircularProgress size={20} /> : <RefreshIcon />}
                        </IconButton>
                      </Tooltip>
                    )}
                    
                    <Tooltip title="Export filtered data as CSV">
                      <span>
                        <IconButton
                          onClick={handleExport}
                          disabled={exporting || !filteredData || filteredData.filteredCount === 0}
                          color="secondary"
                        >
                          {exporting ? <CircularProgress size={20} /> : <ExportIcon />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                {filters.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <FilterIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                      Add filters to start cutting your data
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Use the filter panel on the left to create intelligent filters based on your column types
                    </Typography>
                  </Box>
                ) : filteredData ? (
                  <>
                    {/* Filter Summary */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Active Filters ({filters.length}):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {filters.map((filter, index) => (
                          <Chip
                            key={index}
                            size="small"
                            label={`${filter.column} ${filter.operator} ${filter.value || ''}`}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {/* Results Table */}
                    {displayedRows.length > 0 ? (
                      <>
                        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                {filteredData.headers.map((header, index) => (
                                  <TableCell key={index} sx={{ fontWeight: 'bold' }}>
                                    {header}
                                  </TableCell>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {displayedRows.map((row, rowIndex) => (
                                <TableRow key={rowIndex} hover>
                                  {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex}>
                                      {cell}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>

                        <TablePagination
                          rowsPerPageOptions={[25, 50, 100]}
                          component="div"
                          count={Math.min(filteredData.filteredCount, filteredData.filteredRows.length)}
                          rowsPerPage={rowsPerPage}
                          page={page}
                          onPageChange={handlePageChange}
                          onRowsPerPageChange={handleRowsPerPageChange}
                        />

                        {filteredData.filteredRows.length < filteredData.filteredCount && (
                          <Alert severity="info" sx={{ mt: 2 }}>
                            <InfoIcon sx={{ mr: 1 }} />
                            Showing preview of first {filteredData.filteredRows.length} rows. 
                            Export to get all {filteredData.filteredCount.toLocaleString()} filtered rows.
                          </Alert>
                        )}
                      </>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="h6" color="text.secondary">
                          No rows match your current filters
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Try adjusting your filter criteria or removing some filters
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : filtering ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                    <Typography sx={{ ml: 2 }}>Applying filters...</Typography>
                  </Box>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default QueryBuilder;