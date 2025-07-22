import { Hono } from 'hono';
import type { CloudflareEnv } from '../types/env';

const chat = new Hono<{ Bindings: CloudflareEnv }>();

// System prompt for Cutty the Cuttlefish
const CUTTY_SYSTEM_PROMPT = `You are Cutty the Cuttlefish, a friendly and helpful AI assistant for the List Cutter application. 
You specialize in helping users with synthetic data generation features. You're enthusiastic, supportive, and always ready to help users create and manage their test data.

Key features you can help with:
- Generating synthetic customer lists
- Creating test datasets for various business scenarios
- Explaining data generation options and parameters
- Providing tips for effective test data creation
- Answering questions about the List Cutter application

Always be friendly, encouraging, and focus on making data generation easy and accessible for users.`;

// POST /api/v1/chat - Chat with Cutty
chat.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { message } = body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Message is required' }, 400);
    }

    if (message.length > 4000) {
      return c.json({ error: 'Message too long (max 4000 characters)' }, 400);
    }

    // TODO: Replace with actual AI worker endpoint
    // For now, mock the external AI service call
    const aiWorkerUrl = 'https://api.example.com/ai/chat'; // Replace with actual endpoint
    
    try {
      // In production, this would be an actual fetch to the AI worker
      // const response = await fetch(aiWorkerUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${c.env.AI_API_KEY}` // Add to env if needed
      //   },
      //   body: JSON.stringify({
      //     messages: [
      //       { role: 'system', content: CUTTY_SYSTEM_PROMPT },
      //       { role: 'user', content: message }
      //     ]
      //   })
      // });

      // Mock response for development
      const mockResponse = {
        reply: `Hello! I'm Cutty the Cuttlefish 🦑! I received your message: "${message}". I'm here to help you with synthetic data generation. What kind of test data would you like to create today?`,
        timestamp: new Date().toISOString()
      };

      return c.json({
        success: true,
        data: mockResponse
      });

    } catch (aiError) {
      console.error('AI Worker error:', aiError);
      return c.json({
        error: 'Failed to process chat message',
        details: c.env.ENVIRONMENT === 'development' ? aiError.message : undefined
      }, 500);
    }

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return c.json({
      error: 'Internal server error',
      details: c.env.ENVIRONMENT === 'development' ? error.message : undefined
    }, 500);
  }
});

export default chat;