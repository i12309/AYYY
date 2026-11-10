CREATE TABLE analyte_favorites (
    analyte_id TEXT PRIMARY KEY,
    favorite INTEGER NOT NULL CHECK(favorite IN (0,1)),
    version INTEGER NOT NULL CHECK(version > 0),
    updated_at TEXT NOT NULL
);
