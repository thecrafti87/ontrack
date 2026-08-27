-- AlterTable
ALTER TABLE "BulkItem" ADD COLUMN "weightKg" REAL;

-- CreateTable
CREATE TABLE "EventBulkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "bulkItemId" TEXT NOT NULL,
    "plannedQty" INTEGER NOT NULL,
    CONSTRAINT "EventBulkItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventBulkItem_bulkItemId_fkey" FOREIGN KEY ("bulkItemId") REFERENCES "BulkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EventBulkItem_eventId_bulkItemId_key" ON "EventBulkItem"("eventId", "bulkItemId");
