import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import AssistantChat from './AssistantChat';

/**
 * Demo component to showcase the Assistant Chat functionality
 * This can be used for testing and development purposes
 */
const AssistantDemo = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Assistant Chat Demo
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        The Assistant Chat component is now floating in the bottom-right corner. 
        Click the chat icon to open it and test the functionality.
      </Alert>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Features Implemented:
        </Typography>
        <ul>
          <li>Floating chat button in bottom-right corner</li>
          <li>Expandable chat window with header and controls</li>
          <li>Message display with user and assistant messages</li>
          <li>Source cards for displaying reference materials</li>
          <li>Action buttons for suggested actions</li>
          <li>Input field with send functionality</li>
          <li>Context-aware welcome messages</li>
          <li>Loading states and error handling</li>
          <li>Mobile-responsive design</li>
          <li>Integration with authentication context</li>
        </ul>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          API Integration:
        </Typography>
        <Typography variant="body2" paragraph>
          The assistant service is configured to work with the following endpoints:
        </Typography>
        <ul>
          <li><code>POST /api/v1/assistant/chat</code> - Send messages</li>
          <li><code>GET /api/v1/assistant/conversation/:id</code> - Get conversation history</li>
          <li><code>DELETE /api/v1/assistant/conversation/:id</code> - Clear conversation</li>
          <li><code>POST /api/v1/assistant/actions</code> - Get suggested actions</li>
        </ul>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Test the Assistant:
        </Typography>
        <Typography variant="body2" paragraph>
          Look for the floating chat icon in the bottom-right corner of the screen.
          Try asking questions like:
        </Typography>
        <ul>
          <li>"How do I upload a file?"</li>
          <li>"What is Cuttytabs?"</li>
          <li>"Help me navigate the app"</li>
          <li>"What can I do here?"</li>
        </ul>
      </Paper>

      {/* The AssistantChat component is already included in the SidebarLayout */}
    </Box>
  );
};

export default AssistantDemo;