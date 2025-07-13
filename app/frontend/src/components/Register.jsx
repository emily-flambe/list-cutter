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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage('');
    setLoading(true);

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
      console.error("❌ Registration error details:", {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      });
      
      if (error.response && error.response.data) {
        setErrors(error.response.data);
      } else {
        setErrors({ non_field_errors: `An error occurred: ${error.message}` });
      }
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

        <Button variant="contained" type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </Box>
    </Box>
  );
};

export default Register;
