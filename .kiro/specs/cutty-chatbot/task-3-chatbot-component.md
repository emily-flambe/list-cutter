# Task 3: Create ChatBot Component

## Overview
Build a floating chat interface component that provides an intuitive way for users to interact with Cutty the Cuttlefish.

## Component Implementation

### Complete ChatBot Component
Create the main chat component:

```jsx
// app/frontend/src/components/ChatBot.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  Fab, 
  Paper, 
  TextField, 
  IconButton, 
  Typography,
  Box,
  Fade,
  CircularProgress,
  Chip
} from '@mui/material';
import { 
  Chat as ChatIcon, 
  Close as CloseIcon, 
  Send as SendIcon 
} from '@mui/icons-material';

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi! I'm Cutty 🦑 How can I help you today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage.content })
      });

      const data = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || 'Sorry, I encountered an error.'
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting. Please try again later.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="chat"
        onClick={() => setIsOpen(!isOpen)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: isOpen ? 'none' : 'flex',
          zIndex: 1200
        }}
      >
        <ChatIcon />
      </Fab>

      {/* Chat Window */}
      <Fade in={isOpen}>
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            width: { xs: 'calc(100% - 32px)', sm: 380 },
            height: { xs: 'calc(100% - 32px)', sm: 500 },
            maxHeight: '80vh',
            display: isOpen ? 'flex' : 'none',
            flexDirection: 'column',
            zIndex: 1200,
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6">Cutty</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Your AI Assistant
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setIsOpen(false)}
              sx={{ color: 'inherit' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Messages Area */}
          <Box
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              backgroundColor: 'background.default'
            }}
          >
            {messages.map((message) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <Chip
                  label={message.content}
                  sx={{
                    maxWidth: '80%',
                    height: 'auto',
                    '& .MuiChip-label': {
                      whiteSpace: 'normal',
                      padding: '8px 12px'
                    },
                    backgroundColor: message.role === 'user' 
                      ? 'primary.main' 
                      : 'grey.200',
                    color: message.role === 'user' 
                      ? 'primary.contrastText' 
                      : 'text.primary'
                  }}
                />
              </Box>
            ))}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <CircularProgress size={20} />
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              gap: 1
            }}
          >
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 20
                }
              }}
            />
            <IconButton
              color="primary"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Fade>
    </>
  );
};

export default ChatBot;
```

## Styling Enhancements

### Add Custom Styles (Optional)
For a more unique look, add these styles:

```css
/* app/frontend/src/components/ChatBot.css */
.chatbot-message-enter {
  opacity: 0;
  transform: translateY(20px);
}

.chatbot-message-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 300ms ease-in;
}

.chatbot-fab-pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(25, 118, 210, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(25, 118, 210, 0);
  }
}
```

## Mobile Responsiveness

The component is already responsive, but here are key considerations:

1. **Full screen on mobile**: Uses calc(100% - 32px) width/height on xs screens
2. **Fixed size on desktop**: 380px wide, 500px tall on larger screens
3. **Touch-friendly**: Large tap targets for mobile users
4. **Keyboard handling**: Proper support for mobile keyboards

## Accessibility Features

### Built-in Accessibility
```jsx
// Add these aria labels for better screen reader support
<Fab
  color="primary"
  aria-label="Open chat with Cutty"
  aria-expanded={isOpen}
  // ...
>

<IconButton
  aria-label="Close chat"
  // ...
>

<TextField
  aria-label="Chat message input"
  // ...
>

<IconButton
  aria-label="Send message"
  // ...
>
```

## State Management Options

### Option 1: Local State (Implemented Above)
- Simple, self-contained
- Messages lost on page refresh
- Good for MVP

### Option 2: Context API (If Needed)
```jsx
// Create a ChatContext if you need to:
// - Persist messages across page navigation
// - Show unread message count
// - Access chat state from other components

// contexts/ChatContext.jsx
export const ChatContext = React.createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  return (
    <ChatContext.Provider value={{ messages, setMessages, unreadCount }}>
      {children}
    </ChatContext.Provider>
  );
};
```

## Performance Optimizations

1. **Lazy Load the Component**:
```jsx
// In Layout.jsx
const ChatBot = lazy(() => import('./ChatBot'));

// Wrap in Suspense
<Suspense fallback={null}>
  <ChatBot />
</Suspense>
```

2. **Debounce Input** (if needed):
```jsx
import { debounce } from 'lodash';

const debouncedSend = useCallback(
  debounce((message) => sendMessage(message), 300),
  []
);
```

3. **Virtualize Long Conversations** (future enhancement):
- Only implement if users have very long conversations
- Use react-window or similar for virtual scrolling

## Testing Checklist

- [ ] Chat button appears in bottom-right corner
- [ ] Clicking button opens/closes chat window
- [ ] Welcome message displays on first open
- [ ] Can type and send messages
- [ ] Enter key sends message
- [ ] Messages appear in correct order
- [ ] Loading spinner shows while waiting
- [ ] Error messages display gracefully
- [ ] Chat is responsive on mobile
- [ ] Can close chat with X button
- [ ] Messages scroll to bottom automatically

## Common Issues & Solutions

### Issue: Chat appears behind other elements
**Solution**: Ensure z-index is high enough (1200+)

### Issue: Keyboard covers input on mobile
**Solution**: Add viewport meta tag and test on real devices

### Issue: Messages not wrapping properly
**Solution**: The Chip component with whiteSpace: 'normal' handles this

### Issue: Chat state lost on navigation
**Solution**: Either accept this for MVP or implement Context API