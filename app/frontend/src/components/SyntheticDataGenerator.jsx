import { useState, useEffect } from 'react';
import api from '../api';
// Optimized direct imports for better tree-shaking and build performance
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const SyntheticDataGenerator = () => {
  const [formData, setFormData] = useState({
    count: 100,
    states: []
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [supportedStates, setSupportedStates] = useState([]);
  const [loadingStates, setLoadingStates] = useState(true);

  // Fetch supported states on component mount
  useEffect(() => {
    const fetchSupportedStates = async () => {
      try {
        const response = await api.get('/api/v1/synthetic-data/supported-states');
        if (response.data.states) {
          setSupportedStates(response.data.states);
        }
      } catch (error) {
        console.error('Failed to fetch supported states:', error);
        // Fall back to hardcoded states that we know have data
        setSupportedStates(['CA', 'FL', 'GA', 'IL', 'NY', 'OH', 'PA', 'TX']);
      } finally {
        setLoadingStates(false);
      }
    };

    fetchSupportedStates();
  }, []);

  // Listen for agent form fill events
  useEffect(() => {
    const handleAgentFormFill = (event) => {
      console.log('📝 Received agent-form-fill event:', event.detail);
      
      if (event.detail) {
        const newFormData = { ...formData };
        
        // Handle count
        if (event.detail.count !== undefined) {
          const count = parseInt(event.detail.count);
          if (!isNaN(count) && count >= 1 && count <= 1000) {
            newFormData.count = count;
          }
        }
        
        // Handle states (can be a single state string or an array)
        if (event.detail.states !== undefined) {
          if (Array.isArray(event.detail.states)) {
            // Filter to only include valid states from supportedStates
            newFormData.states = event.detail.states.filter(state => 
              supportedStates.includes(state)
            );
          } else if (typeof event.detail.states === 'string' && event.detail.states) {
            // Convert single state to array if it's supported
            const stateUpper = event.detail.states.toUpperCase();
            if (supportedStates.includes(stateUpper)) {
              newFormData.states = [stateUpper];
            }
          }
        }
        
        // Handle state (singular) - for backward compatibility
        if (event.detail.state !== undefined && !event.detail.states) {
          const stateUpper = event.detail.state.toUpperCase();
          if (supportedStates.includes(stateUpper)) {
            newFormData.states = [stateUpper];
          }
        }
        
        // Update the form data
        setFormData(newFormData);
        
        // Clear any existing errors
        setErrors({});
        setSuccessMessage('');
        setDownloadUrl('');
      }
    };

    // Add event listener
    window.addEventListener('agent-form-fill', handleAgentFormFill);

    // Cleanup
    return () => {
      window.removeEventListener('agent-form-fill', handleAgentFormFill);
    };
  }, [formData, supportedStates]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'count' ? parseInt(value) || 0 : value
    }));
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.count || formData.count < 1) {
      newErrors.count = 'Count must be at least 1';
    } else if (formData.count > 1000) {
      newErrors.count = 'Count cannot exceed 1000';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage('');
    setDownloadUrl('');
    setLoading(true);

    // Validate form before sending to API
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      console.log('🚀 Generating synthetic data...');
      console.log('📋 Form data:', formData);
      
      const payload = {
        count: formData.count,
        ...(formData.states.length > 0 && { states: formData.states })
      };

      const response = await api.post('/api/v1/synthetic-data/generate', payload);
      
      console.log('✅ Synthetic data generation successful:', response.data);
      
      if (response.data.file && response.data.file.downloadUrl) {
        setDownloadUrl(response.data.file.downloadUrl);
        setSuccessMessage(`Successfully generated ${response.data.metadata.recordCount} synthetic records${response.data.metadata.state ? ` for ${response.data.metadata.state}` : ''}`);
      } else {
        setSuccessMessage('Synthetic data generated successfully');
      }
      
    } catch (error) {
      console.error("❌ SYNTHETIC DATA GENERATION FAILED:");
      console.error("Error object:", error);
      
      if (error.response) {
        console.error("HTTP Response:", error.response.status, error.response.data);
        
        const errorData = error.response.data;
        let errorMessage = "Unknown server error";
        
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData && typeof errorData === 'object') {
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          }
        }
        
        // Set field-specific errors if possible
        if (errorMessage.toLowerCase().includes('count')) {
          setErrors({ count: errorMessage });
        } else if (errorMessage.toLowerCase().includes('state')) {
          setErrors({ state: errorMessage });
        } else {
          setErrors({ non_field_errors: errorMessage });
        }
        
      } else if (error.request) {
        console.error("Network error - no response received");
        setErrors({ non_field_errors: "Network error: Unable to connect to the server. Please check your connection and try again." });
        
      } else {
        console.error("Request setup error:", error.message);
        setErrors({ non_field_errors: `Request error: ${error.message}` });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      // Check if user is authenticated by looking at the download URL
      const isAuthenticated = downloadUrl.includes('/api/v1/files/');
      
      if (isAuthenticated) {
        // For authenticated users, we need to fetch with the Authorization header
        const response = await api.get(downloadUrl, {
          responseType: 'blob'
        });
        
        // Create a blob URL and trigger download
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'synthetic-data.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // For anonymous users, use the regular link download
        window.location.href = downloadUrl;
      }
    } catch (error) {
      console.error('Download failed:', error);
      setErrors({ non_field_errors: 'Failed to download file. Please try again.' });
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Generate Fake Data
        </Typography>
        
        <Box component="ul" sx={{ 
          color: 'text.secondary', 
          lineHeight: 1.6,
          textAlign: 'left',
          pl: 4,
          pr: 2,
          m: 0,
          listStyle: 'disc',
          fontSize: '0.875rem',
          '& li': {
            mb: 0.5
          }
        }}>
          <li>Generate synthetic person records for testing and development purposes</li>
          <li>All generated data is completely fictional and not based on real individuals</li>
          <li>Area codes, cities, and ZIP codes are based on real geographic data</li>
        </Box>
      </Box>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* Download Link */}
      {downloadUrl && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Your synthetic data is ready!
          </Typography>
          <Button
            onClick={handleDownload}
            variant="contained"
            sx={{ 
              fontWeight: 'bold',
              textDecoration: 'none',
              bgcolor: 'primary.main',
              color: 'white',
              px: 2,
              py: 1,
              borderRadius: 1,
              display: 'inline-block',
              '&:hover': {
                bgcolor: 'primary.dark'
              }
            }}
          >
            Download CSV File
          </Button>
        </Box>
      )}

      {/* Error Messages */}
      {errors.non_field_errors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.non_field_errors}
        </Alert>
      )}

      {/* Form */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ 
          p: 3,
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 1,
          border: '1px solid',
          borderColor: 'divider'
        }}
      >
        {/* Form Fields Row */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {/* Count Input */}
          <TextField
            label="Total Number of Records"
            name="count"
            type="number"
            variant="outlined"
            value={formData.count}
            onChange={handleChange}
            required
            disabled={loading}
            error={Boolean(errors.count)}
            helperText={errors.count}
            inputProps={{
              min: 1,
              max: 1000
            }}
            sx={{ flex: 1 }}
          />

          {/* State Filter */}
          <FormControl sx={{ flex: 1 }}>
            <InputLabel id="states-select-label">States (Optional)</InputLabel>
            <Select
              labelId="states-select-label"
              label="States (Optional)"
              name="states"
              multiple
              value={formData.states}
              onChange={handleChange}
              disabled={loading || loadingStates}
              error={Boolean(errors.states)}
              renderValue={(selected) => {
                if (selected.length === 0) return 'All Available States';
                if (selected.length === supportedStates.length) return 'All Available States';
                return selected.join(', ');
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    '& .MuiMenuItem-root': {
                      justifyContent: 'flex-start'
                    }
                  }
                }
              }}
            >
              {loadingStates ? (
                <MenuItem disabled>
                  <CircularProgress size={16} sx={{ mr: 1 }} />
                  Loading states...
                </MenuItem>
              ) : supportedStates.length === 0 ? (
                <MenuItem disabled>
                  No states available
                </MenuItem>
              ) : (
                supportedStates.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))
              )}
            </Select>
            {errors.states && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {errors.states}
              </Typography>
            )}
            {!errors.states && formData.states.length > 1 && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5, textAlign: 'left' }}>
                Records will be evenly distributed across all selected states
              </Typography>
            )}
          </FormControl>
        </Box>

        {/* Generate Button */}
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{ 
            height: 56,
            fontSize: '1.1rem',
            fontWeight: 600,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4
            }
          }}
          fullWidth
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} color="inherit" />
              Generating Data...
            </Box>
          ) : (
            'Generate Synthetic Data'
          )}
        </Button>
      </Box>

      {/* Information Section */}
      <Accordion sx={{ mt: 4, border: '1px solid', borderColor: 'divider', borderRadius: 1, boxShadow: 'none' }}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            bgcolor: 'background.paper',
            borderRadius: '4px 4px 0 0',
            minHeight: 48,
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 500, color: 'text.primary' }}>
            How It's Made
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ 
          bgcolor: 'background.paper', 
          p: 3,
          textAlign: 'left'
        }}>
          <Box component="ul" sx={{ 
            m: 0, 
            p: 0, 
            pl: 2,
            listStyle: 'disc',
            '& li': {
              mb: 1.5,
              color: 'text.primary',
              fontSize: '0.875rem',
              lineHeight: 1.5
            },
            '& ul': {
              mt: 0.5,
              pl: 2,
              listStyle: 'circle',
              '& li': {
                mb: 0.5,
                fontSize: '0.8125rem',
                color: 'text.secondary'
              }
            }
          }}>
            <li>
              Full names (first and last)
              <ul>
                <li>Random selection from common American first/last names</li>
              </ul>
            </li>
            <li>
              Email addresses
              <ul>
                <li>Generated using person's name plus common email providers</li>
              </ul>
            </li>
            <li>
              Phone numbers
              <ul>
                <li>Follow real US phone number patterns with real area codes for selected states</li>
              </ul>
            </li>
            <li>
              Addresses (street, city, state, ZIP)
              <ul>
                <li>Cities, states, and ZIP codes use real data for a selection of states</li>
                <li>Street addresses are a random combination of a number and a typical street name</li>
              </ul>
            </li>
            <li>
              Birth dates
              <ul>
                <li>Random dates ensuring logical adult ages (no future dates)</li>
              </ul>
            </li>
            <li>
              Voter IDs
              <ul>
                <li>Unique identifiers in format ABC123456 (3 letters + 6 numbers)</li>
                <li>Any resemblance to other voter ID formats is purely coincidental!</li>
              </ul>
            </li>
          </Box>

          <Box sx={{ 
            mt: 3, 
            pt: 2, 
            borderTop: '1px solid', 
            borderColor: 'divider'
          }}>
            <Typography variant="body2" color="text.secondary">
              <Link 
                href="https://github.com/emily-flambe/list-cutter/blob/main/cloudflare/workers/src/services/synthetic-data-generator.ts" 
                target="_blank" 
                rel="noopener noreferrer"
                sx={{ fontWeight: 500, textDecoration: 'none' }}
              >
                View source code →
              </Link>
            </Typography>
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default SyntheticDataGenerator;