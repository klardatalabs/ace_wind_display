# ACE Wind Turbine Public Energy Platform --- System Design

**Status:** Architecture baseline / implementation-ready design\
**Deployment:** Contabo --- single VPS initially\
**Primary audience:** Public community display, students, community
members, developers, researchers\
**Core principles:** live data, durability, graceful degradation,
scalable event-driven architecture, provider-agnostic AI

------------------------------------------------------------------------

## 1. Executive Summary

This system turns live and historical data from the **Ambition Community
Energy (ACE) wind turbine** into a public-facing digital experience.

The platform has four major capabilities:

1.  **Live turbine experience** --- live power, wind and turbine status
    are streamed to the frontend.
2.  **Audience experiences** --- dedicated storytelling for children,
    university students and the community.
3.  **Ask the Turbine** --- a conversational AI experience using live
    turbine data, historical data, curated knowledge, Mem0 memory and
    Tavily for current web research.
4.  **Developer/data access** --- a developer portal, API documentation
    and a dataset delivery workflow.

The architecture is deliberately event-driven:

``` mermaid
flowchart LR
    ACE["ACE Live API"] --> C["ACE Collector"]
    C --> K["Apache Kafka"]

    K --> RAW["Raw Archive"]
    K --> TS["TimescaleDB"]
    K --> REDIS["Redis"]
    K --> FAIL["Failure Pipeline"]

    TS --> API["FastAPI"]
    REDIS --> API
    API --> FE["Next.js Frontend"]

    TS --> AI["AI / LangGraph"]
    PGV["pgvector"] --> AI
    MEM["Mem0"] --> AI
    TAV["Tavily"] --> AI

    AI --> WS["WebSocket"]
    API --> WS
    WS --> FE

    FE --> KIDS["Kids"]
    FE --> UNI["University"]
    FE --> COMM["Community"]
    FE --> DEV["Developer"]
```

The ACE API is fetched **once** by the collector. Other services never
independently poll ACE.

------------------------------------------------------------------------

# 2. Goals

### Functional goals

-   Consume live ACE turbine data.
-   Preserve raw data for durability and reproducibility.
-   Store queryable time-series data.
-   Maintain 5-minute, hourly, daily and monthly aggregates.
-   Display live data directly on the frontend.
-   Support real-time WebSocket updates.
-   Provide historical exploration.
-   Provide a 3D turbine visualization.
-   Support three main public experiences:
    -   Kids
    -   University students
    -   Community
-   Provide an AI chatbot.
-   Maintain short-term chat context with Redis.
-   Maintain useful longer-term memory with Mem0.
-   Use embeddings and pgvector for semantic knowledge retrieval.
-   Use Tavily for current external web research.
-   Keep the LLM provider-agnostic so Gemini, Groq or another compatible
    provider can be selected later.
-   Provide a developer page.
-   Provide dataset download through a simple form and email.
-   Send dataset links using Resend.
-   Record ingestion and system failures durably.
-   Continue serving cached/historical data when the ACE API is
    unavailable.
-   Deploy everything on a single Contabo VPS initially.

### Non-functional goals

-   Durable
-   Horizontally scalable
-   Observable
-   Recoverable
-   Idempotent
-   Provider-agnostic
-   Secure
-   Low operational complexity initially

------------------------------------------------------------------------

# 3. Non-Goals

The first version does **not** require:

-   Public user authentication.
-   An admin dashboard.
-   Manual dataset approval.
-   Microservices for every individual feature.
-   Multiple VPS nodes initially.
-   A separate vector database.
-   Direct frontend-to-ACE API communication.
-   The LLM directly querying the database.
-   Permanent personal profiles for anonymous public-screen users.

------------------------------------------------------------------------

# 4. Core Architecture Principles

## 4.1 ACE is fetched once

``` mermaid
flowchart LR
    ACE["ACE API"] --> COL["Single Collector"]
    COL --> K["Kafka"]

    K --> A["Aggregation"]
    K --> DB["Database"]
    K --> CACHE["Redis"]
    K --> ARCHIVE["Object Storage"]
    K --> MON["Monitoring / Failure"]
```

No other application component polls ACE.

This prevents:

-   duplicated requests
-   unnecessary upstream traffic
-   inconsistent values between services
-   coupling between the public UI and ACE availability

------------------------------------------------------------------------

## 4.2 Database is the durable source of truth

Redis is a hot cache and session layer.

Kafka is the event backbone.

Object storage preserves source files.

TimescaleDB stores queryable turbine history.

PostgreSQL stores application state.

pgvector stores semantic knowledge.

``` mermaid
flowchart TB
    K["Kafka"] --> TS["TimescaleDB"]
    K --> OBJ["Object Storage"]

    TS --> R["Redis Cache"]

    PG["PostgreSQL"] --> APP["Application State"]
    PGV["pgvector"] --> RAG["Semantic Retrieval"]
```

------------------------------------------------------------------------

# 5. Complete System Architecture

``` mermaid
flowchart TB
    subgraph External
        ACE["ACE Live API"]
        TAV["Tavily"]
        EMAIL["Resend"]
        DATA["Historical Dataset Files"]
    end

    subgraph Ingestion
        COL["ACE Collector"]
        VAL["Validation / Normalization"]
        K["Apache Kafka"]
    end

    subgraph DurableData["Durable Data"]
        TS["PostgreSQL + TimescaleDB"]
        PGV["pgvector"]
        OBJ["S3-compatible Object Storage"]
        FAILDB["Failure Records"]
    end

    subgraph HotData["Hot / Ephemeral"]
        REDIS["Redis"]
        MEM0["Mem0"]
    end

    subgraph Backend
        API["FastAPI"]
        WS["WebSocket Gateway"]
        CHAT["Chat / LangGraph"]
        JOBS["Background Workers"]
        DATASET["Dataset Service"]
    end

    subgraph Frontend
        WEB["Next.js / React"]
        THREE["3D Turbine"]
        STORIES["Story Engine"]
        DEV["Developer Portal"]
    end

    ACE --> COL
    COL --> VAL
    VAL --> K

    DATA --> JOBS
    JOBS --> OBJ
    JOBS --> TS
    JOBS --> PGV

    K --> TS
    K --> OBJ
    K --> JOBS
    K --> FAILDB

    TS --> REDIS
    API --> REDIS
    API --> TS

    WEB <--> WS
    WS --> REDIS

    WEB --> API
    API --> CHAT

    CHAT --> TS
    CHAT --> PGV
    CHAT --> REDIS
    CHAT --> MEM0
    CHAT --> TAV

    API --> DATASET
    DATASET --> OBJ
    DATASET --> EMAIL

    WEB --> THREE
    WEB --> STORIES
    WEB --> DEV
```

