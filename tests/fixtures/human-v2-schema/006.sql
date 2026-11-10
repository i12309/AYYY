CREATE TABLE analyte_settings (
    analyte_id TEXT NOT NULL,
    version INTEGER NOT NULL CHECK(version > 0),
    payload TEXT NOT NULL,
    PRIMARY KEY (analyte_id, version)
);
