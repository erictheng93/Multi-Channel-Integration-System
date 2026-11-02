-- Migration 0069: message_daily_stats rollup + stats_watermarks
-- ===============================================================
-- Date: 2026-10-29
--
-- WHY: the dashboard (message volume, summary, channel activity) used to scan the
-- messages table on every cache miss. D1 bills per row read, and that cost grows
-- with history. Reading this rollup costs O(days in range), independent of how many
-- messages those days contain, and an admin read touches one row per day x platform.
--
-- message_daily_stats counts non-deleted messages. One logical row per
-- (team, sender type, Asia/Taipei day, customer platform):
--   team_id     the conversation's assigned_team_id AT AGGREGATION TIME;
--               0  = unassigned shared pool (0, not NULL: NULL never conflicts in a
--                    PRIMARY KEY, so an upsert on a NULL team would insert duplicates)
--               -1 = ALL TEAMS (the sum of every team row; what admins read, so an
--                    admin never touches per-team rows)
--               A later reassignment does not move already-aggregated counts; the
--               nightly heal recomputes the last 2 Taipei days with the current team.
--   sender_type 'customer' | 'agent' | 'system'
--   day         'YYYY-MM-DD' in Asia/Taipei (UTC+8, no DST): date(created_at, '+8 hours');
--               '0000-00-00' = ALL-TIME total (team -1 only), so "total messages" is
--               one row per platform and sender instead of one per day.
--   platform    customers.platform of the conversation's customer, 'unknown' if none
-- Key order is (team_id, sender_type, day, platform) and the table is WITHOUT ROWID:
-- a read for "customer messages, days X..Y" is one contiguous key range holding only
-- the rows it needs, and every row read is a single b-tree row (no second lookup).
-- Agent scoping = sum of their teams + team 0, matching conversation-visibility.ts.
--
-- stats_watermarks: key/value.
--   'message_daily_stats'     ISO instant up to which messages are folded into the rollup
--                             (the */5 cron advances it atomically with the counts, so a
--                             re-run never double counts)
--   'last_activity:<platform>' newest customer/agent message per platform (channel "last
--                             activity", not derivable from day buckets)

CREATE TABLE IF NOT EXISTS message_daily_stats (
  team_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL,
  day TEXT NOT NULL,
  platform TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (team_id, sender_type, day, platform)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS stats_watermarks (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Watermark first (1 minute behind now so rows still being committed are not skipped),
-- then backfill everything up to it. Messages after the watermark are folded in by
-- the next cron run, and readers add them live.
INSERT OR REPLACE INTO stats_watermarks (key, value, updated_at)
VALUES (
  'message_daily_stats',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 minute'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

DELETE FROM message_daily_stats;

-- Per-team rows
INSERT INTO message_daily_stats (team_id, sender_type, day, platform, count)
SELECT COALESCE(c.assigned_team_id, 0),
       m.sender_type,
       date(m.created_at, '+8 hours'),
       COALESCE(cu.platform, 'unknown'),
       COUNT(*)
FROM messages m
INNER JOIN conversations c ON c.id = m.conversation_id
LEFT JOIN customers cu ON cu.id = c.customer_id
WHERE m.deleted_at IS NULL
  AND m.created_at <= (SELECT value FROM stats_watermarks WHERE key = 'message_daily_stats')
GROUP BY 1, 2, 3, 4;

-- All-teams rows (team -1), per day
INSERT INTO message_daily_stats (team_id, sender_type, day, platform, count)
SELECT -1,
       m.sender_type,
       date(m.created_at, '+8 hours'),
       COALESCE(cu.platform, 'unknown'),
       COUNT(*)
FROM messages m
INNER JOIN conversations c ON c.id = m.conversation_id
LEFT JOIN customers cu ON cu.id = c.customer_id
WHERE m.deleted_at IS NULL
  AND m.created_at <= (SELECT value FROM stats_watermarks WHERE key = 'message_daily_stats')
GROUP BY 1, 2, 3, 4;

-- All-time totals (team -1, day '0000-00-00')
INSERT INTO message_daily_stats (team_id, sender_type, day, platform, count)
SELECT -1,
       m.sender_type,
       '0000-00-00',
       COALESCE(cu.platform, 'unknown'),
       COUNT(*)
FROM messages m
INNER JOIN conversations c ON c.id = m.conversation_id
LEFT JOIN customers cu ON cu.id = c.customer_id
WHERE m.deleted_at IS NULL
  AND m.created_at <= (SELECT value FROM stats_watermarks WHERE key = 'message_daily_stats')
GROUP BY 1, 2, 3, 4;

INSERT OR REPLACE INTO stats_watermarks (key, value, updated_at)
SELECT 'last_activity:' || COALESCE(cu.platform, 'unknown'),
       MAX(m.created_at),
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM messages m
INNER JOIN conversations c ON c.id = m.conversation_id
LEFT JOIN customers cu ON cu.id = c.customer_id
WHERE m.deleted_at IS NULL
  AND m.sender_type IN ('customer', 'agent')
  AND m.created_at <= (SELECT value FROM stats_watermarks WHERE key = 'message_daily_stats')
GROUP BY COALESCE(cu.platform, 'unknown');
