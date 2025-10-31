import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, getDaysBetween } from "@/lib/utils";
import { BookingActions } from "@/components/booking-actions";
import { Calendar, CheckCircle, XCircle, Clock, ChevronRight } from "lucide-react";
import Link from "next/link";
import { BookingsTabs } from "@/components/admin/bookings-tabs";
import { StatCard } from "@/components/admin/stat-card";
import { BookingsHeader } from "@/components/admin/bookings-header";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
  });

  const pendingBookings = bookings.filter((b) => b.status === "PENDING");
  const approvedBookings = bookings.filter((b) => b.status === "APPROVED");
  const otherBookings = bookings.filter(
    (b) => !["PENDING", "APPROVED"].includes(b.status)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">Ausstehend</Badge>;
      case "APPROVED":
        return <Badge variant="success">Genehmigt</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Abgelehnt</Badge>;
      case "CANCELLED":
        return <Badge variant="outline">Storniert</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const BookingCard = ({ booking }: { booking: typeof bookings[0] }) => {
    const nights = getDaysBetween(booking.startDate, booking.endDate);
    const isPending = booking.status === "PENDING";

    const cardContent = (
      <>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-base sm:text-lg truncate">
                {booking.guestName || booking.guestEmail}
              </CardTitle>
              <CardDescription className="space-y-1">
                <div className="truncate text-xs sm:text-sm">{booking.guestEmail}</div>
                <div className="font-mono text-[10px] sm:text-xs">{booking.bookingCode}</div>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {getStatusBadge(booking.status)}
              {!isPending && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-xs sm:text-sm">
                  {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                </span>
              </div>
              <span className="text-muted-foreground text-xs sm:text-sm ml-5 sm:ml-0">
                ({nights} {nights === 1 ? "Nacht" : "Nächte"})
              </span>
            </div>
            <div className="text-xs sm:text-sm">
              <span className="font-medium">Gäste:</span> {booking.numberOfGuests}
            </div>
            {booking.totalPrice && (
              <div className="text-sm">
                <span className="font-medium">Preis:</span>{" "}
                {formatCurrency(parseFloat(booking.totalPrice.toString()))}
              </div>
            )}
            {booking.message && (
              <div className="text-sm">
                <div className="font-medium">Nachricht:</div>
                <div className="mt-1 text-muted-foreground">{booking.message}</div>
              </div>
            )}
            {booking.rejectionReason && (
              <div className="text-sm">
                <div className="font-medium text-destructive">Ablehnungsgrund:</div>
                <div className="mt-1 text-destructive">{booking.rejectionReason}</div>
              </div>
            )}
            {booking.adminNotes && (
              <div className="text-sm">
                <div className="font-medium">Admin-Notizen:</div>
                <div className="mt-1 text-muted-foreground">{booking.adminNotes}</div>
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Erstellt: {formatDate(booking.createdAt)}
            </div>
          </div>

          {isPending && (
            <BookingActions bookingId={booking.id} />
          )}
        </CardContent>
      </>
    );

    if (isPending) {
      // PENDING bookings: Not clickable, show actions
      return <Card className="transition-colors">{cardContent}</Card>;
    }

    // Other bookings: Clickable card
    return (
      <Link href={`/admin/bookings/${booking.id}`} className="block">
        <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
          {cardContent}
        </Card>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-4 py-8">
        <BookingsHeader />

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <StatCard
            title="booking.pending"
            value={pendingBookings.length}
            icon={<Clock className="h-4 w-4 text-yellow-600" />}
          />
          <StatCard
            title="booking.approved"
            value={approvedBookings.length}
            icon={<CheckCircle className="h-4 w-4 text-green-600" />}
          />
          <StatCard
            title="admin.total"
            value={bookings.length}
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          />
        </div>

        <BookingsTabs
          pendingCount={pendingBookings.length}
          approvedCount={approvedBookings.length}
          otherCount={otherBookings.length}
          pendingContent={
            pendingBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Keine ausstehenden Buchungen
                  </h3>
                  <p className="text-muted-foreground">
                    Alle Buchungsanfragen wurden bearbeitet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </>
            )
          }
          approvedContent={
            approvedBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Keine genehmigten Buchungen
                  </h3>
                  <p className="text-muted-foreground">
                    Noch keine Buchungen genehmigt
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {approvedBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </>
            )
          }
          otherContent={
            otherBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <XCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Keine weiteren Buchungen
                  </h3>
                </CardContent>
              </Card>
            ) : (
              <>
                {otherBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </>
            )
          }
        />
      </div>
    </div>
  );
}

