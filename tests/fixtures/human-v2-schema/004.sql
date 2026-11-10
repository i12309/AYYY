CREATE TABLE analyte_aliases (
 normalized_name TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 payload TEXT NOT NULL,
 PRIMARY KEY(normalized_name,version)
);
