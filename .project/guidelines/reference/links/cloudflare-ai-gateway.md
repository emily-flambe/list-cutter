# Cloudflare AI Gateway Documentation

Manage and optimize AI model usage with unified API, caching, rate limiting, and observability.

## Core Documentation
- [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/index.md)
- [Getting started](https://developers.cloudflare.com/ai-gateway/get-started/index.md)
- [AI Assistant](https://developers.cloudflare.com/ai-gateway/ai/index.md)
- [REST API reference](https://developers.cloudflare.com/ai-gateway/api-reference/index.md)
- [Header Glossary](https://developers.cloudflare.com/ai-gateway/glossary/index.md)
- [Changelog](https://developers.cloudflare.com/ai-gateway/changelog/index.md)

## Configuration
- [Configuration](https://developers.cloudflare.com/ai-gateway/configuration/index.md)
- [Manage gateways](https://developers.cloudflare.com/ai-gateway/configuration/manage-gateway/index.md)
- [Authenticated Gateway](https://developers.cloudflare.com/ai-gateway/configuration/authentication/index.md): Add security by requiring a valid authorization token for each request.
- [BYOK (Store Keys)](https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/index.md)
- [Custom costs](https://developers.cloudflare.com/ai-gateway/configuration/custom-costs/index.md): Override default or public model costs on a per-request basis.
- [Fallbacks](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/index.md)
- [Request handling](https://developers.cloudflare.com/ai-gateway/configuration/request-handling/index.md)

## Features
- [Features](https://developers.cloudflare.com/ai-gateway/features/index.md)
- [Caching](https://developers.cloudflare.com/ai-gateway/features/caching/index.md): Override caching settings on a per-request basis.
- [Rate limiting](https://developers.cloudflare.com/ai-gateway/features/rate-limiting/index.md)
- [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/index.md): Use the Cloudflare billing to pay for and authenticate your inference requests.
- [Data Loss Prevention (DLP)](https://developers.cloudflare.com/ai-gateway/features/dlp/index.md)
- [Set up Data Loss Prevention (DLP)](https://developers.cloudflare.com/ai-gateway/features/dlp/set-up-dlp/index.md)
- [Dynamic routing](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/index.md)
- [JSON Configuration](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/json-configuration/index.md)
- [Using a dynamic route](https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/usage/index.md)
- [Guardrails](https://developers.cloudflare.com/ai-gateway/features/guardrails/index.md)
- [Set up Guardrails](https://developers.cloudflare.com/ai-gateway/features/guardrails/set-up-guardrail/index.md)
- [Usage considerations](https://developers.cloudflare.com/ai-gateway/features/guardrails/usage-considerations/index.md)
- [Supported model types](https://developers.cloudflare.com/ai-gateway/features/guardrails/supported-model-types/index.md)

## Evaluations
- [Evaluations](https://developers.cloudflare.com/ai-gateway/evaluations/index.md)
- [Set up Evaluations](https://developers.cloudflare.com/ai-gateway/evaluations/set-up-evaluations/index.md)
- [Add Human Feedback using API](https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback-api/index.md)
- [Add human feedback using Worker Bindings](https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback-bindings/index.md)
- [Add Human Feedback using Dashboard](https://developers.cloudflare.com/ai-gateway/evaluations/add-human-feedback/index.md)

## Integrations
- [Integrations](https://developers.cloudflare.com/ai-gateway/integrations/index.md)
- [Agents](https://developers.cloudflare.com/ai-gateway/integrations/agents/index.md): Build AI-powered Agents on Cloudflare
- [Workers AI](https://developers.cloudflare.com/ai-gateway/integrations/aig-workers-ai-binding/index.md)
- [Vercel AI SDK](https://developers.cloudflare.com/ai-gateway/integrations/vercel-ai-sdk/index.md)
- [AI Gateway Binding Methods](https://developers.cloudflare.com/ai-gateway/integrations/worker-binding-methods/index.md)

## Observability
- [Observability](https://developers.cloudflare.com/ai-gateway/observability/index.md)
- [Analytics](https://developers.cloudflare.com/ai-gateway/observability/analytics/index.md)
- [Costs](https://developers.cloudflare.com/ai-gateway/observability/costs/index.md)
- [Custom metadata](https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/index.md)
- [Audit logs](https://developers.cloudflare.com/ai-gateway/reference/audit-logs/index.md)
- [Logging](https://developers.cloudflare.com/ai-gateway/observability/logging/index.md)
- [Workers Logpush](https://developers.cloudflare.com/ai-gateway/observability/logging/logpush/index.md)

## Usage & APIs
- [Using AI Gateway](https://developers.cloudflare.com/ai-gateway/usage/index.md)
- [Unified API (OpenAI compat)](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/index.md)
- [Universal Endpoint](https://developers.cloudflare.com/ai-gateway/usage/universal/index.md)
- [WebSockets API](https://developers.cloudflare.com/ai-gateway/usage/websockets-api/index.md)
- [Non-realtime WebSockets API](https://developers.cloudflare.com/ai-gateway/usage/websockets-api/non-realtime-api/index.md)
- [Realtime WebSockets API](https://developers.cloudflare.com/ai-gateway/usage/websockets-api/realtime-api/index.md)

## Supported Providers
- [Provider Native](https://developers.cloudflare.com/ai-gateway/usage/providers/index.md)
- [Anthropic](https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/index.md)
- [Azure OpenAI](https://developers.cloudflare.com/ai-gateway/usage/providers/azureopenai/index.md)
- [Amazon Bedrock](https://developers.cloudflare.com/ai-gateway/usage/providers/bedrock/index.md)
- [Cartesia](https://developers.cloudflare.com/ai-gateway/usage/providers/cartesia/index.md)
- [Cerebras](https://developers.cloudflare.com/ai-gateway/usage/providers/cerebras/index.md)
- [Cohere](https://developers.cloudflare.com/ai-gateway/usage/providers/cohere/index.md)
- [DeepSeek](https://developers.cloudflare.com/ai-gateway/usage/providers/deepseek/index.md)
- [ElevenLabs](https://developers.cloudflare.com/ai-gateway/usage/providers/elevenlabs/index.md)
- [Google AI Studio](https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/index.md)
- [Google Vertex AI](https://developers.cloudflare.com/ai-gateway/usage/providers/vertex/index.md)
- [Groq](https://developers.cloudflare.com/ai-gateway/usage/providers/groq/index.md)
- [HuggingFace](https://developers.cloudflare.com/ai-gateway/usage/providers/huggingface/index.md)
- [Mistral AI](https://developers.cloudflare.com/ai-gateway/usage/providers/mistral/index.md)
- [OpenAI](https://developers.cloudflare.com/ai-gateway/usage/providers/openai/index.md)
- [OpenRouter](https://developers.cloudflare.com/ai-gateway/usage/providers/openrouter/index.md)
- [Perplexity](https://developers.cloudflare.com/ai-gateway/usage/providers/perplexity/index.md)
- [Replicate](https://developers.cloudflare.com/ai-gateway/usage/providers/replicate/index.md)
- [Workers AI](https://developers.cloudflare.com/ai-gateway/usage/providers/workersai/index.md)
- [xAI](https://developers.cloudflare.com/ai-gateway/usage/providers/grok/index.md)

## Tutorials
- [Tutorials](https://developers.cloudflare.com/ai-gateway/tutorials/index.md)
- [Create your first AI Gateway using Workers AI](https://developers.cloudflare.com/ai-gateway/tutorials/create-first-aig-workers/index.md)
- [Deploy a Worker that connects to OpenAI via AI Gateway](https://developers.cloudflare.com/ai-gateway/tutorials/deploy-aig-worker/index.md): Learn how to deploy a Worker that makes calls to OpenAI through AI Gateway

## Platform Reference
- [Platform](https://developers.cloudflare.com/ai-gateway/reference/index.md)
- [Limits](https://developers.cloudflare.com/ai-gateway/reference/limits/index.md)
- [Pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/index.md)
- [Architectures](https://developers.cloudflare.com/ai-gateway/demos/index.md)