-- Researcher dataset requests and background job runs. A request names a dataset and a
-- range of UK dates; its link (only ever sent by email) streams exactly that range as CSV
-- straight from the time-series tables.

CREATE TABLE app.dataset (
  dataset_id      text PRIMARY KEY CHECK (dataset_id ~ '^[a-z0-9_]+$'),
  label           text NOT NULL,
  description     text NOT NULL,
  max_range_days  integer NOT NULL CHECK (max_range_days > 0)
);

CREATE TABLE app.requester (
  requester_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL UNIQUE CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

-- Only a SHA-256 of the download token is stored, so a database leak reveals no live links.
CREATE TABLE app.dataset_request (
  request_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_id   bigint NOT NULL REFERENCES app.requester ON DELETE CASCADE,
  dataset_id     text NOT NULL REFERENCES app.dataset,
  full_name      text CHECK (length(full_name) <= 120),
  organisation   text CHECK (length(organisation) <= 160),
  purpose        text CHECK (length(purpose) <= 1000),
  date_from      date NOT NULL,
  date_to        date NOT NULL CHECK (date_to >= date_from),
  token_sha256   bytea NOT NULL UNIQUE CHECK (length(token_sha256) = 32),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  emailed_at     timestamptz,
  CHECK (expires_at > requested_at)
);
CREATE INDEX dataset_request_requester_idx ON app.dataset_request (requester_id, requested_at DESC);

CREATE TABLE app.dataset_download (
  request_id     bigint NOT NULL REFERENCES app.dataset_request ON DELETE CASCADE,
  downloaded_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, downloaded_at)
);

CREATE TABLE app.job (
  job_id       text PRIMARY KEY,
  description  text NOT NULL
);

CREATE TABLE app.job_run (
  run_id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id         text NOT NULL REFERENCES app.job,
  started_at     timestamptz NOT NULL DEFAULT now(),
  finished_at    timestamptz,
  outcome        text NOT NULL DEFAULT 'running' CHECK (outcome IN ('running', 'succeeded', 'failed')),
  rows_fetched   integer CHECK (rows_fetched >= 0),
  rows_written   integer CHECK (rows_written >= 0),
  rows_rejected  integer CHECK (rows_rejected >= 0),
  error_summary  text CHECK (length(error_summary) <= 500),
  CHECK ((outcome = 'running') = (finished_at IS NULL))
);
CREATE INDEX job_run_job_started_idx ON app.job_run (job_id, started_at DESC);
