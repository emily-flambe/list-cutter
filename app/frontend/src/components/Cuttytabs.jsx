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

  // Fetch user's files on component mount
  useEffect(() => {
    const fetchFiles = async () => {
      if (!token) return;
      
      try {
        const response = await api.get('/api/v1/files');
        const csvFiles = response.data.files.filter(file => 
          file.filename.toLowerCase().endsWith('.csv')
        );
        setFiles(csvFiles || []);
      } catch (err) {
        console.error('Error fetching files:', err);
        setError('Failed to load your files. Please try again.');
      }
    };

    fetchFiles();
  }, [token]);

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
      // Use the secure analysis endpoint for field retrieval
      const response = await api.get(`/api/v1/analysis/fields/${fileId}`);
      setFields(response.data.fields || []);
    } catch (err) {
      console.error('Error fetching fields:', err);
      if (err.response?.status === 404) {
        setError('File not found or access denied.');
      } else if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else {
        setError('Failed to load file fields. Please try again.');
      }
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

  // Generate crosstab using secure analysis endpoint
  const handleGenerateCrosstab = async () => {
    if (!selectedFile || !rowVariable || !columnVariable) {
      setError('Please select a file and both variables.');
      return;
    }

    if (rowVariable === columnVariable) {
      setError('Row and column variables must be different. Please select different fields.');
      return;
    }

    setLoading(true);
    setError('');
    setCrosstabData(null);

    try {
      const response = await api.post('/api/v1/analysis/crosstab', {
        fileId: selectedFile,
        rowVariable,
        columnVariable,
        includePercentages: true,
        includeStatistics: true
      });

      setCrosstabData(response.data.analysis);
      setSuccessMessage('Crosstab generated successfully with enhanced security!');
    } catch (err) {
      console.error('Error generating crosstab:', err);
      
      // Handle specific error cases
      if (err.response?.status === 400) {
        setError(err.response.data?.message || 'Invalid analysis parameters.');
      } else if (err.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else if (err.response?.status === 404) {
        setError('File not found or access denied.');
      } else if (err.response?.status === 429) {
        setError('Too many analysis requests. Please wait before trying again.');
      } else {
        setError('Failed to generate crosstab. Please try again.');
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
      const response = await api.post(`/api/v1/files/${selectedFile}/export/crosstab`, {
        rowVariable,
        columnVariable
      }, {
        responseType: 'blob'
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crosstab_${rowVariable}_${columnVariable}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMessage('Crosstab exported successfully and saved to your files!');
      
      // Refresh global file list if available (safe check)
      if (typeof window !== 'undefined' && typeof window.refreshFileList === 'function') {
        try {
          window.refreshFileList();
        } catch (refreshError) {
          console.warn('Failed to refresh file list:', refreshError);
        }
      }
    } catch (err) {
      console.error('Error exporting crosstab:', err);
      setError(err.response?.data?.message || 'Failed to export crosstab. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const selectedFileName = files.find(f => f.id === selectedFile)?.filename || '';

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Cuttytabs - Crosstab Analysis
      </Typography>
      
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Create cross-tabulation tables to analyze relationships between two categorical variables in your CSV files.
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
              
              {files.length === 0 ? (
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
                    {files.map((file) => (
                      <MenuItem key={file.id} value={file.id}>
                        {file.filename}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                File: {selectedFileName} | Total records processed: {crosstabData.grandTotal}
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