------------------------------------------------------------------------

# 6. Data Flow

``` mermaid
sequenceDiagram
    participant ACE as ACE API
    participant C as Collector
    participant K as Kafka
    participant T as TimescaleDB
    participant R as Redis
    participant WS as WebSocket
    participant UI as Frontend

    ACE->>C: Fetch latest data
    C->>C: Validate + normalize
    C->>K: Publish telemetry event
    K->>T: Persist telemetry
    K->>R: Update live state
    R->>WS: Publish latest state
    WS->>UI: Live update
```

The frontend therefore receives live information without contacting ACE.

------------------------------------------------------------------------

# 7. Historical Dataset Architecture

The uploaded historical datasets are first-class inputs to the platform.

Current files include:

-   `ace-wind-2026-events.parquet`
-   `ace-wind-2026-events-latest.parquet`
-   `ace-wind-2026-daily.parquet`
-   `ace-wind-2026-daily-latest.parquet`
-   `ace-wind-2026-10m.parquet`
-   `ace-wind-2026-10m-latest.parquet`

The exact column mapping should be finalized during ingestion
implementation from the dataset schema. The architecture deliberately
supports events, daily data and 10-minute time-series data.

``` mermaid
flowchart LR
    F["Historical Parquet Files"] --> DISC["Schema Discovery"]
    DISC --> VALID["Validation"]
    VALID --> RAW["Original File Archive"]
    VALID --> PARSE["Structured Parser"]

    PARSE --> TS["TimescaleDB"]
    PARSE --> EVENT["Event Tables"]
    PARSE --> AGG["Aggregation Pipeline"]

    TS --> API["Historical API"]
    TS --> CHAT["Chat Tools"]

    F --> DL["Dataset Delivery"]
    DL --> EMAIL["Resend"]
```

------------------------------------------------------------------------

# 8. Historical Data Has Three Representations

## 8.1 Original representation

Preserve the original dataset exactly in object storage.

Purpose:

-   reproducibility
-   research
-   downloads
-   reprocessing
-   auditability

``` text
object-storage/
  ace/
    historical/
      2026/
        events/
        daily/
        10m/
```

## 8.2 Structured representation

Convert relevant telemetry into TimescaleDB.

Purpose:

-   SQL queries
-   charts
-   statistics
-   chatbot tools
-   API access

## 8.3 Semantic representation

Only appropriate textual/semantic information is embedded.

Examples:

-   dataset descriptions
-   turbine documentation
-   event explanations
-   educational material
-   community information
-   historical context
-   metadata

Raw numerical time-series should **not** be blindly embedded.

------------------------------------------------------------------------

# 9. Kafka Architecture

Kafka is the central event backbone.

``` mermaid
flowchart TB
    C["ACE Collector"] --> P["Kafka Producer"]

    P --> RAW["ace.telemetry.raw"]
    P --> EVT["ace.turbine.events"]
    P --> QUALITY["ace.data.quality"]

    RAW --> RAWC["Raw Storage Consumer"]
    RAW --> AGG["Aggregation Consumer"]
    RAW --> CACHE["Live Cache Consumer"]
    RAW --> ANALYTICS["Analytics Consumer"]

    EVT --> EVENTDB["Event Storage"]
    QUALITY --> MON["Monitoring"]
```

## Initial topics

  Topic                        Purpose
  ---------------------------- -------------------------------
  `ace.telemetry.raw`          Raw normalized telemetry
  `ace.turbine.events`         Turbine operational events
  `ace.data.quality`           Validation and quality events
  `ace.telemetry.aggregated`   Aggregated measurements
  `ace.forecast`               Future forecasting pipeline
  `ace.analytics`              Future analytics consumers

Kafka partitioning should use `turbine_id` as the key so events for a
turbine retain ordering.

------------------------------------------------------------------------

# 10. Kafka Durability

Initially there is one Contabo VPS, so Kafka does not provide physical
fault tolerance against VPS loss.

Nevertheless, the architecture should use:

-   persistent Kafka volumes
-   appropriate replication configuration when brokers are expanded
-   producer acknowledgements
-   consumer offsets
-   idempotent consumers
-   dead-letter topics
-   backups / exported durable data

When infrastructure expands:

``` mermaid
flowchart LR
    subgraph FutureKafka["Future Multi-Node Kafka"]
        B1["Broker 1"]
        B2["Broker 2"]
        B3["Broker 3"]
    end

    P["Producer"] --> B1
    P --> B2
    P --> B3

    B1 <--> B2
    B2 <--> B3
    B1 <--> B3
```

A three-broker cluster should only be described as genuinely highly
available when the brokers are on independent failure domains.

------------------------------------------------------------------------

# 11. Data Ingestion Pipeline

``` mermaid
flowchart TD
    A["ACE API"] --> F["Fetcher"]
    F --> V["Schema Validation"]

    V -->|Invalid| DLQ["Data Quality / DLQ"]
    V -->|Valid| N["Normalize"]

    N --> D["Deduplication"]
    D --> K["Kafka"]

    K --> TS["TimescaleDB"]
    K --> R["Redis"]
    K --> O["Object Storage"]
```

The collector should attach:

-   source timestamp
-   ingestion timestamp
-   source identifier
-   turbine identifier
-   schema/version information
-   correlation/event identifier

------------------------------------------------------------------------

# 12. Idempotency

A duplicate upstream record must not create duplicate application data.

Logical uniqueness should be based on the source event identity or a
deterministic key such as:

``` text
turbine_id + source_timestamp + measurement identity
```

Consumer operations must be idempotent.

``` mermaid
flowchart LR
    E["Kafka Event"] --> C["Consumer"]
    C --> CHECK{"Already processed?"}
    CHECK -->|Yes| SKIP["Skip"]
    CHECK -->|No| WRITE["Write"]
    WRITE --> OFFSET["Commit Offset"]
```

------------------------------------------------------------------------

# 13. TimescaleDB Design

The database is PostgreSQL with TimescaleDB.

## Main tables

### Turbine metadata

``` text
turbines
turbine_configurations
```

### Time-series

``` text
telemetry_raw
telemetry_10m
telemetry_5m
telemetry_hourly
telemetry_daily
telemetry_monthly
```

### Events

``` text
turbine_events
```

### Application

``` text
stories
story_scenes
chat_sessions
chat_messages
conversation_summaries
experience_events
```

### Dataset delivery

