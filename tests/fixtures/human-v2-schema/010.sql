CREATE TABLE health_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  source_id TEXT NOT NULL REFERENCES sources(id),
  payload TEXT NOT NULL
);
CREATE INDEX health_records_date ON health_records(deleted,observed_at DESC,id);
CREATE INDEX health_records_kind_date ON health_records(kind,deleted,observed_at DESC,id);
CREATE TABLE health_revisions (
  record_id TEXT NOT NULL REFERENCES health_records(id),
  version INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  PRIMARY KEY(record_id,version)
);
CREATE TABLE profile_revisions (
  version INTEGER PRIMARY KEY,
  changed_at TEXT NOT NULL,
  snapshot TEXT NOT NULL
);
