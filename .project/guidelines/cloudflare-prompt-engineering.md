# Cloudflare Prompt Engineering Guidelines

## Overview

This document outlines prompt engineering best practices when developing with Cloudflare Workers AI, based on Cloudflare's official recommendations. These guidelines ensure consistent, secure, and effective AI interactions within the Cutty platform.

## Core Principles

### 1. Clear Context Definition
Always establish explicit context for AI interactions:
- Define the AI's role and expertise domain upfront
- Specify the technical environment (Cloudflare Workers, edge computing)
- Set clear boundaries for what the AI should and shouldn't do

### 2. Structured Prompt Architecture
Use a consistent structure for all prompts:
```
<system_context>
Define the AI's role and platform-specific context
</system_context>

<behavior_guidelines>
Specify expected behaviors and constraints
</behavior_guidelines>

<code_standards>
Define coding conventions and requirements
</code_standards>

<user_prompt>
The actual user request or task
</user_prompt>
```

## Cloudflare-Specific Requirements

### Platform Constraints
When prompting for Cloudflare Workers development:
- **Module Format**: Always specify ES modules (not CommonJS)
- **Dependencies**: Minimize external dependencies; prefer built-in APIs
- **Native Libraries**: Explicitly prohibit C-binding or native libraries
- **Runtime**: Remember Workers run in V8 isolates, not Node.js

### Service Integration
Prioritize Cloudflare's native services in prompts:
- KV for key-value storage
- D1 for SQL databases
- R2 for object storage
- Durable Objects for stateful coordination
- Queues for message processing

### Security Requirements
Always include these security guidelines in prompts:
- Never hardcode secrets or API keys
- Use environment variables for all sensitive configuration
- Implement proper CORS headers
- Follow Workers security best practices
- Validate and sanitize all inputs

## Prompt Template for Cutty Development

```markdown
<system_context>
You are an AI assistant specialized in Cloudflare Workers development for the Cutty platform.
Cutty is a CSV processing and data management application built on Cloudflare's edge infrastructure.

Technical Environment:
- Platform: Cloudflare Workers (V8 isolates)
- Language: TypeScript (strict mode)
- Database: D1 (SQLite)
- Storage: R2 for files, KV for cache
- Authentication: JWT with Google OAuth
- Frontend: React with responsive design
</system_context>

<behavior_guidelines>
- Provide concise, actionable solutions
- Focus on edge-first, serverless patterns
- Prioritize performance and global scalability
- Consider sub-50ms response time targets
- Follow the project's existing patterns and conventions
</behavior_guidelines>

<code_standards>
- Use TypeScript with strict type checking
- Follow ES module format for all code
- Implement comprehensive error handling
- Include input validation with Zod
- Write self-documenting code with meaningful variable names
- Add JSDoc comments for complex functions
- Never include emojis in code or comments
- Never hardcode secrets or sensitive data
</code_standards>

<platform_integration>
- Use Cloudflare native services (KV, D1, R2) over external alternatives
- Implement proper rate limiting
- Handle Worker CPU time limits (10ms-50ms)
- Consider global deployment and edge caching
- Use official Cloudflare SDKs when available
</platform_integration>

<user_prompt>
[User's specific request goes here]
</user_prompt>
```

## Best Practices for Different Scenarios

### 1. Feature Development Prompts
Include:
- Specific feature requirements
- Performance targets
- Database schema context
- Existing API patterns

Example:
```
Given our existing D1 schema and JWT authentication, implement a new API endpoint 
for bulk CSV operations that processes files up to 10MB with sub-200ms response times.
```

### 2. Debugging and Troubleshooting Prompts
Include:
- Error messages and stack traces
- Environment configuration
- Recent changes
- Expected vs actual behavior

### 3. Performance Optimization Prompts
Include:
- Current performance metrics
- Bottleneck identification
- Caching strategy context
- Global distribution requirements

### 4. Security Review Prompts
Include:
- Authentication flow details
- Data sensitivity levels
- Compliance requirements
- Threat model context

## Integration with Existing Guidelines

This document complements our existing AI behavior guidelines:
- Follow all rules in `ai-behavior.md` regarding no emojis, objective decision-making, and verification
- Apply coding standards from `coding-standards.md`
- Use TDD approach as outlined in `tdd-approach.md`
- Reference `troubleshooting.md` patterns in debug prompts

## AutoRAG and AI Assistant Prompts

When configuring AutoRAG or AI assistants for Cutty:

### System Prompt Configuration
```typescript
const CUTTY_SYSTEM_PROMPT = `
You are Cutty, an intelligent assistant for the Cutty CSV processing platform.
You help users with data management, CSV operations, and platform navigation.

Core Capabilities:
- Guide users through CSV upload and processing
- Explain data transformation features
- Troubleshoot common issues
- Suggest optimal workflows for data tasks

Technical Context:
- Platform runs on Cloudflare Workers
- Supports files up to 10MB
- Provides real-time processing with <200ms response times
- Offers synthetic data generation

Communication Style:
- Be concise and helpful
- Focus on actionable guidance
- Avoid technical jargon unless necessary
- Never use emojis in responses
`;
```

### Intent Detection Prompts
Structure prompts to identify user intent clearly:
```typescript
const INTENT_PROMPT = `
Analyze the user query and determine:
1. Primary intent (documentation, troubleshooting, how-to, feature-request)
2. Relevant Cutty features mentioned
3. Required action type (navigate, create, edit, view, search)
4. Confidence level (0-1)

Respond in JSON format only.
`;
```

## Monitoring and Iteration

### Prompt Performance Metrics
Track:
- Response accuracy and relevance
- Token usage efficiency
- Response time
- User satisfaction scores

### Continuous Improvement
- Review prompt effectiveness weekly
- Update based on common user queries
- Incorporate new platform features
- Adjust for model updates

## Common Pitfalls to Avoid

1. **Over-specification**: Don't constrain the AI too much; allow for creative problem-solving
2. **Under-specification**: Provide sufficient context about the platform and requirements
3. **Ignoring Edge Constraints**: Always consider Workers' limitations (CPU time, memory)
4. **Generic Prompts**: Tailor prompts specifically for Cloudflare Workers, not generic Node.js
5. **Security Assumptions**: Never assume the AI will handle security automatically

## References

- [Cloudflare Workers AI Prompting Guide](https://developers.cloudflare.com/workers/get-started/prompting/)
- [Cloudflare AutoRAG System Prompts](https://developers.cloudflare.com/autorag/configuration/system-prompt/)
- [Workers AI Features - Prompting](https://developers.cloudflare.com/workers-ai/features/prompting/)
- Project-specific guidelines in `.project/guidelines/`

---

*This document should be reviewed and updated as Cloudflare's AI capabilities and best practices evolve.*