import React, { lazy } from 'react';

// Lazy load the appropriate ChatBot component based on environment
const ChatBot = lazy(() => import('./ChatBot'));
const ChatBotWebSocket = lazy(() => import('./ChatBotWebSocket'));

const ChatBotWrapper = () => {
  // Use WebSocket version if agent is enabled
  const Component = import.meta.env.VITE_AGENT_ENABLED === 'true' 
    ? ChatBotWebSocket 
    : ChatBot;
    
  return <Component />;
};

export default ChatBotWrapper;