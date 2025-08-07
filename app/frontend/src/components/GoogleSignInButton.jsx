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
  returnUrl = '/',
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
      variant="outlined"
      size={size}
      fullWidth={fullWidth}
      onClick={handleGoogleSignIn}
      disabled={loading || disabled}
      startIcon={
        loading ? (
          <CircularProgress size={18} sx={{ color: '#4285f4' }} />
        ) : (
          <Box
            component="svg"
            viewBox="0 0 24 24"
            sx={{ width: 18, height: 18 }}
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </Box>
        )
      }
      sx={{
        backgroundColor: '#fff',
        color: '#3c4043',
        border: '1px solid #dadce0',
        borderRadius: '4px',
        textTransform: 'none',
        fontSize: '14px',
        fontWeight: 500,
        padding: '0 12px',
        height: '40px',
        minWidth: '184px',
        fontFamily: '"Google Sans", "Roboto", sans-serif',
        boxShadow: 'none',
        transition: 'background-color .218s, border-color .218s, box-shadow .218s',
        '&:hover': {
          backgroundColor: '#f7f8f8',
          borderColor: '#dadce0',
          boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 1px 2px 0 rgba(60,64,67,0.15)',
        },
        '&:active': {
          backgroundColor: '#e8eaed',
          boxShadow: '0 1px 3px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)',
        },
        '&:focus': {
          outline: 'none',
          border: '1px solid #4285f4',
          boxShadow: 'none',
        },
        '&.Mui-disabled': {
          backgroundColor: '#fff',
          color: 'rgba(60,64,67,0.38)',
          borderColor: '#dadce0',
          cursor: 'not-allowed',
        },
        '& .MuiButton-startIcon': {
          marginRight: '8px',
          marginLeft: 0,
        },
      }}
    >
      {loading ? 'Signing in...' : getModeText()}
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
      const urlParams = new URLSearchParams(window.location.search);
      
      // Only process if we have OAuth parameters
      if (!urlParams.has('oauth_success') && !urlParams.has('error')) {
        setProcessing(false); // Not an OAuth callback
        return; // No OAuth parameters, nothing to process
      }
      
      try {
        const isSuccess = urlParams.get('oauth_success') === 'true';
        const token = urlParams.get('token');
        const refreshToken = urlParams.get('refresh_token');
        const userId = urlParams.get('user_id');
        const error = urlParams.get('error');
        

        if (error) {
          throw new Error(decodeURIComponent(error));
        }

        if (isSuccess && token && userId) {
          // IMPORTANT: Clear all old tokens before setting new OAuth token
          // This prevents conflicts with old JWT formats
          const authKeys = ['token', 'refreshToken', 'refresh_token', 'access_token', 'user'];
          authKeys.forEach(key => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
          });
          
          // Store the new OAuth tokens
          localStorage.setItem('token', token);
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
          } else {
          }
          
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