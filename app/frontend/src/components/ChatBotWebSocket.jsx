import React, { useState, useRef, useEffect } from 'react';
import {
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Chip,
  Avatar,
  Divider
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { useAgentChat } from '../hooks/useAgentChat';
import cuttyAvatar from '../assets/cutty_logo.png';

const ChatBotWebSocket = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const {
    messages,
    sendMessage,
    isConnected,
    isLoading,
    sessionId
  } = useAgentChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && isConnected) {
      sendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Only show chat if agent is enabled
  if (import.meta.env.VITE_AGENT_ENABLED !== 'true') {
    return null;
  }

  return (
    <>
      <Fab
        color="primary"
        aria-label="chat"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={() => setOpen(true)}
      >
        <ChatIcon />
      </Fab>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { height: '80vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar src={cuttyAvatar} alt="Cutty" sx={{ width: 40, height: 40 }} />
          <Box flex={1}>
            <Typography variant="h6">Chat with Cutty</Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={isConnected ? 'Connected' : 'Connecting...'}
                size="small"
                color={isConnected ? 'success' : 'default'}
                variant={isConnected ? 'filled' : 'outlined'}
              />
              {import.meta.env.DEV && (
                <Typography variant="caption" color="text.secondary">
                  Session: {sessionId.slice(-8)}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton onClick={() => setOpen(false)} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
          <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
            {messages.length === 0 && (
              <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom>
                  Welcome to Cutty Chat! 🦑
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  I can help you understand the Cutty app and answer questions about:
                </Typography>
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <Chip label="Supported states for data generation" size="small" />
                  <Chip label="How to use app features" size="small" />
                  <Chip label="List generation and management" size="small" />
                </Box>
              </Paper>
            )}

            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2
                }}
              >
                {message.role === 'assistant' && (
                  <Avatar 
                    src={cuttyAvatar} 
                    sx={{ width: 32, height: 32, mr: 1 }} 
                  />
                )}
                <Paper
                  elevation={1}
                  sx={{
                    p: 2,
                    maxWidth: '70%',
                    bgcolor: message.role === 'user' ? 'primary.dark' : 'background.paper',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                    border: message.role === 'assistant' ? '1px solid' : 'none',
                    borderColor: 'divider'
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mt: 1,
                      opacity: 0.7,
                      color: message.role === 'user' ? 'inherit' : 'text.secondary'
                    }}
                  >
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </Typography>
                </Paper>
              </Box>
            ))}

            {isLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar src={cuttyAvatar} sx={{ width: 32, height: 32, mr: 1 }} />
                <Paper sx={{ p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                  <CircularProgress size={20} />
                </Paper>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder={isConnected ? "Type your message..." : "Connecting to agent..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
              multiline
              maxRows={4}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!input.trim() || !isConnected}
              sx={{
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'primary.dark',
                },
                '&.Mui-disabled': {
                  bgcolor: 'action.disabledBackground',
                  color: 'action.disabled'
                }
              }}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatBotWebSocket;