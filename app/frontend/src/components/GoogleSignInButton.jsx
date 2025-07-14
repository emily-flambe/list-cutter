/**
 * Google Sign-In Button Component
 * 
 * Provides a beautiful, accessible Google Sign-In button that follows
 * Google's brand guidelines and integrates with our OAuth flow.
 * 
 * Features:
 * - Authentic Google branding and styling
 * - Multiple modes: login, signup, link account
 * - Loading states and error handling
 * - Accessibility support
 * - Responsive design
 */

import React, { useState } from 'react';
import { Button, CircularProgress, Box, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../context/AuthContext';

const GoogleSignInButton = ({ 
  mode = 'login', // 'login', 'signup', 'link'
  returnUrl = '/dashboard',
  onSuccess,
  onError,
  disabled = false,
  variant = 'contained',
  size = 'large',
  fullWidth = true
}) => {
  const [loading, setLoading] = useState(false);
  const { API_BASE_URL } = useAuth();

  const getModeText = () => {
    switch (mode) {
      case 'signup':
        return 'Sign up with Google';
      case 'link':
        return 'Link Google Account';
      default:
        return 'Sign in with Google';
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading || disabled) return;

    try {
      setLoading(true);

      // For account linking, we need to include the auth token
      const headers = {};
      if (mode === 'link') {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication required for account linking');
        }
        headers.Authorization = `Bearer ${token}`;
      }

      // Build the OAuth initiation URL
      const endpoint = mode === 'link' 
        ? `${API_BASE_URL}/api/v1/auth/google/link`
        : `${API_BASE_URL}/api/v1/auth/google`;

      const params = new URLSearchParams({
        return_url: returnUrl,
      });

      const requestUrl = mode === 'link' 
        ? endpoint
        : `${endpoint}?${params.toString()}`;

      // For linking, make a POST request; for login/signup, make a GET request
      const response = mode === 'link'
        ? await fetch(requestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers,
            },
            body: JSON.stringify({ return_url: returnUrl }),
          })
        : await fetch(requestUrl, {
            method: 'GET',
            headers,
          });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to initiate Google OAuth');
      }

      const data = await response.json();

      if (!data.success || !data.authorization_url) {
        throw new Error(data.message || 'Invalid OAuth response');
      }

      // Redirect to Google OAuth
      window.location.href = data.authorization_url;

    } catch (error) {
      setLoading(false);
      console.error('Google OAuth initiation failed:', error);
      
      if (onError) {
        onError(error);
      } else {
        // Show a user-friendly error message
        alert(error.message || 'Google sign-in failed. Please try again.');
      }
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      onClick={handleGoogleSignIn}
      disabled={loading || disabled}
      startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
      sx={{
        backgroundColor: variant === 'contained' ? '#4285f4' : 'transparent',
        color: variant === 'contained' ? 'white' : '#4285f4',
        border: variant === 'outlined' ? '2px solid #4285f4' : 'none',
        borderRadius: '8px',
        textTransform: 'none',
        fontSize: '16px',
        fontWeight: 500,
        padding: '12px 24px',
        minHeight: '48px',
        '&:hover': {
          backgroundColor: variant === 'contained' ? '#3367d6' : 'rgba(66, 133, 244, 0.04)',
          border: variant === 'outlined' ? '2px solid #3367d6' : 'none',
        },
        '&:focus': {
          boxShadow: '0 0 0 2px rgba(66, 133, 244, 0.3)',
        },
        '&.Mui-disabled': {
          backgroundColor: variant === 'contained' ? '#dadce0' : 'transparent',
          color: '#9aa0a6',
          border: variant === 'outlined' ? '2px solid #dadce0' : 'none',
        },
        // Google brand compliance - consistent with Google's design system
        fontFamily: '"Google Sans", "Roboto", sans-serif',
      }}
    >
      {loading ? 'Connecting...' : getModeText()}
    </Button>
  );
};

/**
 * OAuth Callback Handler Component
 * 
 * Handles the OAuth callback URL parameters and processes the authentication
 * result. This component should be rendered on the OAuth callback page.
 */
export const GoogleOAuthCallback = ({ onSuccess, onError }) => {
  const [processing, setProcessing] = useState(true);
  const { login } = useAuth();

  React.useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const isSuccess = urlParams.get('oauth_success') === 'true';
        const token = urlParams.get('token');
        const userId = urlParams.get('user_id');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(decodeURIComponent(error));
        }

        if (isSuccess && token && userId) {
          // Store the token and update auth context
          localStorage.setItem('token', token);
          
          // Fetch user details and update auth context
          await login(token);
          
          // Clean up URL parameters
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          
          if (onSuccess) {
            onSuccess({ token, userId });
          }
        } else {
          throw new Error('OAuth callback missing required parameters');
        }
      } catch (error) {
        console.error('OAuth callback processing failed:', error);
        
        if (onError) {
          onError(error);
        }
      } finally {
        setProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [login, onSuccess, onError]);

  if (processing) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="200px"
        gap={2}
      >
        <CircularProgress size={48} />
        <Typography variant="h6" color="textSecondary">
          Completing Google sign-in...
        </Typography>
      </Box>
    );
  }

  return null;
};

/**
 * Google Account Status Component
 * 
 * Shows the current Google account connection status for authenticated users
 * and provides options to link/unlink Google accounts.
 */
export const GoogleAccountStatus = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);
  const { API_BASE_URL, user } = useAuth();

  const fetchGoogleStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/google/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to fetch Google account status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Are you sure you want to unlink your Google account?')) {
      return;
    }

    try {
      setUnlinking(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/google/unlink`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchGoogleStatus(); // Refresh status
        alert('Google account unlinked successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to unlink Google account');
      }
    } catch (error) {
      console.error('Failed to unlink Google account:', error);
      alert(error.message || 'Failed to unlink Google account');
    } finally {
      setUnlinking(false);
    }
  };

  React.useEffect(() => {
    if (user) {
      fetchGoogleStatus();
    }
  }, [user]);

  if (loading || !user) {
    return <CircularProgress size={24} />;
  }

  if (!status) {
    return null;
  }

  return (
    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: '8px' }}>
      <Typography variant="h6" gutterBottom>
        Google Account
      </Typography>
      
      {status.google_connected ? (
        <Box>
          <Typography variant="body2" color="success.main" gutterBottom>
            ✓ Connected to Google
          </Typography>
          
          {status.google_email && (
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Email: {status.google_email}
            </Typography>
          )}
          
          {status.display_name && (
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Name: {status.display_name}
            </Typography>
          )}

          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleUnlinkGoogle}
            disabled={unlinking}
            sx={{ mt: 1 }}
          >
            {unlinking ? 'Unlinking...' : 'Unlink Google Account'}
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="body2" color="textSecondary" gutterBottom>
            Link your Google account for easier sign-in
          </Typography>
          
          <GoogleSignInButton 
            mode="link"
            variant="outlined"
            size="small"
            fullWidth={false}
          />
        </Box>
      )}
    </Box>
  );
};

export default GoogleSignInButton;