``` text
datasets
dataset_versions
dataset_downloads
```

### Knowledge

``` text
knowledge_documents
knowledge_chunks
embeddings
```

### Reliability

``` text
ingestion_runs
system_failures
data_quality_events
```

------------------------------------------------------------------------

# 14. Time-Series Data Model

``` mermaid
erDiagram
    TURBINES ||--o{ TELEMETRY_RAW : has
    TURBINES ||--o{ TELEMETRY_10M : has
    TURBINES ||--o{ TELEMETRY_5M : has
    TURBINES ||--o{ TELEMETRY_HOURLY : has
    TURBINES ||--o{ TELEMETRY_DAILY : has
    TURBINES ||--o{ TELEMETRY_MONTHLY : has
    TURBINES ||--o{ TURBINE_EVENTS : produces

    TURBINES {
        uuid id PK
        string external_id UK
        string name
        decimal rated_power_kw
        string timezone
        timestamp commissioned_at
    }

    TELEMETRY_RAW {
        timestamptz time
        uuid turbine_id FK
        bigint sequence_id
        decimal power_kw
        decimal wind_speed_ms
        decimal wind_direction_deg
        decimal rotor_speed_rpm
        decimal temperature_c
        string status
        jsonb metadata
    }

    TELEMETRY_10M {
        timestamptz bucket PK
        uuid turbine_id FK
        decimal power_avg_kw
        decimal power_min_kw
        decimal power_max_kw
        decimal wind_avg_ms
        decimal energy_kwh
        integer sample_count
    }

    TELEMETRY_5M {
        timestamptz bucket PK
        uuid turbine_id FK
        decimal power_avg_kw
        decimal power_min_kw
        decimal power_max_kw
        decimal wind_avg_ms
        decimal energy_kwh
        integer sample_count
    }

    TELEMETRY_HOURLY {
        timestamptz bucket PK
        uuid turbine_id FK
        decimal power_avg_kw
        decimal power_peak_kw
        decimal wind_avg_ms
        decimal energy_kwh
        integer sample_count
    }

    TELEMETRY_DAILY {
        date day PK
        uuid turbine_id FK
        decimal energy_kwh
        decimal power_avg_kw
        decimal power_peak_kw
        decimal wind_avg_ms
        decimal capacity_factor
        decimal operating_hours
    }

    TELEMETRY_MONTHLY {
        date month PK
        uuid turbine_id FK
        decimal energy_kwh
        decimal power_avg_kw
        decimal power_peak_kw
        decimal capacity_factor
        decimal operating_hours
    }

    TURBINE_EVENTS {
        uuid id PK
        uuid turbine_id FK
        timestamptz event_time
        string event_type
        string severity
        string code
        text message
        jsonb metadata
    }
```

------------------------------------------------------------------------

# 15. Why Multiple Aggregation Levels?

We should not query raw telemetry for every chart.

``` mermaid
flowchart LR
    RAW["Raw"] --> TEN["10 minute"]
    TEN --> FIVE["5 minute"]
    FIVE --> HOUR["Hourly"]
    HOUR --> DAY["Daily"]
    DAY --> MONTH["Monthly"]
```

Typical use:

  Query             Source
  ----------------- -----------------
  Current value     Redis
  Last hour         5m / 10m
  Last 24 hours     10m / hourly
  Last 30 days      Daily
  Last year         Daily / monthly
  Research export   Raw/archive

------------------------------------------------------------------------

# 16. Redis Architecture

Redis is a hot-state system, not the durable source of truth.

``` mermaid
flowchart TB
    K["Kafka"] --> LC["Live Cache Consumer"]
    LC --> R["Redis"]

    R --> LIVE["Live Turbine State"]
    R --> WS["WebSocket Gateway"]

    CHAT["Chat Service"] <--> R
    R --> CTX["Recent Chat Context"]

    DB["TimescaleDB"] --> R
    DB -. rebuild cache .-> R
```

Possible key namespaces:

``` text
live:turbine:{id}
live:summary:{id}
chat:session:{id}
chat:messages:{id}
ws:room:{id}
```

Redis loss should not destroy turbine history.

------------------------------------------------------------------------

# 17. Live Frontend Data

``` mermaid
sequenceDiagram
    participant K as Kafka
    participant R as Redis
    participant W as WebSocket Gateway
    participant F as Frontend

    K->>R: New turbine telemetry
    R->>W: Updated live state
    W->>F: turbine:update
    F->>F: Update metrics
    F->>F: Update charts
    F->>F: Update 3D turbine
```

Frontend receives a state object containing at least:

``` json
{
  "turbineId": "ace-01",
  "timestamp": "...",
  "power": 2840,
  "windSpeed": 8.7,
  "status": "generating",
  "isLive": true,
  "ageSeconds": 12
}
```

The exact field names should follow the final ACE API schema.

------------------------------------------------------------------------

# 18. WebSocket Architecture

WebSocket has two primary uses:

1.  Live turbine updates.
2.  Streaming chatbot responses.

``` mermaid
flowchart TB
    F["Frontend"] <-->|WebSocket| G["WebSocket Gateway"]

    G --> LIVE["Live Data Channel"]
    G --> CHAT["Chat Channel"]

    LIVE --> R["Redis"]
    CHAT --> LG["LangGraph"]

    LG --> R
```

Suggested event types:

``` text
turbine.snapshot
turbine.update
turbine.status
chat.started
chat.token
chat.tool_call
chat.tool_result
chat.completed
chat.error
system.degraded
```

------------------------------------------------------------------------

# 19. Public Frontend Architecture

``` mermaid
flowchart TB
    APP["Next.js Application"]

    APP --> HOME["Home / Live"]
    APP --> STORIES["Stories"]
    APP --> KIDS["Kids"]
    APP --> STUDENTS["Students"]
    APP --> COMMUNITY["Community"]
    APP --> CHAT["Ask the Turbine"]
    APP --> DATA["Data Explorer"]
    APP --> DEV["Developer Portal"]
    APP --> DATASETS["Datasets"]

    HOME --> LIVE["Live Data"]
    HOME --> THREE["3D Turbine"]

    STORIES --> STORY["Story Engine"]
    STORY --> LIVE

    CHAT --> WS["WebSocket"]
    DATA --> API["REST API"]
    DEV --> API
```

------------------------------------------------------------------------

# 20. 3D Turbine

The 3D component should represent actual data.

