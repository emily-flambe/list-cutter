# Design: Advanced Identity Resolution & Schema Management

## Overview
This document outlines the architecture for a comprehensive Master Data Management (MDM) system built on top of Cutty's foundation. This is a major platform evolution requiring significant infrastructure changes.

## Architecture Evolution

### New Infrastructure Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + D3.js)                      │
│                 (Identity Graph Visualization)                   │
├─────────────────────────────────────────────────────────────────┤
│                    API Gateway (Kong/Apigee)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │   Identity   │  │    Schema    │  │   ML Pipeline      │   │
│  │   Service    │  │  Registry    │  │   Service          │   │
│  │  (Node.js)   │  │  (Node.js)   │  │  (Python)          │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  PostgreSQL  │  │   Neo4j      │  │   Pinecone         │   │
│  │  (Core Data) │  │   (Graph)    │  │  (Vectors)         │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │    Kafka     │  │  Kubernetes  │  │   MLflow           │   │
│  │  (Streaming) │  │  (Compute)   │  │  (ML Ops)          │   │
│  └──────────────┘  └──────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Migration from Cloudflare

Due to the complexity of ML workloads and graph operations, this system requires:
- Traditional cloud infrastructure (AWS/GCP/Azure)
- Kubernetes for orchestration
- Dedicated ML infrastructure
- Graph and vector databases

## Core Services

### Identity Resolution Service

```typescript
// Advanced matching with ML
class IdentityResolutionService {
  private mlModel: TensorFlowModel;
  private graphDb: Neo4j;
  private vectorDb: Pinecone;
  
  async resolveIdentity(record: Record): Promise<IdentityMatch[]> {
    // 1. Generate embedding for record
    const embedding = await this.generateEmbedding(record);
    
    // 2. Find candidates via vector similarity
    const candidates = await this.vectorDb.search(embedding, {
      topK: 100,
      threshold: 0.7
    });
    
    // 3. Score candidates with ML model
    const scores = await Promise.all(
      candidates.map(c => this.mlModel.predict(record, c))
    );
    
    // 4. Apply business rules
    const matches = this.applyRules(scores);
    
    // 5. Update graph relationships
    await this.updateIdentityGraph(record, matches);
    
    return matches;
  }
  
  private async generateEmbedding(record: Record): Promise<Float32Array> {
    // Use pre-trained BERT model for text embedding
    const features = this.extractFeatures(record);
    return await this.embeddingModel.encode(features);
  }
}
```

### ML Pipeline

```python
# ML Training Pipeline
class IdentityMatchingModel:
    def __init__(self):
        self.model = self._build_model()
        self.feature_encoder = FeatureEncoder()
    
    def _build_model(self):
        # Deep learning model for similarity scoring
        return tf.keras.Sequential([
            tf.keras.layers.Input(shape=(512,)),
            tf.keras.layers.Dense(256, activation='relu'),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(128, activation='relu'),
            tf.keras.layers.Dropout(0.3),
            tf.keras.layers.Dense(64, activation='relu'),
            tf.keras.layers.Dense(1, activation='sigmoid')
        ])
    
    def train(self, training_data):
        # Active learning from user feedback
        features, labels = self.prepare_training_data(training_data)
        
        self.model.fit(
            features, 
            labels,
            epochs=10,
            validation_split=0.2,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(patience=3),
                MLflowCallback()
            ]
        )
    
    def predict(self, record_a, record_b):
        features = self.feature_encoder.encode_pair(record_a, record_b)
        return self.model.predict(features)[0][0]
```

### Schema Registry

```typescript
// Dynamic schema management with versioning
class SchemaRegistry {
  async registerSchema(schema: Schema): Promise<string> {
    // Validate schema
    const validation = await this.validateSchema(schema);
    if (!validation.valid) {
      throw new SchemaValidationError(validation.errors);
    }
    
    // Check compatibility with existing versions
    const compatibility = await this.checkCompatibility(schema);
    
    // Register with version
    const version = await this.getNextVersion(schema.name);
    const schemaId = await this.store.save({
      ...schema,
      version,
      fingerprint: this.generateFingerprint(schema),
      created: new Date()
    });
    
    // Update consumers
    await this.notifyConsumers(schemaId, schema);
    
    return schemaId;
  }
  
  async evolveSchema(
    schemaId: string, 
    changes: SchemaChange[]
  ): Promise<string> {
    const current = await this.getSchema(schemaId);
    const evolved = this.applyChanges(current, changes);
    
    // Generate migration scripts
    const migrations = this.generateMigrations(current, evolved);
    
    return this.registerSchema(evolved);
  }
}
```

