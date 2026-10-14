-- Indexes for the queries the app runs (beyond the primary keys, which already serve every
-- "latest reading" and time-range lookup), plus compression for the long-lived aggregates.

-- Records: the strongest gust and highest power ever, answered without a full scan.
CREATE INDEX scada_10m_asset_power_max_idx ON ts.scada_10m (asset_id, active_power_max_kw DESC NULLS LAST);
CREATE INDEX scada_10m_asset_wind_max_idx  ON ts.scada_10m (asset_id, wind_speed_max_ms DESC NULLS LAST);

-- Status timeline filtered to faults or service visits.
CREATE INDEX status_event_asset_flags_idx ON ts.status_event (asset_id, observed_at DESC)
  WHERE fault_message OR warning_message OR service_mode;

-- Foreign keys whose parent rows are deleted or joined on (cascades stay fast).
CREATE INDEX chat_message_photo_photo_idx ON app.chat_message_photo (photo_id);
CREATE INDEX chunk_embedding_model_idx ON kb.chunk_embedding (model_id);
CREATE INDEX dataset_request_dataset_idx ON app.dataset_request (dataset_id);
CREATE INDEX photo_photographer_idx ON app.photo (photographer_url);

-- Expired dataset links are cleaned up by expiry time.
CREATE INDEX dataset_request_expires_idx ON app.dataset_request (expires_at);

-- The 1-minute aggregates are kept forever: compress them once they stop changing.
ALTER MATERIALIZED VIEW ts.asset_minute SET (timescaledb.enable_columnstore = true);
ALTER MATERIALIZED VIEW ts.site_minute SET (timescaledb.enable_columnstore = true);
CALL add_columnstore_policy('ts.asset_minute', after => INTERVAL '7 days');
CALL add_columnstore_policy('ts.site_minute', after => INTERVAL '7 days');
