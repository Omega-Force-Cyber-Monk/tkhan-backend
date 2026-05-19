WITH ranked_conversations AS (
  SELECT
    id,
    "buyerId",
    "groomerId",
    ROW_NUMBER() OVER (
      PARTITION BY "buyerId", "groomerId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS rank,
    FIRST_VALUE(id) OVER (
      PARTITION BY "buyerId", "groomerId"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS canonical_id
  FROM "ChatConversation"
),
duplicate_conversations AS (
  SELECT id, canonical_id
  FROM ranked_conversations
  WHERE rank > 1
)
UPDATE "ChatMessage" AS message
SET "conversationId" = duplicate.canonical_id
FROM duplicate_conversations AS duplicate
WHERE message."conversationId" = duplicate.id;

DELETE FROM "ChatConversation" AS conversation
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "buyerId", "groomerId"
        ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
      ) AS rank
    FROM "ChatConversation"
  ) ranked
  WHERE ranked.rank > 1
) AS duplicate
WHERE conversation.id = duplicate.id;

UPDATE "ChatConversation"
SET "bookingId" = NULL
WHERE "bookingId" IS NOT NULL;

DROP INDEX IF EXISTS "ChatConversation_buyerId_groomerId_bookingId_key";
CREATE UNIQUE INDEX "ChatConversation_buyerId_groomerId_key"
ON "ChatConversation"("buyerId", "groomerId");
