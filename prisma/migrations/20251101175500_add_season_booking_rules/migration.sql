-- AlterTable
ALTER TABLE "PricingPhase" ADD COLUMN     "minNights" INTEGER,
ADD COLUMN     "saturdayToSaturday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "warningMessage" TEXT;

