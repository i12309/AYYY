CREATE TABLE lab_imports (
 id TEXT PRIMARY KEY,
 document_id TEXT NOT NULL UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
 version INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 payload TEXT NOT NULL
);
