CREATE TABLE lab_import_links (
 draft_id TEXT NOT NULL REFERENCES lab_imports(id),
 row_id TEXT NOT NULL,
 observation_id TEXT NOT NULL REFERENCES observations(id),
 source_id TEXT NOT NULL REFERENCES sources(id),
 kind TEXT NOT NULL CHECK(kind IN ('new','duplicate')),
 PRIMARY KEY(draft_id,row_id)
);
