import { useState } from 'react';
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

const SyntheticDataGenerator = () => {
  const [formData, setFormData] = useState({
    count: 100,
    state: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // US States list for dropdown
  const usStates = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
    'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
    'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
    'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
    'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
    'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
    'Wisconsin', 'Wyoming'
  ];


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
        ...(formData.state && { state: formData.state })
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

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Synthetic Data Generator
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary' }}>
        Generate synthetic person records for testing and development purposes. 
        All generated data is completely fictional and not based on real individuals.
      </Typography>

      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      {/* Download Link */}
      {downloadUrl && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Your synthetic data is ready! 
            <Link href={downloadUrl} download sx={{ ml: 1, fontWeight: 'bold' }}>
              Download CSV File
            </Link>
          </Typography>
        </Alert>
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
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {/* Count Input */}
        <TextField
          label="Number of Records"
          name="count"
          type="number"
          variant="outlined"
          value={formData.count}
          onChange={handleChange}
          required
          disabled={loading}
          error={Boolean(errors.count)}
          helperText={errors.count || 'Enter a number between 1 and 1000'}
          inputProps={{
            min: 1,
            max: 1000
          }}
          fullWidth
        />

        {/* State Filter */}
        <FormControl fullWidth>
          <InputLabel id="state-select-label">State (Optional)</InputLabel>
          <Select
            labelId="state-select-label"
            label="State (Optional)"
            name="state"
            value={formData.state}
            onChange={handleChange}
            disabled={loading}
            error={Boolean(errors.state)}
          >
            <MenuItem value="">
              <em>All States</em>
            </MenuItem>
            {usStates.map((state) => (
              <MenuItem key={state} value={state}>
                {state}
              </MenuItem>
            ))}
          </Select>
          {errors.state && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
              {errors.state}
            </Typography>
          )}
        </FormControl>

        {/* Generate Button */}
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{ 
            mt: 2, 
            height: 48,
            fontSize: '1rem'
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
      <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          About Synthetic Data
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          The generated data includes realistic but fictional information such as:
        </Typography>
        <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
          <li>Full names (first and last)</li>
          <li>Email addresses</li>
          <li>Phone numbers</li>
          <li>Addresses (street, city, state, ZIP)</li>
          <li>Birth dates</li>
          <li>Demographics</li>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
          Note: All data is completely fictional and generated algorithmically.
        </Typography>
      </Box>
    </Box>
  );
};

export default SyntheticDataGenerator;