``` mermaid
flowchart LR
    D["Live Turbine State"] --> MAP["State Mapper"]

    MAP --> ROTOR["Rotor Speed"]
    MAP --> WIND["Wind Particles"]
    MAP --> POWER["Power Visualisation"]
    MAP --> STATUS["Status State"]

    ROTOR --> THREE["Three.js / React Three Fiber"]
    WIND --> THREE
    POWER --> THREE
    STATUS --> THREE
```

The 3D experience is therefore a visualization layer, not a separate
data source.

------------------------------------------------------------------------

# 21. Story Engine

The same platform powers multiple audiences.

``` mermaid
flowchart TB
    DATA["Live + Historical Data"] --> ENGINE["Story Engine"]

    ENGINE --> K["Kids Story"]
    ENGINE --> U["University Story"]
    ENGINE --> C["Community Story"]

    K --> R["Frontend Renderer"]
    U --> R
    C --> R
```

Stories should be configuration-driven.

Example conceptual structure:

``` json
{
  "audience": "community",
  "scene": "today",
  "components": [
    "live_power",
    "energy_today",
    "community_message",
    "turbine_story"
  ]
}
```

------------------------------------------------------------------------

# 22. Chatbot Architecture

The chatbot is a controlled data/knowledge agent.

``` mermaid
flowchart TB
    U["User"] --> WS["WebSocket"]
    WS --> S["Session Manager"]
    S --> R["Redis"]

    S --> LG["LangGraph"]

    LG --> ROUTER["Intent / Query Router"]

    ROUTER --> SQL["Turbine Data Tools"]
    ROUTER --> RAG["Knowledge Retrieval"]
    ROUTER --> WEB["Web Search"]

    SQL --> TS["TimescaleDB"]
    RAG --> V["pgvector"]
    WEB --> T["Tavily"]

    TS --> LG
    V --> LG
    T --> LG

    LG --> LLM["Provider-Agnostic LLM Adapter"]
    LLM --> WS
```

------------------------------------------------------------------------

# 23. LLM Provider Abstraction

The model must not be hardcoded into the architecture.

``` mermaid
flowchart TB
    LG["LangGraph"] --> ADAPTER["LLM Provider Adapter"]

    ADAPTER --> GEMINI["Gemini"]
    ADAPTER --> GROQ["Groq"]
    ADAPTER --> OTHER["Other Compatible Provider"]
```

Application code should depend on the adapter/interface, not on one
provider.

Conceptually:

``` text
LLMProvider
  ├── GeminiProvider
  ├── GroqProvider
  └── FutureProvider
```

This lets us switch providers without redesigning the agent workflow.

**OpenAI SDK is not the system LLM requirement.** The architecture keeps
the model provider replaceable.

------------------------------------------------------------------------

# 24. LangGraph Workflow

``` mermaid
stateDiagram-v2
    [*] --> ReceiveQuestion
    ReceiveQuestion --> LoadContext
    LoadContext --> ClassifyIntent

    ClassifyIntent --> TurbineData
    ClassifyIntent --> Knowledge
    ClassifyIntent --> WebSearch
    ClassifyIntent --> Mixed

    TurbineData --> ToolResult
    Knowledge --> ToolResult
    WebSearch --> ToolResult

    Mixed --> TurbineData
    Mixed --> Knowledge
    Mixed --> WebSearch

    ToolResult --> BuildContext
    BuildContext --> GenerateAnswer
    GenerateAnswer --> UpdateMemory
    UpdateMemory --> StreamAnswer
    StreamAnswer --> [*]
```

------------------------------------------------------------------------

# 25. AI Tool Boundary

The LLM must not have arbitrary SQL access.

Instead:

``` mermaid
flowchart LR
    LLM["LLM"] --> TOOLS["Controlled Tools"]

    TOOLS --> CURRENT["get_current_status()"]
    TOOLS --> ENERGY["get_energy(period)"]
    TOOLS --> HISTORY["get_power_history(period)"]
    TOOLS --> EVENTS["get_events(period)"]
    TOOLS --> DAILY["get_daily_summary(date)"]

    CURRENT --> DB["TimescaleDB / Redis"]
    ENERGY --> DB
    HISTORY --> DB
    EVENTS --> DB
    DAILY --> DB
```

This improves:

-   security
-   correctness
-   observability
-   testability
-   provider independence

------------------------------------------------------------------------

# 26. Redis + Mem0

Redis and Mem0 solve different problems.

``` mermaid
flowchart TB
    USER["Anonymous User"] --> CHAT["Chat Session"]

    CHAT --> REDIS["Redis"]
    CHAT --> MEM0["Mem0"]

    REDIS --> SHORT["Short-term context"]
    REDIS --> ACTIVE["Active session state"]

    MEM0 --> LONG["Useful longer-term memory"]
```

Redis should hold hot context.

Mem0 should hold only useful memory that is appropriate to retain.

Because users are anonymous, memory retention should be conservative.

------------------------------------------------------------------------

# 27. RAG Architecture

``` mermaid
flowchart LR
    DOC["ACE / Educational Documents"] --> CHUNK["Chunk"]
    CHUNK --> EMB["Embedding Model"]
    EMB --> V["pgvector"]

    Q["User Question"] --> QE["Query Embedding"]
    QE --> V
    V --> CONTEXT["Relevant Context"]

    CONTEXT --> LG["LangGraph"]
```

Do not embed raw numerical telemetry as the primary retrieval mechanism.

Numerical questions should use database tools.

------------------------------------------------------------------------

# 28. Tavily Integration

``` mermaid
flowchart TB
    Q["User Question"] --> ROUTER["LangGraph Router"]

    ROUTER -->|Current external information needed| T["Tavily"]
    T --> RESULTS["Search Results"]
    RESULTS --> VERIFY["Context / Source Handling"]
    VERIFY --> LLM["LLM"]

    ROUTER -->|ACE-specific data| DB["TimescaleDB"]
    ROUTER -->|Known documentation| RAG["pgvector"]
```

Tavily is not the source of truth for ACE turbine measurements.

------------------------------------------------------------------------

# 29. Dataset Delivery

There is intentionally **no admin panel or approval workflow**.

``` mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as Dataset API
    participant DB as PostgreSQL
    participant S as Object Storage
    participant R as Resend

    U->>F: Select dataset
    U->>F: Submit name/email/purpose
    F->>API: Dataset request
    API->>DB: Save request
    API->>S: Generate secure download reference
    API->>R: Send email
    R->>U: Dataset download link
    U->>S: Download dataset
```

------------------------------------------------------------------------

# 30. Dataset Tables

