CREATE INDEX observations_name_unit_document_time
ON observations(name,unit,COALESCE(json_extract(payload,'$.source.document_id'),''),observed_at,id);
