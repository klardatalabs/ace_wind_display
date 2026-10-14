// Identifiers for rows the code refers to by name (seeded by seed.js).

export const LIVE_SOURCE = "ace-live-api";
export const ZENODO_SOURCE = "zenodo";
export const LIVE_RELEASE_REF = "live";

export const JOBS = {
  "history-sync": "Sync 10-minute SCADA history from the ACE API",
  "zenodo-import": "Import the latest verified Zenodo archive release",
  "chat-retention": "Delete chat sessions older than the retention period",
};

// The kinds of step the chat agent takes; labels are what the phone shows in the activity graph.
export const AGENT_STEP_KINDS = {
  live_status: "Checking the turbine's live data",
  history: "Looking through the turbine's history",
  knowledge_search: "Reading the books",
  web_search: "Searching the web",
  photo_search: "Finding pictures",
  screen_action: "Moving the big screen",
};
