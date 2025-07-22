# Simple Implementation Plan

- [ ] 1. Configure external AI worker connection
  - Add AI_WORKER_URL to wrangler.toml
  - Add AI_WORKER_API_KEY to .dev.vars for local dev
  - Add AI_WORKER_API_KEY secret for production

- [ ] 2. Create backend chat route
  - Add route: `POST /api/v1/chat`
  - Accept message from frontend
  - Call external AI worker with auth
  - Return response or error

- [ ] 3. Create ChatBot component
  - Floating chat button (bottom-right corner)
  - Expandable chat window
  - Message display area
  - Input field with send button
  - Loading states

- [ ] 4. Add ChatBot to app layout
  - Import ChatBot component
  - Add to Layout.jsx (appears on all pages)
  - Ensure proper z-index for floating UI

- [ ] 5. Basic testing
  - Test chat endpoint responds
  - Test AI worker authentication works
  - Test chat UI opens/closes
  - Test sending and receiving messages
  - Test error handling when AI unavailable