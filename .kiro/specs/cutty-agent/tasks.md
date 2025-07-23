# Tasks

## Overview

Implementation tasks for Cutty Agent PoC integration. Tasks are split between the `cutty-agent` and `list-cutter` repositories.

## Task List

### Phase 1: Agent Repository Setup (cutty-agent repo)

#### Task 1: Initialize Agent Repository
**Repository**: cutty-agent  
**Time**: 30 minutes  
**Dependencies**: None

1. Create new repository at `github.com/emily-flambe/cutty-agent`
2. Clone locally to `~/Documents/GitHub/cutty-agent`
3. Initialize from agents-starter template:
   ```bash
   npx create-cloudflare@latest . --template=cloudflare/agents-starter
   ```
4. Commit initial template code

**Acceptance**: Repository created with starter template files

---

#### Task 2: Configure Agent Identity
**Repository**: cutty-agent  
**Time**: 20 minutes  
**Dependencies**: Task 1

1. Update `package.json` with project details
2. Configure `wrangler.jsonc`:
   - Set name to `cutty-agent`
   - Configure Durable Objects binding
   - Remove environment configurations
3. Create `.dev.vars` with Anthropic API key
4. Update `.gitignore` for security

**Acceptance**: `npm run dev` starts without errors

---

#### Task 3: Implement Cutty Personality
**Repository**: cutty-agent  
**Time**: 1 hour  
**Dependencies**: Task 2

1. Update system prompt in `src/server.ts`:
   - Add Cutty the Cuttlefish personality
   - Define available capabilities
   - Set helpful tone
2. Switch from OpenAI to Anthropic:
   - Install `@ai-sdk/anthropic`
   - Update imports and model configuration
   - Use `claude-3-5-sonnet-20241022`

**Acceptance**: Agent responds as Cutty when tested locally

---

#### Task 4: Create getSupportedStates Tool
**Repository**: cutty-agent  
**Time**: 30 minutes  
**Dependencies**: Task 3

1. Create/update `src/tools.ts`:
   - Define `getSupportedStates` tool
   - Return hardcoded array: ['CA', 'FL', 'GA', 'IL', 'NY', 'OH', 'PA', 'TX']
   - Add clear response message
2. Register tool in agent
3. Test tool execution

**Acceptance**: Asking "what states do you support?" triggers tool

---

#### Task 5: Deploy Agent to Cloudflare
**Repository**: cutty-agent  
**Time**: 30 minutes  
**Dependencies**: Task 4

1. Run `npx wrangler login` if needed
2. Deploy with `npm run deploy`
3. Note deployed URL: `https://cutty-agent.emily-cogsdill.workers.dev`
4. Test health endpoint: `/health`
5. Test chat functionality with deployed agent

**Acceptance**: Agent accessible at public URL with working health check

---

### Phase 2: Main App Integration (list-cutter repo)

#### Task 6: Add Environment Variables
**Repository**: list-cutter  
**Time**: 15 minutes  
**Dependencies**: Task 5 (need deployed agent URL)

1. Add to `cloudflare/workers/.dev.vars`:
   ```env
   AGENT_ENABLED=true
   AGENT_URL=https://cutty-agent.emily-cogsdill.workers.dev
   ```
2. Add to `app/frontend/.env`:
   ```env
   VITE_AGENT_ENABLED=true
   VITE_AGENT_URL=https://cutty-agent.emily-cogsdill.workers.dev
   ```
3. Update `.env.example` files for documentation

**Acceptance**: Environment variables load correctly in both backend and frontend

---

#### Task 7: Update ChatBot Component
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 6

1. Edit `app/frontend/src/components/ChatBot.jsx`:
   ```javascript
   const chatEndpoint = import.meta.env.VITE_AGENT_ENABLED === 'true'
     ? `${import.meta.env.VITE_AGENT_URL}/api/chat`
     : '/api/v1/chat';
   ```
2. Update fetch call to use `chatEndpoint`
3. No other changes needed (keep existing error handling)

**Acceptance**: ChatBot uses agent URL when flag enabled

---

### Phase 3: Integration Testing

#### Task 8: Test Development Integration
**Repository**: list-cutter  
**Time**: 45 minutes  
**Dependencies**: Tasks 5 and 7

1. Start main app with --remote (uses cutty-dev and deployed agent):
   ```bash
   cd ~/Documents/GitHub/list-cutter/worktrees/cutty-agent
   make dev  # Uses wrangler dev --remote
   ```
2. Access app at http://localhost:5173
3. Test scenarios:
   - Send regular chat message
   - Ask "what states do you support?"
   - Verify responses display correctly
   - Check browser console for CORS errors
   - Verify agent URL in Network tab shows cutty-agent.emily-cogsdill.workers.dev

**Acceptance**: No errors, tool executes, responses from deployed agent

---

#### Task 9: Test Cutty-Dev Deployment
**Repository**: list-cutter  
**Time**: 30 minutes  
**Dependencies**: Task 8

1. Deploy main app to cutty-dev:
   ```bash
   cd ~/Documents/GitHub/list-cutter/worktrees/cutty-agent/cloudflare/workers
   npm run deploy:dev  # Deploys to cutty-dev.emilycogsdill.com
   ```
2. Access https://cutty-dev.emilycogsdill.com
3. Test same scenarios as Task 8
4. Monitor response times
5. Check agent logs: `cd cutty-agent && npm run logs`

**Acceptance**: Integration works on cutty-dev with deployed agent

---

#### Task 10: Feature Flag Testing
**Repository**: list-cutter  
**Time**: 20 minutes  
**Dependencies**: Task 9

1. Test with `AGENT_ENABLED=false`:
   - Verify falls back to Workers AI
   - No errors or warnings
   - Existing functionality intact
2. Toggle flag and restart:
   - Verify switches to agent
   - Test rapid toggling
3. Document toggle behavior

**Acceptance**: Clean switching between AI Worker and Agent

---

### Phase 4: Documentation & Cleanup

#### Task 11: Create Integration Documentation
**Repository**: Both  
**Time**: 45 minutes  
**Dependencies**: Task 10

1. In cutty-agent repo:
   - Update README.md with setup instructions
   - Document environment variables
   - Add troubleshooting section
2. In list-cutter repo:
   - Update main README with agent option
   - Document feature flag
   - Add to CHANGELOG.md

**Acceptance**: Clear documentation for future developers

---

#### Task 12: Performance & Monitoring Check
**Repository**: cutty-agent  
**Time**: 30 minutes  
**Dependencies**: Task 11

1. Monitor agent for 24 hours:
   - Check uptime
   - Review error logs
   - Measure response times
2. Document findings in `POC_FINDINGS.md`
3. Create issues for any problems found
4. Make go/no-go recommendation

**Acceptance**: Documented decision on proceeding to V1

---

## Summary

Total Tasks: 12  
Estimated Time: 6.5 hours active work + 24 hour monitoring  
Critical Path: Tasks 1→2→3→4→5 for agent, then 8→9→10 for integration testing

## Success Criteria

- [ ] Agent deployed and accessible
- [ ] Main app can toggle between AI Worker and Agent
- [ ] getSupportedStates tool executes successfully
- [ ] No breaking changes to existing functionality
- [ ] Clear documentation for V1 development