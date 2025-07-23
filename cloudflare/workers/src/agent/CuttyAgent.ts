import { Agent } from 'agents';
import { AIChatAgent } from 'agents/ai-chat-agent';
import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { SyntheticDataGenerator } from '../services/synthetic-data-generator';
import { Env } from '../types/env';

export class CuttyAgent extends AIChatAgent {
  private syntheticDataGenerator: SyntheticDataGenerator;
  private env: Env;

  constructor(env: Env, id: string) {
    super(env, id);
    this.env = env;
    this.syntheticDataGenerator = new SyntheticDataGenerator();
  }

  // Define tools with execute functions
  private tools = {
    generateSyntheticData: tool({
      description: 'Generate synthetic voter registration data with realistic information',
      parameters: {
        type: 'object',
        properties: {
          count: { 
            type: 'number', 
            minimum: 1, 
            maximum: 1000,
            description: 'Number of records to generate (1-1000)' 
          },
          states: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'List of state codes to filter by (e.g., ["CA", "TX", "FL"])' 
          },
          format: { 
            type: 'string', 
            enum: ['csv', 'json'],
            default: 'csv',
            description: 'Output format for the data' 
          },
        },
        required: ['count'],
      },
      execute: async ({ count, states, format }) => {
        try {
          // Generate the data
          const data = this.syntheticDataGenerator.generateRecords(count);
          
          // Filter by states if provided
          let filteredData = data;
          if (states && states.length > 0) {
            filteredData = data.filter(record => 
              states.includes(record.state_code)
            );
          }

          // Return the data for the agent to present
          return {
            success: true,
            count: filteredData.length,
            data: filteredData,
            format: format || 'csv',
            message: `Successfully generated ${filteredData.length} synthetic voter records${states ? ` for states: ${states.join(', ')}` : ''}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate data',
          };
        }
      },
    }),

    getSupportedStates: tool({
      description: 'Get the list of US states supported for synthetic data generation',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const states = this.syntheticDataGenerator.getSupportedStates();
        return {
          success: true,
          states,
          count: states.length,
          message: `I can generate data for ${states.length} US states: ${states.join(', ')}`,
        };
      },
    }),

    // Tools without execute functions require human confirmation
    createList: tool({
      description: 'Create a new list for organizing data',
      parameters: {
        type: 'object',
        properties: {
          name: { 
            type: 'string',
            minLength: 1,
            maxLength: 100,
            description: 'Name of the list' 
          },
          description: { 
            type: 'string',
            maxLength: 500,
            description: 'Optional description of the list' 
          },
        },
        required: ['name'],
      },
    }),

    uploadFile: tool({
      description: 'Process and upload a CSV file to a list',
      parameters: {
        type: 'object',
        properties: {
          fileUrl: { 
            type: 'string',
            format: 'uri',
            description: 'URL of the file to upload' 
          },
          listId: { 
            type: 'string',
            description: 'ID of the list to add the file to' 
          },
        },
        required: ['fileUrl', 'listId'],
      },
    }),
  };

  // System prompt for Cutty
  private getSystemPrompt() {
    return `You are Cutty the Cuttlefish, a friendly and helpful AI assistant for the Cutty app. 
You help users manage lists and generate synthetic voter registration data.

Your personality:
- You're a cheerful cuttlefish who loves helping users organize their data
- You use ocean and sea-related metaphors occasionally (but don't overdo it)
- You're professional but friendly, making data management feel approachable
- You celebrate user successes with enthusiasm

You can help users with:
1. Generating synthetic voter registration data (up to 1000 records at a time)
2. Creating and managing lists
3. Processing CSV files
4. Answering questions about the app's features

When users ask you to generate data, use the generateSyntheticData tool. You can filter by specific states if requested.
When users want to know which states are available, use the getSupportedStates tool.
For actions like creating lists or uploading files, these require user confirmation through the UI.

Always be clear about what actions you're taking and what the results are.`;
  }

  // Main chat method
  async chat(request: Request): Promise<Response> {
    try {
      const { message, userId, sessionId } = await request.json();

      // Get or initialize conversation history
      const historyKey = `history_${sessionId || 'default'}`;
      const history = (await this.getState(historyKey)) || [];
      
      // Add user message to history
      history.push({ role: 'user', content: message });

      // Use streamText for real-time responses
      const result = await streamText({
        model: openai('gpt-4o', {
          apiKey: this.env.OPENAI_API_KEY,
        }),
        system: this.getSystemPrompt(),
        messages: history,
        tools: this.tools,
        toolChoice: 'auto',
        maxSteps: 5,
        onFinish: async ({ text, toolCalls, usage }) => {
          // Save assistant response to history
          history.push({ 
            role: 'assistant', 
            content: text,
            toolCalls: toolCalls,
          });
          
          // Persist conversation history
          await this.setState(historyKey, history.slice(-20)); // Keep last 20 messages
          
          // Log usage for monitoring
          console.log('Token usage:', usage);
        },
      });

      // Return the streaming response
      return new Response(result.toDataStream(), {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('Error in CuttyAgent chat:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to process chat message',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  }

  // Handle HTTP requests
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);
    
    if (url.pathname === '/chat' && request.method === 'POST') {
      return this.chat(request);
    }

    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ status: 'healthy', agent: 'CuttyAgent' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}

// Export the agent class directly for Durable Object binding
export { CuttyAgent as CuttyAgentNamespace };