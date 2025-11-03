-- =========================================================
-- SQL-Befehl um Buchung 909993 auf PENDING zu setzen
-- =========================================================

-- Option 1: Über bookingCode (wahrscheinlich 909993)
UPDATE "Booking"
SET 
  status = 'PENDING',
  "updatedAt" = NOW(),
  "approvedAt" = NULL,
  "approvedById" = NULL,
  "rejectedAt" = NULL,
  "rejectedById" = NULL,
  "rejectionReason" = NULL,
  "cancelledAt" = NULL,
  "cancellationReason" = NULL
WHERE "bookingCode" = '909993';

-- Option 2: Falls 909993 die ID ist statt bookingCode
-- UPDATE "Booking"
-- SET 
--   status = 'PENDING',
--   "updatedAt" = NOW(),
--   "approvedAt" = NULL,
--   "approvedById" = NULL,
--   "rejectedAt" = NULL,
--   "rejectedById" = NULL,
--   "rejectionReason" = NULL,
--   "cancelledAt" = NULL,
--   "cancellationReason" = NULL
-- WHERE id = '909993';

-- Prüfen ob die Buchung gefunden wurde
SELECT id, "bookingCode", status, "guestEmail", "startDate", "endDate"
FROM "Booking"
WHERE "bookingCode" = '909993' OR id = '909993';

