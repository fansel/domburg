import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { BookingDetailView } from "@/components/admin/booking-detail-view";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; month?: string; year?: string };
}) {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      messages: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!booking) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href={
              searchParams?.from === "calendar" 
                ? `/admin/calendar${searchParams?.month && searchParams?.year ? `?month=${searchParams.month}&year=${searchParams.year}` : ""}`
                : "/admin/bookings"
            }
          >
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {searchParams?.from === "calendar" ? "Zurück zum Kalender" : "Zurück zu Buchungen"}
            </Button>
          </Link>
        </div>

        <BookingDetailView booking={booking} currentUser={user} />
      </div>
    </div>
  );
}

