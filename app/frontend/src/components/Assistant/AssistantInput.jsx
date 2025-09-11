import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';

const AssistantInput = ({ 
  onSendMessage, 
  isLoading, 
  disabled = false, 
  placeholder = "Ask Cutty anything..." 
}) => {
  const [message, setMessage] = useState('');
  const inputRef = useRef(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isLoading && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
      // Keep focus on input after sending
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleChange = (event) => {
    setMessage(event.target.value);
  };

  // Future enhancement: voice input
  const handleVoiceInput = () => {
    // This would implement speech-to-text functionality
    console.log('Voice input clicked - future enhancement');
  };

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
      <TextField
        ref={inputRef}
        fullWidth
        multiline
        maxRows={3}
        value={message}
        onChange={handleChange}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        variant="outlined"
        size="small"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {/* Voice input button - future enhancement */}
                <IconButton
                  size="small"
                  onClick={handleVoiceInput}
                  disabled={disabled || isLoading}
                  sx={{ mr: 0.5, opacity: 0.5 }} // Make it subtle since it's not implemented
                  title="Voice input (coming soon)"
                >
                  <MicIcon fontSize="small" />
                </IconButton>
                
                {/* Send button */}
                <IconButton
                  onClick={handleSend}
                  disabled={!message.trim() || isLoading || disabled}
                  color="primary"
                  size="small"
                >
                  {isLoading ? (
                    <CircularProgress size={20} />
                  ) : (
                    <SendIcon fontSize="small" />
                  )}
                </IconButton>
              </Box>
            </InputAdornment>
          ),
          sx: {
            borderRadius: 2,
            '& .MuiOutlinedInput-root': {
              '&:hover fieldset': {
                borderColor: 'primary.main',
              },
              '&.Mui-focused fieldset': {
                borderWidth: 2,
              },
            },
          }
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            paddingRight: 1,
          }
        }}
      />
      
      {/* Hint text */}
      <Box 
        sx={{ 
          mt: 1, 
          px: 1, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Box 
          component="span" 
          sx={{ 
            fontSize: '0.75rem', 
            color: 'text.secondary',
            opacity: 0.7
          }}
        >
          Press Enter to send, Shift+Enter for new line
        </Box>
        
        {/* Character count for longer messages */}
        {message.length > 100 && (
          <Box 
            component="span" 
            sx={{ 
              fontSize: '0.75rem', 
              color: message.length > 500 ? 'warning.main' : 'text.secondary'
            }}
          >
            {message.length}/1000
          </Box>
        )}
      </Box>
    </Box>
  );
};

AssistantInput.propTypes = {
  onSendMessage: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string
};

export default AssistantInput;