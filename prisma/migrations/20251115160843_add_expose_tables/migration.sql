-- CreateEnum
DO $$ BEGIN
CREATE TYPE "ExposeImagePlacement" AS ENUM ('ABOVE', 'BELOW', 'GALLERY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "ExposeSection" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExposeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expose" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "imageText" TEXT,
    "sectionId" TEXT,
    "placement" "ExposeImagePlacement" NOT NULL DEFAULT 'BELOW',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExposeSection_order_idx" ON "ExposeSection"("order");

-- CreateIndex
CREATE INDEX "ExposeSection_title_idx" ON "ExposeSection"("title");

-- CreateIndex
CREATE INDEX "Expose_order_idx" ON "Expose"("order");

-- CreateIndex
CREATE INDEX "Expose_isActive_idx" ON "Expose"("isActive");

-- CreateIndex
CREATE INDEX "Expose_sectionId_idx" ON "Expose"("sectionId");

-- CreateIndex
CREATE INDEX "Expose_placement_idx" ON "Expose"("placement");

-- AddForeignKey
ALTER TABLE "Expose" ADD CONSTRAINT "Expose_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExposeSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

