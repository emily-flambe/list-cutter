// frontend/src/pages/Login.jsx
import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { Box, Typography, TextField, Button, Alert, Link } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Login = () => {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate(); // Get the navigate function
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/accounts/login/`, credentials);
      login(response.data.access, credentials.username, response.data.refresh);
      navigate('/');
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 400, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Login
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Username"
          name="username"
          value={credentials.username}
          onChange={handleChange}
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          value={credentials.password}
          onChange={handleChange}
          required
        />
        <Button variant="contained" type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </Box>
      <Typography variant="body2" sx={{ mt: 2 }}>
        Need to create an account?{' '}
        <Link component={RouterLink} to="/register">
          Click here
        </Link>
      </Typography>
    </Box>
  );
};

export default Login;
