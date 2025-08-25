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
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField
} from '@mui/material';
import {
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  ContentCut as ContentCutIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { AuthContext } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import FilterPanel from './FilterPanel';
import SQLPreviewPanel from './SQLPreviewPanel';
import cuttyLogo from '../assets/cutty_logo.png';

/**
 * QueryBuilder - Main CUT (Cutty Ultimate Tool) interface
 * 
 * Charlie's Feature Implementation:
 * - Manual "Apply Filters" button for all file sizes
 * - Export filtered data as new CSV files
 * - Integration with existing authentication and file management
 * - Simple, predictable filtering behavior
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
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showLoginMessage, setShowLoginMessage] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(!token);
  const [demoMode, setDemoMode] = useState(false);
  
  // File selection state for logged-in users
  const [availableFiles, setAvailableFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState('');
  const [showFileSelection, setShowFileSelection] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  
  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  
  // SQL Preview Panel state
  const [sqlPanelExpanded, setSqlPanelExpanded] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('sqlPanelExpanded') === 'true' : false
  );

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

  // Update authentication state when token changes
  useEffect(() => {
    setIsAnonymous(!token);
  }, [token]);

  // Function to handle changing file
  const handleChangeFile = () => {
    // Reset state
    setFileId('');
    setFileInfo(null);
    setColumns([]);
    setFilters([]);
    setFilteredData(null);
    setDataLoaded(false);
    setError('');
    setSuccessMessage('');
    setSelectedFileId('');
    setShowFileSelection(true);
    setPage(0);
    
    // Load available files for selection
    if (token) {
      loadAvailableFiles();
    }
  };

  // Initialize when component mounts or fileId changes
  useEffect(() => {
    // If no fileId and anonymous, use demo mode with NPORS 2025 data
    if (!fileId && !token) {
      setDemoMode(true);
      setFileId('demo-npors2025');
      initializeFile('demo-npors2025');
    } else if (fileId) {
      initializeFile(fileId);
      setShowFileSelection(false);
    } else if (token && !fileId) {
      // Logged-in user with no fileId - show file selection
      setShowFileSelection(true);
      loadAvailableFiles();
    }
  }, [fileId, token]);

  // Load available files for logged-in users
  const loadAvailableFiles = async () => {
    if (!token) return;
    
    setLoadingFiles(true);
    setError('');
    
    try {
      const response = await api.get('/api/v1/files?type=csv');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to load files');
      }

      // Fetch enhanced metadata for each file (row count, column count)
      const filesWithMetadata = await Promise.all(
        response.data.files.map(async (file) => {
          try {
            const metadataResponse = await api.get(`/api/v1/files/${file.id}/columns`);
            if (metadataResponse.data.success) {
              return {
                ...file,
                totalRows: metadataResponse.data.fileInfo.totalRows,
                totalColumns: metadataResponse.data.fileInfo.totalColumns
              };
            }
          } catch (err) {
            console.warn(`Failed to load metadata for file ${file.id}:`, err);
          }
          return file; // Return without enhanced metadata if failed
        })
      );

      setAvailableFiles(filesWithMetadata);
    } catch (err) {
      console.error('Failed to load available files:', err);
      setError(`Failed to load your files: ${err.message}`);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Handle file selection from dropdown
  const handleFileSelection = (selectedId) => {
    setSelectedFileId(selectedId);
    if (selectedId) {
      setFileId(selectedId);
      setShowFileSelection(false);
      // initializeFile will be called by the useEffect above
    }
  };

  // No auto-update logic - all filtering is manual

  const initializeFile = async (targetFileId) => {
    const actualFileId = targetFileId || fileId;
    setLoading(true);
    setError('');
    
    try {

      let columnsUrl;
      
      // Handle demo mode for anonymous users
      if (actualFileId === 'demo-npors2025' && isAnonymous) {
        columnsUrl = '/api/v1/public/demo/npors2025/columns';
        const demoFileInfo = {
          filename: '2025 National Public Opinion Reference Survey (Demo Data)',
          id: 'demo-npors2025',
          size: 0
        };
        setFileInfo(demoFileInfo);
        // Set default filename for demo
        const timestamp = new Date().toISOString().split('T')[0];
        setExportFilename(`demo-cut-filtered_${timestamp}.csv`);
      } else if (actualFileId === 'reference-squirrel' && token) {
        columnsUrl = '/api/v1/files/reference/squirrel/columns';
      } else {
        columnsUrl = `/api/v1/files/${actualFileId}/columns`;
      }

      // Load column metadata
      const columnsResponse = await api.get(columnsUrl);

      if (!columnsResponse.data.success) {
        throw new Error(columnsResponse.data.error || 'Failed to load column metadata');
      }

      const receivedColumns = columnsResponse.data.columns || [];
      if (!Array.isArray(receivedColumns)) {
        console.warn('Invalid columns data received:', receivedColumns);
        throw new Error('Invalid column data format received from server');
      }

      setColumns(receivedColumns);
      if (!demoMode) {
        const info = columnsResponse.data.fileInfo || {};
        setFileInfo(info);
        // Set default filename
        if (info.filename) {
          const timestamp = new Date().toISOString().split('T')[0];
          const baseFilename = info.filename.replace('.csv', '');
          setExportFilename(`${baseFilename}_cut_${timestamp}.csv`);
        }
      }

      // Only show success message for non-demo mode (check both demoMode state and demo file ID)
      if (!demoMode && actualFileId !== 'demo-npors2025') {
        setSuccessMessage(`File loaded! ${columnsResponse.data.columns?.length || 0} columns detected. Click "Show Data" to preview.`);
      }
      
    } catch (err) {
      console.error('File initialization failed:', err);
      const message = err.response?.data?.message || err.message || 'Failed to initialize file';
      setError(`File loading failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = useCallback(async (isAutoUpdate = false) => {
    if (!fileId) {
      setFilteredData(null);
      return;
    }

    setFiltering(true);
    setError('');

    try {

      const queryRequest = {
        filters: filters.length > 0 ? filters : [],
        includePreview: true,
        previewLimit: 100,
        includeAnalysis: false
      };

      let queryUrl;
      // Handle demo mode for anonymous users
      if (fileId === 'demo-npors2025' && isAnonymous) {
        queryUrl = '/api/v1/public/demo/npors2025/query';
      } else if (fileId === 'reference-squirrel' && token) {
        queryUrl = '/api/v1/files/reference/squirrel/query';
      } else {
        queryUrl = `/api/v1/files/${fileId}/query`;
      }

      const response = await api.post(queryUrl, queryRequest);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Query execution failed');
      }

      setFilteredData(response.data.data);
      setDataLoaded(true);
      setPage(0); // Reset pagination
      
      if (!isAutoUpdate) {
        const resultCount = response.data.data.filteredCount;
        const totalCount = response.data.data.totalRows;
        if (filters.length > 0) {
          setSuccessMessage(`Query complete! ${resultCount.toLocaleString()} of ${totalCount.toLocaleString()} rows match your filters.`);
        } else {
          setSuccessMessage(`Data loaded! Showing ${Math.min(resultCount, 100).toLocaleString()} preview rows of ${totalCount.toLocaleString()} total.`);
        }
      }

    } catch (err) {
      console.error('Query execution failed:', err);
      const message = err.response?.data?.message || err.message || 'Query execution failed';
      setError(`Query failed: ${message}`);
      setFilteredData(null);
    } finally {
      setFiltering(false);
    }
  }, [fileId, filters, demoMode, isAnonymous]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleManualRefresh = () => {
    executeQuery(false);
  };

  const handleSaveToMyFiles = async () => {
    console.log('Save to My Files clicked');
    console.log('Token:', !!token);
    console.log('Filtered data:', !!filteredData);
    
    if (!token) {
      setShowLoginMessage(true);
      return;
    }

    if (!filteredData || filteredData.filteredCount === 0) {
      setError('No data to save. Click "Show Data" first.');
      return;
    }

    setExporting(true);
    setError('');

    try {

      // Use the filename from the input field or generate one
      const filename = exportFilename || (() => {
        const timestamp = new Date().toISOString().split('T')[0];
        const baseFilename = fileInfo?.filename ? fileInfo.filename.replace('.csv', '') : 'filtered';
        return `${baseFilename}_cut_${timestamp}.csv`;
      })();

      // Prepare save request - use the actual export endpoint which already works
      const exportRequest = {
        fileId: fileId,
        filters,
        filename: filename,
        includeMetadata: true
      };
      console.log('Sending save request to export/filtered endpoint...');
      const response = await api.post(`/api/v1/files/${fileId}/export/filtered`, exportRequest);

      console.log('Save response:', response.data);
      
      // Check if the file was actually saved
      if (response.data.success && response.data.savedFile) {
        const savedFilename = response.data.savedFile.filename;
        setSuccessMessage(`File saved to your collection as "${savedFilename}"!`);
        console.log(`✅ File saved with ID: ${response.data.savedFile.id}`);
      } else {
        setSuccessMessage(`File saved to your collection as "${filename}"!`);
      }
      
      // Refresh available files list if function exists
      if (availableFiles.length > 0) {
        await loadAvailableFiles();
      }
    } catch (error) {
      console.error('Error saving file:', error);
      setError(`Failed to save file: ${error.response?.data?.error || error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    if (!filteredData || filteredData.filteredCount === 0) {
      setError('No data to export. Click "Show Data" first.');
      return;
    }

    setExporting(true);
    setError('');

    try {

      // For demo mode, get full filtered dataset and generate CSV client-side
      if (demoMode || isAnonymous) {
        
        // Call query endpoint to get ALL filtered data (not just preview)
        let queryUrl;
        if (fileId === 'demo-npors2025') {
          queryUrl = '/api/v1/public/demo/npors2025/query';
        } else {
          queryUrl = '/api/v1/public/demo/squirrel/query';
        }
        
        const queryRequest = {
          filters: filters.length > 0 ? filters : [],
          includePreview: true,
          previewLimit: 999999 // Get all rows, not just 100
        };
        
        const queryResponse = await api.post(queryUrl, queryRequest);
        
        if (!queryResponse.data.success) {
          throw new Error(queryResponse.data.error || 'Failed to get full dataset');
        }
        
        const fullFilteredData = queryResponse.data.data;
        const csvContent = generateCSVFromFilteredData(fullFilteredData);
        const filename = exportFilename || (() => {
          const timestamp = new Date().toISOString().split('T')[0];
          return `demo-cut-filtered_${timestamp}.csv`;
        })();
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccessMessage(`Demo export complete! ${filename} downloaded with all ${fullFilteredData.filteredCount.toLocaleString()} ${filters.length > 0 ? 'filtered' : ''} rows. Create an account to save exports to your file library.`);
      } else {
        // For authenticated users, use backend export
        const exportRequest = {
          fileId: fileId,  // Add the fileId to the request
          filters,
          includeMetadata: true
        };

        let exportUrl;
        if (fileId === 'reference-squirrel') {
          exportUrl = '/api/v1/files/reference/squirrel/export/filtered';
        } else {
          exportUrl = `/api/v1/files/${fileId}/export/filtered`;
        }

        const response = await api.post(exportUrl, exportRequest);

        if (!response.data.success) {
          throw new Error(response.data.error || 'Export failed');
        }

        // Trigger download - fetch the actual CSV content
        const downloadUrl = response.data.downloadUrl;
        const filename = exportFilename || response.data.savedFile?.filename || 'filtered_export.csv';
        
        console.log('Download URL:', downloadUrl);
        console.log('Filename:', filename);
        
        // Fetch the CSV file with proper response type
        const fileResponse = await api.get(downloadUrl, {
          responseType: 'text'
        });
        
        // Create blob and download
        const blob = new Blob([fileResponse.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        setSuccessMessage(`Export complete! ${filename} has been saved to your files and downloaded.`);
      }

    } catch (err) {
      console.error('Export failed:', err);
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

  const handleSQLPanelToggle = (newExpanded) => {
    setSqlPanelExpanded(newExpanded);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sqlPanelExpanded', String(newExpanded));
    }
  };

  // Helper function to generate CSV from filtered data
  const generateCSVFromFilteredData = (data) => {
    const csvParts = [];
    
    // Header row
    csvParts.push(data.headers.map(h => escapeCSVCell(h)).join(','));
    
    // Data rows
    for (const row of data.filteredRows) {
      csvParts.push(row.map(cell => escapeCSVCell(cell)).join(','));
    }
    
    return csvParts.join('\n');
  };

  // Helper function to escape CSV cells
  const escapeCSVCell = (cell) => {
    const str = String(cell || '');
    // If contains comma, newline, or quote, wrap in quotes and escape internal quotes
    if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };


  const displayedRows = filteredData?.filteredRows ? 
    filteredData.filteredRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) : [];

  // Helper function to check if a column is being filtered
  const getFilteredColumnNames = () => {
    return new Set(filters.map(filter => filter.column));
  };

  const filteredColumns = getFilteredColumnNames();

  return (
    <Box sx={{ 
      p: { xs: 2, sm: 3 }, 
      maxWidth: '1400px', 
      mx: 'auto',
      width: '100%'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        {(onClose || routeFileId) && (
          <Button 
            onClick={onClose || (() => navigate('/manage_files'))} 
            variant="outlined"
          >
            Back to Files
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {(onClose || routeFileId) && (
          <Box sx={{ width: '120px' }} />
        )}
      </Box>
      
      <Typography variant="h2" component="h1" sx={{ textAlign: 'center', fontWeight: 'bold', mb: 1 }}>
        CUT
      </Typography>
      
      <Typography 
        variant="h5" 
        component="h2" 
        sx={{ 
          textAlign: 'center', 
          mb: 1,
          '& span:first-letter': {
            fontSize: '1.5em',
            fontWeight: 'bold'
          }
        }}
      >
        <span>Cutty</span> <span>Ultimate</span> <span>Tool</span>
      </Typography>
      
      <Typography variant="h6" component="h3" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
        The best list cutter EVER
      </Typography>

      {showFileSelection && !isAnonymous && (
        <Card sx={{ mb: 3, maxWidth: '1200px', mx: 'auto' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Select a file to analyze:
            </Typography>
            
            {loadingFiles ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={20} sx={{ mr: 2 }} />
                <Typography>Loading your files...</Typography>
              </Box>
            ) : availableFiles.length > 0 ? (
              <FormControl fullWidth>
                <InputLabel>Choose a file</InputLabel>
                <Select
                  value={selectedFileId}
                  label="Choose a file"
                  onChange={(e) => handleFileSelection(e.target.value)}
                  sx={{ mb: 2 }}
                >
                  {availableFiles.map((file) => (
                    <MenuItem key={file.id} value={file.id}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <Typography sx={{ fontWeight: 'medium' }}>
                          {file.filename}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
                          {file.totalRows && (
                            <Chip 
                              label={`${file.totalRows.toLocaleString()} rows`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {file.totalColumns && (
                            <Chip 
                              label={`${file.totalColumns} cols`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          <Chip 
                            label={`${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <Alert severity="info">
                No CSV files found in your account. <a href="/file_upload">Upload a file</a> to get started with CUT!
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {isAnonymous && demoMode && (
        <Alert severity="info" sx={{ mb: 2, maxWidth: '1400px', mx: 'auto' }}>
          <strong>Demo Mode:</strong> Try CUT with the 2025 National Public Opinion Reference Survey dataset!<br />
          <a href="/login" style={{color: 'inherit', textDecoration: 'underline'}}>Login</a> or <a href="/register" style={{color: 'inherit', textDecoration: 'underline'}}>create an account</a> to use CUT with your own CSV files.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: '1400px', mx: 'auto' }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2, maxWidth: '1400px', mx: 'auto' }}>
          {successMessage}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading file analysis...</Typography>
        </Box>
      ) : !showFileSelection ? (
        <Grid container spacing={3} sx={{ maxWidth: '1400px', mx: 'auto' }}>
          {/* File Info Panel */}
          {fileInfo && (
            <Grid item xs={12}>
              <Card sx={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                    {/* Left: File Name */}
                    <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                      <Typography 
                        variant="subtitle1" 
                        sx={{ 
                          fontWeight: 600, 
                          color: 'text.primary',
                          wordBreak: 'break-word',
                          lineHeight: 1.2,
                          textAlign: 'left'
                        }}
                      >
                        {fileInfo.filename}
                      </Typography>
                    </Box>
                    
                    {/* Center: Metrics as Chips */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      <Chip 
                        label={`${columns.length} cols`}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                      <Chip 
                        label={fileInfo.totalRows ? `${fileInfo.totalRows.toLocaleString()} rows` : 'Unknown rows'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                      <Chip 
                        label={fileInfo.size ? `${(fileInfo.size / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.75rem', height: '24px' }}
                      />
                    </Box>
                    
                    {/* Right: Buttons */}
                    <Box sx={{ flexShrink: 0, display: 'flex', gap: 1 }}>
                      {/* Change File Button - only show for logged-in users */}
                      {!isAnonymous && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleChangeFile}
                          sx={{
                            textTransform: 'none',
                            fontSize: '0.8rem',
                            px: 2,
                            py: 0.5,
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            '&:hover': {
                              backgroundColor: 'primary.main',
                              color: 'white'
                            }
                          }}
                        >
                          Change File
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<InfoIcon />}
                        sx={{
                          textTransform: 'none',
                          fontSize: '0.8rem',
                          px: 2,
                          py: 0.5,
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          '&:hover': {
                            backgroundColor: 'primary.main',
                            color: 'white'
                          }
                        }}
                        disabled
                      >
                        Schema
                      </Button>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Filter Panel */}
          <Grid item xs={12}>
            <FilterPanel
              columns={columns}
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onApplyFilters={handleManualRefresh}
              isFiltering={filtering}
            />
          </Grid>

          {/* SQL Preview Panel */}
          <Grid item xs={12}>
            <SQLPreviewPanel
              filters={filters}
              columns={columns}
              isExpanded={sqlPanelExpanded}
              onToggle={handleSQLPanelToggle}
              persistState={true}
              tableName={fileInfo?.filename?.replace(/\.(csv|xlsx?)$/i, '') || 'data'}
            />
          </Grid>

          {/* Show Data / Apply Filters Button */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleManualRefresh}
                disabled={filtering}
                startIcon={filtering ? <CircularProgress size={20} /> : (filters.length > 0 ? <FilterIcon /> : <RefreshIcon />)}
                sx={{
                  px: 6,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none'
                }}
              >
                {filtering ? 
                  (filters.length > 0 ? 'Applying Filters...' : 'Loading Data...') : 
                  (filters.length > 0 ? 'Apply Filters' : (!dataLoaded ? 'Show Data' : 'Refresh Data'))}
              </Button>
            </Box>
          </Grid>

          {/* Results Panel */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Data Preview
                  </Typography>
                  
                  {/* CUT it! Expandable Element */}
                  {filteredData && filteredData.filteredCount > 0 && (
                    <Box sx={{ minWidth: 350 }}>
                      <Accordion>
                        <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                          sx={{
                            backgroundColor: 'var(--action)',
                            color: 'white',
                            '&:hover': {
                              backgroundColor: 'var(--dark-accent)',
                            },
                            '&.Mui-expanded': {
                              backgroundColor: 'var(--dark-accent)',
                            },
                            borderRadius: '4px 4px 0 0',
                            minHeight: '48px',
                            '& .MuiAccordionSummary-content': {
                              margin: '8px 0',
                            }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <ContentCutIcon />
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              CUT it!
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                            {/* Filename field - Always available */}
                            <TextField
                              label="File Name"
                              value={exportFilename}
                              onChange={(e) => setExportFilename(e.target.value)}
                              fullWidth
                              sx={{ mb: 1 }}
                              helperText="Enter a name for your cut file"
                            />
                            
                            {/* Download Button - Always available */}
                            <Button
                              variant="contained"
                              color="success"
                              onClick={handleExport}
                              disabled={exporting}
                              startIcon={exporting ? <CircularProgress size={20} /> : <DownloadIcon />}
                              sx={{ 
                                py: 1,
                                fontSize: '1rem',
                                fontWeight: 'bold'
                              }}
                            >
                              {exporting ? 'Preparing Download...' : 'Download'}
                            </Button>

                            {/* Save to My Files Button - Conditional styling */}
                            <Box sx={{ position: 'relative' }}>
                              <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={handleSaveToMyFiles}
                                disabled={exporting || (!token && false)}
                                sx={{ 
                                  py: 1,
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  width: '100%',
                                  opacity: token ? 1 : 0.7
                                }}
                              >
                                Save to My Files
                              </Button>
                            </Box>

                            {/* Login message - only show when save clicked while not logged in */}
                            {showLoginMessage && !token && (
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 2, 
                                mt: 1, 
                                p: 1.5,
                                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                                borderRadius: 1,
                                border: '1px solid rgba(255, 0, 0, 0.3)'
                              }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: '#ff0000',
                                    fontWeight: 'bold',
                                    fontSize: '0.9rem',
                                    textShadow: '0 0 3px rgba(255, 0, 0, 0.5)',
                                    flex: 1
                                  }}
                                >
                                  You must be logged in to save things.
                                </Typography>
                                <Box
                                  component="img"
                                  src={cuttyLogo}
                                  alt="Angry Cutty"
                                  sx={{
                                    width: '40px',
                                    height: 'auto',
                                    transform: 'scaleX(-1)',
                                    filter: 'hue-rotate(0deg) saturate(2) brightness(1.2) drop-shadow(0 0 8px #ff0000)',
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        </AccordionDetails>
                      </Accordion>
                    </Box>
                  )}
                </Box>

                {!dataLoaded ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <InfoIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
                    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                      Ready to explore your data
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Click "Show Data" above to preview your dataset{filters.length > 0 ? ' with filters applied' : ''}
                    </Typography>
                  </Box>
                ) : filteredData ? (
                  <>
                    {/* Preview Info Banner */}
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Previewing the first {Math.min(filteredData.filteredRows.length, filteredData.filteredCount).toLocaleString()} rows ({filteredData.filteredCount.toLocaleString()} total)
                    </Alert>
                    
                    {/* Filter Summary */}
                    {filters.length > 0 && (
                      <>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textAlign: 'left' }}>
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
                      </>
                    )}

                    {/* Results Table */}
                    {displayedRows.length > 0 ? (
                      <>
                        <TableContainer component={Paper} sx={{ maxHeight: 700 }}>
                          <Table stickyHeader size="small">
                            <TableHead>
                              <TableRow>
                                {filteredData.headers.map((header, index) => {
                                  const isFiltered = filteredColumns.has(header);
                                  return (
                                    <TableCell 
                                      key={index} 
                                      sx={{ 
                                        fontWeight: 'bold',
                                        position: 'sticky',
                                        top: 0,
                                        zIndex: 10,
                                        backgroundColor: 'background.paper',
                                        ...(isFiltered && {
                                          backgroundColor: 'rgba(25, 118, 210, 0.08)', // Very subtle blue tint
                                          borderBottom: '2px solid rgba(25, 118, 210, 0.3)', // Subtle blue border
                                          '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            bottom: 0,
                                            left: 0,
                                            right: 0,
                                            height: '3px',
                                            backgroundColor: 'primary.main',
                                            opacity: 0.6
                                          }
                                        })
                                      }}
                                    >
                                      {header}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {displayedRows.map((row, rowIndex) => (
                                <TableRow key={rowIndex} hover>
                                  {row.map((cell, cellIndex) => {
                                    const header = filteredData.headers[cellIndex];
                                    const isFiltered = filteredColumns.has(header);
                                    return (
                                      <TableCell 
                                        key={cellIndex}
                                        sx={{
                                          ...(isFiltered && {
                                            backgroundColor: 'rgba(25, 118, 210, 0.03)', // Even more subtle for data cells
                                            borderLeft: '1px solid rgba(25, 118, 210, 0.15)', // Subtle left border
                                            borderRight: '1px solid rgba(25, 118, 210, 0.15)', // Subtle right border
                                          })
                                        }}
                                      >
                                        {cell}
                                      </TableCell>
                                    );
                                  })}
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
                            Export to get all {filteredData.filteredCount.toLocaleString()} {filters.length > 0 ? 'filtered' : ''} rows.
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
      ) : (
        // Show a message when file selection is active
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Select a file above to start using CUT
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose from your uploaded CSV files to begin filtering and analysis
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default QueryBuilder;