CREATE TABLE journal_entries (
  kind TEXT NOT NULL CHECK(kind IN ('meal','activity')),
  id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  title TEXT NOT NULL,
  search_title TEXT NOT NULL,
  version INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1)),
  payload TEXT NOT NULL,
  PRIMARY KEY(kind,id)
);
CREATE INDEX journal_date ON journal_entries(kind,deleted,occurred_at DESC,id);
CREATE TABLE journal_revisions (
  kind TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  action TEXT NOT NULL,
  PRIMARY KEY(kind,entry_id,version),
  FOREIGN KEY(kind,entry_id) REFERENCES journal_entries(kind,id)
);
