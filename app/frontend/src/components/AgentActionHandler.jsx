import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Snackbar, Alert } from '@mui/material';

const AgentActionHandler = () => {
  const navigate = useNavigate();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  useEffect(() => {
    const handleAgentAction = (event) => {
      const { action, data } = event.detail;
      console.log('Agent action received:', action, data);

      switch (action) {
        case 'NAVIGATE':
          handleNavigation(data);
          break;
          
        case 'FILL_FORM':
          handleFormFill(data);
          break;
          
        case 'SHOW_MESSAGE':
          handleShowMessage(data);
          break;
          
        case 'GENERATE_DATA':
          handleGenerateData(data);
          break;
          
        default:
          console.warn('Unknown agent action:', action);
      }
    };

    const handleNavigation = (data) => {
      const { path } = data;
      if (path) {
        navigate(path);
        showSnackbar(`Navigated to ${path}`, 'info');
      }
    };

    const handleFormFill = (data) => {
      // Dispatch a custom event that the target form can listen to
      const formEvent = new CustomEvent('agent-form-fill', {
        detail: data,
        bubbles: true
      });
      window.dispatchEvent(formEvent);
      showSnackbar('Form data prepared by Cutty', 'success');
    };

    const handleShowMessage = (data) => {
      const { message, severity = 'info' } = data;
      showSnackbar(message, severity);
    };

    const handleGenerateData = (data) => {
      // Navigate to synthetic data generator with params
      navigate('/synthetic-data', { 
        state: { 
          prefilledData: data 
        } 
      });
      showSnackbar('Preparing to generate synthetic data...', 'info');
    };

    // Add event listener
    window.addEventListener('agent-action', handleAgentAction);

    // Cleanup
    return () => {
      window.removeEventListener('agent-action', handleAgentAction);
    };
  }, [navigate]);

  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={handleCloseSnackbar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
};

export default AgentActionHandler;