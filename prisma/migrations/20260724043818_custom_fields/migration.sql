-- AlterTable
ALTER TABLE "Device" ADD COLUMN "fieldOverride" TEXT;

-- CreateTable
CREATE TABLE "CategoryFieldConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "fieldCodes" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "DeviceFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "fieldCode" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "DeviceFieldValue_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CategoryFieldConfig_category_key" ON "CategoryFieldConfig"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceFieldValue_deviceId_fieldCode_key" ON "DeviceFieldValue"("deviceId", "fieldCode");
