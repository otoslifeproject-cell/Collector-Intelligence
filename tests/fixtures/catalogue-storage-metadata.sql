-- DISPOSABLE ONLY: Storage metadata stand-in, not Supabase Storage API/bytes.
-- The unchanged original 002 migration installs the actual application policies.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, public boolean NOT NULL DEFAULT false,
 file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE storage.objects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text NOT NULL REFERENCES storage.buckets(id), name text NOT NULL,
 UNIQUE(bucket_id,name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE
 SET search_path=pg_catalog AS $$
 SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]
$$;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT ON storage.objects TO authenticated;
