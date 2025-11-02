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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-8">
        <div className="flex-1">
          <PageHeader
            title="admin.bookingManagement"
            description="admin.bookingManagementDescription"
          />
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Neue Buchung
        </Button>
      </div>
      <AdminBookingForm open={isFormOpen} onOpenChange={setIsFormOpen} />
    </>
  );
}

