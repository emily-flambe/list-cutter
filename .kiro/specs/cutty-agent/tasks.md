# Tasks - Updated for WebSocket Integration

## Overview

Implementation tasks for Cutty Agent WebSocket integration. The agent is already deployed at `https://cutty-agent.emilycogsdill.com`. These tasks focus on integrating it with the list-cutter app to enable agent actions on behalf of users.

## Current Status

- ✅ Agent deployed at: `https://cutty-agent.emilycogsdill.com`
- ✅ Agent has WebSocket support at `/agents/chat/{sessionId}`
- ✅ Tools implemented: `getSupportedStates`, `explainFeature`
- ⏳ Need to integrate with list-cutter app via WebSocket proxy

## Task List

### Phase 1: Backend WebSocket Proxy Setup (list-cutter repo)

#### Task 1: Create WebSocket Proxy Routes
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: None

1. Create `cloudflare/workers/src/routes/agent.ts`:
   - WebSocket proxy endpoint at `/chat/:sessionId`
   - Message history endpoint at `/chat/:sessionId/messages`
   - Health check endpoint at `/health`
2. Mount routes at `/api/v1/agent/*` in index.ts
3. Handle conditional routing based on `AGENT_ENABLED` env var

**Acceptance**: Backend can proxy WebSocket connections to agent

---

#### Task 2: Update Environment Configuration
**Repository**: list-cutter  
**Time**: 15 minutes  
**Dependencies**: None

1. Verify in `cloudflare/workers/.dev.vars`:
   ```env
   AGENT_ENABLED=true
   AGENT_URL=https://cutty-agent.emilycogsdill.com
   ```
2. Add to `app/frontend/.env.development`:
   ```env
   VITE_AGENT_ENABLED=true
   ```
3. Update GitHub Actions workflows for deployment env vars

**Acceptance**: Environment variables properly configured

---

### Phase 2: Frontend WebSocket Integration (list-cutter repo)

#### Task 3: Create useAgentChat Hook
**Repository**: list-cutter  
**Time**: 45 minutes  
**Dependencies**: Task 1

1. Create `app/frontend/src/hooks/useAgentChat.js`:
   - WebSocket connection management
   - Session ID generation per tab
   - Auto-reconnection logic
   - Message history loading
   - Action event handling
2. Handle agent actions via CustomEvent dispatch
3. Maintain connection state

**Acceptance**: Hook establishes and maintains WebSocket connection

---

#### Task 4: Replace ChatBot Component
**Repository**: list-cutter  
**Time**: 1 hour  
**Dependencies**: Task 3

1. Create new WebSocket-based ChatBot component
2. Features to implement:
   - Connection status indicator
   - Message history display
   - Typing indicators
   - Session info (dev mode)
   - Auto-reconnection UI feedback
3. Remove hardcoded `ai.emilycogsdill.com` endpoint
4. Use `VITE_AGENT_ENABLED` for conditional rendering

**Acceptance**: ChatBot uses WebSocket for real-time communication

---

#### Task 5: Implement Action Handling
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 4

1. Add event listener for 'agent-action' events
2. Create action handlers for:
   - Form filling
   - Navigation
   - UI state changes
3. Add confirmation dialogs for sensitive actions
4. Log all actions for debugging

**Acceptance**: Agent can trigger UI actions via WebSocket messages

---

### Phase 3: Integration Testing

#### Task 6: Test Local Development
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Tasks 1-5

1. Start list-cutter locally:
   ```bash
   cd ~/Documents/GitHub/list-cutter/worktrees/cutty-agent
   npm run dev
   ```
2. Verify WebSocket connection in DevTools
3. Test chat messages and responses
4. Test "what states do you support?" tool
5. Verify session isolation between tabs

**Acceptance**: WebSocket chat works locally with deployed agent

---

#### Task 7: Test Agent Actions
**Repository**: list-cutter  
**Time**: 45 minutes  
**Dependencies**: Task 6

1. Test tool executions:
   - getSupportedStates (auto-executes)
   - explainFeature (requires confirmation)
2. Monitor CustomEvent dispatches
3. Verify action handling
4. Test error scenarios

**Acceptance**: Agent tools execute and actions are handled correctly

---

#### Task 8: Deploy to Staging
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 7

1. Deploy to cutty-dev:
   ```bash
   cd cloudflare/workers
   npm run deploy:dev
   ```
2. Test at https://cutty-dev.emilycogsdill.com
3. Verify WebSocket upgrade works through Cloudflare
4. Test all scenarios from Task 7

**Acceptance**: Integration works on staging environment

---

### Phase 4: Production Readiness

#### Task 9: Add Monitoring
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 8

1. Add WebSocket connection metrics
2. Log agent action events
3. Monitor reconnection attempts
4. Set up error tracking
5. Create dashboard in Cloudflare Analytics

**Acceptance**: Can monitor WebSocket health and usage

---

#### Task 10: Security Review
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 8

1. Verify session IDs are secure
2. Add rate limiting for WebSocket connections
3. Validate all agent actions
4. Review CORS configuration
5. Add input sanitization

**Acceptance**: Security measures in place

---

#### Task 11: Documentation
**Repository**: Both  
**Time**: 45 minutes  
**Dependencies**: Task 10

1. Update list-cutter README:
   - WebSocket integration details
   - Environment variable docs
   - Troubleshooting guide
2. Create architecture diagram
3. Document action event system
4. Add to CHANGELOG.md

**Acceptance**: Complete documentation for developers

---

#### Task 12: Production Deployment
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 11

1. Set GitHub repository variables:
   - `AGENT_ENABLED=true`
   - `AGENT_URL=https://cutty-agent.emilycogsdill.com`
2. Create PR and deploy to production
3. Monitor for 24 hours
4. Document any issues

**Acceptance**: Agent integration live in production

---

## Summary

Total Tasks: 12  
Estimated Time: 6.5 hours active work  
Critical Path: WebSocket proxy → Frontend hook → ChatBot component → Testing

## Success Criteria

- [x] Agent already deployed and accessible
- [ ] WebSocket proxy functioning
- [ ] Real-time chat with session isolation
- [ ] Agent can execute actions in UI
- [ ] Clean fallback to existing chat
- [ ] Production deployment successful

## Key Differences from Original Plan

1. **Agent Already Deployed**: Skip Phase 1 agent setup
2. **WebSocket Focus**: Not REST API - enables real-time actions
3. **Session Management**: Each tab gets isolated conversation
4. **Action System**: Agent can control UI via events
5. **No Local Agent**: Always use deployed agent service