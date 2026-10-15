-- Dataset downloads are now instant only: the "email me a link" flow and the tables that
-- recorded its requests are gone. (app.dataset, the catalogue, stays.)
DROP TABLE IF EXISTS app.dataset_download;
DROP TABLE IF EXISTS app.dataset_request;
DROP TABLE IF EXISTS app.requester;
