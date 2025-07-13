// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import api from '../api';
// Optimized direct imports for better tree-shaking and build performance
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectivityTest, setConnectivityTest] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const testConnectivity = async () => {
    setConnectivityTest({ loading: true });
    try {
      console.log('Testing API connectivity...');
      console.log('API Base URL:', api.defaults.baseURL);
      
      // Test the auth/test endpoint
      const response = await api.get('/api/v1/auth/test');
      console.log('Connectivity test response:', response.data);
      
      setConnectivityTest({
        success: true,
        message: `✅ API Connected! Environment: ${response.data.environment}`,
        details: response.data
      });
    } catch (error) {
      console.error('Connectivity test failed:', error);
      setConnectivityTest({
        success: false,
        message: '❌ API Connection Failed',
        error: error.response?.data || error.message || 'Unknown error',
        details: {
          status: error.response?.status,
          baseURL: api.defaults.baseURL,
          fullURL: error.config?.url
        }
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username || formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters long';
    }
    
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    }
    
    if (formData.password !== formData.password2) {
      newErrors.password2 = 'Passwords do not match';
    }
    
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email format is invalid';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage('');
    setLoading(true);

    // Validate form before sending to API
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setLoading(false);
      return;
    }

    try {
      console.log('🚀 Attempting registration...');
      console.log('📍 API Base URL:', api.defaults.baseURL);
      console.log('📋 Form data:', { ...formData, password: '***', password2: '***' });
      
      // Fixed: Using correct endpoint path for registration
      const response = await api.post(
        `/api/v1/auth/register`,
        formData
      );
      console.log('✅ Registration successful:', response.data);
      setSuccessMessage(response.data.detail || response.data.message);
    } catch (error) {
      console.error("❌ REGISTRATION FAILED - DETAILED ERROR ANALYSIS:");
      console.error("=".repeat(60));
      
      // Log error object structure
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);
      console.error("Error stack:", error.stack);
      
      // Log response details if available
      if (error.response) {
        console.error("HTTP Response received:");
        console.error("- Status:", error.response.status);
        console.error("- Status Text:", error.response.statusText);
        console.error("- Headers:", error.response.headers);
        console.error("- Response Data:", error.response.data);
        
        // Try to extract the actual error message
        const errorData = error.response.data;
        let actualErrorMessage = "Unknown server error";
        
        if (typeof errorData === 'string') {
          actualErrorMessage = errorData;
          console.error("- Error type: Plain text response");
        } else if (errorData && typeof errorData === 'object') {
          console.error("- Error type: JSON object response");
          if (errorData.error) {
            actualErrorMessage = errorData.error;
            console.error("- Extracted error:", errorData.error);
          } else if (errorData.message) {
            actualErrorMessage = errorData.message;
            console.error("- Extracted message:", errorData.message);
          } else if (errorData.detail) {
            actualErrorMessage = errorData.detail;
            console.error("- Extracted detail:", errorData.detail);
          } else {
            console.error("- Error object structure:", Object.keys(errorData));
          }
        }
        
        console.error("- FINAL ERROR MESSAGE TO SHOW USER:", actualErrorMessage);
        
        // Set user-friendly errors based on the actual error message
        if (actualErrorMessage.toLowerCase().includes('password must be')) {
          setErrors({ password: actualErrorMessage });
        } else if (actualErrorMessage.toLowerCase().includes('username')) {
          setErrors({ username: actualErrorMessage });
        } else if (actualErrorMessage.toLowerCase().includes('email')) {
          setErrors({ email: actualErrorMessage });
        } else {
          setErrors({ non_field_errors: actualErrorMessage });
        }
        
      } else if (error.request) {
        console.error("Network request made but no response received:");
        console.error("- Request:", error.request);
        console.error("- Possible causes: Network timeout, CORS, server down");
        setErrors({ non_field_errors: "Network error: No response from server. Check your connection and try again." });
        
      } else {
        console.error("Error in setting up the request:");
        console.error("- Error message:", error.message);
        setErrors({ non_field_errors: `Request setup error: ${error.message}` });
      }
      
      // Log the final URL that was called
      if (error.config) {
        console.error("Request configuration:");
        console.error("- Method:", error.config.method?.toUpperCase());
        console.error("- Base URL:", error.config.baseURL);
        console.error("- URL path:", error.config.url);
        console.error("- Full URL:", (error.config.baseURL || '') + (error.config.url || ''));
        console.error("- Headers:", error.config.headers);
        console.error("- Data sent:", error.config.data);
      }
      
      console.error("=".repeat(60));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Register
      </Typography>

      {/* API Connectivity Test Section */}
      <Box sx={{ mb: 3, p: 2, border: '1px solid #ddd', borderRadius: 1, backgroundColor: '#f9f9f9' }}>
        <Typography variant="h6" gutterBottom>
          🔧 Debug: API Connectivity Test
        </Typography>
        <Button 
          variant="outlined" 
          onClick={testConnectivity} 
          disabled={connectivityTest?.loading}
          sx={{ mb: 2 }}
        >
          {connectivityTest?.loading ? 'Testing...' : 'Test API Connection'}
        </Button>
        
        {connectivityTest && !connectivityTest.loading && (
          <Alert 
            severity={connectivityTest.success ? "success" : "error"} 
            sx={{ mb: 1 }}
          >
            <Typography variant="body2">
              {connectivityTest.message}
            </Typography>
            {connectivityTest.details && (
              <Box component="pre" sx={{ fontSize: '0.8rem', mt: 1, overflow: 'auto' }}>
                {JSON.stringify(connectivityTest.details, null, 2)}
              </Box>
            )}
            {connectivityTest.error && (
              <Box component="pre" sx={{ fontSize: '0.8rem', mt: 1, overflow: 'auto' }}>
                Error: {JSON.stringify(connectivityTest.error, null, 2)}
              </Box>
            )}
          </Alert>
        )}
      </Box>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      {errors.non_field_errors && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.non_field_errors}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        <TextField
          label="Username"
          name="username"
          variant="outlined"
          value={formData.username}
          onChange={handleChange}
          required
          disabled={loading}
          error={Boolean(errors.username)}
          helperText={errors.username}
        />

        <TextField
          label="Email"
          name="email"
          type="email"
          variant="outlined"
          value={formData.email}
          onChange={handleChange}
          disabled={loading}
          error={Boolean(errors.email)}
          helperText={errors.email}
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          variant="outlined"
          value={formData.password}
          onChange={handleChange}
          required
          disabled={loading}
          error={Boolean(errors.password)}
          helperText={errors.password}
        />

        <TextField
          label="Confirm Password"
          name="password2"
          type="password"
          variant="outlined"
          value={formData.password2}
          onChange={handleChange}
          required
          disabled={loading}
          error={Boolean(errors.password2)}
          helperText={errors.password2}
        />

        {errors.non_field_errors && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Registration Failed:</strong><br />
            {errors.non_field_errors}
            <br /><br />
            <small>Check the browser console for detailed technical information.</small>
          </Alert>
        )}

        <Button variant="contained" type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </Box>
    </Box>
  );
};

export default Register;
