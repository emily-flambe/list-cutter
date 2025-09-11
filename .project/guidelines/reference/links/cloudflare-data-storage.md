# Cloudflare Data Storage Documentation

Comprehensive documentation links for Cloudflare's data storage solutions including distributed SQLite databases, key-value storage, object storage, data catalogs, and vector databases for AI applications.

## D1 - Distributed SQLite Database

### Getting Started
- [Getting started](https://developers.cloudflare.com/d1/get-started/index.md)
- [Cloudflare D1](https://developers.cloudflare.com/d1/index.md)

### API Reference
- [REST API](https://developers.cloudflare.com/d1/d1-api/index.md)
- [SQL API](https://developers.cloudflare.com/d1/sql-api/index.md)
- [Workers Binding API](https://developers.cloudflare.com/d1/worker-api/index.md)
- [D1 Database](https://developers.cloudflare.com/d1/worker-api/d1-database/index.md)
- [Return objects](https://developers.cloudflare.com/d1/worker-api/return-object/index.md)
- [Prepared statement methods](https://developers.cloudflare.com/d1/worker-api/prepared-statements/index.md)

### SQL Features
- [SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/index.md)
- [Define foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/index.md)
- [Query JSON](https://developers.cloudflare.com/d1/sql-api/query-json/index.md)
- [Generated columns](https://developers.cloudflare.com/d1/reference/generated-columns/index.md)

### Configuration
- [Configuration](https://developers.cloudflare.com/d1/configuration/index.md)
- [Data location](https://developers.cloudflare.com/d1/configuration/data-location/index.md)
- [Environments](https://developers.cloudflare.com/d1/configuration/environments/index.md)

### Best Practices
- [Best practices](https://developers.cloudflare.com/d1/best-practices/index.md)
- [Import and export data](https://developers.cloudflare.com/d1/best-practices/import-export-data/index.md)
- [Local development](https://developers.cloudflare.com/d1/best-practices/local-development/index.md)
- [Query a database](https://developers.cloudflare.com/d1/best-practices/query-d1/index.md)
- [Remote development](https://developers.cloudflare.com/d1/best-practices/remote-development/index.md)
- [Global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/index.md)
- [Use D1 from Pages](https://developers.cloudflare.com/d1/best-practices/use-d1-from-pages/index.md)
- [Use indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/index.md)

### Examples and Tutorials
- [Demos and architectures](https://developers.cloudflare.com/d1/demos/index.md)
- [Examples](https://developers.cloudflare.com/d1/examples/index.md)
- [Query D1 from Hono](https://developers.cloudflare.com/d1/examples/d1-and-hono/index.md): Query D1 from the Hono web framework
- [Query D1 from Remix](https://developers.cloudflare.com/d1/examples/d1-and-remix/index.md): Query your D1 database from a Remix application.
- [Query D1 from SvelteKit](https://developers.cloudflare.com/d1/examples/d1-and-sveltekit/index.md): Query a D1 database from a SvelteKit application.
- [Export and save D1 database](https://developers.cloudflare.com/d1/examples/export-d1-into-r2/index.md)
- [Query D1 from Python Workers](https://developers.cloudflare.com/d1/examples/query-d1-from-python-workers/index.md): Learn how to query D1 from a Python Worker
- [Tutorials](https://developers.cloudflare.com/d1/tutorials/index.md)
- [Build a Comments API](https://developers.cloudflare.com/d1/tutorials/build-a-comments-api/index.md)
- [Build a Staff Directory Application](https://developers.cloudflare.com/d1/tutorials/build-a-staff-directory-app/index.md): Build a staff directory using D1. Users access employee info; admins add new employees within the app.
- [Query D1 using Prisma ORM](https://developers.cloudflare.com/d1/tutorials/d1-and-prisma-orm/index.md)
- [Build an API to access D1 using a proxy Worker](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/index.md)
- [Bulk import to D1 using REST API](https://developers.cloudflare.com/d1/tutorials/import-to-d1-with-rest-api/index.md)
- [Using D1 Read Replication for your e-commerce website](https://developers.cloudflare.com/d1/tutorials/using-read-replication-for-e-com/index.md)

### Observability
- [Observability](https://developers.cloudflare.com/d1/observability/index.md)
- [Audit Logs](https://developers.cloudflare.com/d1/observability/audit-logs/index.md)
- [Billing](https://developers.cloudflare.com/d1/observability/billing/index.md)
- [Debug D1](https://developers.cloudflare.com/d1/observability/debug-d1/index.md)
- [Metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/d1/platform/index.md)
- [Alpha database migration guide](https://developers.cloudflare.com/d1/platform/alpha-migration/index.md)
- [Limits](https://developers.cloudflare.com/d1/platform/limits/index.md)
- [Pricing](https://developers.cloudflare.com/d1/platform/pricing/index.md)
- [Release notes](https://developers.cloudflare.com/d1/platform/release-notes/index.md)
- [Choose a data or storage product](https://developers.cloudflare.com/d1/platform/storage-options/index.md)

### Reference
- [Reference](https://developers.cloudflare.com/d1/reference/index.md)
- [Backups (Legacy)](https://developers.cloudflare.com/d1/reference/backups/index.md)
- [Community projects](https://developers.cloudflare.com/d1/reference/community-projects/index.md)
- [FAQs](https://developers.cloudflare.com/d1/reference/faq/index.md)
- [Data security](https://developers.cloudflare.com/d1/reference/data-security/index.md)
- [Glossary](https://developers.cloudflare.com/d1/reference/glossary/index.md)
- [Migrations](https://developers.cloudflare.com/d1/reference/migrations/index.md)
- [Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/index.md)

### Tools
- [Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/index.md)

## KV - Key-Value Storage

### Getting Started
- [Getting started](https://developers.cloudflare.com/kv/get-started/index.md)
- [Cloudflare Workers KV](https://developers.cloudflare.com/kv/index.md)

### Core Concepts
- [Key concepts](https://developers.cloudflare.com/kv/concepts/index.md)
- [How KV works](https://developers.cloudflare.com/kv/concepts/how-kv-works/index.md)
- [KV bindings](https://developers.cloudflare.com/kv/concepts/kv-bindings/index.md)
- [KV namespaces](https://developers.cloudflare.com/kv/concepts/kv-namespaces/index.md)

### API Reference
- [Workers Binding API](https://developers.cloudflare.com/kv/api/index.md)
- [KV REST API](https://developers.cloudflare.com/kv/workers-kv-api/index.md)
- [Read key-value pairs](https://developers.cloudflare.com/kv/api/read-key-value-pairs/index.md)
- [Write key-value pairs](https://developers.cloudflare.com/kv/api/write-key-value-pairs/index.md)
- [Delete key-value pairs](https://developers.cloudflare.com/kv/api/delete-key-value-pairs/index.md)
- [List keys](https://developers.cloudflare.com/kv/api/list-keys/index.md)

### Examples and Use Cases
- [Demos and architectures](https://developers.cloudflare.com/kv/demos/index.md)
- [Examples](https://developers.cloudflare.com/kv/examples/index.md)
- [Cache data with Workers KV](https://developers.cloudflare.com/kv/examples/cache-data-with-workers-kv/index.md): Example of how to use Workers KV to build a distributed application configuration store.
- [Build a distributed configuration store](https://developers.cloudflare.com/kv/examples/distributed-configuration-with-workers-kv/index.md): Example of how to use Workers KV to build a distributed application configuration store.
- [A/B testing with Workers KV](https://developers.cloudflare.com/kv/examples/implement-ab-testing-with-workers-kv/index.md)
- [Route requests across various web servers](https://developers.cloudflare.com/kv/examples/routing-with-workers-kv/index.md): Example of how to use Workers KV to build a distributed application configuration store.
- [Store and retrieve static assets](https://developers.cloudflare.com/kv/examples/workers-kv-to-serve-assets/index.md): Example of how to use Workers KV to store static assets

### Observability
- [Observability](https://developers.cloudflare.com/kv/observability/index.md)
- [Metrics and analytics](https://developers.cloudflare.com/kv/observability/metrics-analytics/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/kv/platform/index.md)
- [Pricing](https://developers.cloudflare.com/kv/platform/pricing/index.md)
- [Limits](https://developers.cloudflare.com/kv/platform/limits/index.md)
- [Release notes](https://developers.cloudflare.com/kv/platform/release-notes/index.md)
- [Choose a data or storage product](https://developers.cloudflare.com/kv/platform/storage-options/index.md)

### Reference
- [Reference](https://developers.cloudflare.com/kv/reference/index.md)
- [Data security](https://developers.cloudflare.com/kv/reference/data-security/index.md)
- [Environments](https://developers.cloudflare.com/kv/reference/environments/index.md)
- [FAQ](https://developers.cloudflare.com/kv/reference/faq/index.md)
- [Wrangler KV commands](https://developers.cloudflare.com/kv/reference/kv-commands/index.md)
- [Glossary](https://developers.cloudflare.com/kv/glossary/index.md)

### Learning Resources
- [Tutorials](https://developers.cloudflare.com/kv/tutorials/index.md)

## R2 - Object Storage

### Getting Started
- [Getting started](https://developers.cloudflare.com/r2/get-started/index.md)
- [Cloudflare R2](https://developers.cloudflare.com/r2/index.md): Cloudflare R2 is a cost-effective, scalable object storage solution for cloud-native apps, web content, and data lakes without egress fees.
- [How R2 works](https://developers.cloudflare.com/r2/how-r2-works/index.md): Find out how R2 works.

### API Reference
- [API](https://developers.cloudflare.com/r2/api/index.md)
- [S3](https://developers.cloudflare.com/r2/api/s3/index.md)
- [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/index.md)
- [Extensions](https://developers.cloudflare.com/r2/api/s3/extensions/index.md)
- [Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/index.md)
- [Workers API](https://developers.cloudflare.com/r2/api/workers/index.md)
- [Workers API reference](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/index.md)
- [Use R2 from Workers](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/index.md)
- [Use the R2 multipart API from Workers](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/index.md)

### Authentication
- [Authentication](https://developers.cloudflare.com/r2/api/tokens/index.md)

### Buckets
- [Buckets](https://developers.cloudflare.com/r2/buckets/index.md)
- [Create new buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/index.md)
- [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/index.md)
- [Bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/index.md)
- [Configure CORS](https://developers.cloudflare.com/r2/buckets/cors/index.md)
- [Event notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/index.md)
- [Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/index.md)
- [Storage classes](https://developers.cloudflare.com/r2/buckets/storage-classes/index.md)

### Objects
- [Objects](https://developers.cloudflare.com/r2/objects/index.md)
- [Upload objects](https://developers.cloudflare.com/r2/objects/upload-objects/index.md)
- [Download objects](https://developers.cloudflare.com/r2/objects/download-objects/index.md)
- [Delete objects](https://developers.cloudflare.com/r2/objects/delete-objects/index.md)
- [Multipart upload](https://developers.cloudflare.com/r2/objects/multipart-objects/index.md)

### Data Migration
- [Data migration](https://developers.cloudflare.com/r2/data-migration/index.md)
- [Migration Strategies](https://developers.cloudflare.com/r2/data-migration/migration-strategies/index.md)
- [Sippy](https://developers.cloudflare.com/r2/data-migration/sippy/index.md)
- [Super Slurper](https://developers.cloudflare.com/r2/data-migration/super-slurper/index.md)

### Examples and Integrations
- [Demos and architectures](https://developers.cloudflare.com/r2/demos/index.md)
- [Examples](https://developers.cloudflare.com/r2/examples/index.md)
- [Authenticate against R2 API using auth tokens](https://developers.cloudflare.com/r2/examples/authenticate-r2-auth-tokens/index.md)
- [Use the Cache API](https://developers.cloudflare.com/r2/examples/cache-api/index.md)
- [Multi-cloud setup](https://developers.cloudflare.com/r2/examples/multi-cloud/index.md)
- [Rclone](https://developers.cloudflare.com/r2/examples/rclone/index.md)
- [Use SSE-C](https://developers.cloudflare.com/r2/examples/ssec/index.md)
- [Terraform (AWS)](https://developers.cloudflare.com/r2/examples/terraform-aws/index.md)
- [Terraform](https://developers.cloudflare.com/r2/examples/terraform/index.md)

### S3 SDKs
- [S3 SDKs](https://developers.cloudflare.com/r2/examples/aws/index.md)
- [aws CLI](https://developers.cloudflare.com/r2/examples/aws/aws-cli/index.md)
- [aws-sdk-go](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-go/index.md)
- [aws-sdk-js-v3](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/index.md)
- [aws-sdk-java](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-java/index.md)
- [aws-sdk-net](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-net/index.md)
- [aws-sdk-php](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-php/index.md): Example of how to configure `aws-sdk-php` to use R2.
- [aws-sdk-js](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js/index.md)
- [aws-sdk-ruby](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-ruby/index.md)
- [aws-sdk-rust](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-rust/index.md)
- [aws4fetch](https://developers.cloudflare.com/r2/examples/aws/aws4fetch/index.md)
- [boto3](https://developers.cloudflare.com/r2/examples/aws/boto3/index.md)
- [Configure custom headers](https://developers.cloudflare.com/r2/examples/aws/custom-header/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/r2/platform/index.md)
- [Audit Logs](https://developers.cloudflare.com/r2/platform/audit-logs/index.md)
- [Limits](https://developers.cloudflare.com/r2/platform/limits/index.md)
- [Metrics and analytics](https://developers.cloudflare.com/r2/platform/metrics-analytics/index.md)
- [Release-notes](https://developers.cloudflare.com/r2/platform/release-notes/index.md)
- [Choose a storage product](https://developers.cloudflare.com/r2/platform/storage-options/index.md)
- [Troubleshooting](https://developers.cloudflare.com/r2/platform/troubleshooting/index.md)
- [Pricing](https://developers.cloudflare.com/r2/pricing/index.md)

### Reference
- [Reference](https://developers.cloudflare.com/r2/reference/index.md)
- [Consistency model](https://developers.cloudflare.com/r2/reference/consistency/index.md)
- [Data location](https://developers.cloudflare.com/r2/reference/data-location/index.md)
- [Data security](https://developers.cloudflare.com/r2/reference/data-security/index.md)
- [Durability](https://developers.cloudflare.com/r2/reference/durability/index.md)
- [Unicode interoperability](https://developers.cloudflare.com/r2/reference/unicode-interoperability/index.md)
- [Wrangler commands](https://developers.cloudflare.com/r2/reference/wrangler-commands/index.md)
- [Partners](https://developers.cloudflare.com/r2/reference/partners/index.md)
- [Snowflake](https://developers.cloudflare.com/r2/reference/partners/snowflake-regions/index.md)

### Tutorials
- [Tutorials](https://developers.cloudflare.com/r2/tutorials/index.md)
- [Protect an R2 Bucket with Cloudflare Access](https://developers.cloudflare.com/r2/tutorials/cloudflare-access/index.md)
- [Mastodon](https://developers.cloudflare.com/r2/tutorials/mastodon/index.md)
- [Postman](https://developers.cloudflare.com/r2/tutorials/postman/index.md): Learn how to configure Postman to interact with R2.
- [Use event notification to summarize PDF files on upload](https://developers.cloudflare.com/r2/tutorials/summarize-pdf/index.md)
- [Log and store upload events in R2 with event notifications](https://developers.cloudflare.com/r2/tutorials/upload-logs-event-notifications/index.md)

### Learning Resources
- [Videos](https://developers.cloudflare.com/r2/video-tutorials/index.md)

## R2 Data Catalog

### Getting Started
- [R2 Data Catalog](https://developers.cloudflare.com/r2/data-catalog/index.md): A managed Apache Iceberg data catalog built directly into R2 buckets.
- [Getting started](https://developers.cloudflare.com/r2/data-catalog/get-started/index.md): Learn how to enable the R2 Data Catalog on your bucket, load sample data, and run your first query.

### Management
- [Manage catalogs](https://developers.cloudflare.com/r2/data-catalog/manage-catalogs/index.md): Understand how to manage Iceberg REST catalogs associated with R2 buckets

### Integrations
- [Connect to Iceberg engines](https://developers.cloudflare.com/r2/data-catalog/config-examples/index.md): Find detailed setup instructions for Apache Spark and other common query engines.
- [DuckDB](https://developers.cloudflare.com/r2/data-catalog/config-examples/duckdb/index.md)
- [PyIceberg](https://developers.cloudflare.com/r2/data-catalog/config-examples/pyiceberg/index.md)
- [Snowflake](https://developers.cloudflare.com/r2/data-catalog/config-examples/snowflake/index.md)
- [Spark (Scala)](https://developers.cloudflare.com/r2/data-catalog/config-examples/spark-scala/index.md)
- [Spark (PySpark)](https://developers.cloudflare.com/r2/data-catalog/config-examples/spark-python/index.md)
- [StarRocks](https://developers.cloudflare.com/r2/data-catalog/config-examples/starrocks/index.md)
- [Apache Trino](https://developers.cloudflare.com/r2/data-catalog/config-examples/trino/index.md)

## Vectorize - Vector Database

### Getting Started
- [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/index.md)
- [Get started](https://developers.cloudflare.com/vectorize/get-started/index.md)
- [Introduction to Vectorize](https://developers.cloudflare.com/vectorize/get-started/intro/index.md)
- [Vectorize and Workers AI](https://developers.cloudflare.com/vectorize/get-started/embeddings/index.md)

### API Reference
- [Vectorize REST API](https://developers.cloudflare.com/vectorize/vectorize-api/index.md)
- [Vectorize API](https://developers.cloudflare.com/vectorize/reference/client-api/index.md)

### Best Practices
- [Best practices](https://developers.cloudflare.com/vectorize/best-practices/index.md)
- [Create indexes](https://developers.cloudflare.com/vectorize/best-practices/create-indexes/index.md)
- [Insert vectors](https://developers.cloudflare.com/vectorize/best-practices/insert-vectors/index.md)
- [List vectors](https://developers.cloudflare.com/vectorize/best-practices/list-vectors/index.md)
- [Query vectors](https://developers.cloudflare.com/vectorize/best-practices/query-vectors/index.md)

### Examples and Use Cases
- [Architectures](https://developers.cloudflare.com/vectorize/demos/index.md)
- [Examples](https://developers.cloudflare.com/vectorize/examples/index.md)
- [Agents](https://developers.cloudflare.com/vectorize/examples/agents/index.md): Build AI-powered Agents on Cloudflare
- [LangChain Integration](https://developers.cloudflare.com/vectorize/examples/langchain/index.md)
- [Retrieval Augmented Generation](https://developers.cloudflare.com/vectorize/examples/rag/index.md)

### Platform
- [Platform](https://developers.cloudflare.com/vectorize/platform/index.md)
- [Changelog](https://developers.cloudflare.com/vectorize/platform/changelog/index.md)
- [Limits](https://developers.cloudflare.com/vectorize/platform/limits/index.md)
- [Pricing](https://developers.cloudflare.com/vectorize/platform/pricing/index.md)
- [Choose a data or storage product](https://developers.cloudflare.com/vectorize/platform/storage-options/index.md)

### Reference
- [Reference](https://developers.cloudflare.com/vectorize/reference/index.md)
- [Metadata filtering](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/index.md)
- [Vector databases](https://developers.cloudflare.com/vectorize/reference/what-is-a-vector-database/index.md)
- [Transition legacy Vectorize indexes](https://developers.cloudflare.com/vectorize/reference/transition-vectorize-legacy/index.md)
- [Wrangler commands](https://developers.cloudflare.com/vectorize/reference/wrangler-commands/index.md)

### Learning Resources
- [Tutorials](https://developers.cloudflare.com/vectorize/tutorials/index.md)