-- CreateTable
CREATE TABLE "ExternalReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "deviceId" TEXT,
    "description" TEXT NOT NULL,
    "contact" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEU',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledById" TEXT,
    "handledAt" DATETIME,
    "issueId" TEXT,
    CONSTRAINT "ExternalReport_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExternalReport_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExternalReport_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExternalReport_status_createdAt_idx" ON "ExternalReport"("status", "createdAt");
