import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ClearIcon from '@mui/icons-material/Clear';
import MinimizeIcon from '@mui/icons-material/Minimize';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AssistantMessage from './AssistantMessage';
import AssistantInput from './AssistantInput';
import { ActionButtonGroup } from './ActionButton';
import { useAssistant } from '../../hooks/useAssistant';

const AssistantChat = () => {
  const {
    messages,
    isLoading,
    isOpen,
    error,
    suggestedActions,
    messagesEndRef,
    sendMessage,
    clearConversation,
    toggleOpen,
    handleActionClick,
    setError
  } = useAssistant();

  const hasNewMessages = messages.length > 1; // More than just welcome message

  const ChatWindow = () => (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        bottom: 100,
        right: 24,
        width: 380,
        height: 500,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1300,
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SmartToyIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Cutty Assistant
          </Typography>
        </Box>
        
        <Box>
          <Tooltip title="Clear conversation">
            <IconButton
              size="small"
              onClick={clearConversation}
              sx={{ color: 'inherit', mr: 1 }}
              disabled={messages.length === 0}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Close">
            <IconButton
              size="small"
              onClick={toggleOpen}
              sx={{ color: 'inherit' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      <Collapse in={!!error}>
        <Alert 
          severity="error" 
          onClose={() => setError(null)}
          sx={{ borderRadius: 0 }}
        >
          {error}
        </Alert>
      </Collapse>

      {/* Messages Container */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'background.default'
        }}
      >
        {messages.length === 0 ? (
          <Box 
            sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              textAlign: 'center',
              color: 'text.secondary'
            }}
          >
            <HelpOutlineIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2" sx={{ mb: 1 }}>
              Welcome to Cutty Assistant!
            </Typography>
            <Typography variant="caption">
              Ask me anything about the application or need help navigating.
            </Typography>
          </Box>
        ) : (
          <>
            {messages.map((message) => (
              <AssistantMessage
                key={message.id}
                message={message}
                onActionClick={handleActionClick}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </Box>

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <>
          <Divider />
          <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
            <ActionButtonGroup
              actions={suggestedActions}
              onActionClick={handleActionClick}
              title="Quick Actions"
              variant="chip"
            />
          </Box>
        </>
      )}

      {/* Input */}
      <AssistantInput
        onSendMessage={sendMessage}
        isLoading={isLoading}
        placeholder="Ask Cutty anything..."
      />
    </Paper>
  );

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip title={isOpen ? "Close Assistant" : "Open Assistant"}>
        <Badge 
          badgeContent={hasNewMessages && !isOpen ? "!" : 0} 
          color="secondary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1300
          }}
        >
          <Fab
            color="primary"
            onClick={toggleOpen}
            sx={{
              width: 60,
              height: 60,
              boxShadow: 4,
              '&:hover': {
                boxShadow: 8,
                transform: 'scale(1.05)'
              },
              transition: 'all 0.2s ease'
            }}
          >
            {isOpen ? <MinimizeIcon /> : <SmartToyIcon />}
          </Fab>
        </Badge>
      </Tooltip>

      {/* Chat Window */}
      {isOpen && <ChatWindow />}
    </>
  );
};

export default AssistantChat;