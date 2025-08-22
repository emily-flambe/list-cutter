# AI Provider Requirements

## CRITICAL: Use Anthropic Only

This project uses **Anthropic's Claude** as the AI provider for all agent functionality. 

### DO NOT USE:
- ❌ OpenAI (GPT models)
- ❌ Google AI models
- ❌ Any other AI providers

### ALWAYS USE:
- ✅ Anthropic Claude models
- ✅ Currently: `claude-3-5-sonnet-20241022`

### Environment Variables:
- Use `ANTHROPIC_API_KEY` (not OPENAI_API_KEY)
- Configure in `.dev.vars` for local development
- Set in Cloudflare dashboard for production

### Package Dependencies:
- Use `@ai-sdk/anthropic` (not @ai-sdk/openai)
- Import: `import { anthropic } from '@ai-sdk/anthropic'`

### Model Configuration:
```typescript
model: anthropic('claude-3-5-sonnet-20241022', {
  apiKey: env.ANTHROPIC_API_KEY,
})
```

## Rationale
This project is specifically designed to use Anthropic's Claude for its superior performance in coding tasks and consistent behavior in agent-based systems.

## History
- Initial implementation mistakenly used OpenAI
- Fixed in commit: [pending commit hash]
- All references updated to use Anthropic exclusively