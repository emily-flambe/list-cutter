import React from 'react';
import { Container, Typography, Box, Paper } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { GoogleOAuthCallback } from './GoogleSignInButton';
import { Navigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, loading } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const isOAuthCallback = urlParams.has('oauth_success') || urlParams.has('token');

  // Handle OAuth callback if parameters are present
  if (isOAuthCallback) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <GoogleOAuthCallback 
          onSuccess={() => {
            // Clear URL parameters and stay on dashboard
            window.history.replaceState({}, document.title, '/dashboard');
          }}
          onError={(error) => {
            console.error('OAuth error:', error);
            alert(`Sign-in failed: ${error.message}`);
            window.location.href = '/login';
          }}
        />
      </Container>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Normal dashboard view
  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Welcome to Your Dashboard
      </Typography>
      
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          User Information
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography>Username: {user.username}</Typography>
          {user.email && <Typography>Email: {user.email}</Typography>}
          <Typography>User ID: {user.id}</Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body1">
            • <a href="/csv_cutter">CSV Cutter</a> - Process your CSV files
          </Typography>
          <Typography variant="body1">
            • <a href="/manage_files">Manage Files</a> - View and manage your uploaded files
          </Typography>
          <Typography variant="body1">
            • <a href="/file_lineage">File Lineage</a> - Track file processing history
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default Dashboard;