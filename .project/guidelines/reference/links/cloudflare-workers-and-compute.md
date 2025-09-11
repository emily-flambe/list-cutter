# Cloudflare Workers and Compute Documentation

Cloudflare's serverless compute platform enables developers to deploy applications, APIs, and full-stack websites at the edge. The platform includes Workers for general-purpose serverless computing, Workers AI for machine learning inference, Durable Objects for stateful applications, Workflows for orchestration, and more.

## Workers - Edge Computing Platform

### Getting Started
- [Cloudflare Workers](https://developers.cloudflare.com/workers/index.md)
- [Getting started](https://developers.cloudflare.com/workers/get-started/index.md)
- [Dashboard](https://developers.cloudflare.com/workers/get-started/dashboard/index.md)
- [CLI](https://developers.cloudflare.com/workers/get-started/guide/index.md)
- [Playground](https://developers.cloudflare.com/workers/playground/index.md)
- [Prompting](https://developers.cloudflare.com/workers/get-started/prompting/index.md)
- [Templates](https://developers.cloudflare.com/workers/get-started/quickstarts/index.md): GitHub repositories that are designed to be a starting point for building a new Cloudflare Workers project.

### Core Features
- [AI Assistant](https://developers.cloudflare.com/workers/ai/index.md)
- [Demos and architectures](https://developers.cloudflare.com/workers/demos/index.md)
- [Glossary](https://developers.cloudflare.com/workers/glossary/index.md)
- [How Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/index.md): The difference between the Workers runtime versus traditional browsers and Node.js.

### Configuration
- [Configuration](https://developers.cloudflare.com/workers/configuration/index.md)
- [Bindings](https://developers.cloudflare.com/workers/configuration/bindings/index.md): The various bindings that are available to Cloudflare Workers.
- [Compatibility dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/index.md): Opt into a specific version of the Workers runtime for your Workers project.
- [Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/index.md): Opt into a specific features of the Workers runtime for your Workers project.
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/index.md): Enable your Worker to be executed on a schedule.
- [Environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/index.md): You can add environment variables, which are a type of binding, to attach text strings or JSON values to your Worker.
- [Multipart upload metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/index.md)
- [Preview URLs](https://developers.cloudflare.com/workers/configuration/previews/index.md): Preview URLs allow you to preview new versions of your project without deploying it to production.
- [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/index.md): Store sensitive information, like API keys and auth tokens, in your Worker.
- [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement/index.md): Speed up your Worker application by automatically placing your workloads in an optimal location that minimizes latency.
- [Page Rules](https://developers.cloudflare.com/workers/configuration/workers-with-page-rules/index.md): Review the interaction between various Page Rules and Workers.

### Routing and Domains
- [Routes and domains](https://developers.cloudflare.com/workers/configuration/routing/index.md): Connect your Worker to an external endpoint (via Routes, Custom Domains or a `workers.dev` subdomain) such that it can be accessed by the Internet.
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/index.md)
- [Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/index.md)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/index.md)

### Versions and Deployments
- [Versions & Deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/index.md): Upload versions of Workers and create deployments to release new versions.
- [Gradual deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/index.md): Incrementally deploy code changes to your Workers with gradual deployments.
- [Rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/index.md): Revert to an older version of your Worker.

### Integrations
- [Integrations](https://developers.cloudflare.com/workers/configuration/integrations/index.md): Integrate with third-party services and products.
- [APIs](https://developers.cloudflare.com/workers/configuration/integrations/apis/index.md)
- [External Services](https://developers.cloudflare.com/workers/configuration/integrations/external-services/index.md)
- [Momento](https://developers.cloudflare.com/workers/configuration/integrations/momento/index.md)

### Development and Testing
- [Development & testing](https://developers.cloudflare.com/workers/development-testing/index.md): Develop and test your Workers locally.
- [Supported bindings per development mode](https://developers.cloudflare.com/workers/development-testing/bindings-per-env/index.md): Supported bindings per development mode
- [Environment variables and secrets](https://developers.cloudflare.com/workers/development-testing/environment-variables/index.md): Configuring environment variables and secrets for local development
- [Adding local data](https://developers.cloudflare.com/workers/development-testing/local-data/index.md): Populating local resources with data
- [Developing with multiple Workers](https://developers.cloudflare.com/workers/development-testing/multi-workers/index.md): Learn how to develop with multiple Workers using different approaches and configurations.
- [Testing](https://developers.cloudflare.com/workers/development-testing/testing/index.md)
- [Vite Plugin](https://developers.cloudflare.com/workers/development-testing/vite-plugin/index.md)
- [Choosing between Wrangler & Vite](https://developers.cloudflare.com/workers/development-testing/wrangler-vs-vite/index.md): Choosing between Wrangler and Vite for local development

### Databases
- [Databases](https://developers.cloudflare.com/workers/databases/index.md)
- [Analytics Engine](https://developers.cloudflare.com/workers/databases/analytics-engine/index.md): Use Workers to receive performance analytics about your applications, products and projects.
- [Connect to databases](https://developers.cloudflare.com/workers/databases/connecting-to-databases/index.md): Learn about the different kinds of database integrations Cloudflare supports.
- [Cloudflare D1](https://developers.cloudflare.com/workers/databases/d1/index.md): Cloudflare's native serverless database.
- [Vectorize (vector database)](https://developers.cloudflare.com/workers/databases/vectorize/index.md): A globally distributed vector database that enables you to build full-stack, AI-powered applications with Cloudflare Workers.
- [Hyperdrive](https://developers.cloudflare.com/workers/databases/hyperdrive/index.md): Use Workers to accelerate queries you make to existing databases.

### Third-Party Database Integrations
- [3rd Party Integrations](https://developers.cloudflare.com/workers/databases/third-party-integrations/index.md): Connect to third-party databases such as Supabase, Turso and PlanetScale)
- [Neon](https://developers.cloudflare.com/workers/databases/third-party-integrations/neon/index.md): Connect Workers to a Neon Postgres database.
- [PlanetScale](https://developers.cloudflare.com/workers/databases/third-party-integrations/planetscale/index.md)
- [Supabase](https://developers.cloudflare.com/workers/databases/third-party-integrations/supabase/index.md)
- [Turso](https://developers.cloudflare.com/workers/databases/third-party-integrations/turso/index.md)
- [Upstash](https://developers.cloudflare.com/workers/databases/third-party-integrations/upstash/index.md)
- [Xata](https://developers.cloudflare.com/workers/databases/third-party-integrations/xata/index.md)

### Framework Guides
- [Framework guides](https://developers.cloudflare.com/workers/framework-guides/index.md): Create full-stack applications deployed to Cloudflare Workers.

#### AI and Agents
- [AI & agents](https://developers.cloudflare.com/workers/framework-guides/ai-and-agents/index.md)
- [Agents SDK](https://developers.cloudflare.com/workers/framework-guides/ai-and-agents/agents-sdk/index.md)
- [LangChain](https://developers.cloudflare.com/workers/framework-guides/ai-and-agents/langchain/index.md)

#### APIs
- [APIs](https://developers.cloudflare.com/workers/framework-guides/apis/index.md)
- [Hono](https://developers.cloudflare.com/workers/framework-guides/apis/hono/index.md)
- [FastAPI](https://developers.cloudflare.com/workers/framework-guides/apis/fast-api/index.md)

#### Mobile Applications
- [Mobile applications](https://developers.cloudflare.com/workers/framework-guides/mobile-apps/index.md)
- [Expo](https://developers.cloudflare.com/workers/framework-guides/mobile-apps/expo/index.md)

#### Web Applications
- [Web applications](https://developers.cloudflare.com/workers/framework-guides/web-apps/index.md)
- [Astro](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/index.md): Create an Astro application and deploy it to Cloudflare Workers with Workers Assets.
- [Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/index.md): Create an Next.js application and deploy it to Cloudflare Workers with Workers Assets.
- [React Router (formerly Remix)](https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/index.md): Create a React Router application and deploy it to Cloudflare Workers
- [React + Vite](https://developers.cloudflare.com/workers/framework-guides/web-apps/react/index.md): Create a React application and deploy it to Cloudflare Workers with Workers Assets.
- [RedwoodSDK](https://developers.cloudflare.com/workers/framework-guides/web-apps/redwoodsdk/index.md): Create an RedwoodSDK application and deploy it to Cloudflare Workers with Workers Assets.
- [Svelte](https://developers.cloudflare.com/workers/framework-guides/web-apps/svelte/index.md): Create a Svelte application and deploy it to Cloudflare Workers with Workers Assets.
- [TanStack](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack/index.md): Create a TanStack Start application and deploy it to Cloudflare Workers with Workers Assets.
- [Vue](https://developers.cloudflare.com/workers/framework-guides/web-apps/vue/index.md): Create a Vue application and deploy it to Cloudflare Workers with Workers Assets.

#### More Web Frameworks
- [More guides...](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/index.md)
- [Angular](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/angular/index.md): Create an Angular application and deploy it to Cloudflare Workers with Workers Assets.
- [Docusaurus](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/docusaurus/index.md): Create a Docusaurus application and deploy it to Cloudflare Workers with Workers Assets.
- [Gatsby](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/gatsby/index.md): Create a Gatsby application and deploy it to Cloudflare Workers with Workers Assets.
- [Hono](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/hono/index.md): Create a Hono application and deploy it to Cloudflare Workers with Workers Assets.
- [Nuxt](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/nuxt/index.md): Create a Nuxt application and deploy it to Cloudflare Workers with Workers Assets.
- [Solid](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/solid/index.md): Create a Solid application and deploy it to Cloudflare Workers with Workers Assets.
- [Qwik](https://developers.cloudflare.com/workers/framework-guides/web-apps/more-web-frameworks/qwik/index.md): Create a Qwik application and deploy it to Cloudflare Workers with Workers Assets.

### Languages
- [Languages](https://developers.cloudflare.com/workers/languages/index.md): Languages supported on Workers, a polyglot platform.

#### JavaScript
- [JavaScript](https://developers.cloudflare.com/workers/languages/javascript/index.md)
- [Examples](https://developers.cloudflare.com/workers/languages/javascript/examples/index.md)

#### TypeScript
- [TypeScript](https://developers.cloudflare.com/workers/languages/typescript/index.md)
- [Examples](https://developers.cloudflare.com/workers/languages/typescript/examples/index.md)

#### Python
- [Python](https://developers.cloudflare.com/workers/languages/python/index.md): Write Workers in 100% Python
- [Examples](https://developers.cloudflare.com/workers/languages/python/examples/index.md)
- [Foreign Function Interface (FFI)](https://developers.cloudflare.com/workers/languages/python/ffi/index.md)
- [How Python Workers Work](https://developers.cloudflare.com/workers/languages/python/how-python-workers-work/index.md)
- [Standard Library](https://developers.cloudflare.com/workers/languages/python/stdlib/index.md)
- [Packages](https://developers.cloudflare.com/workers/languages/python/packages/index.md)
- [FastAPI](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/index.md)
- [Langchain](https://developers.cloudflare.com/workers/languages/python/packages/langchain/index.md)

#### Rust
- [Rust](https://developers.cloudflare.com/workers/languages/rust/index.md): Write Workers in 100% Rust using the [`workers-rs` crate](https://github.com/cloudflare/workers-rs)
- [Supported crates](https://developers.cloudflare.com/workers/languages/rust/crates/index.md)

### Runtime APIs
- [Runtime APIs](https://developers.cloudflare.com/workers/runtime-apis/index.md)
- [Cache](https://developers.cloudflare.com/workers/runtime-apis/cache/index.md): Control reading and writing from the Cloudflare global network cache.
- [Console](https://developers.cloudflare.com/workers/runtime-apis/console/index.md): Supported methods of the `console` API in Cloudflare Workers
- [Context (ctx)](https://developers.cloudflare.com/workers/runtime-apis/context/index.md): The Context API in Cloudflare Workers, including waitUntil and passThroughOnException.
- [Encoding](https://developers.cloudflare.com/workers/runtime-apis/encoding/index.md): Takes a stream of code points as input and emits a stream of bytes.
- [EventSource](https://developers.cloudflare.com/workers/runtime-apis/eventsource/index.md): EventSource is a server-sent event API that allows a server to push events to a client.
- [Fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/index.md): An interface for asynchronously fetching resources via HTTP requests inside of a Worker.
- [Headers](https://developers.cloudflare.com/workers/runtime-apis/headers/index.md): Access HTTP request and response headers.
- [HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/index.md): Build comprehensive and expressive HTML parsers inside of a Worker application.
- [MessageChannel](https://developers.cloudflare.com/workers/runtime-apis/messagechannel/index.md): Channel messaging with MessageChannel and MessagePort
- [Performance and timers](https://developers.cloudflare.com/workers/runtime-apis/performance/index.md): Measure timing, performance, and timing of subrequests and other operations.
- [Request](https://developers.cloudflare.com/workers/runtime-apis/request/index.md): Interface that represents an HTTP request.
- [Response](https://developers.cloudflare.com/workers/runtime-apis/response/index.md): Interface that represents an HTTP response.
- [TCP sockets](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/index.md): Use the `connect()` API to create outbound TCP connections from Workers.
- [Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/index.md): A set of low-level functions for common cryptographic tasks.
- [Web standards](https://developers.cloudflare.com/workers/runtime-apis/web-standards/index.md): Standardized APIs for use by Workers running on Cloudflare's global network.
- [WebSockets](https://developers.cloudflare.com/workers/runtime-apis/websockets/index.md): Communicate in real time with your Cloudflare Workers.

### Bindings
- [Bindings (env)](https://developers.cloudflare.com/workers/runtime-apis/bindings/index.md): Worker Bindings that allow for interaction with other Cloudflare Resources.
- [AI](https://developers.cloudflare.com/workers/runtime-apis/bindings/ai/index.md): Run generative AI inference and machine learning models on GPUs, without managing servers or infrastructure.
- [Analytics Engine](https://developers.cloudflare.com/workers/runtime-apis/bindings/analytics-engine/index.md): Write high-cardinality data and metrics at scale, directly from Workers.
- [Assets](https://developers.cloudflare.com/workers/runtime-apis/bindings/assets/index.md): APIs available in Cloudflare Workers to interact with a collection of static assets. Static assets can be uploaded as part of your Worker.
- [Browser Rendering](https://developers.cloudflare.com/workers/runtime-apis/bindings/browser-rendering/index.md): Programmatically control and interact with a headless browser instance.
- [D1](https://developers.cloudflare.com/workers/runtime-apis/bindings/d1/index.md): APIs available in Cloudflare Workers to interact with D1.  D1 is Cloudflare's native serverless database.
- [Dispatcher (Workers for Platforms)](https://developers.cloudflare.com/workers/runtime-apis/bindings/dispatcher/index.md): Let your customers deploy their own code to your platform, and dynamically dispatch requests from your Worker to their Worker.
- [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/bindings/durable-objects/index.md): A globally distributed coordination API with strongly consistent storage.
- [Environment Variables](https://developers.cloudflare.com/workers/runtime-apis/bindings/environment-variables/index.md): Add string and JSON values to your Worker.
- [Hyperdrive](https://developers.cloudflare.com/workers/runtime-apis/bindings/hyperdrive/index.md): Connect to your existing database from Workers, turning your existing regional database into a globally distributed database.
- [Images](https://developers.cloudflare.com/workers/runtime-apis/bindings/images/index.md): Store, transform, optimize, and deliver images at scale.
- [KV](https://developers.cloudflare.com/workers/runtime-apis/bindings/kv/index.md): Global, low-latency, key-value data storage.
- [mTLS](https://developers.cloudflare.com/workers/runtime-apis/bindings/mtls/index.md): Configure your Worker to present a client certificate to services that enforce an mTLS connection.
- [Queues](https://developers.cloudflare.com/workers/runtime-apis/bindings/queues/index.md): Send and receive messages with guaranteed delivery.
- [R2](https://developers.cloudflare.com/workers/runtime-apis/bindings/r2/index.md): APIs available in Cloudflare Workers to read from and write to R2 buckets.  R2 is S3-compatible, zero egress-fee, globally distributed object storage.
- [Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/index.md): Define rate limits and interact with them directly from your Cloudflare Worker
- [Secrets Store](https://developers.cloudflare.com/workers/runtime-apis/bindings/secrets-store/index.md): Account-level secrets that can be added to Workers applications as a binding.
- [Secrets](https://developers.cloudflare.com/workers/runtime-apis/bindings/secrets/index.md): Add encrypted secrets to your Worker.
- [Service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/index.md): Facilitate Worker-to-Worker communication.
- [HTTP](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/index.md): Facilitate Worker-to-Worker communication by forwarding Request objects.
- [RPC (WorkerEntrypoint)](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/rpc/index.md): Facilitate Worker-to-Worker communication via RPC.
- [Tail Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/tail-worker/index.md): Receive and transform logs, exceptions, and other metadata. Then forward them to observability tools for alerting, debugging, and analytics purposes.
- [Vectorize](https://developers.cloudflare.com/workers/runtime-apis/bindings/vectorize/index.md): APIs available in Cloudflare Workers to interact with Vectorize.  Vectorize is Cloudflare's globally distributed vector database.
- [Version metadata](https://developers.cloudflare.com/workers/runtime-apis/bindings/version-metadata/index.md): Exposes Worker version metadata (`versionID` and `versionTag`). These fields can be added to events emitted from the Worker to send to downstream observability systems.
- [Workflows](https://developers.cloudflare.com/workers/runtime-apis/bindings/workflows/index.md): APIs available in Cloudflare Workers to interact with Workflows. Workflows allow you to build durable, multi-step applications using Workers.

### Handlers
- [Handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/index.md): Methods, such as `fetch()`, on Workers that can receive and process external inputs.
- [Alarm Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/alarm/index.md)
- [Email Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/email/index.md)
- [Fetch Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/index.md)
- [Queue Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/queue/index.md)
- [Scheduled Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/index.md)
- [Tail Handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/tail/index.md)

### Node.js Compatibility
- [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/index.md): Node.js APIs available in Cloudflare Workers
- [assert](https://developers.cloudflare.com/workers/runtime-apis/nodejs/assert/index.md)
- [AsyncLocalStorage](https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/index.md)
- [Buffer](https://developers.cloudflare.com/workers/runtime-apis/nodejs/buffer/index.md)
- [crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/index.md)
- [Diagnostics Channel](https://developers.cloudflare.com/workers/runtime-apis/nodejs/diagnostics-channel/index.md)
- [dns](https://developers.cloudflare.com/workers/runtime-apis/nodejs/dns/index.md)
- [EventEmitter](https://developers.cloudflare.com/workers/runtime-apis/nodejs/eventemitter/index.md)
- [http](https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/index.md)
- [https](https://developers.cloudflare.com/workers/runtime-apis/nodejs/https/index.md)
- [net](https://developers.cloudflare.com/workers/runtime-apis/nodejs/net/index.md)
- [path](https://developers.cloudflare.com/workers/runtime-apis/nodejs/path/index.md)
- [process](https://developers.cloudflare.com/workers/runtime-apis/nodejs/process/index.md)
- [Streams](https://developers.cloudflare.com/workers/runtime-apis/nodejs/streams/index.md)
- [StringDecoder](https://developers.cloudflare.com/workers/runtime-apis/nodejs/string-decoder/index.md)
- [test](https://developers.cloudflare.com/workers/runtime-apis/nodejs/test/index.md)
- [timers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/timers/index.md)
- [tls](https://developers.cloudflare.com/workers/runtime-apis/nodejs/tls/index.md)
- [url](https://developers.cloudflare.com/workers/runtime-apis/nodejs/url/index.md)
- [util](https://developers.cloudflare.com/workers/runtime-apis/nodejs/util/index.md)
- [zlib](https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib/index.md)

### Remote Procedure Call (RPC)
- [Remote-procedure call (RPC)](https://developers.cloudflare.com/workers/runtime-apis/rpc/index.md): The built-in, JavaScript-native RPC system built into Workers and Durable Objects.
- [Error handling](https://developers.cloudflare.com/workers/runtime-apis/rpc/error-handling/index.md): How exceptions, stack traces, and logging works with the Workers RPC system.
- [Lifecycle](https://developers.cloudflare.com/workers/runtime-apis/rpc/lifecycle/index.md): Memory management, resource management, and the lifecycle of RPC stubs.
- [Reserved Methods](https://developers.cloudflare.com/workers/runtime-apis/rpc/reserved-methods/index.md): Reserved methods with special behavior that are treated differently.
- [TypeScript](https://developers.cloudflare.com/workers/runtime-apis/rpc/typescript/index.md): How TypeScript types for your Worker or Durable Object's RPC methods are generated and exposed to clients
- [Visibility and Security Model](https://developers.cloudflare.com/workers/runtime-apis/rpc/visibility/index.md): Which properties are and are not exposed to clients that communicate with your Worker or Durable Object via RPC

### Streams
- [Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/index.md): A web standard API that allows JavaScript to programmatically access and process streams of data.
- [ReadableStream](https://developers.cloudflare.com/workers/runtime-apis/streams/readablestream/index.md)
- [ReadableStream BYOBReader](https://developers.cloudflare.com/workers/runtime-apis/streams/readablestreambyobreader/index.md)
- [ReadableStream DefaultReader](https://developers.cloudflare.com/workers/runtime-apis/streams/readablestreamdefaultreader/index.md)
- [TransformStream](https://developers.cloudflare.com/workers/runtime-apis/streams/transformstream/index.md)
- [WritableStream](https://developers.cloudflare.com/workers/runtime-apis/streams/writablestream/index.md)
- [WritableStream DefaultWriter](https://developers.cloudflare.com/workers/runtime-apis/streams/writablestreamdefaultwriter/index.md)

### WebAssembly
- [WebAssembly (Wasm)](https://developers.cloudflare.com/workers/runtime-apis/webassembly/index.md): Execute code written in a language other than JavaScript or write an entire Cloudflare Worker in Rust.
- [Wasm in JavaScript](https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/index.md)

### Static Assets
- [Static Assets](https://developers.cloudflare.com/workers/static-assets/index.md): Create full-stack applications deployed to Cloudflare Workers.
- [Get Started](https://developers.cloudflare.com/workers/static-assets/get-started/index.md): Run front-end websites – static or dynamic – directly on Cloudflare's global network.
- [Configuration and Bindings](https://developers.cloudflare.com/workers/static-assets/binding/index.md): Details on how to configure Workers static assets and its binding.
- [Direct Uploads](https://developers.cloudflare.com/workers/static-assets/direct-upload/index.md): Upload assets through the Workers API.
- [Headers](https://developers.cloudflare.com/workers/static-assets/headers/index.md)
- [Redirects](https://developers.cloudflare.com/workers/static-assets/redirects/index.md)
- [Billing and Limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/index.md): Billing, troubleshooting, and limitations for Static assets on Workers

### Static Assets Routing
- [Routing](https://developers.cloudflare.com/workers/static-assets/routing/index.md)
- [Full-stack application](https://developers.cloudflare.com/workers/static-assets/routing/full-stack-application/index.md): How to configure and use a full-stack application with Workers.
- [Single Page Application (SPA)](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/index.md): How to configure and use a Single Page Application (SPA) with Workers.
- [Static Site Generation (SSG) and custom 404 pages](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/index.md): How to configure a Static Site Generation (SSG) application and custom 404 pages with Workers.
- [Worker script](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/index.md): How the presence of a Worker script influences static asset routing and the related configuration options.

### Static Assets Advanced
- [Advanced](https://developers.cloudflare.com/workers/static-assets/routing/advanced/index.md)
- [HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/index.md): How to configure a HTML handling and trailing slashes for the static assets of your Worker.
- [Serving a subdirectory](https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/index.md): How to configure a Worker with static assets on a subpath.

### Static Assets Migration
- [Migration Guides](https://developers.cloudflare.com/workers/static-assets/migration-guides/index.md): Learn how to migrate your applications to Cloudflare Workers.
- [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/index.md): A guide for migrating from Cloudflare Pages to Cloudflare Workers. Includes a compatibility matrix for comparing the features of Cloudflare Workers and Pages.
- [Migrate from Netlify to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/netlify-to-workers/index.md)
- [Migrate from Vercel to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/index.md)

### Workers Sites (Legacy)
- [Workers Sites](https://developers.cloudflare.com/workers/configuration/sites/index.md): Use [Workers Static Assets](/workers/static-assets/) to host full-stack applications instead of Workers Sites. Do not use Workers Sites for new projects.
- [Workers Sites configuration](https://developers.cloudflare.com/workers/configuration/sites/configuration/index.md)
- [Start from existing](https://developers.cloudflare.com/workers/configuration/sites/start-from-existing/index.md)
- [Start from Worker](https://developers.cloudflare.com/workers/configuration/sites/start-from-worker/index.md)
- [Start from scratch](https://developers.cloudflare.com/workers/configuration/sites/start-from-scratch/index.md)

### Examples
- [Examples](https://developers.cloudflare.com/workers/examples/index.md)
- [103 Early Hints](https://developers.cloudflare.com/workers/examples/103-early-hints/index.md): Allow a client to request static assets while waiting for the HTML response.
- [Accessing the Cloudflare Object](https://developers.cloudflare.com/workers/examples/accessing-the-cloudflare-object/index.md): Access custom Cloudflare properties and control how Cloudflare features are applied to every request.
- [A/B testing with same-URL direct access](https://developers.cloudflare.com/workers/examples/ab-testing/index.md): Set up an A/B test by controlling what response is served based on cookies. This version supports passing the request through to test and control on the origin, bypassing random assignment.
- [Aggregate requests](https://developers.cloudflare.com/workers/examples/aggregate-requests/index.md): Send two GET request to two urls and aggregates the responses into one response.
- [Auth with headers](https://developers.cloudflare.com/workers/examples/auth-with-headers/index.md): Allow or deny a request based on a known pre-shared key in a header. This is not meant to replace the WebCrypto API.
- [Alter headers](https://developers.cloudflare.com/workers/examples/alter-headers/index.md): Example of how to add, change, or delete headers sent in a request or returned in a response.
- [HTTP Basic Authentication](https://developers.cloudflare.com/workers/examples/basic-auth/index.md): Shows how to restrict access using the HTTP Basic schema.
- [Block on TLS](https://developers.cloudflare.com/workers/examples/block-on-tls/index.md): Inspects the incoming request's TLS version and blocks if under TLSv1.2.
- [Bulk origin override](https://developers.cloudflare.com/workers/examples/bulk-origin-proxy/index.md): Resolve requests to your domain to a set of proxy third-party origin URLs.
- [Bulk redirects](https://developers.cloudflare.com/workers/examples/bulk-redirects/index.md): Redirect requests to certain URLs based on a mapped object to the request's URL.
- [Using the Cache API](https://developers.cloudflare.com/workers/examples/cache-api/index.md): Use the Cache API to store responses in Cloudflare's cache.
- [Cache POST requests](https://developers.cloudflare.com/workers/examples/cache-post-request/index.md): Cache POST requests using the Cache API.
- [Cache Tags using Workers](https://developers.cloudflare.com/workers/examples/cache-tags/index.md): Send Additional Cache Tags using Workers
- [Cache using fetch](https://developers.cloudflare.com/workers/examples/cache-using-fetch/index.md): Determine how to cache a resource by setting TTLs, custom cache keys, and cache headers in a fetch request.
- [Conditional response](https://developers.cloudflare.com/workers/examples/conditional-response/index.md): Return a response based on the incoming request's URL, HTTP method, User Agent, IP address, ASN or device type.
- [CORS header proxy](https://developers.cloudflare.com/workers/examples/cors-header-proxy/index.md): Add the necessary CORS headers to a third party API response.
- [Country code redirect](https://developers.cloudflare.com/workers/examples/country-code-redirect/index.md): Redirect a response based on the country code in the header of a visitor.
- [Setting Cron Triggers](https://developers.cloudflare.com/workers/examples/cron-trigger/index.md): Set a Cron Trigger for your Worker.
- [Data loss prevention](https://developers.cloudflare.com/workers/examples/data-loss-prevention/index.md): Protect sensitive data to prevent data loss, and send alerts to a webhooks server in the event of a data breach.
- [Debugging logs](https://developers.cloudflare.com/workers/examples/debugging-logs/index.md): Send debugging information in an errored response to a logging service.
- [Cookie parsing](https://developers.cloudflare.com/workers/examples/extract-cookie-value/index.md): Given the cookie name, get the value of a cookie. You can also use cookies for A/B testing.
- [Fetch HTML](https://developers.cloudflare.com/workers/examples/fetch-html/index.md): Send a request to a remote server, read HTML from the response, and serve that HTML.
- [Fetch JSON](https://developers.cloudflare.com/workers/examples/fetch-json/index.md): Send a GET request and read in JSON from the response. Use to fetch external data.
- [Geolocation: Weather application](https://developers.cloudflare.com/workers/examples/geolocation-app-weather/index.md): Fetch weather data from an API using the user's geolocation data.
- [Geolocation: Custom Styling](https://developers.cloudflare.com/workers/examples/geolocation-custom-styling/index.md): Personalize website styling based on localized user time.
- [Geolocation: Hello World](https://developers.cloudflare.com/workers/examples/geolocation-hello-world/index.md): Get all geolocation data fields and display them in HTML.
- [Hot-link protection](https://developers.cloudflare.com/workers/examples/hot-link-protection/index.md): Block other websites from linking to your content. This is useful for protecting images.
- [Custom Domain with Images](https://developers.cloudflare.com/workers/examples/images-workers/index.md): Set up custom domain for Images using a Worker or serve images using a prefix path and Cloudflare registered domain.
- [Logging headers to console](https://developers.cloudflare.com/workers/examples/logging-headers/index.md): Examine the contents of a Headers object by logging to console with a Map.
- [Modify request property](https://developers.cloudflare.com/workers/examples/modify-request-property/index.md): Create a modified request with edited properties based off of an incoming request.
- [Modify response](https://developers.cloudflare.com/workers/examples/modify-response/index.md): Fetch and modify response properties which are immutable by creating a copy first.
- [Multiple Cron Triggers](https://developers.cloudflare.com/workers/examples/multiple-cron-triggers/index.md): Set multiple Cron Triggers on three different schedules.
- [Stream OpenAI API Responses](https://developers.cloudflare.com/workers/examples/openai-sdk-streaming/index.md): Use the OpenAI v4 SDK to stream responses from OpenAI.
- [Post JSON](https://developers.cloudflare.com/workers/examples/post-json/index.md): Send a POST request with JSON data. Use to share data with external servers.
- [Using timingSafeEqual](https://developers.cloudflare.com/workers/examples/protect-against-timing-attacks/index.md): Protect against timing attacks by safely comparing values using `timingSafeEqual`.
- [Read POST](https://developers.cloudflare.com/workers/examples/read-post/index.md): Serve an HTML form, then read POST requests. Use also to read JSON or POST data from an incoming request.
- [Redirect](https://developers.cloudflare.com/workers/examples/redirect/index.md): Redirect requests from one URL to another or from one set of URLs to another set.
- [Respond with another site](https://developers.cloudflare.com/workers/examples/respond-with-another-site/index.md): Respond to the Worker request with the response from another website (example.com in this example).
- [Return small HTML page](https://developers.cloudflare.com/workers/examples/return-html/index.md): Deliver an HTML page from an HTML string directly inside the Worker script.
- [Return JSON](https://developers.cloudflare.com/workers/examples/return-json/index.md): Return JSON directly from a Worker script, useful for building APIs and middleware.
- [Rewrite links](https://developers.cloudflare.com/workers/examples/rewrite-links/index.md): Rewrite URL links in HTML using the HTMLRewriter. This is useful for JAMstack websites.
- [Set security headers](https://developers.cloudflare.com/workers/examples/security-headers/index.md): Set common security headers (X-XSS-Protection, X-Frame-Options, X-Content-Type-Options, Permissions-Policy, Referrer-Policy, Strict-Transport-Security, Content-Security-Policy).
- [Sign requests](https://developers.cloudflare.com/workers/examples/signing-requests/index.md): Verify a signed request using the HMAC and SHA-256 algorithms or return a 403.
- [Turnstile with Workers](https://developers.cloudflare.com/workers/examples/turnstile-html-rewriter/index.md): Inject [Turnstile](/turnstile/) implicitly into HTML elements using the HTMLRewriter runtime API.
- [Using the WebSockets API](https://developers.cloudflare.com/workers/examples/websockets/index.md): Use the WebSockets API to communicate in real time with your Cloudflare Workers.

### Observability
- [Observability](https://developers.cloudflare.com/workers/observability/index.md)
- [Errors and exceptions](https://developers.cloudflare.com/workers/observability/errors/index.md): Review Workers errors and exceptions.
- [Metrics and analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/index.md): Diagnose issues with Workers metrics, and review request data for a zone with Workers analytics.
- [Query Builder](https://developers.cloudflare.com/workers/observability/query-builder/index.md): Write structured queries to investigate and visualize your telemetry data.
- [Source maps and stack traces](https://developers.cloudflare.com/workers/observability/source-maps/index.md): Adding source maps and generating stack traces for Workers.

### DevTools
- [DevTools](https://developers.cloudflare.com/workers/observability/dev-tools/index.md)
- [Breakpoints](https://developers.cloudflare.com/workers/observability/dev-tools/breakpoints/index.md): Debug your local and deployed Workers using breakpoints.
- [Profiling CPU usage](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/index.md): Learn how to profile CPU usage and ensure CPU-time per request stays under Workers limits
- [Profiling Memory](https://developers.cloudflare.com/workers/observability/dev-tools/memory-usage/index.md)

### Logs
- [Logs](https://developers.cloudflare.com/workers/observability/logs/index.md)
- [Workers Logpush](https://developers.cloudflare.com/workers/observability/logs/logpush/index.md): Send Workers Trace Event Logs to a supported third party, such as a storage or logging provider.
- [Real-time logs](https://developers.cloudflare.com/workers/observability/logs/real-time-logs/index.md): Debug your Worker application by accessing logs and exceptions through the Cloudflare dashboard or `wrangler tail`.
- [Tail Workers](https://developers.cloudflare.com/workers/observability/logs/tail-workers/index.md): Track and log Workers on invocation by assigning a Tail Worker to your projects.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/index.md): Store, filter, and analyze log data emitted from Cloudflare Workers.

### Third-Party Integrations
- [Integrations](https://developers.cloudflare.com/workers/observability/third-party-integrations/index.md)
- [Sentry](https://developers.cloudflare.com/workers/observability/third-party-integrations/sentry/index.md): Connect to a Sentry project from your Worker to automatically send errors and uncaught exceptions to Sentry.

### CI/CD
- [CI/CD](https://developers.cloudflare.com/workers/ci-cd/index.md): Set up continuous integration and continuous deployment for your Workers.

### Builds
- [Builds](https://developers.cloudflare.com/workers/ci-cd/builds/index.md): Use Workers Builds to integrate with Git and automatically build and deploy your Worker when pushing a change
- [Advanced setups](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/index.md): Learn how to use Workers Builds with more advanced setups
- [Build caching](https://developers.cloudflare.com/workers/ci-cd/builds/build-caching/index.md): Improve build times by caching build outputs and dependencies
- [Build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/index.md): Configure which git branches should trigger a Workers Build
- [Build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/index.md): Understand the build image used in Workers Builds.
- [Build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/index.md): Reduce compute for your monorepo by specifying paths for Workers Builds to skip
- [Configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/index.md): Understand the different settings associated with your build.
- [Limits & pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/index.md): Limits & pricing for Workers Builds
- [Troubleshooting builds](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/index.md): Learn how to troubleshoot common and known issues in Workers Builds.

### Git Integration
- [Git integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/index.md): Learn how to add and manage your Git integration for Workers Builds
- [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/index.md): Learn how to manage your GitHub integration for Workers Builds
- [GitLab integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/gitlab-integration/index.md): Learn how to manage your GitLab integration for Workers Builds

### External CI/CD
- [External CI/CD](https://developers.cloudflare.com/workers/ci-cd/external-cicd/index.md): Integrate Workers development into your existing continuous integration and continuous development workflows, such as GitHub Actions or GitLab Pipelines.
- [GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/index.md): Integrate Workers development into your existing GitHub Actions workflows.
- [GitLab CI/CD](https://developers.cloudflare.com/workers/ci-cd/external-cicd/gitlab-cicd/index.md): Integrate Workers development into your existing GitLab Pipelines workflows.

### Testing
- [Testing](https://developers.cloudflare.com/workers/testing/index.md)
- [Wrangler's unstable_startWorker()](https://developers.cloudflare.com/workers/testing/unstable_startworker/index.md): Write integration tests using Wrangler's `unstable_startWorker()` API

### Miniflare
- [Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/index.md)
- [Get Started](https://developers.cloudflare.com/workers/testing/miniflare/get-started/index.md)
- [Writing tests](https://developers.cloudflare.com/workers/testing/miniflare/writing-tests/index.md): Write integration tests against Workers using Miniflare.

### Miniflare Core
- [Core](https://developers.cloudflare.com/workers/testing/miniflare/core/index.md)
- [📅 Compatibility Dates](https://developers.cloudflare.com/workers/testing/miniflare/core/compatibility/index.md)
- [🔨 Fetch Events](https://developers.cloudflare.com/workers/testing/miniflare/core/fetch/index.md)
- [📚 Modules](https://developers.cloudflare.com/workers/testing/miniflare/core/modules/index.md)
- [🔌 Multiple Workers](https://developers.cloudflare.com/workers/testing/miniflare/core/multiple-workers/index.md)
- [🚥 Queues](https://developers.cloudflare.com/workers/testing/miniflare/core/queues/index.md)
- [⏰ Scheduled Events](https://developers.cloudflare.com/workers/testing/miniflare/core/scheduled/index.md)
- [🕸 Web Standards](https://developers.cloudflare.com/workers/testing/miniflare/core/standards/index.md)
- [🔑 Variables and Secrets](https://developers.cloudflare.com/workers/testing/miniflare/core/variables-secrets/index.md)
- [✉️ WebSockets](https://developers.cloudflare.com/workers/testing/miniflare/core/web-sockets/index.md)

### Miniflare Storage
- [Storage](https://developers.cloudflare.com/workers/testing/miniflare/storage/index.md)
- [✨ Cache](https://developers.cloudflare.com/workers/testing/miniflare/storage/cache/index.md)
- [💾 D1](https://developers.cloudflare.com/workers/testing/miniflare/storage/d1/index.md)
- [🔌 Durable Objects](https://developers.cloudflare.com/workers/testing/miniflare/storage/durable-objects/index.md)
- [📦 KV](https://developers.cloudflare.com/workers/testing/miniflare/storage/kv/index.md)
- [🪣 R2](https://developers.cloudflare.com/workers/testing/miniflare/storage/r2/index.md)

### Miniflare Developing
- [Developing](https://developers.cloudflare.com/workers/testing/miniflare/developing/index.md)
- [🛠 Attaching a Debugger](https://developers.cloudflare.com/workers/testing/miniflare/developing/debugger/index.md)
- [⚡️ Live Reload](https://developers.cloudflare.com/workers/testing/miniflare/developing/live-reload/index.md)

### Miniflare Migrations
- [Migrations](https://developers.cloudflare.com/workers/testing/miniflare/migrations/index.md): Review migration guides for specific versions of Miniflare.
- [⬆️ Migrating from Version 2](https://developers.cloudflare.com/workers/testing/miniflare/migrations/from-v2/index.md)

### Vitest Integration
- [Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/index.md)
- [Write your first test](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/index.md): Write tests against Workers using Vitest
- [Configuration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/index.md): Vitest configuration specific to the Workers integration.
- [Debugging](https://developers.cloudflare.com/workers/testing/vitest-integration/debugging/index.md): Debug your Workers tests with Vitest.
- [Isolation and concurrency](https://developers.cloudflare.com/workers/testing/vitest-integration/isolation-and-concurrency/index.md): Review how the Workers Vitest integration runs your tests, how it isolates tests from each other, and how it imports modules.
- [Known issues](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/index.md): Explore the known issues associated with the Workers Vitest integration.
- [Recipes and examples](https://developers.cloudflare.com/workers/testing/vitest-integration/recipes/index.md): Examples that demonstrate how to write unit and integration tests with the Workers Vitest integration.
- [Test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/index.md): Runtime helpers for writing tests, exported from the `cloudflare:test` module.

### Vitest Migration
- [Migration guides](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/index.md): Migrate to using the Workers Vitest integration.
- [Migrate from Miniflare 2's test environments](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-miniflare-2/index.md): Migrate from [Miniflare 2](https://github.com/cloudflare/miniflare?tab=readme-ov-file) to the Workers Vitest integration.
- [Migrate from unstable_dev](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-unstable-dev/index.md): Migrate from the [`unstable_dev`](/workers/wrangler/api/#unstable_dev) API to writing tests with the Workers Vitest integration.

### Vite Plugin
- [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/index.md): A full-featured integration between Vite and the Workers runtime
- [Get started](https://developers.cloudflare.com/workers/vite-plugin/get-started/index.md): Get started with the Vite plugin
- [Tutorial - React SPA with an API](https://developers.cloudflare.com/workers/vite-plugin/tutorial/index.md): Create a React SPA with an API Worker using the Vite plugin

### Vite Plugin Reference
- [Reference](https://developers.cloudflare.com/workers/vite-plugin/reference/index.md)
- [API](https://developers.cloudflare.com/workers/vite-plugin/reference/api/index.md): Vite plugin API
- [Cloudflare Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/index.md): Using Cloudflare environments with the Vite plugin
- [Debugging](https://developers.cloudflare.com/workers/vite-plugin/reference/debugging/index.md): Debugging with the Vite plugin
- [Migrating from wrangler dev](https://developers.cloudflare.com/workers/vite-plugin/reference/migrating-from-wrangler-dev/index.md): Migrating from wrangler dev to the Vite plugin
- [Secrets](https://developers.cloudflare.com/workers/vite-plugin/reference/secrets/index.md): Using secrets with the Vite plugin
- [Static Assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/index.md): Static assets and the Vite plugin
- [Vite Environments](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/index.md): Vite environments and the Vite plugin

### Wrangler
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/index.md)
- [Install/Update Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/index.md): Get started by installing Wrangler, and update to newer versions by following this guide.
- [API](https://developers.cloudflare.com/workers/wrangler/api/index.md): A set of programmatic APIs that can be integrated with local Cloudflare Workers-related workflows.
- [Bundling](https://developers.cloudflare.com/workers/wrangler/bundling/index.md): Review Wrangler's default bundling.
- [Commands](https://developers.cloudflare.com/workers/wrangler/commands/index.md): Create, develop, and deploy your Cloudflare Workers with Wrangler commands.
- [Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/index.md): Use a configuration file to customize the development and deployment setup for your Worker project and other Developer Platform products.
- [Custom builds](https://developers.cloudflare.com/workers/wrangler/custom-builds/index.md): Customize how your code is compiled, before being processed by Wrangler.
- [Deprecations](https://developers.cloudflare.com/workers/wrangler/deprecations/index.md): The differences between Wrangler versions, specifically deprecations and breaking changes.
- [Environments](https://developers.cloudflare.com/workers/wrangler/environments/index.md): Use environments to create different configurations for the same Worker application.
- [System environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/index.md): Local environment variables that can change Wrangler's behavior.

### Wrangler Migration
- [Migrations](https://developers.cloudflare.com/workers/wrangler/migration/index.md): Review migration guides for specific versions of Wrangler.
- [Migrate from Wrangler v2 to v3](https://developers.cloudflare.com/workers/wrangler/migration/update-v2-to-v3/index.md)
- [Migrate from Wrangler v3 to v4](https://developers.cloudflare.com/workers/wrangler/migration/update-v3-to-v4/index.md)

### Wrangler v1 to v2 Migration
- [Migrate from Wrangler v1 to v2](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/index.md)
- [1. Migrate webpack projects](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/eject-webpack/index.md)
- [2. Update to Wrangler v2](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/update-v1-to-v2/index.md)

### Wrangler v1 (Legacy)
- [Wrangler v1 (legacy)](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/index.md)
- [Authentication](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/authentication/index.md)
- [Commands](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/commands/index.md)
- [Configuration](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/configuration/index.md): Learn how to configure your Cloudflare Worker using Wrangler v1. This guide covers top-level and environment-specific settings, key types, and deployment options.
- [Install / Update](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/install-update/index.md)
- [Webpack](https://developers.cloudflare.com/workers/wrangler/migration/v1-to-v2/wrangler-legacy/webpack/index.md): Learn how to migrate from Wrangler v1 to v2 using webpack. This guide covers configuration, custom builds, and compatibility for Cloudflare Workers.

### Tutorials
- [Tutorials](https://developers.cloudflare.com/workers/tutorials/index.md)
- [Automate analytics reporting with Cloudflare Workers and email routing](https://developers.cloudflare.com/workers/tutorials/automated-analytics-reporting/index.md)
- [Build a todo list Jamstack application](https://developers.cloudflare.com/workers/tutorials/build-a-jamstack-app/index.md)
- [Build a QR code generator](https://developers.cloudflare.com/workers/tutorials/build-a-qr-code-generator/index.md)
- [Build a Slackbot](https://developers.cloudflare.com/workers/tutorials/build-a-slackbot/index.md)
- [Connect to and query your Turso database using Workers](https://developers.cloudflare.com/workers/tutorials/connect-to-turso-using-workers/index.md)
- [Create a fine-tuned OpenAI model with R2](https://developers.cloudflare.com/workers/tutorials/create-finetuned-chatgpt-ai-models-with-r2/index.md): In this tutorial, you will use the OpenAI API and Cloudflare R2 to create a fine-tuned model.
- [Deploy a real-time chat application](https://developers.cloudflare.com/workers/tutorials/deploy-a-realtime-chat-app/index.md)
- [Generate YouTube thumbnails with Workers and Cloudflare Image Resizing](https://developers.cloudflare.com/workers/tutorials/generate-youtube-thumbnails-with-workers-and-images/index.md)
- [GitHub SMS notifications using Twilio](https://developers.cloudflare.com/workers/tutorials/github-sms-notifications-using-twilio/index.md)
- [Handle form submissions with Airtable](https://developers.cloudflare.com/workers/tutorials/handle-form-submissions-with-airtable/index.md)
- [Build Live Cursors with Next.js, RPC and Durable Objects](https://developers.cloudflare.com/workers/tutorials/live-cursors-with-nextjs-rpc-do/index.md)
- [Connect to a MySQL database with Cloudflare Workers](https://developers.cloudflare.com/workers/tutorials/mysql/index.md)
- [OpenAI GPT function calling with JavaScript and Cloudflare Workers](https://developers.cloudflare.com/workers/tutorials/openai-function-calls-workers/index.md): Build a project that leverages OpenAI's function calling feature, available in OpenAI's latest Chat Completions API models.
- [Send Emails With Postmark](https://developers.cloudflare.com/workers/tutorials/send-emails-with-postmark/index.md)
- [Connect to a PostgreSQL database with Cloudflare Workers](https://developers.cloudflare.com/workers/tutorials/postgres/index.md)
- [Send Emails With Resend](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/index.md)
- [Securely access and upload assets with Cloudflare R2](https://developers.cloudflare.com/workers/tutorials/upload-assets-with-r2/index.md)
- [Set up and use a Prisma Postgres database](https://developers.cloudflare.com/workers/tutorials/using-prisma-postgres-with-workers/index.md)
- [Use Workers KV directly from Rust](https://developers.cloudflare.com/workers/tutorials/workers-kv-from-rust/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/workers/platform/index.md)
- [Betas](https://developers.cloudflare.com/workers/platform/betas/index.md): Cloudflare developer platform and Workers features beta status.
- [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/index.md): Set up a Deploy to Cloudflare button
- [Infrastructure as Code (IaC)](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/index.md)
- [Known issues](https://developers.cloudflare.com/workers/platform/known-issues/index.md): Known issues and bugs to be aware of when using Workers.
- [Limits](https://developers.cloudflare.com/workers/platform/limits/index.md): Cloudflare Workers plan and platform limits.
- [Pricing](https://developers.cloudflare.com/workers/platform/pricing/index.md): Workers plans and pricing information.
- [Choose a data or storage product](https://developers.cloudflare.com/workers/platform/storage-options/index.md): Storage and database options available on Cloudflare's developer platform.
- [Workers for Platforms](https://developers.cloudflare.com/workers/platform/workers-for-platforms/index.md): Deploy custom code on behalf of your users or let your users directly deploy their own code to your platform, managing infrastructure.

### Platform Changelog
- [Changelog](https://developers.cloudflare.com/workers/platform/changelog/index.md): Review recent changes to Cloudflare Workers.
- [Workers (Historic)](https://developers.cloudflare.com/workers/platform/changelog/historical-changelog/index.md): Review pre-2023 changes to Cloudflare Workers.
- [Wrangler](https://developers.cloudflare.com/workers/platform/changelog/wrangler/index.md)

### Reference
- [Reference](https://developers.cloudflare.com/workers/reference/index.md)
- [How the Cache works](https://developers.cloudflare.com/workers/reference/how-the-cache-works/index.md): How Workers interacts with the Cloudflare cache.
- [Migrate from Service Workers to ES Modules](https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/index.md): Write your Worker code in ES modules syntax for an optimized experience.
- [Protocols](https://developers.cloudflare.com/workers/reference/protocols/index.md): Supported protocols on the Workers platform.
- [Security model](https://developers.cloudflare.com/workers/reference/security-model/index.md)

## Workers AI - Run AI Models at the Edge

### Getting Started
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/index.md)
- [Getting started](https://developers.cloudflare.com/workers-ai/get-started/index.md)
- [Dashboard](https://developers.cloudflare.com/workers-ai/get-started/dashboard/index.md)
- [REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/index.md): Use the Cloudflare Workers AI REST API to deploy a large language model (LLM).
- [Workers Bindings](https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/index.md): Deploy your first Cloudflare Workers AI project using the CLI.
- [Playground](https://developers.cloudflare.com/workers-ai/playground/index.md)

### Configuration
- [Configuration](https://developers.cloudflare.com/workers-ai/configuration/index.md)
- [Vercel AI SDK](https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/index.md)
- [Workers Bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/index.md)
- [Hugging Face Chat UI](https://developers.cloudflare.com/workers-ai/configuration/hugging-face-chat-ui/index.md)
- [OpenAI compatible API endpoints](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/index.md)

### Features
- [Features](https://developers.cloudflare.com/workers-ai/features/index.md)
- [Asynchronous Batch API](https://developers.cloudflare.com/workers-ai/features/batch-api/index.md)
- [Workers Binding](https://developers.cloudflare.com/workers-ai/features/batch-api/workers-binding/index.md)
- [REST API](https://developers.cloudflare.com/workers-ai/features/batch-api/rest-api/index.md)
- [Fine-tunes](https://developers.cloudflare.com/workers-ai/features/fine-tunes/index.md)
- [Using LoRA adapters](https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/index.md): Upload and use LoRA adapters to get fine-tuned inference on Workers AI.
- [Public LoRA adapters](https://developers.cloudflare.com/workers-ai/features/fine-tunes/public-loras/index.md): Cloudflare offers a few public LoRA adapters that are immediately ready for use.
- [Function calling](https://developers.cloudflare.com/workers-ai/features/function-calling/index.md)
- [Traditional](https://developers.cloudflare.com/workers-ai/features/function-calling/traditional/index.md)
- [Embedded](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/index.md)
- [Get Started](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/get-started/index.md)
- [API Reference](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/api-reference/index.md)
- [Troubleshooting](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/troubleshooting/index.md)
- [Examples](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/examples/index.md)
- [Use fetch() handler](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/examples/fetch/index.md): Learn how to use the fetch() handler in Cloudflare Workers AI to enable LLMs to perform API calls, like retrieving a 5-day weather forecast using function calling.
- [Use KV API](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/examples/kv/index.md): Learn how to use Cloudflare Workers AI to interact with KV storage, enabling persistent data handling with embedded function calling in a few lines of code.
- [Tools based on OpenAPI Spec](https://developers.cloudflare.com/workers-ai/features/function-calling/embedded/examples/openapi/index.md)
- [JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/index.md)
- [Markdown Conversion](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/index.md)
- [Prompting](https://developers.cloudflare.com/workers-ai/features/prompting/index.md)

### Guides
- [Guides](https://developers.cloudflare.com/workers-ai/guides/index.md)
- [Agents](https://developers.cloudflare.com/workers-ai/guides/agents/index.md): Build AI-powered Agents on Cloudflare
- [Demos and architectures](https://developers.cloudflare.com/workers-ai/guides/demos-architectures/index.md)

### Tutorials
- [Tutorials](https://developers.cloudflare.com/workers-ai/guides/tutorials/index.md)
- [Build a Retrieval Augmented Generation (RAG) AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/index.md): Build your first AI app with Cloudflare AI. This guide uses Workers AI, Vectorize, D1, and Cloudflare Workers.
- [Build a Voice Notes App with auto transcriptions using Workers AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-voice-notes-app-with-auto-transcription/index.md): Explore how you can use AI models to transcribe audio recordings and post process the transcriptions.
- [Whisper-large-v3-turbo with Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-workers-ai-whisper-with-chunking/index.md): Learn how to transcribe large audio files using Workers AI.
- [Build an interview practice tool with Workers AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-ai-interview-practice-tool/index.md): Learn how to build an AI-powered interview practice tool that provides real-time feedback to help improve interview skills.
- [Explore Code Generation Using DeepSeek Coder Models](https://developers.cloudflare.com/workers-ai/guides/tutorials/explore-code-generation-using-deepseek-coder-models/index.md): Explore how you can use AI models to generate code and work more efficiently.
- [Explore Workers AI Models Using a Jupyter Notebook](https://developers.cloudflare.com/workers-ai/guides/tutorials/explore-workers-ai-models-using-a-jupyter-notebook/index.md): This Jupyter notebook explores various models (including Whisper, Distilled BERT, LLaVA, and Meta Llama 3) using Python and the requests library.
- [Fine Tune Models With AutoTrain from HuggingFace](https://developers.cloudflare.com/workers-ai/guides/tutorials/fine-tune-models-with-autotrain/index.md): Fine-tuning AI models with LoRA adapters on Workers AI allows adding custom training data, like for LLM finetuning.
- [Choose the Right Text Generation Model](https://developers.cloudflare.com/workers-ai/guides/tutorials/how-to-choose-the-right-text-generation-model/index.md): There's a wide range of text generation models available through Workers AI. In an effort to aid you in your journey of finding the right model, this notebook will help you get to know your options in a speed dating type of scenario.
- [How to Build an Image Generator using Workers AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/image-generation-playground/index.md): Learn how to build an image generator using Workers AI.
- [Build an AI Image Generator Playground (Part 1)](https://developers.cloudflare.com/workers-ai/guides/tutorials/image-generation-playground/image-generator-flux/index.md)
- [Add New AI Models to your Playground (Part 2)](https://developers.cloudflare.com/workers-ai/guides/tutorials/image-generation-playground/image-generator-flux-newmodels/index.md)
- [Store and Catalog AI Generated Images with R2 (Part 3)](https://developers.cloudflare.com/workers-ai/guides/tutorials/image-generation-playground/image-generator-store-and-catalog/index.md)
- [Llama 3.2 11B Vision Instruct model on Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/llama-vision-tutorial/index.md): Learn how to use the Llama 3.2 11B Vision Instruct model on Cloudflare Workers AI.
- [Using BigQuery with Workers AI](https://developers.cloudflare.com/workers-ai/guides/tutorials/using-bigquery-with-workers-ai/index.md): Learn how to ingest data stored outside of Cloudflare as an input to Workers AI models.

### Platform
- [Platform](https://developers.cloudflare.com/workers-ai/platform/index.md)
- [AI Gateway](https://developers.cloudflare.com/workers-ai/platform/ai-gateway/index.md)
- [Data usage](https://developers.cloudflare.com/workers-ai/platform/data-usage/index.md)
- [Errors](https://developers.cloudflare.com/workers-ai/platform/errors/index.md)
- [Glossary](https://developers.cloudflare.com/workers-ai/platform/glossary/index.md)
- [Limits](https://developers.cloudflare.com/workers-ai/platform/limits/index.md)
- [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/index.md)
- [Choose a data or storage product](https://developers.cloudflare.com/workers-ai/platform/storage-options/index.md)

### Reference
- [Models](https://developers.cloudflare.com/workers-ai/models/index.md)
- [Agents](https://developers.cloudflare.com/workers-ai/agents/index.md)
- [REST API reference](https://developers.cloudflare.com/workers-ai/api-reference/index.md)
- [Changelog](https://developers.cloudflare.com/workers-ai/changelog/index.md): Review recent changes to Cloudflare Workers AI.

## Durable Objects - Stateful Serverless

### Overview
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/index.md)
- [Getting started](https://developers.cloudflare.com/durable-objects/get-started/index.md)
- [Demos and architectures](https://developers.cloudflare.com/durable-objects/demos/index.md)
- [Videos](https://developers.cloudflare.com/durable-objects/video-tutorials/index.md)
- [Release notes](https://developers.cloudflare.com/durable-objects/release-notes/index.md)

### Concepts
- [Concepts](https://developers.cloudflare.com/durable-objects/concepts/index.md)
- [What are Durable Objects?](https://developers.cloudflare.com/durable-objects/concepts/what-are-durable-objects/index.md)
- [Lifecycle of a Durable Object](https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/index.md)

### API
- [Workers Binding API](https://developers.cloudflare.com/durable-objects/api/index.md)
- [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/index.md)
- [Durable Object Base Class](https://developers.cloudflare.com/durable-objects/api/base/index.md)
- [Durable Object Container](https://developers.cloudflare.com/durable-objects/api/container/index.md)
- [Durable Object ID](https://developers.cloudflare.com/durable-objects/api/id/index.md)
- [Durable Object Namespace](https://developers.cloudflare.com/durable-objects/api/namespace/index.md)
- [Durable Object State](https://developers.cloudflare.com/durable-objects/api/state/index.md)
- [Durable Object Storage](https://developers.cloudflare.com/durable-objects/api/storage-api/index.md)
- [Durable Object Stub](https://developers.cloudflare.com/durable-objects/api/stub/index.md)
- [WebGPU](https://developers.cloudflare.com/durable-objects/api/webgpu/index.md)
- [Rust API](https://developers.cloudflare.com/durable-objects/api/workers-rs/index.md)

### Best Practices
- [Best practices](https://developers.cloudflare.com/durable-objects/best-practices/index.md)
- [Access Durable Objects Storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/index.md)
- [Invoke methods](https://developers.cloudflare.com/durable-objects/best-practices/create-durable-object-stubs-and-send-requests/index.md)
- [Error handling](https://developers.cloudflare.com/durable-objects/best-practices/error-handling/index.md)
- [Use WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md)

### Examples
- [Examples](https://developers.cloudflare.com/durable-objects/examples/index.md)
- [Agents](https://developers.cloudflare.com/durable-objects/examples/agents/index.md): Build AI-powered Agents on Cloudflare
- [Use the Alarms API](https://developers.cloudflare.com/durable-objects/examples/alarms-api/index.md): Use the Durable Objects Alarms API to batch requests to a Durable Object.
- [Build a counter](https://developers.cloudflare.com/durable-objects/examples/build-a-counter/index.md): Build a counter using Durable Objects and Workers with RPC methods.
- [Build a rate limiter](https://developers.cloudflare.com/durable-objects/examples/build-a-rate-limiter/index.md): Build a rate limiter using Durable Objects and Workers.
- [Durable Object in-memory state](https://developers.cloudflare.com/durable-objects/examples/durable-object-in-memory-state/index.md): Create a Durable Object that stores the last location it was accessed from in-memory.
- [Durable Object Time To Live](https://developers.cloudflare.com/durable-objects/examples/durable-object-ttl/index.md): Use the Durable Objects Alarms API to implement a Time To Live (TTL) for Durable Object instances.
- [Use ReadableStream with Durable Object and Workers](https://developers.cloudflare.com/durable-objects/examples/readable-stream/index.md): Stream ReadableStream from Durable Objects.
- [Use RpcTarget class to handle Durable Object metadata](https://developers.cloudflare.com/durable-objects/examples/reference-do-name-using-init/index.md): Access the name from within a Durable Object using RpcTarget.
- [Testing with Durable Objects](https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/index.md): Write tests for Durable Objects.
- [Use Workers KV from Durable Objects](https://developers.cloudflare.com/durable-objects/examples/use-kv-from-durable-objects/index.md): Read and write to/from KV within a Durable Object
- [Build a WebSocket server with WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/index.md): Build a WebSocket server using WebSocket Hibernation on Durable Objects and Workers.
- [Build a WebSocket server](https://developers.cloudflare.com/durable-objects/examples/websocket-server/index.md): Build a WebSocket server using Durable Objects and Workers.

### Observability
- [Observability](https://developers.cloudflare.com/durable-objects/observability/index.md)
- [Metrics and GraphQL analytics](https://developers.cloudflare.com/durable-objects/observability/graphql-analytics/index.md)
- [Troubleshooting](https://developers.cloudflare.com/durable-objects/observability/troubleshooting/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/durable-objects/platform/index.md)
- [Known issues](https://developers.cloudflare.com/durable-objects/platform/known-issues/index.md)
- [Limits](https://developers.cloudflare.com/durable-objects/platform/limits/index.md)
- [Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/index.md)
- [Choose a data or storage product](https://developers.cloudflare.com/durable-objects/platform/storage-options/index.md)

### Reference
- [Reference](https://developers.cloudflare.com/durable-objects/reference/index.md)
- [Data location](https://developers.cloudflare.com/durable-objects/reference/data-location/index.md)
- [Data security](https://developers.cloudflare.com/durable-objects/reference/data-security/index.md)
- [Gradual Deployments](https://developers.cloudflare.com/durable-objects/reference/durable-object-gradual-deployments/index.md): Gradually deploy changes to Durable Objects.
- [Durable Objects migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/index.md)
- [Environments](https://developers.cloudflare.com/durable-objects/reference/environments/index.md)
- [FAQs](https://developers.cloudflare.com/durable-objects/reference/faq/index.md)
- [Glossary](https://developers.cloudflare.com/durable-objects/reference/glossary/index.md)
- [In-memory state in a Durable Object](https://developers.cloudflare.com/durable-objects/reference/in-memory-state/index.md)

### Tutorials
- [Tutorials](https://developers.cloudflare.com/durable-objects/tutorials/index.md)
- [Build a seat booking app with SQLite in Durable Objects](https://developers.cloudflare.com/durable-objects/tutorials/build-a-seat-booking-app/index.md)

### REST API
- [REST API](https://developers.cloudflare.com/durable-objects/durable-objects-rest-api/index.md)

## Workflows - Orchestration and Automation

### Overview
- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/index.md)
- [Get started](https://developers.cloudflare.com/workflows/get-started/index.md)
- [CLI quick start](https://developers.cloudflare.com/workflows/get-started/cli-quick-start/index.md)
- [Guide](https://developers.cloudflare.com/workflows/get-started/guide/index.md)
- [Videos](https://developers.cloudflare.com/workflows/videos/index.md)

### Build with Workflows
- [Build with Workflows](https://developers.cloudflare.com/workflows/build/index.md)
- [Call Workflows from Pages](https://developers.cloudflare.com/workflows/build/call-workflows-from-pages/index.md)
- [Events and parameters](https://developers.cloudflare.com/workflows/build/events-and-parameters/index.md)
- [Local Development](https://developers.cloudflare.com/workflows/build/local-development/index.md)
- [Rules of Workflows](https://developers.cloudflare.com/workflows/build/rules-of-workflows/index.md)
- [Sleeping and retrying](https://developers.cloudflare.com/workflows/build/sleeping-and-retrying/index.md)
- [Trigger Workflows](https://developers.cloudflare.com/workflows/build/trigger-workflows/index.md)
- [Workers API](https://developers.cloudflare.com/workflows/build/workers-api/index.md)

### Examples
- [Examples](https://developers.cloudflare.com/workflows/examples/index.md)
- [Agents](https://developers.cloudflare.com/workflows/examples/agents/index.md): Build AI-powered Agents on Cloudflare
- [Export and save D1 database](https://developers.cloudflare.com/workflows/examples/backup-d1/index.md): Send invoice when shopping cart is checked out and paid for
- [Pay cart and send invoice](https://developers.cloudflare.com/workflows/examples/send-invoices/index.md): Send invoice when shopping cart is checked out and paid for
- [Integrate Workflows with Twilio](https://developers.cloudflare.com/workflows/examples/twilio/index.md): Integrate Workflows with Twilio. Learn how to receive and send text messages and phone calls via APIs and Webhooks.
- [Human-in-the-Loop Image Tagging with waitForEvent](https://developers.cloudflare.com/workflows/examples/wait-for-event/index.md): Human-in-the-loop Workflow with waitForEvent API

### Python SDK
- [Python Workflows SDK](https://developers.cloudflare.com/workflows/python/index.md)
- [Interact with a Workflow](https://developers.cloudflare.com/workflows/python/bindings/index.md)
- [DAG Workflows](https://developers.cloudflare.com/workflows/python/dag/index.md)
- [Python Workers API](https://developers.cloudflare.com/workflows/python/python-workers-api/index.md)

### Observability
- [Observability](https://developers.cloudflare.com/workflows/observability/index.md)
- [Metrics and analytics](https://developers.cloudflare.com/workflows/observability/metrics-analytics/index.md)

### Reference
- [Platform](https://developers.cloudflare.com/workflows/reference/index.md)
- [Changelog](https://developers.cloudflare.com/workflows/reference/changelog/index.md)
- [Glossary](https://developers.cloudflare.com/workflows/reference/glossary/index.md)
- [Limits](https://developers.cloudflare.com/workflows/reference/limits/index.md)
- [Pricing](https://developers.cloudflare.com/workflows/reference/pricing/index.md)
- [Wrangler commands](https://developers.cloudflare.com/workflows/reference/wrangler-commands/index.md)

### API
- [Workflows REST API](https://developers.cloudflare.com/workflows/workflows-api/index.md)

## Workers Analytics Engine - Real-time Analytics

### Overview
- [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/index.md)
- [Get started](https://developers.cloudflare.com/analytics/analytics-engine/get-started/index.md)

### Usage
- [Querying from a Worker](https://developers.cloudflare.com/analytics/analytics-engine/worker-querying/index.md)
- [Querying from Grafana](https://developers.cloudflare.com/analytics/analytics-engine/grafana/index.md)
- [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/index.md): The SQL API for Workers Analytics Engine
- [SQL Reference](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/index.md)

### Features
- [Sampling with WAE](https://developers.cloudflare.com/analytics/analytics-engine/sampling/index.md): How data written to Workers Analytics Engine is automatically sampled at scale

### Examples
- [Examples](https://developers.cloudflare.com/analytics/analytics-engine/recipes/index.md)
- [Usage-based billing](https://developers.cloudflare.com/analytics/analytics-engine/recipes/usage-based-billing-for-your-saas-product/index.md): How to use Workers Analytics Engine to build usage-based billing into your SaaS product

### Platform
- [Limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/index.md)
- [Pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/index.md): Workers Analytics Engine is priced based on two metrics – data points written, and read queries.

## Containers - Deploy Container-based Applications

### Overview
- [Containers (Beta)](https://developers.cloudflare.com/containers/index.md)
- [Getting started](https://developers.cloudflare.com/containers/get-started/index.md)
- [Beta Info & Roadmap](https://developers.cloudflare.com/containers/beta-info/index.md)
- [Frequently Asked Questions](https://developers.cloudflare.com/containers/faq/index.md)

### Core Concepts
- [Architecture](https://developers.cloudflare.com/containers/architecture/index.md)
- [Container Package](https://developers.cloudflare.com/containers/container-package/index.md)
- [Durable Object Interface](https://developers.cloudflare.com/containers/durable-object-methods/index.md)
- [Image Management](https://developers.cloudflare.com/containers/image-management/index.md)
- [Scaling and Routing](https://developers.cloudflare.com/containers/scaling-and-routing/index.md)

### Development
- [Local Development](https://developers.cloudflare.com/containers/local-dev/index.md)
- [Wrangler Commands](https://developers.cloudflare.com/containers/wrangler-commands/index.md)
- [Wrangler Configuration](https://developers.cloudflare.com/containers/wrangler-configuration/index.md)

### Examples
- [Examples](https://developers.cloudflare.com/containers/examples/index.md)
- [Static Frontend, Container Backend](https://developers.cloudflare.com/containers/examples/container-backend/index.md): A simple frontend app with a containerized backend
- [Cron Container](https://developers.cloudflare.com/containers/examples/cron/index.md): Running a container on a schedule using Cron Triggers
- [Using Durable Objects Directly](https://developers.cloudflare.com/containers/examples/durable-object-interface/index.md): Various examples calling Containers directly from Durable Objects
- [Env Vars and Secrets](https://developers.cloudflare.com/containers/examples/env-vars-and-secrets/index.md): Pass in environment variables and secrets to your container
- [Stateless Instances](https://developers.cloudflare.com/containers/examples/stateless/index.md): Run multiple instances across Cloudflare's network
- [Status Hooks](https://developers.cloudflare.com/containers/examples/status-hooks/index.md): Execute Workers code in reaction to Container status changes
- [Websocket to Container](https://developers.cloudflare.com/containers/examples/websocket/index.md): Forwarding a Websocket request to a Container

### Platform
- [Platform](https://developers.cloudflare.com/containers/platform-details/index.md)
- [Pricing](https://developers.cloudflare.com/containers/pricing/index.md)

## Constellation - Distributed Inference

### Overview
- [Overview](https://developers.cloudflare.com/constellation/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/constellation/platform/index.md)
- [Client API](https://developers.cloudflare.com/constellation/platform/client-api/index.md)