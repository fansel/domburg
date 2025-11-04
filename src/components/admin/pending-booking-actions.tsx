"use client";

import { useEffect, useState } from "react";
import { BookingActions } from "@/components/booking-actions";

interface PendingBookingActionsProps {
  bookingId: string;
  initialAdminNotes?: string | null;
}

export function PendingBookingActions({ bookingId, initialAdminNotes }: PendingBookingActionsProps) {
  const [canApprove, setCanApprove] = useState(true);

  useEffect(() => {
    async function checkPermissions() {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        if (data.authenticated && data.user) {
          // SUPERADMIN hat immer alle Rechte
          setCanApprove(data.role === "SUPERADMIN" || (data.permissions?.canApproveBookings !== false));
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
      }
    }
    checkPermissions();
  }, []);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <BookingActions bookingId={bookingId} canApprove={canApprove} initialAdminNotes={initialAdminNotes} />
    </div>
  );
}

