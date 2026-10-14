-- Extensions and the four schemas:
--   core  reference data (sites, turbine models, assets, data sources)
--   ts    time series (TimescaleDB hypertables and continuous aggregates)
--   app   application data (screens, chats, dataset requests, job runs)
--   kb    knowledge base (documents, chunks, embeddings)

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS ts;
CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS kb;
