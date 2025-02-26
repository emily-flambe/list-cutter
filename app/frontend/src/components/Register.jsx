// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
} from '@mui/material';

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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSuccessMessage('');
    setLoading(true);

    try {
      const response = await axios.post(
        `/api/accounts/register/`,
        formData
      );
      setSuccessMessage(response.data.detail);
    } catch (error) {
      console.error("Registration error:", error);
      if (error.response && error.response.data) {
        setErrors(error.response.data);
      } else {
        setErrors({ non_field_errors: 'An error occurred' });
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