``` mermaid
erDiagram
    DATASETS ||--o{ DATASET_VERSIONS : contains
    DATASET_VERSIONS ||--o{ DATASET_DOWNLOADS : downloaded_as

    DATASETS {
        uuid id PK
        string name
        text description
        string licence
        string access_level
        timestamp created_at
    }

    DATASET_VERSIONS {
        uuid id PK
        uuid dataset_id FK
        string version
        string object_key
        bigint size_bytes
        string checksum
        timestamp created_at
    }

    DATASET_DOWNLOADS {
        uuid id PK
        uuid dataset_version_id FK
        string requester_email
        string requester_name
        string organisation
        text purpose
        timestamp requested_at
        timestamp downloaded_at
        timestamp expires_at
    }
```

------------------------------------------------------------------------

# 31. Dataset Storage

``` mermaid
flowchart TB
    DB["Dataset Metadata"] --> OBJ["S3-Compatible Object Storage"]

    OBJ --> V1["Dataset v1"]
    OBJ --> V2["Dataset v2"]
    OBJ --> V3["Dataset v3"]

    API["Dataset API"] --> SIGN["Signed URL Generator"]
    SIGN --> EMAIL["Resend"]
    EMAIL --> USER["Requester"]
    USER --> SIGNED["Signed Download"]
    SIGNED --> OBJ
```

The original historical files remain available for reproducibility.

------------------------------------------------------------------------

# 32. Email Reliability

Email sending must not block the core request.

``` mermaid
flowchart TD
    FORM["Dataset Form"] --> API["Dataset API"]
    API --> DB["Save Request"]
    DB --> JOB["Email Job"]

    JOB --> RESEND["Resend"]

    RESEND -->|Success| DONE["Delivered"]
    RESEND -->|Temporary Failure| RETRY["Retry"]
    RETRY --> RESEND

    RETRY -->|Permanent Failure| FAIL["Failure Record"]
```

------------------------------------------------------------------------

# 33. Failure Architecture

Failures are durable data.

``` mermaid
flowchart TB
    SYS["Any System Component"] --> ERR["Failure Event"]

    ERR --> K["Kafka / Failure Topic"]
    K --> DB["system_failures"]

    DB --> OBS["Observability"]
    DB --> ALERT["Alerts"]
    DB --> REC["Recovery Logic"]
```

------------------------------------------------------------------------

# 34. Failure Categories

Examples:

``` text
ACE_API_TIMEOUT
ACE_API_UNAVAILABLE
ACE_API_INVALID_RESPONSE

KAFKA_PUBLISH_FAILURE
KAFKA_CONSUMER_FAILURE

DATABASE_CONNECTION_FAILURE
DATABASE_WRITE_FAILURE

REDIS_FAILURE

OBJECT_STORAGE_FAILURE

RESEND_FAILURE

TAVILY_FAILURE

LLM_PROVIDER_FAILURE

WEBSOCKET_FAILURE

RAG_FAILURE
```

------------------------------------------------------------------------

# 35. ACE API Failure

The public system should degrade gracefully.

``` mermaid
stateDiagram-v2
    [*] --> Live

    Live --> APIUnavailable : ACE API failure
    APIUnavailable --> Retry : retry
    Retry --> Live : recovered
    Retry --> Degraded : retries exhausted

    Degraded --> CachedData
    CachedData --> Live : API recovered
```

During degradation:

``` text
Live status = false
Last known value = displayed
Last successful update = displayed
Historical data = available
```

The UI must never claim stale data is live.

------------------------------------------------------------------------

# 36. Redis Failure

Redis is rebuildable.

``` mermaid
flowchart LR
    REDIS["Redis unavailable"] --> DB["TimescaleDB"]
    DB --> REBUILD["Rebuild Hot Cache"]
    REBUILD --> REDIS2["Redis restored"]
```

The durable data remains safe.

------------------------------------------------------------------------

# 37. Database Failure

For a database failure:

``` mermaid
flowchart TB
    API["API"] --> DB["PostgreSQL / TimescaleDB"]

    DB -->|failure| RETRY["Retry / Connection Pool"]
    RETRY --> DB

    RETRY -->|persistent failure| DEG["Degraded Mode"]

    DEG --> CACHE["Redis cached data"]
    DEG --> UI["Frontend status"]
```

The system should expose a degraded state rather than silently returning
incorrect data.

------------------------------------------------------------------------

# 38. Data Freshness

Every live value should carry freshness information.

``` text
timestamp
source_timestamp
ingested_at
last_successful_fetch
age_seconds
is_live
```

Conceptual response:

``` json
{
  "powerKw": 2840,
  "sourceTimestamp": "...",
  "ingestedAt": "...",
  "ageSeconds": 12,
  "isLive": true
}
```

------------------------------------------------------------------------

# 39. Developer Portal

``` mermaid
flowchart TB
    DEV["Developer"] --> PORTAL["Developer Portal"]

    PORTAL --> APIREF["API Reference"]
    PORTAL --> LIVE["Live API"]
    PORTAL --> HIST["Historical API"]
    PORTAL --> DATA["Dataset Catalogue"]
    PORTAL --> EXAMPLE["Examples"]
    PORTAL --> DOWNLOAD["Dataset Request"]
```

Suggested sections:

``` text
/developers
/developers/api
/developers/live
/developers/history
/developers/datasets
/developers/examples
```

------------------------------------------------------------------------

# 40. Public API

The API should expose stable application-level contracts.

Conceptual endpoints:

``` text
GET /api/v1/turbines
GET /api/v1/turbines/{id}/live
GET /api/v1/turbines/{id}/summary/today
GET /api/v1/turbines/{id}/history
GET /api/v1/turbines/{id}/events
GET /api/v1/turbines/{id}/statistics
GET /api/v1/datasets
POST /api/v1/datasets/{id}/request
```

WebSocket:

``` text
/ws/turbines/{id}
/ws/chat/{session_id}
```

The exact API contract should be versioned independently of the upstream
ACE API.

------------------------------------------------------------------------

# 41. Application Data Model

``` mermaid
erDiagram
    STORIES ||--o{ STORY_SCENES : contains
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
    CHAT_SESSIONS ||--o| CONVERSATION_SUMMARIES : has
    CHAT_SESSIONS ||--o{ EXPERIENCE_EVENTS : generates

    STORIES {
        uuid id PK
        string slug UK
        string audience
        string title
        text description
        boolean enabled
    }

    STORY_SCENES {
        uuid id PK
        uuid story_id FK
        integer sequence
        string title
        jsonb content
        integer duration_seconds
        boolean enabled
    }

    CHAT_SESSIONS {
        uuid id PK
        string audience
        timestamp created_at
        timestamp last_activity_at
        timestamp expires_at
    }

    CHAT_MESSAGES {
        uuid id PK
        uuid session_id FK
        string role
        text content
        timestamp created_at
        jsonb metadata
    }

    CONVERSATION_SUMMARIES {
        uuid session_id PK
        text summary
        timestamp updated_at
    }

    EXPERIENCE_EVENTS {
        uuid id PK
        uuid session_id FK
        string event_type
        string screen
        timestamp timestamp
        jsonb metadata
    }
```

