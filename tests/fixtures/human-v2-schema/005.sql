CREATE TABLE observation_deletions (
 observation_id TEXT PRIMARY KEY REFERENCES observations(id),
 version INTEGER NOT NULL CHECK(version>0),
 deleted_at TEXT NOT NULL
);
CREATE VIEW active_observations AS
 SELECT o.* FROM observations o
 WHERE NOT EXISTS (SELECT 1 FROM observation_deletions d WHERE d.observation_id=o.id);
CREATE VIEW active_timeline AS
 SELECT t.* FROM timeline t
 WHERE t.kind NOT IN ('observation','observation_revision')
 OR NOT EXISTS (SELECT 1 FROM observation_deletions d WHERE d.observation_id=t.entity_id);
