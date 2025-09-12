# Cloudflare Documentation Links Index

Organized reference documentation for Cloudflare services. The original comprehensive file has been split into logical categories for easier navigation by AI agents and developers.

## Quick Links to Documentation Categories

### Core Services for Cutty Project
- **[Workers and Compute](./cloudflare-workers-and-compute.md)** - Edge computing platform (Workers, Durable Objects, Workflows)
- **[Data Storage](./cloudflare-data-storage.md)** - D1 database, KV storage, R2 object storage, Vectorize
- **[AI Gateway](./cloudflare-ai-gateway.md)** - Unified AI model management and optimization

### AI and Automation
- **[Agents](./cloudflare-agents.md)** - Build AI-powered agents and applications
- **[AI Gateway](./cloudflare-ai-gateway.md)** - Manage and optimize AI model usage

### Communication and Messaging
- **[Messaging and Queues](./cloudflare-messaging-and-queues.md)** - Queues, Pub/Sub, Email Routing, Pipelines

### Media and Content
- **[Media and Streaming](./cloudflare-media-and-streaming.md)** - Stream video, Images API, Realtime services

### Additional Services
- **[Other Services](./cloudflare-other-services.md)** - Pages, Hyperdrive, Browser Rendering, AutoRAG, Zaraz, and more

## Service Breakdown

### Current Project Stack (Cutty)
The Cutty project currently uses:
- **Workers** - Backend API and compute
- **D1** - SQLite database for application data
- **R2** - Object storage for CSV files
- **KV** - Key-value storage for caching and sessions

### Available for Future Integration
Services that could enhance the Cutty project:
- **Agents** - For AI assistant (Cutty the Cuttlefish)
- **AI Gateway** - For managing AI model calls
- **Queues** - For async processing of large CSV files
- **Workers AI** - For running AI models at the edge
- **Vectorize** - For RAG implementation with the assistant
- **AutoRAG** - For retrieval augmented generation

## Documentation Structure

Each category file contains:
- Introduction to the service category
- Core documentation links
- Getting started guides
- API references
- Examples and tutorials
- Best practices
- Platform limitations and pricing

## Source

All documentation links are from:
- Official Cloudflare Developer Documentation: https://developers.cloudflare.com/
- Markdown archive: https://developers.cloudflare.com/markdown.zip
- LLM context file: https://developers.cloudflare.com/llms.txt

## Usage Tips for AI Agents

1. **Start with the index** - Use this file to understand the documentation structure
2. **Navigate by service** - Each category file is focused on related services
3. **Search within files** - Use grep or search within specific category files
4. **Check current stack** - Reference the "Current Project Stack" section above
5. **Explore integrations** - Review "Available for Future Integration" for enhancement ideas

## File Naming Convention

All documentation files follow the pattern: `cloudflare-[category].md`
- cloudflare-agents.md
- cloudflare-ai-gateway.md
- cloudflare-data-storage.md
- cloudflare-media-and-streaming.md
- cloudflare-messaging-and-queues.md
- cloudflare-other-services.md
- cloudflare-workers-and-compute.md
- cloudflare-index.md (this file)

## Last Updated

Documentation extracted and organized from the comprehensive cloudflare-links.md file.
Original source contained all Cloudflare developer documentation links in a single 1600+ line file.