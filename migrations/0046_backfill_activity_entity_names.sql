-- Migration: 0046_backfill_activity_entity_names.sql
-- Date: 2026-03-23
-- Purpose: Backfill entity names into existing activity records for human-readable display.
-- Uses SQLite JSON1 functions (json_set, json_extract) with UPDATE...FROM (SQLite 3.33.0+).

-- 1. Resolve user names (resourceType = 'user')
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.targetName', agents.display_name
)
FROM agents
WHERE activities.resource_type = 'user'
  AND activities.resource_id = agents.id
  AND json_extract(COALESCE(activities.details, '{}'), '$.targetName') IS NULL;

-- 2. Resolve team names (resourceType = 'team', no teamName in details)
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.teamName', teams.name
)
FROM teams
WHERE activities.resource_type = 'team'
  AND activities.resource_id = CAST(teams.id AS TEXT)
  AND json_extract(COALESCE(activities.details, '{}'), '$.teamName') IS NULL;

-- 3. Resolve tag names (resourceType = 'tag')
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.tagName', tags.name
)
FROM tags
WHERE activities.resource_type = 'tag'
  AND activities.resource_id = CAST(tags.id AS TEXT)
  AND json_extract(COALESCE(activities.details, '{}'), '$.tagName') IS NULL;

-- 4. Resolve customer names for tag_assign/tag_unassign
--    (these use resourceType='customer', resourceId=customerId)
UPDATE activities
SET details = json_set(
  COALESCE(details, '{}'),
  '$.customerName', customers.display_name
)
FROM customers
WHERE activities.action IN ('tag_assign', 'tag_unassign')
  AND activities.resource_type = 'customer'
  AND activities.resource_id = CAST(customers.id AS TEXT)
  AND json_extract(COALESCE(activities.details, '{}'), '$.customerName') IS NULL;
