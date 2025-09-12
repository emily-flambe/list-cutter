import React from 'react';
import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ChatIcon from '@mui/icons-material/Chat';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

const ActionButton = ({ action, onClick, variant = 'outlined', size = 'small' }) => {
  const getActionIcon = (type) => {
    switch (type) {
      case 'message':
        return <ChatIcon fontSize="small" />;
      case 'navigation':
        return <OpenInNewIcon fontSize="small" />;
      case 'internal_navigation':
        return <NavigateNextIcon fontSize="small" />;
      default:
        return <ArrowForwardIcon fontSize="small" />;
    }
  };

  const getActionColor = (type) => {
    switch (type) {
      case 'message':
        return 'primary';
      case 'navigation':
        return 'secondary';
      case 'internal_navigation':
        return 'info';
      default:
        return 'primary';
    }
  };

  const handleClick = () => {
    if (onClick) {
      onClick(action);
    }
  };

  if (variant === 'chip') {
    return (
      <Chip
        label={action.label || action.text}
        icon={getActionIcon(action.type)}
        onClick={handleClick}
        color={getActionColor(action.type)}
        variant="outlined"
        size={size}
        sx={{
          m: 0.5,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: 2
          }
        }}
      />
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      color={getActionColor(action.type)}
      startIcon={getActionIcon(action.type)}
      onClick={handleClick}
      sx={{
        m: 0.5,
        textTransform: 'none',
        borderRadius: 2,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: 2
        }
      }}
    >
      {action.label || action.text}
    </Button>
  );
};

export const ActionButtonGroup = ({ actions, onActionClick, title, variant = 'chip' }) => {
  if (!actions || actions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: 2 }}>
      {title && (
        <Box sx={{ mb: 1 }}>
          <Chip 
            label={title} 
            size="small" 
            variant="outlined" 
            sx={{ 
              fontWeight: 600,
              opacity: 0.8
            }} 
          />
        </Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {actions.map((action, index) => (
          <ActionButton
            key={index}
            action={action}
            onClick={onActionClick}
            variant={variant}
          />
        ))}
      </Box>
    </Box>
  );
};

ActionButton.propTypes = {
  action: PropTypes.shape({
    label: PropTypes.string,
    text: PropTypes.string,
    type: PropTypes.string
  }).isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.string,
  size: PropTypes.string
};

ActionButtonGroup.propTypes = {
  actions: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    text: PropTypes.string,
    type: PropTypes.string
  })),
  onActionClick: PropTypes.func,
  title: PropTypes.string,
  variant: PropTypes.string
};

export default ActionButton;