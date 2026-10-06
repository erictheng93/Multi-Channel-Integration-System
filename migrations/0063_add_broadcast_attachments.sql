-- ===============================================
-- Migration 0063: broadcast image attachments
-- ===============================================
-- Date: 2026-10-06
--
-- A broadcast carries optional text plus up to 4 images (LINE multicast
-- allows 5 message objects). Each image has an original (<=10MB) and a
-- client-generated preview (<=1MB, LINE previewImageUrl limit).
-- UNIQUE constraints are inline so a schema.ts-driven rebuild keeps them
-- (see the 2026-06-17 drift incident).
CREATE TABLE IF NOT EXISTS broadcast_attachments (
  id INTEGER PRIMARY KEY,
  broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL REFERENCES file_attachments(id) ON DELETE RESTRICT,
  preview_attachment_id TEXT NOT NULL REFERENCES file_attachments(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (broadcast_id, position),
  UNIQUE (broadcast_id, attachment_id)
);
