import React from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import PersonIcon from '@mui/icons-material/Person';
import SourceCard from './SourceCard';
import { ActionButtonGroup } from './ActionButton';
import cuttlefishLogo from '../../assets/cutty_logo.png';

const AssistantMessage = ({ message, onActionClick }) => {
  const isUser = message.type === 'user';
  const isError = message.isError;

  const formatTimestamp = (timestamp) => {
    try {
      const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch (error) {
      return '';
    }
  };

  const getAvatarContent = () => {
    if (isUser) {
      return <PersonIcon />;
    }
    return (
      <img 
        src={cuttlefishLogo} 
        alt="Cutty" 
        style={{ 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover',
          borderRadius: '50%'
        }} 
      />
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        mb: 2,
        alignItems: 'flex-start'
      }}
    >
      <Avatar
        sx={{
          bgcolor: isUser ? 'primary.main' : 'secondary.main',
          width: 32,
          height: 32,
          mx: 1,
          mt: 0.5
        }}
      >
        {getAvatarContent()}
      </Avatar>

      <Box sx={{ maxWidth: '70%', minWidth: 0 }}>
        <Paper
          elevation={1}
          sx={{
            p: 2,
            bgcolor: isError 
              ? 'error.light' 
              : isUser 
                ? 'primary.main' 
                : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: 2,
            borderTopLeftRadius: isUser ? 2 : 0.5,
            borderTopRightRadius: isUser ? 0.5 : 2,
            boxShadow: isError ? '0 2px 8px rgba(211, 47, 47, 0.3)' : undefined
          }}
        >
          <Typography
            sx={{
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.5
            }}
          >
            {message.content}
          </Typography>

          {/* Sources section - only for assistant messages */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 600, 
                  color: 'text.secondary',
                  mb: 1,
                  display: 'block'
                }}
              >
                Sources:
              </Typography>
              <Stack spacing={1}>
                {message.sources.map((source, index) => (
                  <SourceCard key={index} source={source} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Action buttons - only for assistant messages */}
          {!isUser && message.actions && message.actions.length > 0 && (
            <ActionButtonGroup
              actions={message.actions}
              onActionClick={onActionClick}
              title="Suggested Actions"
              variant="chip"
            />
          )}
        </Paper>

        {/* Timestamp */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            textAlign: isUser ? 'right' : 'left',
            mt: 0.5,
            mx: 1
          }}
        >
          {formatTimestamp(message.timestamp)}
        </Typography>
      </Box>
    </Box>
  );
};

AssistantMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    type: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    timestamp: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]).isRequired,
    sources: PropTypes.array,
    actions: PropTypes.array,
    isError: PropTypes.bool
  }).isRequired,
  onActionClick: PropTypes.func
};

export default AssistantMessage;