# Assistant Chat Components

A comprehensive chat assistant implementation for the Cutty application, providing intelligent help and guidance to users.

## Overview

The Assistant Chat system provides a floating chat interface that helps users navigate the application, understand features, and get answers to their questions. It integrates seamlessly with the existing Cutty design system and authentication flow.

## Components

### 1. AssistantChat.jsx
**Main chat component** - Manages the floating chat interface
- Floating action button in bottom-right corner
- Expandable chat window with header controls
- Badge notification for new messages
- Responsive design for mobile and desktop
- Integration with authentication context

### 2. AssistantMessage.jsx
**Message display component** - Renders individual chat messages
- User and assistant message differentiation
- Timestamp formatting
- Source card integration for references
- Action button integration for suggestions
- Error state handling

### 3. AssistantInput.jsx
**Input field component** - Handles user message input
- Multi-line text input with auto-resize
- Send button with loading states
- Keyboard shortcuts (Enter to send, Shift+Enter for new line)
- Character count for longer messages
- Voice input placeholder for future enhancement

### 4. SourceCard.jsx
**Source attribution component** - Displays reference materials
- Categorized source types (documentation, external, reference)
- Click-to-open external links
- Compact card design with hover effects
- Source description truncation

### 5. ActionButton.jsx
**Suggested actions component** - Interactive action buttons
- Multiple variants (button, chip)
- Action type differentiation (message, navigation, internal navigation)
- Icon integration based on action type
- Hover effects and animations

## Hooks

### useAssistant.js
**Custom hook for assistant state management**
- Message state management
- Loading and error states
- Conversation management
- Suggested actions handling
- Auto-scroll to latest messages
- Context-aware welcome messages

## Services

### assistantService.js
**API service for assistant functionality**
- Send messages to backend
- Retrieve conversation history
- Clear conversations
- Get context-based suggested actions
- Error handling and response formatting

## Features

### Core Functionality
- **Real-time chat interface** with user and assistant messages
- **Context-aware responses** based on current page and user status
- **Source attribution** for assistant responses
- **Suggested actions** for common tasks
- **Conversation persistence** across sessions
- **Error handling** with user-friendly messages

### User Experience
- **Floating design** that doesn't interfere with main content
- **Responsive layout** for mobile and desktop
- **Accessibility features** with proper ARIA labels
- **Loading states** for better user feedback
- **Keyboard navigation** support

### Integration
- **Authentication awareness** with personalized greetings
- **Route awareness** for context-specific help
- **Theme integration** with existing Cutty design system
- **Material-UI consistency** with app styling

## API Integration

The assistant expects the following backend endpoints:

### POST /api/v1/assistant/chat
Send a message to the assistant
```json
{
  "message": "How do I upload a file?",
  "conversation_id": "optional-uuid"
}
```

Response:
```json
{
  "response": "To upload a file, click on...",
  "conversation_id": "uuid",
  "sources": [
    {
      "title": "File Upload Guide",
      "description": "Step by step instructions...",
      "url": "https://example.com/docs",
      "type": "documentation"
    }
  ],
  "suggested_actions": [
    {
      "text": "Go to Upload Page",
      "type": "internal_navigation",
      "path": "/file_upload"
    }
  ]
}
```

### GET /api/v1/assistant/conversation/:id
Retrieve conversation history

### DELETE /api/v1/assistant/conversation/:id
Clear conversation history

### POST /api/v1/assistant/actions
Get context-based suggested actions
```json
{
  "context": {
    "page": "/cut",
    "user_authenticated": true,
    "user_id": "uuid"
  }
}
```

## Installation

The assistant components are automatically included when the app is built. They are integrated into the `SidebarLayout` component and will appear on all pages.

## Usage

### Basic Usage
The assistant is automatically available to all users. No additional setup is required.

### Customization
- **Welcome messages**: Modify `useAssistant.js` to customize initial greetings
- **Suggested actions**: Update the backend API to provide context-specific actions
- **Styling**: Components follow the Material-UI theme and can be customized via theme variables

### Development
Use the `AssistantDemo` component for testing and development:
```jsx
import AssistantDemo from './components/Assistant/AssistantDemo';
```

## File Structure

```
src/components/Assistant/
├── AssistantChat.jsx       # Main chat interface
├── AssistantMessage.jsx    # Message display
├── AssistantInput.jsx      # Input field
├── SourceCard.jsx          # Source attribution
├── ActionButton.jsx        # Action buttons
├── AssistantDemo.jsx       # Demo/test component
├── index.js               # Component exports
└── README.md              # This file

src/hooks/
└── useAssistant.js        # Assistant state management

src/services/
└── assistantService.js    # API integration
```

## Future Enhancements

### Planned Features
- **Voice input/output** for accessibility
- **File attachment** support in chat
- **Rich text formatting** in messages
- **Conversation search** and filtering
- **Message reactions** and feedback
- **Typing indicators** for better UX

### Technical Improvements
- **Message caching** for offline support
- **WebSocket integration** for real-time updates
- **Message encryption** for sensitive data
- **Analytics integration** for usage tracking

## Troubleshooting

### Common Issues

1. **Assistant not appearing**: Check that `AssistantChat` is included in the layout component
2. **API errors**: Verify backend endpoints are available and properly configured
3. **Styling issues**: Ensure Material-UI theme is properly configured
4. **Mobile layout**: Check responsive breakpoints and z-index values

### Debug Mode
Add debug logging by setting:
```javascript
console.log('Assistant Debug:', { messages, isLoading, error });
```

## Contributing

When adding new features:
1. Follow the existing component patterns
2. Maintain accessibility standards
3. Include proper error handling
4. Add tests for new functionality
5. Update this documentation

## Dependencies

- React 18+
- Material-UI 6+
- React Router DOM 6+
- Axios for API calls
- Date formatting utilities