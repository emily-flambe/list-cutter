import React from 'react';
import PropTypes from 'prop-types';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinkIcon from '@mui/icons-material/Link';
import DescriptionIcon from '@mui/icons-material/Description';
import WebIcon from '@mui/icons-material/Web';

const SourceCard = ({ source }) => {
  const getSourceIcon = (type) => {
    switch (type) {
      case 'documentation':
        return <DescriptionIcon fontSize="small" />;
      case 'external':
        return <WebIcon fontSize="small" />;
      default:
        return <LinkIcon fontSize="small" />;
    }
  };

  const getSourceColor = (type) => {
    switch (type) {
      case 'documentation':
        return 'primary';
      case 'external':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const handleSourceClick = (e) => {
    e.preventDefault();
    if (source.url) {
      window.open(source.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 1, 
        cursor: source.url ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': source.url ? {
          boxShadow: 2,
          borderColor: 'primary.main'
        } : {},
        maxWidth: 300
      }}
      onClick={source.url ? handleSourceClick : undefined}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {getSourceIcon(source.type)}
          <Typography 
            variant="subtitle2" 
            sx={{ 
              ml: 1, 
              fontWeight: 600,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {source.title || 'Source'}
          </Typography>
          <Chip 
            label={source.type || 'reference'} 
            size="small" 
            color={getSourceColor(source.type)}
            sx={{ ml: 1 }}
          />
        </Box>
        
        {source.description && (
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
              mb: source.url ? 1 : 0
            }}
          >
            {source.description}
          </Typography>
        )}
        
        {source.url && (
          <Link
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            sx={{ 
              fontSize: '0.75rem',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline'
              }
            }}
          >
            View Source
          </Link>
        )}
      </CardContent>
    </Card>
  );
};

SourceCard.propTypes = {
  source: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.string,
    url: PropTypes.string,
    type: PropTypes.string
  }).isRequired
};

export default SourceCard;