------------------------------------------------------------------------

# 42. Knowledge Data Model

``` mermaid
erDiagram
    KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_CHUNKS : contains

    KNOWLEDGE_DOCUMENTS {
        uuid id PK
        string title
        string source
        string licence
        string document_type
        timestamp created_at
    }

    KNOWLEDGE_CHUNKS {
        uuid id PK
        uuid document_id FK
        integer chunk_index
        text content
        vector embedding
        jsonb metadata
    }
```

------------------------------------------------------------------------

# 43. Ingestion Reliability

``` mermaid
sequenceDiagram
    participant C as Collector
    participant K as Kafka
    participant DB as TimescaleDB
    participant R as Redis
    participant F as Failure Store

    C->>K: Publish event

    alt Kafka success
        K->>DB: Consume
        DB-->>K: Commit successful
        K->>R: Update live state
    else Kafka failure
        C->>F: Record failure
        C->>C: Retry with backoff
    end
```

------------------------------------------------------------------------

# 44. Background Worker Architecture

Not every task belongs inside the API request lifecycle.

``` mermaid
flowchart TB
    API["FastAPI"] --> Q["Background Job / Queue"]

    Q --> ING["Historical Ingestion"]
    Q --> AGG["Aggregation"]
    Q --> EMAIL["Email Delivery"]
    Q --> EMB["Embedding Jobs"]
    Q --> EXPORT["Dataset Export"]
    Q --> CLEAN["Retention / Cleanup"]
```

Workers should be restartable and idempotent.

------------------------------------------------------------------------

# 45. Deployment --- Contabo

Initial deployment is one Contabo VPS.

``` mermaid
flowchart TB
    INTERNET["Internet"] --> PROXY["Reverse Proxy / TLS"]

    PROXY --> FRONT["Next.js"]
    PROXY --> API["FastAPI"]
    PROXY --> WS["WebSocket"]

    subgraph CONTABO["Contabo VPS"]
        FRONT
        API
        WS

        KAFKA["Kafka"]
        REDIS["Redis"]
        PG["PostgreSQL"]
        TIMESCALE["TimescaleDB"]
        WORKER["Workers"]
        MON["Monitoring"]

        PG --> TIMESCALE
        API --> PG
        API --> REDIS
        WORKER --> KAFKA
        WORKER --> TIMESCALE
        WORKER --> REDIS
    end

    API --> EXT["External Providers"]
    EXT --> ACE["ACE API"]
    EXT --> TAV["Tavily"]
    EXT --> EMAIL["Resend"]
```

------------------------------------------------------------------------

# 46. Container Architecture

Everything should be containerized.

``` mermaid
flowchart TB
    subgraph Docker["Contabo Docker Host"]
        NGINX["Reverse Proxy"]

        FE["frontend"]
        API["backend"]
        ING["collector"]
        WORKER["worker"]
        CHAT["chat-service"]

        K["kafka"]
        REDIS["redis"]
        PG["postgres-timescaledb"]

        MON["monitoring"]
    end

    NGINX --> FE
    NGINX --> API

    API --> REDIS
    API --> PG
    API --> CHAT

    ING --> K
    WORKER --> K
    WORKER --> PG
    WORKER --> REDIS

    CHAT --> REDIS
    CHAT --> PG
```

The first deployment can use Docker Compose.

------------------------------------------------------------------------

# 47. Container Persistence

Stateful services require persistent volumes.

``` mermaid
flowchart TB
    K["Kafka Container"] --> KV["Kafka Persistent Volume"]
    PG["PostgreSQL / TimescaleDB"] --> PV["Postgres Persistent Volume"]
    R["Redis"] --> RV["Redis Persistence"]
    MON["Monitoring"] --> MV["Monitoring Volume"]
```

Containers can be recreated without destroying the underlying state.

------------------------------------------------------------------------

# 48. Contabo Deployment Evolution

### Phase 1

``` text
One Contabo VPS
    │
    └── Docker Compose
```

### Phase 2

``` text
Multiple Contabo VPS nodes
    │
    ├── API nodes
    ├── Worker nodes
    ├── Kafka nodes
    └── Database infrastructure
```

### Phase 3

``` mermaid
flowchart TB
    LB["Load Balancer"] --> A1["API Node 1"]
    LB --> A2["API Node 2"]
    LB --> A3["API Node 3"]

    A1 --> K["Kafka Cluster"]
    A2 --> K
    A3 --> K

    K --> DB["Durable Database"]
```

The application should be designed statelessly from the beginning so
this transition does not require a rewrite.

------------------------------------------------------------------------

# 49. Durability Strategy

Durability is a first-class requirement.

## Source data

Preserve raw ACE responses/events where useful.

## Historical datasets

Preserve original files in object storage.

## Database

Use persistent volumes and automated backups.

## Kafka

Use persistent logs and durable consumer offsets.

## Redis

Treat as rebuildable.

## Chat

Persist only what is necessary; Redis handles hot context and Mem0
handles explicitly useful memory.

## Dataset links

Store dataset metadata and versions so delivery can be reproduced.

------------------------------------------------------------------------

# 50. Backup Architecture

``` mermaid
flowchart TB
    PG["PostgreSQL / TimescaleDB"] --> BACKUP["Automated Backups"]
    BACKUP --> OFFSITE["Off-host / External Backup"]

    OBJ["Object Storage"] --> VERSION["Versioning / Retention"]

    K["Kafka"] --> ARCH["Important Event Archive"]

    CONFIG["Infrastructure Config"] --> GIT["Git Repository"]
```

A single Contabo VPS is a single physical failure domain, so backups
must not exist only on the same VPS.

------------------------------------------------------------------------

# 51. Observability

``` mermaid
flowchart LR
    APP["Applications"] --> OTEL["OpenTelemetry"]

    OTEL --> METRICS["Metrics"]
    OTEL --> LOGS["Logs"]
    OTEL --> TRACES["Traces"]

    METRICS --> PROM["Prometheus"]
    PROM --> GRAF["Grafana"]

    LOGS --> LOGSTORE["Log Storage"]
    TRACES --> TRACESTORE["Trace Storage"]
```

