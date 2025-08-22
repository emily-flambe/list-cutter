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

// WebSocket endpoint - Cloudflare Workers cannot proxy WebSocket connections
// The client must connect directly to the agent service
agent.get('/chat/:sessionId', async (c) => {
  const { sessionId } = c.req.param();
  const agentUrl = c.env.AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
  
  // Check for WebSocket upgrade
  const upgradeHeader = c.req.header('Upgrade');
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket connection' }, 400);
  }
  
  // Return error explaining WebSocket proxy limitation
  return c.json({ 
    error: 'WebSocket proxy not supported',
    message: 'Cloudflare Workers cannot proxy WebSocket connections. The client must connect directly to the agent service.',
    agentUrl: agentUrl,
    suggestedUrl: `${agentUrl}/agents/chat/default?sessionId=${sessionId}`
  }, 501);
});

// Get message history endpoint
agent.get('/chat/:sessionId/messages', async (c) => {
  const { sessionId } = c.req.param();
  const agentUrl = c.env.AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
  
  try {
    const response = await fetch(`${agentUrl}/agents/chat/default/get-messages?sessionId=${sessionId}`);
    if (!response.ok) {
      // Silently handle failed message fetches - returns empty array
      return c.json({ messages: [] });
    }
    const data = await response.json();
    return c.json(data);
  } catch (error) {
    // Error fetching messages - return empty array
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