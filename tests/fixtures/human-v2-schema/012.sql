CREATE TABLE health_episode_state (
  episode_id TEXT PRIMARY KEY REFERENCES health_records(id),
  status TEXT NOT NULL CHECK(status IN ('unknown','ongoing','ended')),
  confirmed_at TEXT NOT NULL DEFAULT '',
  confirmed_until TEXT NOT NULL DEFAULT '',
  next_prompt_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX health_episode_prompt ON health_episode_state(status,next_prompt_at);
CREATE INDEX health_measurement_episode ON health_records(json_extract(payload,'$.episode_id'),deleted,observed_at DESC,id);