### Identity Graph

```typescript
// Neo4j-based identity graph
class IdentityGraph {
  async createIdentity(record: Record): Promise<string> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        CREATE (i:Identity {
          id: $id,
          created: datetime(),
          properties: $properties
        })
        RETURN i.id as id
      `, {
        id: generateUUID(),
        properties: record
      });
      
      return result.records[0].get('id');
    } finally {
      await session.close();
    }
  }
  
  async linkIdentities(
    sourceId: string, 
    targetId: string, 
    confidence: number
  ): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(`
        MATCH (a:Identity {id: $sourceId})
        MATCH (b:Identity {id: $targetId})
        CREATE (a)-[r:SAME_AS {
          confidence: $confidence,
          created: datetime()
        }]->(b)
      `, { sourceId, targetId, confidence });
    } finally {
      await session.close();
    }
  }
  
  async findConnectedIdentities(
    identityId: string, 
    maxDepth: number = 2
  ): Promise<IdentityCluster> {
    const session = this.driver.session();
    
    try {
      const result = await session.run(`
        MATCH (start:Identity {id: $identityId})
        MATCH path = (start)-[r:SAME_AS*1..${maxDepth}]-(connected)
        WHERE ALL(rel in relationships(path) WHERE rel.confidence >= 0.7)
        RETURN DISTINCT connected, relationships(path) as paths
      `, { identityId });
      
      return this.buildCluster(result.records);
    } finally {
      await session.close();
    }
  }
}
```

## Data Models

### PostgreSQL Core Tables

```sql
-- ML training data
CREATE TABLE training_samples (
  id UUID PRIMARY KEY,
  record_a JSONB NOT NULL,
  record_b JSONB NOT NULL,
  is_match BOOLEAN NOT NULL,
  confidence FLOAT,
  user_id UUID NOT NULL,
  feedback_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schema evolution tracking
CREATE TABLE schema_versions (
  id UUID PRIMARY KEY,
  schema_name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  schema_definition JSONB NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  compatibility_mode VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,
  UNIQUE(schema_name, version)
);

-- Rule engine configuration
CREATE TABLE matching_rules (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  rule_ast JSONB NOT NULL, -- Abstract syntax tree
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  performance_impact FLOAT, -- Measured impact on processing time
  accuracy_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Neo4j Graph Schema

```cypher
// Identity nodes
CREATE CONSTRAINT identity_id_unique ON (i:Identity) ASSERT i.id IS UNIQUE;

// Relationship types
// SAME_AS - same person (confidence: 0-1)
// RELATED_TO - family/household (type: parent, child, spouse)
// AFFILIATED_WITH - organization (role: employee, volunteer)
// PREVIOUS_IDENTITY - historical identity

// Indexes for performance
CREATE INDEX identity_email FOR (i:Identity) ON (i.email);
CREATE INDEX identity_phone FOR (i:Identity) ON (i.phone);
CREATE INDEX identity_name FOR (i:Identity) ON (i.lastName, i.firstName);
```

## API Design

### RESTful Endpoints

```yaml
# Identity Resolution
POST   /api/v2/identity/resolve
GET    /api/v2/identity/{id}/graph
POST   /api/v2/identity/{id}/merge
POST   /api/v2/identity/{id}/split
GET    /api/v2/identity/{id}/history
POST   /api/v2/identity/bulk/resolve

# Schema Registry
POST   /api/v2/schemas
GET    /api/v2/schemas/{name}/versions
POST   /api/v2/schemas/{id}/evolve
GET    /api/v2/schemas/{id}/compatibility
POST   /api/v2/schemas/validate

# ML Operations
POST   /api/v2/ml/training/samples
POST   /api/v2/ml/models/train
GET    /api/v2/ml/models/{id}/metrics
POST   /api/v2/ml/models/{id}/deploy
GET    /api/v2/ml/predictions/explain

# Rule Engine
POST   /api/v2/rules
GET    /api/v2/rules/{id}/performance
POST   /api/v2/rules/{id}/test
GET    /api/v2/rules/recommendations
```

### GraphQL API

```graphql
type Query {
  identity(id: ID!): Identity
  identityGraph(
    id: ID!
    depth: Int = 2
    minConfidence: Float = 0.7
  ): IdentityCluster
  
  searchIdentities(
    query: String!
    filters: IdentityFilter
    limit: Int = 20
  ): IdentitySearchResult
}

type Mutation {
  resolveIdentity(
    record: IdentityInput!
    options: ResolveOptions
  ): ResolveResult
  
  mergeIdentities(
    ids: [ID!]!
    strategy: MergeStrategy!
  ): Identity
  
  trainModel(
    samples: [TrainingSample!]!
  ): TrainingJob
}

type Subscription {
  identityUpdates(id: ID!): IdentityUpdate
  matchingProgress(jobId: ID!): MatchingProgress
}
```

## Performance & Scale

### Optimization Strategies

1. **Vector Similarity Search**
   - Pre-compute embeddings for all records
   - Use approximate nearest neighbor (ANN) algorithms
   - Shard vector index by geography/domain

2. **Graph Traversal**
   - Implement graph caching layers
   - Use graph algorithms (connected components)
   - Periodic graph compaction

3. **ML Inference**
   - Model quantization for faster inference
   - Batch prediction APIs
   - Edge deployment for low latency

4. **Stream Processing**
   - Kafka for real-time identity updates
   - Windowed aggregations for deduplication
   - Change data capture (CDC) for sync

## Deployment

### Kubernetes Architecture

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: identity-resolution-service
spec:
  replicas: 5
  template:
    spec:
      containers:
      - name: api
        image: identity-service:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      - name: ml-sidecar
        image: ml-inference:latest
        resources:
          requests:
            memory: "4Gi"
            cpu: "2000m"
            nvidia.com/gpu: 1
```

### ML Pipeline

```yaml
# Kubeflow pipeline for model training
apiVersion: pipelines.kubeflow.org/v1beta1
kind: Pipeline
metadata:
  name: identity-matching-training
spec:
  steps:
  - name: data-preparation
    template: prepare-training-data
  - name: feature-engineering
    template: generate-features
  - name: model-training
    template: train-model
    resources:
      accelerator:
        type: nvidia-tesla-v100
        count: 2
  - name: model-evaluation
    template: evaluate-model
  - name: model-deployment
    template: deploy-model
    when: "{{steps.model-evaluation.outputs.parameters.accuracy}} > 0.95"
```

## Security & Compliance

### Data Privacy
- End-to-end encryption for PII
- Data masking for non-production environments
- Right to be forgotten (GDPR Article 17)
- Audit trails for all identity operations

### Access Control
- Attribute-based access control (ABAC)
- Field-level security
- Data classification tags
- Compliance reporting (GDPR, CCPA)

## Monitoring & Observability

### Metrics
- Match accuracy (precision, recall, F1)
- Processing latency (p50, p95, p99)
- Model drift detection
- Data quality scores

### Dashboards
- Real-time matching performance
- ML model performance
- Graph topology visualization
- System health metrics

## Migration Strategy

### Phase 1: Foundation (Months 1-2)
- Set up new infrastructure
- Migrate from Cloudflare to cloud provider
- Implement basic identity service

### Phase 2: ML Integration (Months 3-4)
- Deploy ML training pipeline
- Implement vector search
- Build feedback loops

### Phase 3: Graph & Scale (Months 5-6)
- Deploy Neo4j cluster
- Implement graph algorithms
- Performance optimization

### Phase 4: Advanced Features (Months 7-9)
- Rule engine implementation
- Schema registry
- Real-time streaming
- Production hardening