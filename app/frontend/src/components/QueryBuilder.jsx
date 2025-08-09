import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../api';

// 🐱 Charlie's Material-UI imports - optimized for CUT interface
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

// 🐱 Charlie's icons for excellent UX
import SearchIcon from '@mui/icons-material/Search';
import GetAppIcon from '@mui/icons-material/GetApp';
import FilterListIcon from '@mui/icons-material/FilterList';
import TimerIcon from '@mui/icons-material/Timer';
import SpeedIcon from '@mui/icons-material/Speed';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';

// Import Ruby's FilterPanel
import FilterPanel from './FilterPanel';

/**
 * QueryBuilder - Charlie's Main CUT Interface Component
 * 
 * 🐱 Charlie's CUT Philosophy:
 * - THE most useful filtering experience possible
 * - Smart performance strategies based on file size
 * - Real-time filtering for small files, manual for large
 * - Excellent user feedback and progressive enhancement
 * - Integration with Ruby's FilterPanel and existing patterns
 * 
 * Performance Features:
 * - Real-time filtering for files <10k rows
 * - Debounced updates for files 10k-50k rows  
 * - Manual "Apply Filters" for files >50k rows
 * - Smart caching and optimization strategies
 */
const QueryBuilder = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const { token } = useContext(AuthContext);
  
  // File info state
  const [fileName, setFileName] = useState('');
  
  // Core state
  const [performanceStrategy, setPerformanceStrategy] = useState(null);
  const [filters, setFilters] = useState([]);
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Query state
  const [logicalOperator, setLogicalOperator] = useState('AND');
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [filtersChanged, setFiltersChanged] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // Export state
  const [exporting, setExporting] = useState(false);
  
  // Debounce timer for medium files
  const [debounceTimer, setDebounceTimer] = useState(null);

  // Authentication check
  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
  }, [token, navigate]);

  // Fetch performance analysis on mount
  useEffect(() => {
    if (fileId && token) {
      fetchPerformanceStrategy();
      fetchFileInfo();
    }
  }, [fileId, token]);

  /**
   * 🐱 CHARLIE'S FILE INFO FETCHER
   */
  const fetchFileInfo = async () => {
    try {
      const response = await api.get('/files', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        const file = response.data.files.find(f => f.id === fileId);
        if (file) {
          setFileName(file.filename);
        } else {
          setError('File not found');
          navigate('/manage_files');
        }
      }
    } catch (err) {
      console.error('🐱 File info fetch failed:', err);
      setError('Failed to load file information');
    }
  };

  // Auto-update logic based on performance strategy
  useEffect(() => {
    if (filters.length > 0 && autoUpdate && performanceStrategy) {
      handleAutoUpdate();
    } else if (filters.length === 0) {
      // Clear results when no filters
      setQueryResults(null);
      setFiltersChanged(false);
    }
  }, [filters, logicalOperator, autoUpdate, performanceStrategy]);

  /**
   * 🐱 CHARLIE'S PERFORMANCE STRATEGY FETCHER
   */
  const fetchPerformanceStrategy = async () => {
    try {
      const response = await api.get(`/files/${fileId}/performance`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setPerformanceStrategy(response.data);
        
        // Auto-disable auto-update for large files
        if (response.data.strategy === 'manual') {
          setAutoUpdate(false);
        }
        
        console.log(`🐱 Performance strategy: ${response.data.strategy} for ${response.data.fileInfo.rowCount} rows`);
      }
    } catch (err) {
      console.error('🐱 Performance analysis failed:', err);
    }
  };

  /**
   * 🐱 CHARLIE'S AUTO-UPDATE LOGIC: Smart updating based on file size
   */
  const handleAutoUpdate = useCallback(() => {
    if (!performanceStrategy) return;

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (performanceStrategy.strategy === 'real-time') {
      // Real-time updates for small files
      const timer = setTimeout(() => {
        executeQuery();
      }, performanceStrategy.updateDelay);
      setDebounceTimer(timer);
    } else if (performanceStrategy.strategy === 'debounced') {
      // Debounced updates for medium files
      setFiltersChanged(true);
      const timer = setTimeout(() => {
        executeQuery();
      }, performanceStrategy.updateDelay);
      setDebounceTimer(timer);
    } else {
      // Manual updates for large files - just mark as changed
      setFiltersChanged(true);
    }
  }, [filters, logicalOperator, performanceStrategy, debounceTimer]);

  /**
   * 🐱 CHARLIE'S MAIN QUERY EXECUTION
   */
  const executeQuery = async () => {
    if (filters.length === 0) return;

    try {
      setLoading(true);
      setError('');
      setFiltersChanged(false);

      const queryRequest = {
        fileId,
        filters: filters.map(f => ({
          type: f.filterType,
          columnName: f.columnName,
          value: f.value
        })),
        logicalOperator,
        limit: rowsPerPage,
        offset: page * rowsPerPage
      };

      console.log(`🐱 Executing CUT query with ${filters.length} filters`);

      const response = await api.post(`/files/${fileId}/query`, queryRequest, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setQueryResults(response.data);
        console.log(`🐱 Query completed: ${response.data.data.filteredRows}/${response.data.data.totalRows} rows match filters in ${response.data.metadata.processingTimeMs}ms`);
      } else {
        setError('Query failed');
      }
    } catch (err) {
      console.error('🐱 Query execution failed:', err);
      setError(err.response?.data?.message || 'Query execution failed');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 🐱 CHARLIE'S EXPORT FUNCTIONALITY
   */
  const handleExport = async () => {
    if (filters.length === 0) {
      setError('Please add filters before exporting');
      return;
    }

    try {
      setExporting(true);
      setError('');

      const queryRequest = {
        fileId,
        filters: filters.map(f => ({
          type: f.filterType,
          columnName: f.columnName,
          value: f.value
        })),
        logicalOperator
      };

      console.log(`🐱 Exporting filtered data with ${filters.length} filters`);

      const response = await api.post(`/files/${fileId}/export/filtered`, queryRequest, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccessMessage(`🐱 ${response.data.message}`);
        
        // Trigger download
        window.open(response.data.downloadUrl, '_blank');
        
        console.log(`🐱 Export completed: ${response.data.metadata.filteredRows} rows exported`);
      } else {
        setError('Export failed');
      }
    } catch (err) {
      console.error('🐱 Export failed:', err);
      setError(err.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  /**
   * 🐱 CHARLIE'S FILTER CHANGE HANDLER
   */
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    setPage(0); // Reset pagination when filters change
  };

  /**
   * 🐱 CHARLIE'S PAGINATION HANDLERS
   */
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
    if (queryResults) {
      executeQuery(); // Fetch new page
    }
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
    if (queryResults) {
      executeQuery(); // Fetch with new page size
    }
  };

  /**
   * 🐱 CHARLIE'S PERFORMANCE INDICATOR COMPONENT
   */
  const PerformanceIndicator = () => {
    if (!performanceStrategy) return null;

    const strategyColors = {
      'real-time': 'success',
      'debounced': 'warning', 
      'manual': 'error'
    };

    const strategyLabels = {
      'real-time': 'Real-time',
      'debounced': 'Smart Update',
      'manual': 'Manual'
    };

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <SpeedIcon fontSize="small" />
        <Chip 
          label={strategyLabels[performanceStrategy.strategy]}
          color={strategyColors[performanceStrategy.strategy]}
          size="small"
        />
        <Typography variant="caption" color="text.secondary">
          {performanceStrategy.fileInfo.rowCount.toLocaleString()} rows • 
          {(performanceStrategy.fileInfo.size / (1024 * 1024)).toFixed(1)}MB
        </Typography>
        <Tooltip title={
          <Box>
            <Typography variant="caption" display="block">Performance Strategy:</Typography>
            {performanceStrategy.recommendations.map((rec, i) => (
              <Typography key={i} variant="caption" display="block">• {rec}</Typography>
            ))}
          </Box>
        }>
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  };

  /**
   * 🐱 CHARLIE'S RESULTS TABLE COMPONENT
   */
  const ResultsTable = () => {
    if (!queryResults || !queryResults.data.rows.length) {
      return (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {filters.length === 0 
              ? "Add filters to see results" 
              : "No rows match your filters"
            }
          </Typography>
        </Paper>
      );
    }

    const columns = queryResults.data.columns;
    const rows = queryResults.data.rows;

    return (
      <Paper>
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell key={column} sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>
                    {column}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index} hover>
                  {columns.map((column) => (
                    <TableCell key={column}>
                      {row[column] || ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          component="div"
          count={queryResults.data.filteredRows}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon color="primary" />
          CUT - CSV Query Tool
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Smart filtering for <strong>{fileName}</strong>
        </Typography>
        <PerformanceIndicator />
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage('')}>
          {successMessage}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left Panel - Filters */}
        <Grid item xs={12} md={4}>
          <FilterPanel fileId={fileId} onFiltersChange={handleFiltersChange} />
          
          {/* Query Controls */}
          {filters.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Query Controls
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Logic</InputLabel>
                  <Select
                    value={logicalOperator}
                    label="Logic"
                    onChange={(e) => setLogicalOperator(e.target.value)}
                  >
                    <MenuItem value="AND">AND (all filters must match)</MenuItem>
                    <MenuItem value="OR">OR (any filter can match)</MenuItem>
                  </Select>
                </FormControl>

                {performanceStrategy?.strategy !== 'real-time' && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoUpdate}
                        onChange={(e) => setAutoUpdate(e.target.checked)}
                      />
                    }
                    label="Auto-update results"
                  />
                )}

                {/* Manual Apply Button for large files or when auto-update is off */}
                {(!autoUpdate || filtersChanged) && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={executeQuery}
                      disabled={loading}
                      startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
                    >
                      {loading ? 'Applying Filters...' : 'Apply Filters'}
                    </Button>
                  </Box>
                )}

                {/* Export Button */}
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleExport}
                  disabled={exporting || filters.length === 0}
                  startIcon={exporting ? <CircularProgress size={20} /> : <GetAppIcon />}
                  sx={{ mt: 2 }}
                >
                  {exporting ? 'Exporting...' : 'CUT IT! (Export)'}
                </Button>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Panel - Results */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  Query Results
                  {queryResults && (
                    <Badge 
                      badgeContent={queryResults.data.filteredRows} 
                      color="primary" 
                      sx={{ ml: 1 }}
                    />
                  )}
                </Typography>
                
                {queryResults && (
                  <Chip 
                    icon={<TimerIcon />}
                    label={`${queryResults.metadata.processingTimeMs}ms`}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>

              {loading && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    Processing filters...
                  </Typography>
                </Box>
              )}

              {queryResults && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Showing {queryResults.data.filteredRows.toLocaleString()} of {queryResults.data.totalRows.toLocaleString()} rows
                  {queryResults.data.filteredRows !== queryResults.data.totalRows && (
                    <> ({((queryResults.data.filteredRows / queryResults.data.totalRows) * 100).toFixed(1)}% match)</>
                  )}
                </Alert>
              )}

              <ResultsTable />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QueryBuilder;