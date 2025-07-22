import React, { useState, useRef, useEffect } from 'react';
import {
  Fab,
  Paper,
  IconButton,
  TextField,
  Box,
  Typography,
  Fade,
  CircularProgress,
  Alert,
  Collapse,
  Avatar
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Send as SendIcon
} from '@mui/icons-material';
import cuttyLogo from '../assets/cutty_logo.png';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hey there! I'm Cutty the Cuttlefish. Your friendly list optimization assistant. How can I help you organize your lists today?",
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Debug: Log the API key (remove in production!)
      console.log('API Key available:', !!import.meta.env.VITE_AI_WORKER_API_KEY);
      console.log('API Key value:', import.meta.env.VITE_AI_WORKER_API_KEY);
      
      // Call AI worker directly
      const response = await fetch('https://ai.emilycogsdill.com/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_AI_WORKER_API_KEY}`
        },
        body: JSON.stringify({ 
          message: inputValue,
          systemPrompt: "You are Cutty the Cuttlefish, a helpful assistant for the Cutty app that generates synthetic person data. Be friendly and enthusiastic. You are a playful cuttlefish character. Keep your responses concise and brief - aim for 1-2 sentences maximum while maintaining your friendly, helpful personality."
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      
      const assistantMessage = {
        id: Date.now() + 1,
        text: data.response || "I'm here to help! Could you tell me more about what you need?",
        sender: 'assistant',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setError('Oops! Something went wrong. Please try again.');
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <Fab
        color="primary"
        aria-label="chat"
        onClick={() => setIsOpen(!isOpen)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: isOpen ? 'none' : 'flex',
          zIndex: 1300
        }}
      >
        <ChatIcon />
      </Fab>

      {/* Chat Window */}
      <Fade in={isOpen}>
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            width: { xs: '85%', sm: 350 },
            minHeight: 300,
            maxHeight: { xs: '70vh', sm: 600 },
            display: isOpen ? 'flex' : 'none',
            flexDirection: 'column',
            borderRadius: 2,
            overflow: 'hidden',
            zIndex: 1400
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Typography variant="h6">Chat with Cutty</Typography>
            <IconButton
              size="small"
              onClick={() => setIsOpen(false)}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              pl: 1,
              pr: 0,
              py: 2,
              bgcolor: 'background.default',
              minHeight: 0
            }}
          >
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  mb: 2,
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end',
                  gap: message.sender === 'assistant' ? 1.5 : 1
                }}
              >
                {message.sender === 'assistant' && (
                  <Avatar
                    src={cuttyLogo}
                    sx={{
                      width: 56,
                      height: 56,
                      bgcolor: 'transparent',
                      ml: 0,
                      flexShrink: 0
                    }}
                  />
                )}
                <Paper
                  elevation={1}
                  sx={{
                    p: 1.5,
                    maxWidth: '70%',
                    bgcolor: message.sender === 'user' ? 'primary.main' : 'background.paper',
                    color: message.sender === 'user' ? 'white' : 'text.primary',
                    borderRadius: message.sender === 'user' ? 2 : '18px',
                    position: 'relative',
                    ...(message.sender === 'assistant' && {
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: -8,
                        bottom: 10,
                        width: 0,
                        height: 0,
                        borderStyle: 'solid',
                        borderWidth: '10px 10px 10px 0',
                        borderColor: 'transparent transparent transparent',
                        borderRightColor: 'background.paper'
                      }
                    })
                  }}
                >
                  <Typography variant="body2" sx={{ textAlign: 'left' }}>{message.text}</Typography>
                </Paper>
              </Box>
            ))}
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', mb: 2, gap: 1.5 }}>
                <Avatar
                  src={cuttyLogo}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: 'transparent',
                    ml: 0,
                    flexShrink: 0
                  }}
                />
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 1.5, 
                    bgcolor: 'background.paper', 
                    borderRadius: '18px',
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: -8,
                      bottom: 10,
                      width: 0,
                      height: 0,
                      borderStyle: 'solid',
                      borderWidth: '10px 10px 10px 0',
                      borderColor: 'transparent transparent transparent',
                      borderRightColor: 'background.paper'
                    }
                  }}
                >
                  <CircularProgress size={20} />
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Error Alert */}
          <Collapse in={!!error}>
            <Alert severity="error" onClose={() => setError(null)} sx={{ m: 1 }}>
              {error}
            </Alert>
          </Collapse>

          {/* Input Area */}
          <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                multiline
                maxRows={3}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Fade>
    </>
  );
};

export default ChatBot;