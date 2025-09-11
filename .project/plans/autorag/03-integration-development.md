# Phase 3: Integration Development

## Objective
Replace the current generic chatbot with an AutoRAG-powered implementation that can answer questions about Cutty's features using the documentation knowledge base.

## Development Tasks

### 1. Remove Existing Chatbot Implementation

#### Files to Remove/Update
```
cloudflare/workers/src/
├── agent/
│   ├── CuttyAgent.ts         # DELETE - Old agent implementation
│   └── tools.ts              # KEEP - May reuse for action tools
├── routes/
│   └── agent.ts              # UPDATE - New AutoRAG routes
└── index.ts                  # UPDATE - Remove old agent references

app/frontend/src/
├── components/
│   ├── ChatBot.jsx           # DELETE - Old chat component
│   ├── ChatBotWrapper.jsx    # DELETE - Old wrapper
│   ├── ChatBotWebSocket.jsx  # DELETE - Old WebSocket
│   └── AgentActionHandler.jsx # KEEP - May reuse for actions
└── hooks/
    └── useAgentChat.js       # DELETE - Old chat hook
```

### 2. Backend Implementation

#### New Worker Structure
```
cloudflare/workers/src/
├── autorag/
│   ├── CuttyAssistant.ts    # Main AutoRAG assistant
│   ├── types.ts             # TypeScript definitions
│   ├── utils.ts             # Helper functions
│   └── actions.ts           # Action tools (optional)
├── routes/
│   └── assistant.ts         # Assistant API routes
└── index.ts                 # Updated with new routes
```

