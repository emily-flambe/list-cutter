import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AssistantService from '../services/assistantService';
import { useAuth } from '../context/AuthContext';

export const useAssistant = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [suggestedActions, setSuggestedActions] = useState([]);
  const messagesEndRef = useRef(null);
  const location = useLocation();
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome message when first opened
    if (isOpen && messages.length === 0) {
      const welcomeMessage = {
        id: Date.now(),
        type: 'assistant',
        content: user 
          ? `Hello ${user.username}! I'm Cutty, your friendly assistant. How can I help you today?`
          : 'Hello! I\'m Cutty, your friendly assistant. I can help you navigate the app, understand features, and answer questions. What would you like to know?',
        timestamp: new Date(),
        sources: [],
        actions: []
      };
      setMessages([welcomeMessage]);
      
      // Get context-based suggested actions
      loadSuggestedActions();
    }
  }, [isOpen, user]);

  const loadSuggestedActions = useCallback(async () => {
    try {
      const context = {
        page: location.pathname,
        user_authenticated: !!user,
        user_id: user?.id
      };
      
      const result = await AssistantService.getSuggestedActions(context);
      if (result.success) {
        setSuggestedActions(result.data.actions || []);
      }
    } catch (error) {
      console.error('Failed to load suggested actions:', error);
    }
  }, [location.pathname, user]);

  const sendMessage = useCallback(async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const result = await AssistantService.sendMessage(messageText.trim(), conversationId);
      
      if (result.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: result.data.answer || result.data.response || 'Sorry, I could not generate a response.',
          timestamp: new Date(),
          sources: result.data.sources || [],
          actions: result.data.actions || result.data.suggested_actions || []
        };

        setMessages(prev => [...prev, assistantMessage]);
        
        if (result.data.conversation_id) {
          setConversationId(result.data.conversation_id);
        }
        
        // Update suggested actions if provided
        if (result.data.suggested_actions?.length > 0) {
          setSuggestedActions(result.data.suggested_actions);
        }
      } else {
        setError(result.error);
        const errorMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date(),
          sources: [],
          actions: [],
          isError: true
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Send message error:', error);
      setError('Network error. Please check your connection and try again.');
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: 'I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date(),
        sources: [],
        actions: [],
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading]);

  const clearConversation = useCallback(async () => {
    try {
      if (conversationId) {
        await AssistantService.clearConversation(conversationId);
      }
      setMessages([]);
      setConversationId(null);
      setError(null);
      setSuggestedActions([]);
      
      // Reload suggested actions for fresh start
      loadSuggestedActions();
    } catch (error) {
      console.error('Clear conversation error:', error);
    }
  }, [conversationId, loadSuggestedActions]);

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const handleActionClick = useCallback((action) => {
    if (action.type === 'message') {
      sendMessage(action.text);
    } else if (action.type === 'navigation' && action.url) {
      window.open(action.url, '_blank');
    } else if (action.type === 'internal_navigation' && action.path) {
      // This would need to be handled by the parent component
      // or through a routing context
      window.location.href = action.path;
    }
  }, [sendMessage]);

  return {
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
  };
};