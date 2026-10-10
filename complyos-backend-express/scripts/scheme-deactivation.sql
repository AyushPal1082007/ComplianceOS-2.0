-- Local review only. Inspect the preview before executing the UPDATE.
-- Allowed official domain roots and their subdomains:
--   gov.in, nic.in, odopup.in
-- Table/column names are unverified against the deployment's prisma/schema.prisma and database.
-- Repository mapping checked: Scheme -> schemes; sourceUrl -> source_url;
-- checkedBy -> checked_by; isActive -> is_active; id and name are unchanged.
BEGIN;

CREATE TEMP TABLE scheme_deactivation_targets ON COMMIT DROP AS
WITH allowed_hosts(host_suffix) AS (
  VALUES
    ('gov.in'),
    ('nic.in'),
    ('odopup.in')
),
scheme_candidates AS (
  SELECT
    schemes.id,
    schemes.name,
    schemes.source_url,
    schemes.checked_by,
    schemes.is_active,
    substring(lower(btrim(schemes.source_url)) FROM '^https://([^/:?#]+)') AS source_host
  FROM schemes
  WHERE schemes.is_active = TRUE
),
classified AS (
  SELECT
    scheme_candidates.*,
    CASE
      WHEN NULLIF(BTRIM(source_url), '') IS NULL
        OR source_url ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
        OR source_url ~* 'TODO_VERIFY_OFFICIAL_URL'
        THEN 'missing or placeholder source_url'
      WHEN NULLIF(BTRIM(checked_by), '') IS NULL
        OR checked_by ~* 'TODO[[:space:]]*[(][[:space:]]*owner[[:space:]]*[)]'
        OR checked_by ~* 'TODO_VERIFY_OFFICIAL_URL'
        THEN 'missing or placeholder checked_by'
      WHEN source_host IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM allowed_hosts
          WHERE source_host = host_suffix
            OR source_host LIKE '%.' || host_suffix
        )
        THEN 'source is not an allowed official host'
    END AS deactivation_reason
  FROM scheme_candidates
)
SELECT id, name, source_url, checked_by, deactivation_reason
FROM classified
WHERE deactivation_reason IS NOT NULL;

-- This preview lists the exact rows targeted by the UPDATE below.
SELECT id, name, source_url, checked_by, deactivation_reason
FROM scheme_deactivation_targets
ORDER BY name, id;

UPDATE schemes
SET is_active = FALSE
WHERE id IN (SELECT id FROM scheme_deactivation_targets);

-- Switch to COMMIT only after reviewing the preview.
ROLLBACK;
