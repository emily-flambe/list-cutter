// frontend/src/pages/Login.jsx
import React, { useState, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
// Optimized direct imports for better tree-shaking and build performance
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import GoogleSignInButton, { GoogleOAuthCallback } from './GoogleSignInButton';

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate(); // Get the navigate function
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.get('oauth_success') === 'true';

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await api.post(`/api/v1/auth/login`, credentials);
      login(response.data.access, credentials.username, response.data.refresh);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSuccess = (data) => {
    // OAuth callback will handle token storage and redirect
    navigate('/dashboard');
  };

  const handleOAuthError = (error) => {
    setError(error.message || 'Google sign-in failed. Please try again.');
  };

  // Handle OAuth callback
  if (isOAuthCallback) {
    return (
      <Box sx={{ p: 2, maxWidth: 400, mx: 'auto' }}>
        <GoogleOAuthCallback 
          onSuccess={handleOAuthSuccess}
          onError={handleOAuthError}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Login
      </Typography>
      
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      
      {/* Google Sign-In Section */}
      <Box sx={{ mb: 3 }}>
        <GoogleSignInButton 
          mode="login"
          onError={handleOAuthError}
          disabled={loading}
        />
      </Box>

      {/* Divider */}
      <Divider sx={{ my: 2 }}>
        <Typography variant="body2" color="textSecondary">
          or continue with email
        </Typography>
      </Divider>

      {/* Email/Password Form */}
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Username"
          name="username"
          value={credentials.username}
          onChange={handleChange}
          required
          disabled={loading}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={credentials.password}
          onChange={handleChange}
          required
          disabled={loading}
        />
        <Button 
          variant="contained" 
          type="submit" 
          disabled={loading}
          sx={{ mt: 1 }}
        >
          {loading ? 'Logging in...' : 'Login with Email'}
        </Button>
      </Box>
      
      <Typography variant="body2" sx={{ mt: 3, textAlign: 'center' }}>
        Need to create an account?{' '}
        <Link component={RouterLink} to="/register">
          Sign up here
        </Link>
      </Typography>
    </Box>
  );
};

export default Login;