#### CuttyAssistant.ts
```typescript
import { Env } from '../types/env';
import { Context } from 'hono';

export interface AssistantQuery {
  message: string;
  sessionId?: string;
  userId?: string;
  context?: Record<string, any>;
}

export interface AssistantResponse {
  type: 'answer' | 'action' | 'error';
  message: string;
  sources?: Source[];
  confidence?: number;
  suggestedActions?: Action[];
  metadata?: Record<string, any>;
}

interface Source {
  title: string;
  path: string;
  relevance: number;
  excerpt?: string;
}

interface Action {
  type: string;
  label: string;
  data: Record<string, any>;
}

export class CuttyAssistant {
  private env: Env;
  private instanceName: string;

  constructor(env: Env) {
    this.env = env;
    this.instanceName = env.AUTORAG_INSTANCE_NAME || 'cutty-assistant';
  }

  async handleQuery(query: AssistantQuery): Promise<AssistantResponse> {
    try {
      // Detect query intent
      const intent = this.detectIntent(query.message);
      
      if (intent === 'documentation') {
        return await this.handleDocumentationQuery(query);
      } else if (intent === 'action') {
        return await this.handleActionQuery(query);
      } else {
        return await this.handleGeneralQuery(query);
      }
    } catch (error) {
      console.error('Assistant error:', error);
      return this.createErrorResponse(error);
    }
  }

  private async handleDocumentationQuery(query: AssistantQuery): Promise<AssistantResponse> {
    // Call AutoRAG
    const ragResponse = await this.env.AI
      .autorag(this.instanceName)
      .aiSearch({
        query: query.message,
        rewriteQuery: true,
        maxResults: 5,
        minScore: 0.7,
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        metadata: {
          sessionId: query.sessionId,
          userId: query.userId
        }
      });

    // Process response
    const sources = this.processSources(ragResponse.sources);
    const suggestedActions = this.extractSuggestedActions(ragResponse.answer);

    return {
      type: 'answer',
      message: ragResponse.answer,
      sources,
      confidence: ragResponse.confidence || 0,
      suggestedActions,
      metadata: {
        queryRewritten: ragResponse.rewrittenQuery,
        tokensUsed: ragResponse.tokensUsed
      }
    };
  }

  private async handleActionQuery(query: AssistantQuery): Promise<AssistantResponse> {
    // For action queries, we might still want to check documentation first
    const docResponse = await this.handleDocumentationQuery(query);
    
    // If documentation has high confidence, return it
    if (docResponse.confidence && docResponse.confidence > 0.8) {
      return docResponse;
    }

    // Otherwise, suggest the user perform an action
    return {
      type: 'action',
      message: "I can help you with that. Would you like me to guide you through the process?",
      suggestedActions: this.getActionsForIntent(query.message),
      confidence: 0.5
    };
  }

  private async handleGeneralQuery(query: AssistantQuery): Promise<AssistantResponse> {
    // For general queries, always try AutoRAG first
    return await this.handleDocumentationQuery(query);
  }

  private detectIntent(message: string): 'documentation' | 'action' | 'general' {
    const lowerMessage = message.toLowerCase();
    
    // Documentation intent keywords
    const docKeywords = [
      'how do i', 'how to', 'what is', 'where is', 'can i',
      'explain', 'help', 'guide', 'tutorial', 'documentation',
      'tell me about', 'show me', 'describe', 'what are'
    ];
    
    // Action intent keywords
    const actionKeywords = [
      'generate', 'create', 'upload', 'export', 'delete',
      'analyze', 'process', 'run', 'execute', 'start'
    ];
    
    // Check for documentation intent
    if (docKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'documentation';
    }
    
    // Check for action intent
    if (actionKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return 'action';
    }
    
    return 'general';
  }

  private processSources(sources: any[]): Source[] {
    if (!sources || sources.length === 0) return [];
    
    return sources.map(source => ({
      title: this.extractTitle(source.metadata.filename),
      path: source.metadata.filename,
      relevance: source.metadata.score || 0,
      excerpt: this.truncateText(source.text, 100)
    }));
  }

  private extractTitle(filename: string): string {
    // Extract a readable title from the filename
    // e.g., "features/csv-cutting/overview.md" -> "CSV Cutting Overview"
    const parts = filename.split('/');
    const name = parts[parts.length - 1].replace('.md', '');
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }

  private extractSuggestedActions(answer: string): Action[] {
    const actions: Action[] = [];
    
    // Look for mentions of features in the answer
    if (answer.includes('upload')) {
      actions.push({
        type: 'navigate',
        label: 'Go to File Upload',
        data: { route: '/upload' }
      });
    }
    
    if (answer.includes('CSV cutting') || answer.includes('filter')) {
      actions.push({
        type: 'navigate',
        label: 'Open CSV Cutter',
        data: { route: '/csv-cutter' }
      });
    }
    
    if (answer.includes('synthetic data') || answer.includes('generate')) {
      actions.push({
        type: 'navigate',
        label: 'Generate Synthetic Data',
        data: { route: '/synthetic-data' }
      });
    }
    
    return actions;
  }

  private getActionsForIntent(message: string): Action[] {
    const actions: Action[] = [];
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('upload')) {
      actions.push({
        type: 'navigate',
        label: 'Go to File Upload',
        data: { route: '/upload' }
      });
    }
    
    if (lowerMessage.includes('generate') || lowerMessage.includes('synthetic')) {
      actions.push({
        type: 'navigate',
        label: 'Generate Data',
        data: { route: '/synthetic-data' }
      });
    }
    
    return actions;
  }

  private createErrorResponse(error: any): AssistantResponse {
    return {
      type: 'error',
      message: "I'm having trouble answering that question right now. Please try again or rephrase your question.",
      metadata: {
        error: error.message || 'Unknown error'
      }
    };
  }
}
```

