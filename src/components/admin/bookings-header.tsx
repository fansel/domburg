"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AdminBookingForm } from "@/components/admin/admin-booking-form";
import { PageHeader } from "@/components/admin/page-header";

export function BookingsHeader() {
  const [isFormOpen, setIsFormOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <PageHeader
          title="admin.bookingManagement"
          description="admin.bookingManagementDescription"
        />
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neue Buchung
        </Button>
      </div>
      <AdminBookingForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </>
  );
}

