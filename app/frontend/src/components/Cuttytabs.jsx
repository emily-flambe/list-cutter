import React, { useState, useEffect, useContext } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Divider
} from '@mui/material';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import CuttytabsTable from './CuttytabsTable';

const Cuttytabs = () => {
  const { token } = useContext(AuthContext);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [squirrelDataAvailable, setSquirrelDataAvailable] = useState(false);
  const [fields, setFields] = useState([]);
  const [rowVariable, setRowVariable] = useState('');
  const [columnVariable, setColumnVariable] = useState('');
  const [crosstabData, setCrosstabData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [exporting, setExporting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(!token);
  const [demoMode, setDemoMode] = useState(false);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (warning) {
      const timer = setTimeout(() => setWarning(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [warning]);

  // Update authentication state when token changes
  useEffect(() => {
    setIsAnonymous(!token);
  }, [token]);

  // Initialize data based on authentication state
  useEffect(() => {
    const initializeData = async () => {
      if (token) {
        // Authenticated user - load their files and check squirrel data
        await fetchUserFiles();
      } else {
        // Anonymous user - check public squirrel data availability
        await checkPublicSquirrelData();
      }
    };

    initializeData();
  }, [token]);

  // Fetch user's files (authenticated users only)
  const fetchUserFiles = async () => {
    try {
      const response = await api.get('/api/v1/files');
      const csvFiles = response.data.files.filter(file => 
        file.filename.toLowerCase().endsWith('.csv')
      );
      setFiles(csvFiles || []);
      
      // Check if squirrel reference data is available for logged-in users
      try {
        await api.get('/api/v1/files/reference/squirrel/fields');
        setSquirrelDataAvailable(true);
        
        // Auto-select squirrel data for logged-in users if no files
        if (csvFiles.length === 0) {
          handleFileSelect('reference-squirrel');
        }
      } catch (squirrelErr) {
        console.log('Squirrel reference data not available for authenticated users:', squirrelErr);
        setSquirrelDataAvailable(false);
      }
      
    } catch (err) {
      console.error('Error fetching user files:', err);
      setError('Failed to load your files. Please try again.');
    }
  };

  // Check public squirrel data availability (anonymous users)
  const checkPublicSquirrelData = async () => {
    try {
      // Use public endpoint to check squirrel data availability
      await api.get('/api/v1/public/squirrel/fields');
      setSquirrelDataAvailable(true);
      setDemoMode(true);
      
      // Auto-select squirrel data for anonymous users
      handleFileSelect('demo-squirrel-data');
      
      // Show demo welcome message
      setSuccessMessage('Welcome to Cuttytabs demo! Explore analysis features with NYC Squirrel Census data.');
    } catch (squirrelErr) {
      console.log('Public squirrel data not available:', squirrelErr);
      setSquirrelDataAvailable(false);
      setError('Demo data is temporarily unavailable. Please try again later or create an account to upload your own files.');
    }
  };

  // Fetch fields when a file is selected
  const handleFileSelect = async (fileId) => {
    setSelectedFile(fileId);
    setFields([]);
    setRowVariable('');
    setColumnVariable('');
    setCrosstabData(null);
    setError('');
    setWarning('');

    if (!fileId) return;

    setFieldsLoading(true);
    try {
      const startTime = Date.now();
      let response;
      
      // Determine which endpoint to use based on authentication state and file type
      if (isAnonymous) {
        // Anonymous user - use public endpoints
        if (fileId === 'demo-squirrel-data') {
          response = await api.get('/api/v1/public/squirrel/fields');
        } else {
          throw new Error('Unauthorized access to user files');
        }
      } else {
        // Authenticated user - use authenticated endpoints
        if (fileId === 'reference-squirrel') {
          response = await api.get('/api/v1/files/reference/squirrel/fields');
        } else {
          response = await api.get(`/api/v1/files/${fileId}/fields`);
        }
      }
      
      const processingTime = Date.now() - startTime;
      setFields(response.data.fields || []);
      
      // Performance feedback and messaging
      const isSquirrelData = fileId === 'reference-squirrel' || fileId === 'demo-squirrel-data';
      const dataType = isSquirrelData ? 'squirrel census data' : 'user file';
      console.log(`🐰 Fields extracted from ${dataType} in ${processingTime}ms for ${response.data.rowCount} rows`);
      
      // Show appropriate success message
      if (isSquirrelData) {
        const message = isAnonymous 
          ? 'NYC Squirrel Census demo data loaded! Try analyzing relationships between different variables.'
          : 'NYC Central Park Squirrel Census data loaded! Ready for crosstab analysis.';
        setSuccessMessage(message);
      }
      
    } catch (err) {
      console.error('🐰 Error fetching fields:', err);
      
      let errorMessage = 'Failed to load file fields.';
      
      if (err.response?.status === 404) {
        errorMessage = isAnonymous
          ? 'Demo data not found. Please try again later.'
          : (fileId === 'reference-squirrel' ? 'Reference squirrel data not found.' : 'File not found or access denied.');
      } else if (err.response?.status === 401) {
        errorMessage = isAnonymous
          ? 'Demo data access temporarily restricted. Please try again later.'
          : 'Authentication required. Please log in again.';
      } else if (err.response?.status === 400) {
        const backendMessage = err.response?.data?.message || err.response?.data?.error || '';
        errorMessage = `CSV parsing error: ${backendMessage}`;
      } else if (err.response?.data?.message?.includes('too large')) {
        errorMessage = `File too large for analysis: ${err.response.data.message}`;
      } else if (err.response?.data?.message) {
        errorMessage = `Error: ${err.response.data.message}`;
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      const suffix = isAnonymous 
        ? ' Please try again later or create an account to upload your own files.'
        : ' Please try again or use a different CSV file.';
      
      setError(errorMessage + suffix);
      setFields([]);
    } finally {
      setFieldsLoading(false);
    }
  };

  // Handle variable selection with warning for same field
  const handleRowVariableChange = (value) => {
    setRowVariable(value);
    if (value === columnVariable && value !== '') {
      setError('Row and column variables must be different. Please select different fields.');
    } else {
      setError('');
      setWarning('');
    }
  };

  const handleColumnVariableChange = (value) => {
    setColumnVariable(value);
    if (value === rowVariable && value !== '') {
      setError('Row and column variables must be different. Please select different fields.');
    } else {
      setError('');
      setWarning('');
    }
  };

  // 🐰 RUBY OPTIMIZED: Generate crosstab with performance monitoring and user feedback
  const handleGenerateCrosstab = async () => {
    if (!selectedFile || !rowVariable || !columnVariable) {
      setError('Please select a file and both variables.');
      return;
    }

    if (rowVariable === columnVariable) {
      setError('Row and column variables must be different. Please select different fields.');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setError('');
    setCrosstabData(null);

    try {
      let response;
      
      // Choose endpoint based on authentication state and file type
      if (isAnonymous) {
        // Anonymous user - use public endpoints
        if (selectedFile === 'demo-squirrel-data') {
          response = await api.post('/api/v1/public/squirrel/analyze/crosstab', {
            rowVariable,
            columnVariable,
            includePercentages: true
          });
        } else {
          throw new Error('Unauthorized access to user files');
        }
      } else {
        // Authenticated user - use authenticated endpoints
        if (selectedFile === 'reference-squirrel') {
          response = await api.post('/api/v1/files/reference/squirrel/analyze/crosstab', {
            rowVariable,
            columnVariable,
            includePercentages: true
          });
        } else {
          response = await api.post(`/api/v1/files/${selectedFile}/analyze/crosstab`, {
            rowVariable,
            columnVariable,
            includePercentages: true
          });
        }
      }

      const processingTime = Date.now() - startTime;
      const performanceData = response.data.metadata?.performance;
      const isDemoMode = response.data.metadata?.demoMode;
      
      setCrosstabData(response.data.data);
      
      // Performance feedback with demo messaging
      let performanceMessage = `Crosstab generated in ${processingTime}ms! 🐰⚡`;
      if (performanceData) {
        const throughput = performanceData.throughput_mbps;
        const matrixSize = performanceData.matrix_size;
        if (throughput && matrixSize) {
          const speedText = `${matrixSize} matrix processed at ${throughput.toFixed(1)}MB/s in ${processingTime}ms`;
          performanceMessage = isDemoMode || isAnonymous
            ? `Demo analysis complete! ${speedText} 🐰⚡ Create an account to analyze your own data!`
            : `Lightning fast analysis complete! ${speedText} 🐰⚡`;
        }
      }
      
      setSuccessMessage(performanceMessage);
      
      // Log performance metrics
      if (performanceData) {
        console.log('🐰 Crosstab performance metrics:', performanceData);
      }
      
    } catch (err) {
      const processingTime = Date.now() - startTime;
      console.error(`🐰 Error generating crosstab after ${processingTime}ms:`, err);
      
      // Handle errors with appropriate messaging for demo vs authenticated users
      if (err.response?.status === 400) {
        const message = err.response.data?.message || 'Invalid analysis parameters.';
        setError(isAnonymous ? `Demo analysis error: ${message}` : message);
      } else if (err.response?.status === 401) {
        setError(isAnonymous 
          ? 'Demo access temporarily restricted. Please try again later or create an account.'
          : 'Authentication required. Please log in again.');
      } else if (err.response?.status === 404) {
        setError(isAnonymous
          ? 'Demo data not found. Please try again later.'
          : 'File not found or access denied.');
      } else if (err.response?.status === 429) {
        setError('Too many analysis requests. Please wait before trying again.');
      } else if (err.response?.data?.message?.includes('too large') || err.response?.data?.message?.includes('timeout')) {
        setError(`Performance limit reached: ${err.response.data.message} Try using fewer unique values.`);
      } else {
        const suffix = isAnonymous 
          ? ' Please try again later or create an account to upload your own files.'
          : ' Please try again.';
        setError(`Failed to generate crosstab after ${processingTime}ms.${suffix}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Export crosstab
  const handleExport = async () => {
    if (!crosstabData) return;

    setExporting(true);
    setError('');

    try {
      // For anonymous users or reference/demo data, export directly from crosstab data
      const isSquirrelData = selectedFile === 'reference-squirrel' || selectedFile === 'demo-squirrel-data';
      
      if (isAnonymous || isSquirrelData) {
        // Generate CSV export directly from the crosstab data
        const csvContent = generateCSVFromCrosstabData(crosstabData, rowVariable, columnVariable);
        
        // Create filename
        const timestamp = new Date().toISOString().split('T')[0];
        const prefix = isAnonymous ? 'demo-squirrel-crosstab' : 'squirrel-crosstab';
        const filename = `${prefix}_${rowVariable}_${columnVariable}_${timestamp}.csv`;
        
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

        const message = isAnonymous 
          ? 'Demo crosstab exported successfully! Create an account to save exports to your file library.'
          : 'Squirrel data crosstab exported successfully!';
        setSuccessMessage(message);
        
      } else {
        // Authenticated user with their own files - use backend export endpoint
        const response = await api.post(`/api/v1/files/${selectedFile}/export/crosstab`, {
          rowVariable,
          columnVariable
        });

        if (!response.data.success || !response.data.downloadUrl) {
          throw new Error('Export failed: No download URL received');
        }

        // Download the actual CSV file using the downloadUrl
        const downloadResponse = await api.get(response.data.downloadUrl, {
          responseType: 'blob'
        });

        // Create download link for the CSV file
        const blob = new Blob([downloadResponse.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.data.savedFile.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccessMessage(response.data.message || 'Crosstab exported successfully and saved to your files!');
        
        // Refresh global file list if available
        if (typeof window !== 'undefined' && typeof window.refreshFileList === 'function') {
          try {
            window.refreshFileList();
          } catch (refreshError) {
            console.warn('Failed to refresh file list:', refreshError);
          }
        }
      }
    } catch (err) {
      console.error('Error exporting crosstab:', err);
      const message = err.response?.data?.message || 'Failed to export crosstab. Please try again.';
      const suffix = isAnonymous ? ' Create an account for full export functionality.' : '';
      setError(message + suffix);
    } finally {
      setExporting(false);
    }
  };

  // Helper function to generate CSV from crosstab data
  const generateCSVFromCrosstabData = (data, rowVar, colVar) => {
    const rows = [];
    const columnKeys = Object.keys(data.columnTotals).sort();
    
    // Header row
    const header = [rowVar, ...columnKeys, 'Total'];
    rows.push(header.join(','));
    
    // Data rows
    const rowKeys = Object.keys(data.rowTotals).sort();
    rowKeys.forEach(rowKey => {
      const row = [rowKey];
      columnKeys.forEach(colKey => {
        const count = data.matrix[rowKey]?.[colKey] || 0;
        row.push(count.toString());
      });
      row.push(data.rowTotals[rowKey].toString());
      rows.push(row.join(','));
    });
    
    // Total row
    const totalRow = ['Total'];
    columnKeys.forEach(colKey => {
      totalRow.push(data.columnTotals[colKey].toString());
    });
    totalRow.push(data.grandTotal.toString());
    rows.push(totalRow.join(','));
    
    return rows.join('\n');
  };

  const selectedFileName = () => {
    if (selectedFile === 'reference-squirrel') {
      return 'NYC Central Park Squirrel Census (Reference Data)';
    } else if (selectedFile === 'demo-squirrel-data') {
      return 'NYC Squirrel Census (Demo Data)';
    } else {
      return files.find(f => f.id === selectedFile)?.filename || '';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Cuttytabs
      </Typography>
      <Typography variant="h6" component="h2" color="text.secondary" sx={{ mb: 3 }}>
        the best crosstabber tool ever
      </Typography>
      
      {isAnonymous ? (
        <Box sx={{ mb: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            🐿️ <strong>Demo Mode:</strong> Try our analysis features with real NYC Squirrel Census data! 
            No login required - explore crosstab analysis to see relationships between different variables.
          </Alert>
        </Box>
      ) : null}

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

      {warning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {warning}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* File Selection Panel */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Step 1: Select File
              </Typography>
              
              {isAnonymous ? (
                // Anonymous user - show only demo data
                squirrelDataAvailable ? (
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Demo Data</InputLabel>
                    <Select
                      value={selectedFile}
                      label="Demo Data"
                      onChange={(e) => handleFileSelect(e.target.value)}
                    >
                      <MenuItem value="demo-squirrel-data">
                        🐿️ NYC Squirrel Census Demo Data
                      </MenuItem>
                    </Select>
                  </FormControl>
                ) : (
                  <Alert severity="warning">
                    Demo data is temporarily unavailable. Please try again later or create an account to upload your own CSV files.
                  </Alert>
                )
              ) : (
                // Authenticated user - show their files and reference data
                files.length === 0 && !squirrelDataAvailable ? (
                  <Alert severity="info">
                    No CSV files found. Please upload CSV files in the Files section first.
                  </Alert>
                ) : (
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Select CSV File</InputLabel>
                    <Select
                      value={selectedFile}
                      label="Select CSV File"
                      onChange={(e) => handleFileSelect(e.target.value)}
                    >
                      {squirrelDataAvailable && (
                        <MenuItem key="reference-squirrel" value="reference-squirrel">
                          🐿️ NYC Central Park Squirrel Census (Reference Data)
                        </MenuItem>
                      )}
                      {files.map((file) => (
                        <MenuItem key={file.id} value={file.id}>
                          {file.filename}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Variable Selection Panel */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Step 2: Select Variables
              </Typography>
              
              {fieldsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : fields.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Select a file to see available fields
                </Typography>
              ) : (
                <Box sx={{ mt: 2 }}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Row Variable</InputLabel>
                    <Select
                      value={rowVariable}
                      label="Row Variable"
                      onChange={(e) => handleRowVariableChange(e.target.value)}
                    >
                      {fields.map((field) => (
                        <MenuItem key={field} value={field}>
                          {field}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <FormControl fullWidth>
                    <InputLabel>Column Variable</InputLabel>
                    <Select
                      value={columnVariable}
                      label="Column Variable"
                      onChange={(e) => handleColumnVariableChange(e.target.value)}
                    >
                      {fields.map((field) => (
                        <MenuItem key={field} value={field}>
                          {field}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Generate Button */}
        <Grid item xs={12}>
          <Box sx={{ textAlign: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateCrosstab}
              disabled={!selectedFile || !rowVariable || !columnVariable || loading}
              startIcon={loading ? <CircularProgress size={20} /> : null}
              sx={{ minWidth: 200 }}
            >
              {loading ? 'Generating...' : 'Generate Crosstab'}
            </Button>
          </Box>
        </Grid>

        {/* Results Panel */}
        {crosstabData && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Crosstab Results: {rowVariable} × {columnVariable}
                </Typography>
                <Button
                  variant="outlined"
                  onClick={handleExport}
                  disabled={exporting || !crosstabData}
                  startIcon={exporting ? <CircularProgress size={16} /> : null}
                >
                  {exporting ? 'Exporting...' : 'Export CSV'}
                </Button>
              </Box>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                File: {selectedFileName()} | Total records processed: {crosstabData.grandTotal}
                {demoMode && (
                  <Typography component="span" color="primary" sx={{ ml: 1 }}>
                    (Demo Mode)
                  </Typography>
                )}
              </Typography>
              
              <Divider sx={{ mb: 2 }} />
              
              <CuttytabsTable 
                data={crosstabData}
                rowVariable={rowVariable}
                columnVariable={columnVariable}
              />
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default Cuttytabs;