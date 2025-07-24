import { Hono } from 'hono';
import type { Env } from '../types/env';

const agent = new Hono<{ Bindings: Env }>();

// Agent is always proxied to external service
agent.use('*', async (c, next) => {
  if (c.env.AGENT_ENABLED !== 'true') {
    return c.json({ error: 'Agent service is disabled' }, 503);
  }
  await next();
});

// Proxy WebSocket connections to the agent service
agent.get('/chat/:sessionId', async (c) => {
  const { sessionId } = c.req.param();
  const agentUrl = c.env.AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
  
  // Check for WebSocket upgrade
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket connection' }, 400);
  }
  
  // Forward the WebSocket connection to agent
  const url = new URL(`/agents/chat/default?sessionId=${sessionId}`, agentUrl);
  console.log(`[WebSocket Proxy] Forwarding to: ${url.toString()}`);
  
  // Note: WebSocket proxying in local dev has limitations
  // This works better when deployed to Cloudflare Workers
  return fetch(url, c.req.raw);
});

// Get message history endpoint
agent.get('/chat/:sessionId/messages', async (c) => {
  const { sessionId } = c.req.param();
  const agentUrl = c.env.AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
  
  try {
    const response = await fetch(`${agentUrl}/agents/chat/default/get-messages?sessionId=${sessionId}`);
    if (!response.ok) {
      console.error('Failed to get messages:', response.status);
      return c.json({ messages: [] });
    }
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return c.json({ messages: [] });
  }
});

// Health check
agent.get('/health', async (c) => {
  const agentUrl = c.env.AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
  
  try {
    const response = await fetch(`${agentUrl}/check-api-key`);
    const data = await response.json();
    
    return c.json({
      status: data.success ? 'healthy' : 'unhealthy',
      agent: 'cutty-agent',
      apiKeyConfigured: data.success
    });
  } catch (error) {
    return c.json({ status: 'error', message: 'Agent unreachable' }, 503);
  }
});

export default agent;