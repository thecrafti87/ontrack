-- AlterTable
ALTER TABLE "Device" ADD COLUMN "gtin" TEXT;

-- CreateIndex
CREATE INDEX "Device_gtin_idx" ON "Device"("gtin");
