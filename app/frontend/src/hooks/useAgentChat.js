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
    console.log('🔍 Session ID:', sessionId);
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
      console.log('📋 Loading message history for session:', sessionId);
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || data || []);
        console.log('✅ Message history loaded:', data.messages?.length || 0, 'messages');
      } else {
        console.error('❌ Failed to load message history:', response.status);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const currentResponseRef = useRef('');
  const currentMessageIdRef = useRef(null);

  const handleAgentMessage = (data) => {
    console.log('📥 Received from agent:', data);
    
    // Handle Cloudflare Agents SDK response format
    if (data.type === 'cf_agent_use_chat_response' && data.body) {
      parseStreamingResponse(data.body, data.done);
    } 
    // Handle action messages from agent
    else if (data.type === 'action') {
      handleAgentAction(data.action, data.data);
    }
    // Fallback for other message formats
    else {
      const message = {
        id: Date.now(),
        role: 'assistant',
        content: data.content || data.message || '',
        timestamp: new Date().toISOString(),
        ...data
      };
      
      setMessages(prev => [...prev, message]);
      setIsLoading(false);
    }
  };

  const parseStreamingResponse = (body, isDone) => {
    // Handle different streaming data types
    if (body.startsWith('0:')) {
      // Text content delta
      try {
        const text = JSON.parse(body.slice(2).trim());
        currentResponseRef.current += text;
        console.log('🔤 Text delta received:', text, '| Total length:', currentResponseRef.current.length);
        
        // Only update or create message if we have content
        if (currentResponseRef.current.trim().length > 0) {
          setMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.id === currentMessageIdRef.current) {
              // Update existing message
              return prev.slice(0, -1).concat({
                ...lastMessage,
                content: currentResponseRef.current
              });
            } else {
              // Create new message only if we have content
              currentMessageIdRef.current = `msg-${Date.now()}`;
              return [...prev, {
                id: currentMessageIdRef.current,
                role: 'assistant',
                content: currentResponseRef.current,
                timestamp: new Date().toISOString()
              }];
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse text delta:', e);
      }
    } else if (body.startsWith('f:')) {
      // Message metadata
      try {
        const metadata = JSON.parse(body.slice(2).trim());
        if (metadata.messageId) {
          currentMessageIdRef.current = metadata.messageId;
        }
      } catch (e) {
        console.error('Failed to parse metadata:', e);
      }
    } else if (body.startsWith('e:')) {
      // Completion data - message is complete
      console.log('✅ Stream complete, cleaning up empty messages');
      // Remove any empty assistant messages on completion
      setMessages(prev => {
        const filtered = prev.filter(msg => 
          msg.role !== 'assistant' || (msg.content && msg.content.trim().length > 0)
        );
        if (filtered.length < prev.length) {
          console.log('🧹 Removed', prev.length - filtered.length, 'empty message(s)');
        }
        return filtered;
      });
      currentResponseRef.current = '';
      currentMessageIdRef.current = null;
      setIsLoading(false);
    }
    
    if (isDone) {
      // Clean up empty messages when done
      setMessages(prev => prev.filter(msg => 
        msg.role !== 'assistant' || (msg.content && msg.content.trim().length > 0)
      ));
      currentResponseRef.current = '';
      currentMessageIdRef.current = null;
      setIsLoading(false);
    }
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

    // Generate unique IDs
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add user message to chat UI immediately
    const userMessage = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Filter out empty messages before sending to avoid API errors
    const validMessages = messages.filter(msg => 
      msg.content && msg.content.trim().length > 0
    );
    
    // Add debugging to track message history
    console.log('📊 Message history before filtering:', messages.map(m => ({
      role: m.role,
      content: m.content,
      contentLength: m.content?.length || 0
    })));
    console.log('✅ Valid messages after filtering:', validMessages.length);

    // Create message in Cloudflare Agents SDK format
    const agentMessage = {
      type: "cf_agent_use_chat_request",
      id: requestId,
      init: {
        method: "POST",
        body: JSON.stringify({
          messages: validMessages.concat({
            id: messageId,
            role: "user",
            content: content,
            createdAt: new Date().toISOString(),
            metadata: {
              user: user?.email,
              page: window.location.pathname
            }
          })
        })
      }
    };

    console.log('📤 Sending message to agent:', agentMessage);
    wsRef.current.send(JSON.stringify(agentMessage));
  }, [user, messages]);

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