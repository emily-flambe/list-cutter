# CuttyAgent - AI-Powered Assistant

CuttyAgent is an AI-powered assistant built using Cloudflare's Agent framework. It provides natural language interactions for the Cutty app, allowing users to generate synthetic data, manage lists, and get help through conversational AI.

## Features

- **Natural Language Processing**: Powered by OpenAI's GPT-4
- **Tool Integration**: Execute actions based on user requests
- **Streaming Responses**: Real-time chat experience
- **Session Management**: Maintains conversation history
- **Synthetic Data Generation**: Generate voter registration data through conversation

## Architecture

CuttyAgent is implemented as a Cloudflare Durable Object, providing:
- Persistent state management
- WebSocket support for real-time communication
- Isolated execution environment
- Automatic scaling

## API Endpoints

### Chat Endpoint
`POST /api/v1/agent/chat`

Send a message to the agent and receive a streaming response.

**Request:**
```json
{
  "message": "Generate 100 voter records for California",
  "sessionId": "optional-session-id",
  "userId": "optional-user-id"
}
```

**Response:** Server-Sent Events stream with AI responses and tool executions

### Health Check
`GET /api/v1/agent/health`

Check if the agent is running and healthy.

## Available Tools

1. **generateSyntheticData**
   - Generate synthetic voter registration data
   - Parameters: count, states (optional), format (csv/json)
   - Example: "Generate 50 records for California and Texas"

2. **getSupportedStates**
   - List all supported US states for data generation
   - Example: "Which states can you generate data for?"

3. **createList** (requires confirmation)
   - Create a new list for organizing data
   - Parameters: name, description (optional)
   - Example: "Create a list called 'California Voters'"

4. **uploadFile** (requires confirmation)
   - Process and upload a CSV file
   - Parameters: fileUrl, listId
   - Example: "Upload file from URL to my list"

## Development

### Prerequisites
- Cloudflare account
- OpenAI API key
- Node.js 18+

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.dev.vars` file:
   ```
   OPENAI_API_KEY=your-openai-api-key
   JWT_SECRET=dev-secret
   API_KEY_SALT=dev-salt
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Test the agent:
   ```bash
   node test-agent.js
   ```

### Deployment

The agent is deployed as part of the Cloudflare Worker:

```bash
npm run deploy
```

## Configuration

The agent is configured in `wrangler.toml`:

```toml
[[durable_objects]]
binding = "CUTTY_AGENT"
class_name = "CuttyAgent"
script_name = "cutty-dev"
```

## Future Enhancements

- WebSocket support for real-time bidirectional communication
- More tools for list management and file processing
- Integration with existing app features
- Multi-modal capabilities (image processing)
- Advanced reasoning with chain-of-thought prompting