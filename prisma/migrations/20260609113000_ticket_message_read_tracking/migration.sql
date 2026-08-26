ALTER TABLE "SupportTicketMessage"
ADD COLUMN "requesterReadAt" TIMESTAMP(3),
ADD COLUMN "adminReadAt" TIMESTAMP(3);

CREATE INDEX "SupportTicketMessage_ticketId_requesterReadAt_idx"
ON "SupportTicketMessage"("ticketId", "requesterReadAt");

CREATE INDEX "SupportTicketMessage_ticketId_adminReadAt_idx"
ON "SupportTicketMessage"("ticketId", "adminReadAt");
