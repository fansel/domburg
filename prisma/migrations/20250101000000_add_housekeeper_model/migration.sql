-- CreateTable
CREATE TABLE "Housekeeper" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Housekeeper_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Housekeeper_email_key" ON "Housekeeper"("email");

-- CreateIndex
CREATE INDEX "Housekeeper_email_idx" ON "Housekeeper"("email");

-- CreateIndex
CREATE INDEX "Housekeeper_isActive_idx" ON "Housekeeper"("isActive");
