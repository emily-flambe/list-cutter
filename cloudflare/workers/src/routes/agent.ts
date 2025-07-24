import { Hono } from 'hono';
import type { Env } from '../types/env';

const agent = new Hono<{ Bindings: Env }>();

// Check if external agent is enabled
agent.use('*', async (c, next) => {
  if (c.env.AGENT_ENABLED !== 'true') {
    // Fallback to local Durable Object
    const id = c.env.CUTTY_AGENT.idFromName('default');
    const agentStub = c.env.CUTTY_AGENT.get(id);
    
    // Forward the request to the Durable Object
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace('/api/v1/agent', '');
    
    const newRequest = new Request(url.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    });
    
    return agentStub.fetch(newRequest);
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
  const url = new URL(`/agents/chat/${sessionId}`, agentUrl);
  return fetch(url, c.req.raw);
});

// Get message history endpoint
agent.get('/chat/:sessionId/messages', async (c) => {
  const { sessionId } = c.req.param();
  const agentUrl = c.env.AGENT_URL || 'https://cutty-agent.emilycogsdill.com';
  
  const response = await fetch(`${agentUrl}/agents/chat/${sessionId}/get-messages`);
  return c.json(await response.json());
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