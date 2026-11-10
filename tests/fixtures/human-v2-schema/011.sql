CREATE TABLE medical_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('allergy','medication','vaccination','condition')),
  status TEXT NOT NULL,
  search_text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  source_id TEXT NOT NULL REFERENCES sources(id),
  payload TEXT NOT NULL
);
CREATE INDEX medical_records_kind ON medical_records(kind,deleted,status,updated_at DESC,id);
CREATE TABLE medical_revisions (
  record_id TEXT NOT NULL REFERENCES medical_records(id),
  version INTEGER NOT NULL,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  PRIMARY KEY(record_id,version)
);
