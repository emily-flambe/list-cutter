import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export const useAgentChat = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Generate unique session ID per tab
  const [sessionId] = useState(() => {
    const existing = sessionStorage.getItem('cutty-chat-session');
    if (existing) return existing;
    
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('cutty-chat-session', id);
    return id;
  });

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Connect directly to the agent service
    // Cloudflare Workers cannot proxy WebSocket connections
    const agentUrl = import.meta.env.VITE_AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
    const wsProtocol = agentUrl.startsWith('https') ? 'wss' : 'ws';
    const agentHost = agentUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${agentHost}/agents/chat/default?sessionId=${sessionId}`;

    console.log('Connecting to agent:', wsUrl);
    console.log('✅ CUTTY-AGENT FIX APPLIED: Direct WebSocket connection to agent service');
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to Cutty Agent');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      loadMessageHistory();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleAgentMessage(data);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      
      // Auto-reconnect after 3 seconds with max attempts
      if (!reconnectTimeoutRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        console.log(`Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 3000);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached. Please refresh the page to try again.');
      }
    };

    wsRef.current = ws;
  }, [sessionId]);

  const loadMessageHistory = async () => {
    try {
      // Always use proxy through worker for API calls
      const url = `/api/v1/agent/chat/${sessionId}/messages`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || data || []);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleAgentMessage = (data) => {
    // Handle action messages from agent
    if (data.type === 'action') {
      handleAgentAction(data.action, data.data);
    }
    
    // Add message to chat
    const message = {
      id: Date.now(),
      role: 'assistant',
      content: data.content || data.message || '',
      timestamp: new Date().toISOString(),
      ...data
    };
    
    setMessages(prev => [...prev, message]);
    setIsLoading(false);
  };

  const handleAgentAction = (action, data) => {
    // Dispatch custom events for the app to handle
    const event = new CustomEvent('agent-action', {
      detail: { action, data }
    });
    window.dispatchEvent(event);
    
    // Log for debugging
    console.log('Agent action:', action, data);
  };

  const sendMessage = useCallback((content) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      return;
    }

    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Send to agent with context
    wsRef.current.send(JSON.stringify({
      message: content,
      context: {
        user: user?.email,
        page: window.location.pathname
      }
    }));
  }, [user]);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return {
    messages,
    sendMessage,
    isConnected,
    isLoading,
    sessionId
  };
};