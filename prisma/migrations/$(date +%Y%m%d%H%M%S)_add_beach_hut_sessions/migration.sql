-- CreateTable
CREATE TABLE "BeachHutSession" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeachHutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BeachHutSession_startDate_endDate_idx" ON "BeachHutSession"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "BeachHutSession_isActive_idx" ON "BeachHutSession"("isActive");

