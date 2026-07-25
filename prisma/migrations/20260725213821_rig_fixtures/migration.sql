-- CreateTable
CREATE TABLE "RigFixture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "fixtureId" TEXT,
    "name" TEXT NOT NULL,
    "gdtfSpec" TEXT,
    "gdtfMode" TEXT,
    "layerName" TEXT,
    "className" TEXT,
    "dmxAddresses" TEXT,
    "posX" REAL,
    "posY" REAL,
    "posZ" REAL,
    "deviceId" TEXT,
    "installStatus" TEXT NOT NULL DEFAULT 'GEPLANT',
    "actualPosition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RigFixture_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RigFixture_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RigFixture_eventId_idx" ON "RigFixture"("eventId");
