CREATE TABLE recommendation_intakes (version INTEGER PRIMARY KEY, payload TEXT NOT NULL);
CREATE TABLE recommendation_contexts (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, hash TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TABLE recommendation_reports (id TEXT PRIMARY KEY, context_id TEXT NOT NULL REFERENCES recommendation_contexts(id), request_id TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, version INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE INDEX recommendation_reports_created ON recommendation_reports(created_at DESC,id);
CREATE TABLE recommendation_revisions (report_id TEXT NOT NULL REFERENCES recommendation_reports(id), version INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(report_id,version));
