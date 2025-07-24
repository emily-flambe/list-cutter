# Cutty Agent Proof of Concept Requirements

## Introduction

This proof of concept (PoC) validates that we can successfully deploy a Cloudflare Agent as a separate service and connect it to the Cutty frontend. The agent will be built in a separate repository (`cutty-agent`) to ensure complete isolation from the production application.

## PoC Goal

**Single Objective:** Deploy a working Cloudflare Agent in a separate repository that can receive messages from the Cutty frontend and return responses.

## Scope

### In Scope
- Deploy a basic Cloudflare Agent using the starter template
- Connect the existing chat UI to the Agent endpoint
- Return responses to user messages
- Implement ONE read-only tool to test tool execution

### Out of Scope
- Action execution or state modification
- User authentication integration
- Multiple tools or complex workflows
- Performance optimization
- Error handling beyond basic functionality

## Core Requirements

### Requirement 1: Basic Agent Deployment

**User Story:** As a developer, I want to deploy a Cloudflare Agent that stays running, so I can validate the infrastructure works.

#### Acceptance Criteria
1. WHEN the Agent is deployed THEN it SHALL be accessible via HTTP endpoint
2. WHEN a health check is requested THEN the Agent SHALL respond with status
3. WHEN deployment completes THEN Durable Objects SHALL be properly configured

### Requirement 2: Frontend Connection

**User Story:** As a developer, I want the chat UI to connect to the Agent, so I can test the integration pathway.

#### Acceptance Criteria
1. WHEN a user sends a message THEN the frontend SHALL successfully reach the Agent
2. WHEN the Agent responds THEN the response SHALL display in the chat UI
3. WHEN connection fails THEN a basic error message SHALL appear

### Requirement 3: Proof of Tool Execution

**User Story:** As a developer, I want to implement one simple tool, so I can verify the tool system works.

#### Acceptance Criteria
1. WHEN implementing getSupportedStates tool THEN it SHALL return hardcoded state list
2. WHEN a user asks "what states do you support?" THEN the tool SHALL execute
3. WHEN the tool executes THEN the response SHALL show the state list

## Technical Approach

### Separate Repository Strategy
- Create new repository: `github.com/emily-flambe/cutty-agent`
- Start with Cloudflare's agents-starter template
- Deploy to separate Worker: `cutty-agent`
- Complete isolation from main application

### Integration Approach
- Main app requires minimal changes (environment variables only)
- Use feature flag to toggle between AI Worker and Agent
- Agent URL configured via environment variable
- No shared code or dependencies

## Success Criteria

- [ ] Agent deploys without errors
- [ ] Agent stays running for 24 hours without crashes
- [ ] Frontend can send messages to Agent
- [ ] Agent returns responses that display in chat
- [ ] One tool executes successfully
- [ ] No impact on existing chatbot functionality

## Timeline

### Week 1: Repository Setup & Deploy
- Create new `cutty-agent` repository
- Initialize from agents-starter template
- Configure for Cutty branding/personality
- Deploy to `cutty-agent.emily-cogsdill.workers.dev`
- Verify health endpoint works

### Week 2: Main App Integration
- Add AGENT_URL and AGENT_ENABLED to main app environment
- Update ChatBot component to conditionally use Agent URL
- Configure CORS headers in agent for Cutty domains
- Test basic message flow between apps

### Week 3: Tool Validation
- Implement getSupportedStates tool in agent repo
- Test tool execution from Cutty frontend
- Document cross-repository challenges
- Make go/no-go decision for V1

## Deliverables

### From `cutty-agent` repository:
1. Deployed Agent at `cutty-agent.emily-cogsdill.workers.dev`
2. Health check endpoint returning status
3. One working tool (getSupportedStates)
4. README with integration instructions

### From main `list-cutter` repository:
1. Environment variables for agent configuration
2. Updated ChatBot component with conditional endpoint
3. No other changes required

### Documentation:
1. Technical report covering:
   - Cross-repository integration challenges
   - CORS and authentication considerations
   - Performance impact of separate service
   - Recommendation for V1 approach

## Risk Mitigation

- Completely separate repository (can delete if failed)
- No production dependencies or changes
- Existing chatbot remains untouched
- Integration via environment variables only
- Can disable with single flag toggle