Important metrics:

``` text
ACE fetch success rate
ACE fetch latency
ACE data freshness
Kafka consumer lag
Kafka publish failures
Database latency
Redis hit rate
WebSocket connections
Chat latency
LLM latency
Tavily latency
Email success/failure
Dataset downloads
API error rate
```

------------------------------------------------------------------------

# 52. Health Checks

Every service should expose health/readiness information.

``` text
/health
/ready
```

Readiness should verify only the dependencies necessary for that service
to operate.

Example:

``` mermaid
flowchart LR
    HEALTH["Health Check"] --> API["API"]
    HEALTH --> DB["Database"]
    HEALTH --> REDIS["Redis"]
    HEALTH --> KAFKA["Kafka"]
```

------------------------------------------------------------------------

# 53. Security

Even without public authentication, the platform still requires
security.

### Public APIs

-   rate limiting
-   request validation
-   input size limits
-   CORS policy
-   secure headers
-   TLS

### Chat

-   prompt/input limits
-   abuse controls
-   tool allowlists
-   no arbitrary SQL
-   no arbitrary shell execution

### Dataset downloads

-   signed URLs
-   expiry
-   rate limits
-   download tracking

### Secrets

Never store secrets in the repository.

Use environment variables/secrets management.

------------------------------------------------------------------------

# 54. No Authentication Does Not Mean No Session

The public chatbot can create an anonymous session.

``` mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant API as Backend
    participant R as Redis

    U->>F: Open chat
    F->>API: Create anonymous session
    API->>R: Store session
    API-->>F: session_id
    F->>API: Connect WebSocket
```

No account is required.

------------------------------------------------------------------------

# 55. Rate Limiting

Apply rate limits at multiple levels.

``` text
IP
session
endpoint
chat
dataset requests
WebSocket connections
```

Example conceptual limits:

``` text
Public API → moderate
Chat → stricter
Dataset email requests → strict
WebSocket → connection/message limits
```

Exact limits should be tuned after observing real usage.

------------------------------------------------------------------------

# 56. End-to-End Chat Example

Question:

> "How much electricity did the turbine produce yesterday, and why does
> wind speed affect that?"

``` mermaid
sequenceDiagram
    participant U as User
    participant W as WebSocket
    participant L as LangGraph
    participant TS as TimescaleDB
    participant V as pgvector
    participant M as LLM

    U->>W: Question
    W->>L: Question + session context

    L->>TS: Query yesterday's generation
    TS-->>L: Energy result

    L->>V: Retrieve wind-energy explanation
    V-->>L: Relevant context

    L->>M: Data + knowledge context
    M-->>L: Answer

    L->>W: Stream response
    W-->>U: Answer
```

------------------------------------------------------------------------

# 57. Live Display Example

``` mermaid
sequenceDiagram
    participant A as ACE API
    participant C as Collector
    participant K as Kafka
    participant R as Redis
    participant W as WebSocket
    participant S as Community Screen

    A->>C: Current telemetry
    C->>K: telemetry.raw
    K->>R: Update live state
    R->>W: New state
    W->>S: Update screen

    Note over S: 2.84 MW<br/>8.7 m/s<br/>Generating
```

------------------------------------------------------------------------

# 58. Graceful Degradation

The experience should degrade by capability, not simply fail.

``` mermaid
flowchart TB
    LIVE["Live ACE Data"] --> FULL["Full Live Experience"]

    LIVE -->|Unavailable| CACHE["Last Known Cached Data"]
    CACHE --> DEG["Degraded Live Experience"]

    DEG --> HIST["Historical Data"]
    HIST --> HISTORY["Historical Experience"]

    CHAT["Chat"] -->|LLM unavailable| FALLBACK["Structured Data Responses"]

    WEB["Tavily"] -->|Unavailable| RAG["Local Knowledge / RAG"]
```

Examples:

-   ACE unavailable → show cached latest data + historical charts.
-   Tavily unavailable → answer using ACE knowledge/data.
-   LLM unavailable → keep live dashboard functional.
-   Redis unavailable → query durable storage where possible.
-   WebSocket unavailable → fallback to periodic REST refresh.
-   Resend unavailable → persist email job and retry.

------------------------------------------------------------------------

# 59. WebSocket Fallback

WebSocket is preferred, but not the only path.

``` mermaid
flowchart TB
    UI["Frontend"] --> WS{"WebSocket available?"}

    WS -->|Yes| REAL["Real-time stream"]
    WS -->|No| POLL["Periodic REST polling"]

    REAL --> UI
    POLL --> UI
```

This makes the public screen more robust.

------------------------------------------------------------------------

# 60. Scaling Model

The initial architecture is one VPS, but components are logically
separable.

``` mermaid
flowchart TB
    subgraph Initial["Phase 1 — One Contabo VPS"]
        APP1["Frontend + API"]
        DATA1["Postgres + TimescaleDB"]
        K1["Kafka"]
        R1["Redis"]
        W1["Workers"]
    end

    subgraph Scale["Phase 2 — Scale Out"]
        LB["Load Balancer"]
        A1["API 1"]
        A2["API 2"]
        A3["API 3"]
        K2["Kafka Cluster"]
        DB2["Database HA"]
        R2["Redis"]
    end

    Initial --> Scale
```

------------------------------------------------------------------------

# 61. Why Kafka if there is only one turbine?

Kafka is not being added merely because it sounds scalable.

It gives us decoupling between:

-   ingestion
-   storage
-   aggregation
-   live cache
-   analytics
-   forecasting
-   future research consumers
-   future turbines
-   monitoring

For one turbine, Kafka is operational overhead. Therefore the
implementation should keep Kafka deployment simple initially while
preserving the event-driven boundary.

------------------------------------------------------------------------

# 62. Future Turbines

The schema should never assume one turbine.

``` mermaid
flowchart LR
    A["ACE Turbine 1"] --> K["Kafka"]
    B["Future Turbine 2"] --> K
    C["Future Turbine 3"] --> K

    K --> TS["TimescaleDB"]

    TS --> API["API"]
    API --> UI["Frontend"]
```

Every telemetry event carries `turbine_id`.

------------------------------------------------------------------------

# 63. Future Forecasting

The architecture can later support short-term wind-power forecasting
without changing ingestion.

``` mermaid
flowchart LR
    K["Kafka Telemetry"] --> FEAT["Feature Pipeline"]
    FEAT --> ML["Forecast Model"]
    ML --> FTOPIC["ace.forecast"]
    FTOPIC --> DB["Forecast Storage"]
    DB --> API["Forecast API"]
    API --> UI["Frontend"]
```