#### Assistant Routes (routes/assistant.ts)
```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CuttyAssistant } from '../autorag/CuttyAssistant';
import { requireAuth } from '../middleware/auth';

const assistant = new Hono();

// Enable CORS
assistant.use('/*', cors());

// Health check
assistant.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'assistant' });
});

// Main chat endpoint
assistant.post('/chat', requireAuth, async (c) => {
  const { message, sessionId } = await c.req.json();
  const userId = c.get('userId');
  
  const assistant = new CuttyAssistant(c.env);
  const response = await assistant.handleQuery({
    message,
    sessionId,
    userId
  });
  
  return c.json(response);
});

// Search endpoint (documentation only)
assistant.post('/search', requireAuth, async (c) => {
  const { query } = await c.req.json();
  
  // Direct search without AI generation
  const results = await c.env.AI
    .autorag(c.env.AUTORAG_INSTANCE_NAME)
    .search({
      query,
      maxResults: 10,
      minScore: 0.6
    });
  
  return c.json({
    results: results.results,
    count: results.results.length
  });
});

// Feedback endpoint
assistant.post('/feedback', requireAuth, async (c) => {
  const { messageId, helpful, feedback } = await c.req.json();
  
  // Store feedback for improvement
  // This could be stored in D1 or sent to analytics
  console.log('Feedback received:', { messageId, helpful, feedback });
  
  return c.json({ success: true });
});

export { assistant };
```

### 3. Frontend Implementation

#### New Chat Component Structure
```
app/frontend/src/
├── components/
│   ├── Assistant/
│   │   ├── AssistantChat.jsx      # Main chat component
│   │   ├── AssistantMessage.jsx   # Message display
│   │   ├── AssistantInput.jsx     # Input field
│   │   ├── SourceCard.jsx         # Source attribution
│   │   └── ActionButton.jsx       # Suggested actions
│   └── index.js
├── hooks/
│   └── useAssistant.js            # Assistant hook
└── services/
    └── assistantService.js        # API service
```

#### AssistantChat.jsx
```jsx
import React, { useState, useRef, useEffect } from 'react';
import {
  Paper,
  Box,
  Typography,
  IconButton,
  Fade,
  Fab,
  Badge
} from '@mui/material';
import {
  Chat as ChatIcon,
  Close as CloseIcon,
  Help as HelpIcon
} from '@mui/icons-material';
import AssistantMessage from './AssistantMessage';
import AssistantInput from './AssistantInput';
import { useAssistant } from '../../hooks/useAssistant';
import cuttyLogo from '../../assets/cutty_logo.png';

const AssistantChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);
  
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages
  } = useAssistant();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (message) => {
    await sendMessage(message);
    setUnreadCount(0);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen && messages.length === 0) {
      // Send welcome message
      sendMessage("Hi! How can I help you use Cutty today?", true);
    }
  };

  return (
    <>
      {/* Floating Help Button */}
      <Fab
        color="primary"
        aria-label="help"
        onClick={handleToggle}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          display: isOpen ? 'none' : 'flex',
          zIndex: 1200
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <HelpIcon />
        </Badge>
      </Fab>

      {/* Chat Window */}
      <Fade in={isOpen}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: { xs: 'calc(100% - 48px)', sm: 400, md: 450 },
            height: { xs: 'calc(100% - 48px)', sm: 600 },
            maxHeight: '80vh',
            display: isOpen ? 'flex' : 'none',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            zIndex: 1300
          }}
        >
          {/* Header */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <img src={cuttyLogo} alt="Cutty" style={{ width: 32, height: 32 }} />
              <Typography variant="h6">Cutty Assistant</Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleToggle}
              sx={{ color: 'white' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
          >
            {messages.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Welcome to Cutty Assistant!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ask me anything about using Cutty:
                </Typography>
                <Box sx={{ mt: 2, textAlign: 'left' }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Try asking:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>How do I upload a CSV file?</li>
                    <li>What is Cuttytabs?</li>
                    <li>How can I filter my data?</li>
                    <li>What are the file size limits?</li>
                  </ul>
                </Box>
              </Box>
            )}
            
            {messages.map((message) => (
              <AssistantMessage
                key={message.id}
                message={message}
                onActionClick={(action) => {
                  // Handle action clicks
                  console.log('Action clicked:', action);
                }}
              />
            ))}
            
            {isLoading && (
              <AssistantMessage
                message={{
                  id: 'loading',
                  type: 'assistant',
                  content: '...',
                  isLoading: true
                }}
              />
            )}
            
            {error && (
              <Typography color="error" variant="body2">
                {error}
              </Typography>
            )}
            
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <AssistantInput
            onSend={handleSend}
            disabled={isLoading}
            placeholder="Ask me anything about Cutty..."
          />
        </Paper>
      </Fade>
    </>
  );
};

export default AssistantChat;
```

