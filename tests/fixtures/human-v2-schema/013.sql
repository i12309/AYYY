CREATE TABLE care_records (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('intake','reminder')),
 occurred_at TEXT NOT NULL,
 version INTEGER NOT NULL,
 deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
 source_id TEXT NOT NULL REFERENCES sources(id),
 payload TEXT NOT NULL
);
CREATE INDEX care_kind_time ON care_records(kind,deleted,occurred_at,id);
CREATE TABLE care_revisions (
 record_id TEXT NOT NULL REFERENCES care_records(id),
 version INTEGER NOT NULL,
 changed_at TEXT NOT NULL,
 action TEXT NOT NULL,
 snapshot TEXT NOT NULL,
 PRIMARY KEY(record_id,version)
);
CREATE TABLE care_preferences (
 id INTEGER PRIMARY KEY CHECK(id=1),
 browser_enabled INTEGER NOT NULL CHECK(browser_enabled IN (0,1)),
 version INTEGER NOT NULL
);
