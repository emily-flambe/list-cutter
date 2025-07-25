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
import api from '../api';

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

  // Format timestamp safely
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return new Date().toLocaleTimeString();
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString();
      }
      return date.toLocaleTimeString();
    } catch (error) {
      return new Date().toLocaleTimeString();
    }
  };

  // Handle file downloads with authentication
  const handleDownload = async (url, filename) => {
    try {
      const response = await api.get(url, {
        responseType: 'blob'
      });
      
      // Create a blob URL and trigger download
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  // Parse markdown links and plain URLs into clickable components
  const renderMessageContent = (content) => {
    // Combined regex to match either markdown links [text](url) or plain URLs
    const combinedRegex = /(\[([^\]]+)\]\(([^)]+)\))|(\/api\/v1\/[^\s]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedRegex.exec(content)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      if (match[1]) {
        // Markdown link format [text](url)
        const linkText = match[2];
        const linkUrl = match[3];
        
        // Check if it's a download link
        if (linkUrl.includes('/api/v1/synthetic-data/download/')) {
          parts.push(
            <a
              key={match.index}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleDownload(linkUrl, linkText);
              }}
              style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {linkText}
            </a>
          );
        } else {
          parts.push(
            <a
              key={match.index}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              {linkText}
            </a>
          );
        }
      } else {
        // Plain URL format
        const url = match[0];
        parts.push(
          <a
            key={match.index}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleDownload(url, 'download');
            }}
            style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Download File
          </a>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : content;
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
        PaperProps={{
          sx: { 
            position: 'fixed',
            bottom: 80,
            right: 16,
            m: 0,
            width: 380,
            height: 500,
            display: 'flex', 
            flexDirection: 'column'
          }
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">Chat with Cutty</Typography>
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
          <IconButton onClick={() => setOpen(false)} edge="end" size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Divider />

        <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
          <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
            {messages.length === 0 && (
              <Paper sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Avatar 
                    src={cuttyAvatar} 
                    sx={{ width: 36, height: 36, flexShrink: 0 }} 
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Hi! I'm Cutty, your best friend!
                    </Typography>
                    <Typography variant="caption" color="text.secondary" paragraph sx={{ mb: 1 }}>
                      Ask me to help you generate synthetic data! It's all I can do right now. I'm a growing boy! (cuttlefish)
                    </Typography>
                    </Box>
                  </Box>
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
                  <Typography 
                    variant="body1" 
                    component="div"
                    sx={{ whiteSpace: 'pre-wrap' }}
                  >
                    {renderMessageContent(message.content)}
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
                    {formatTimestamp(message.timestamp)}
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