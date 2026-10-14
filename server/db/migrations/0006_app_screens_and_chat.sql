-- Screens and visitor chats. A chat message's sources, photos, citations and screen actions
-- are separate facts, so each lives in its own table keyed by (message, position).

CREATE TABLE app.screen (
  screen_id  text PRIMARY KEY CHECK (screen_id ~ '^[a-z0-9-]+$'),
  title      text NOT NULL
);

CREATE TABLE app.screen_action (
  action_id    text PRIMARY KEY CHECK (action_id ~ '^[a-z_]+$'),
  description  text NOT NULL
);

CREATE TABLE app.chat_role (
  role_id  text PRIMARY KEY
);

-- A visitor's conversation, opened from one screen's QR code. Holds no personal data.
CREATE TABLE app.chat_session (
  session_id  uuid PRIMARY KEY,
  screen_id   text NOT NULL REFERENCES app.screen,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_session_created_at_idx ON app.chat_session (created_at);

CREATE TABLE app.chat_message (
  session_id  uuid NOT NULL REFERENCES app.chat_session ON DELETE CASCADE,
  seq         integer NOT NULL CHECK (seq >= 1),
  role_id     text NOT NULL REFERENCES app.chat_role,
  content     text NOT NULL CHECK (length(content) BETWEEN 1 AND 20000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, seq)
);

-- Web pages cited in answers (one row per URL).
CREATE TABLE app.web_page (
  page_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  url      text NOT NULL UNIQUE CHECK (url ~ '^https?://'),
  title    text NOT NULL
);

CREATE TABLE app.chat_message_web_source (
  session_id  uuid NOT NULL,
  seq         integer NOT NULL,
  position    smallint NOT NULL CHECK (position >= 1),
  page_id     bigint NOT NULL REFERENCES app.web_page,
  PRIMARY KEY (session_id, seq, position),
  UNIQUE (session_id, seq, page_id),
  FOREIGN KEY (session_id, seq) REFERENCES app.chat_message ON DELETE CASCADE
);

-- Unsplash photos shown with answers, and their photographers.
CREATE TABLE app.photographer (
  profile_url  text PRIMARY KEY CHECK (profile_url ~ '^https://'),
  name         text NOT NULL
);

CREATE TABLE app.photo (
  photo_id          text PRIMARY KEY,
  photographer_url  text NOT NULL REFERENCES app.photographer,
  alt_text          text NOT NULL,
  color             text NOT NULL,
  width             integer NOT NULL CHECK (width > 0),
  height            integer NOT NULL CHECK (height > 0),
  thumb_url         text NOT NULL,
  regular_url       text NOT NULL,
  page_url          text NOT NULL
);

CREATE TABLE app.chat_message_photo (
  session_id  uuid NOT NULL,
  seq         integer NOT NULL,
  position    smallint NOT NULL CHECK (position >= 1),
  photo_id    text NOT NULL REFERENCES app.photo,
  PRIMARY KEY (session_id, seq, position),
  UNIQUE (session_id, seq, photo_id),
  FOREIGN KEY (session_id, seq) REFERENCES app.chat_message ON DELETE CASCADE
);

-- Screen animations an answer triggered on the hoarding.
CREATE TABLE app.chat_message_screen_action (
  session_id  uuid NOT NULL,
  seq         integer NOT NULL,
  position    smallint NOT NULL CHECK (position >= 1),
  action_id   text NOT NULL REFERENCES app.screen_action,
  PRIMARY KEY (session_id, seq, position),
  FOREIGN KEY (session_id, seq) REFERENCES app.chat_message ON DELETE CASCADE
);
