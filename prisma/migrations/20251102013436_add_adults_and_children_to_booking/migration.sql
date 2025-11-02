-- AlterTable: Add numberOfAdults and numberOfChildren, remove numberOfGuests
ALTER TABLE "Booking" ADD COLUMN "numberOfAdults" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "numberOfChildren" INTEGER NOT NULL DEFAULT 0;

-- Migrate existing data: assume all numberOfGuests are adults
UPDATE "Booking" SET "numberOfAdults" = "numberOfGuests", "numberOfChildren" = 0;

-- Remove old column
ALTER TABLE "Booking" DROP COLUMN "numberOfGuests";