### 4. Integration Points

#### Update Main App
```jsx
// app/frontend/src/App.jsx
import AssistantChat from './components/Assistant/AssistantChat';

function App() {
  return (
    <div className="App">
      {/* Existing app content */}
      
      {/* Add Assistant Chat */}
      <AssistantChat />
    </div>
  );
}
```

#### Update Worker Index
```typescript
// cloudflare/workers/src/index.ts
import { Hono } from 'hono';
import { assistant } from './routes/assistant';

const app = new Hono();

// Mount assistant routes
app.route('/api/v1/assistant', assistant);

// Remove old agent routes
// app.route('/api/v1/agent', agent); // DELETE THIS

export default app;
```

### 5. Feature Enhancements

#### Contextual Help
```javascript
// Add context-aware help based on current page
const getPageContext = () => {
  const path = window.location.pathname;
  const contexts = {
    '/upload': 'file upload',
    '/csv-cutter': 'CSV cutting',
    '/query-builder': 'query building',
    '/synthetic-data': 'synthetic data generation'
  };
  return contexts[path] || 'general';
};

// Include context in queries
const contextualQuery = `${userMessage} (I'm currently on the ${getPageContext()} page)`;
```

#### Quick Actions
```javascript
// Predefined quick action buttons
const quickActions = [
  { label: 'Upload Help', query: 'How do I upload a CSV file?' },
  { label: 'Filter Guide', query: 'How do I filter my data?' },
  { label: 'Export Help', query: 'How can I export my results?' },
  { label: 'File Limits', query: 'What are the file size limits?' }
];
```

#### Feedback Collection
```javascript
// Add feedback buttons to responses
const FeedbackButtons = ({ messageId }) => {
  const handleFeedback = async (helpful) => {
    await assistantService.sendFeedback(messageId, helpful);
  };
  
  return (
    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
      <IconButton size="small" onClick={() => handleFeedback(true)}>
        <ThumbUpIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={() => handleFeedback(false)}>
        <ThumbDownIcon fontSize="small" />
      </IconButton>
    </Box>
  );
};
```

## Migration Steps

### Step 1: Backend Preparation
1. Create new `autorag` directory
2. Implement `CuttyAssistant` class
3. Add assistant routes
4. Update worker configuration

### Step 2: Frontend Development
1. Create Assistant components
2. Implement useAssistant hook
3. Add assistant service
4. Style components

### Step 3: Integration
1. Remove old chatbot code
2. Update app to use new assistant
3. Test integration
4. Deploy to development

### Step 4: Feature Addition
1. Add contextual help
2. Implement quick actions
3. Add feedback collection
4. Enhance UI/UX

## Testing Checklist

- [ ] Assistant responds to documentation queries
- [ ] Sources are displayed correctly
- [ ] Suggested actions work
- [ ] Error handling works
- [ ] Loading states display properly
- [ ] Mobile responsive design works
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Performance acceptable (<2s response)
- [ ] No console errors

## Deployment Steps

1. **Development Environment**
   ```bash
   # Deploy worker
   wrangler deploy --env development
   
   # Build frontend
   npm run build
   
   # Test thoroughly
   ```

2. **Production Deployment**
   ```bash
   # After testing in dev
   wrangler deploy --env production
   
   # Deploy frontend
   npm run deploy
   ```

## Next Phase
Once integration is complete and tested, proceed to Phase 4: Testing & Refinement

---

*Phase Status: Ready to Implement*
*Estimated Development Time: 16-24 hours*
*Dependencies: AutoRAG instance from Phase 2*