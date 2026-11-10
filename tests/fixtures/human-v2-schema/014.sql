CREATE TABLE carbon_runs (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL REFERENCES documents(id),
 source_id TEXT NOT NULL REFERENCES sources(id),
 created_at TEXT NOT NULL,
 fingerprint TEXT NOT NULL UNIQUE,
 payload TEXT NOT NULL
);
CREATE INDEX carbon_runs_document_time ON carbon_runs(document_id,created_at,id);