------------------------------------------------------------------------

# 64. Technology Stack

## Frontend

  Technology                     Role
  ------------------------------ --------------------------
  Next.js                        Web application
  React                          UI
  TypeScript                     Type safety
  Three.js / React Three Fiber   3D turbine
  WebSocket client               Realtime
  Charting library               Historical visualization

## Backend

  Technology           Role
  -------------------- -----------------------
  Python               Backend language
  FastAPI              REST + WebSocket
  Pydantic             Validation
  Background workers   Data processing
  LangChain            AI tooling
  LangGraph            AI workflow/state
  Mem0                 Conversational memory

## AI

  Technology                        Role
  --------------------------------- -------------------------
  Provider-agnostic LLM adapter     Model abstraction
  Gemini / Groq / future provider   Replaceable LLM backend
  Embedding model                   Semantic indexing
  pgvector                          Vector retrieval
  Tavily                            External web research

The specific LLM provider is intentionally **not locked**.

## Data

  Technology       Role
  ---------------- ---------------------------
  PostgreSQL       Application data
  TimescaleDB      Time-series
  pgvector         Semantic search
  Redis            Cache + hot session state
  Object storage   Historical files

## Streaming

  Technology        Role
  ----------------- ----------------
  Apache Kafka      Event backbone
  Kafka consumers   Processing
  Kafka DLQ         Failed events

## Communication

  Technology   Role
  ------------ ------------------
  Resend       Dataset emails
  WebSocket    Realtime updates

## Infrastructure

  Technology       Role
  ---------------- -----------------------
  Contabo VPS      Initial deployment
  Docker           Containerization
  Docker Compose   Initial orchestration
  Reverse proxy    TLS/routing
  Prometheus       Metrics
  Grafana          Monitoring
  OpenTelemetry    Observability

------------------------------------------------------------------------

# 65. Final Architecture

``` mermaid
flowchart TB
    ACE["ACE API"]

    ACE --> COL["Single ACE Collector"]
    COL --> K["Apache Kafka"]

    K --> RAW["Raw Archive"]
    K --> TS["TimescaleDB"]
    K --> AGG["Aggregation Workers"]
    K --> FAIL["Failure Pipeline"]

    AGG --> TS

    TS --> REDIS["Redis"]
    TS --> API["FastAPI"]

    REDIS --> API
    REDIS --> WS["WebSocket"]

    API --> FRONT["Next.js"]
    WS --> FRONT

    FRONT --> THREE["3D Turbine"]
    FRONT --> STORIES["Kids / Students / Community"]
    FRONT --> DEV["Developer Portal"]

    FRONT --> CHAT["Ask the Turbine"]

    CHAT --> LANG["LangGraph"]
    LANG --> LLM["Provider-Agnostic LLM"]
    LANG --> TOOLS["Turbine Tools"]
    TOOLS --> TS

    LANG --> VEC["pgvector"]
    LANG --> MEM["Mem0"]
    LANG --> TAV["Tavily"]

    FRONT --> DATASET["Dataset Form"]
    DATASET --> RESEND["Resend"]
    DATASET --> OBJ["Object Storage"]

    HIST["Historical Parquet"] --> ING["Historical Ingestion"]
    ING --> OBJ
    ING --> TS
    ING --> VEC
```

------------------------------------------------------------------------

# 66. Locked Decisions

  Decision                       Status
  ------------------------------ -------------------------------
  ACE API fetched once           **LOCKED**
  Kafka event backbone           **LOCKED**
  PostgreSQL                     **LOCKED**
  TimescaleDB                    **LOCKED**
  pgvector                       **LOCKED**
  Redis                          **LOCKED**
  Mem0                           **LOCKED**
  WebSocket                      **LOCKED**
  Tavily                         **LOCKED**
  LangChain                      **LOCKED**
  LangGraph                      **LOCKED**
  LLM provider                   **NOT LOCKED**
  Gemini/Groq/etc.               **Pluggable**
  Next.js/React                  **LOCKED**
  Three.js / R3F                 **LOCKED**
  Resend                         **LOCKED**
  Developer page                 **LOCKED**
  Public user authentication     **NOT REQUIRED**
  Admin panel                    **NOT REQUIRED**
  Dataset approval               **NOT REQUIRED**
  Dataset email delivery         **LOCKED**
  Object storage                 **S3-compatible abstraction**
  Deployment                     **Contabo**
  Initial infrastructure         **One VPS**
  Containerization               **Docker**
  Initial orchestration          **Docker Compose**
  Durable failure records        **LOCKED**
  Historical dataset ingestion   **LOCKED**
  Live frontend data             **LOCKED**

------------------------------------------------------------------------

# 67. Final Data Philosophy

The system has a clear hierarchy:

``` text
                    SOURCE OF TRUTH
                         │
             ┌───────────┴───────────┐
             │                       │
       ACE Live Data          Historical Data
             │                       │
             └───────────┬───────────┘
                         ▼
                       Kafka
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
          Timescale    Archive    Events
              │
        ┌─────┴─────┐
        ▼           ▼
      Redis       APIs
        │           │
        └─────┬─────┘
              ▼
          Experience
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
    Public   Chat    Developer
```

The AI is **not the source of truth**.

The LLM explains data; it does not invent it.

The chatbot uses tools to retrieve actual turbine values.

The database stores the durable history.

Kafka connects the system.

Redis makes it fast.

WebSockets make it live.

Mem0 makes conversations contextual.

pgvector makes knowledge searchable.

Tavily provides current external information.

Object storage preserves the datasets.

And the public frontend turns all of this into an understandable
experience for Lawrence Weston.

------------------------------------------------------------------------

# 68. Implementation Order

The architecture should be implemented in this order:

``` mermaid
flowchart LR
    A["1. Infrastructure"] --> B["2. Database"]
    B --> C["3. ACE Collector"]
    C --> D["4. Kafka Pipeline"]
    D --> E["5. Aggregation"]
    E --> F["6. Redis + WebSocket"]
    F --> G["7. Live Frontend"]
    G --> H["8. Historical Data"]
    H --> I["9. Story Engine"]
    I --> J["10. Developer Portal"]
    J --> K["11. RAG"]
    K --> L["12. LangGraph Chat"]
    L --> M["13. Mem0"]
    M --> N["14. Tavily"]
    N --> O["15. Dataset Email"]
    O --> P["16. Monitoring + Hardening"]
```

This order gets the **data backbone working before AI**, which is
important. The chatbot should be built on top of a reliable turbine data
platform, not become the foundation of it.
