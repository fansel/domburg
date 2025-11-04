import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { formatDate, formatCurrency, getDaysBetween } from "@/lib/utils";
import { PendingBookingActions } from "@/components/admin/pending-booking-actions";
import { Calendar, CheckCircle, XCircle, Clock, ChevronRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { BookingsTabs } from "@/components/admin/bookings-tabs";
import { StatCard } from "@/components/admin/stat-card";
import { BookingsHeader } from "@/components/admin/bookings-header";
import { findAllConflicts } from "@/lib/booking-conflicts";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }

  // Prüfe ob User Buchungen sehen darf
  if (!user.canSeeBookings) {
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

  // Lade Konflikte server-side
  let conflictsCount = 0;
  try {
    const conflicts = await findAllConflicts();
    conflictsCount = conflicts.length;
  } catch (error) {
    console.error("Error loading conflicts:", error);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Badge variant="warning">Ausstehend</Badge>;
      case "APPROVED":
        return <Badge variant="success">Genehmigt</Badge>;
      case "REJECTED":
        return <Badge variant="destructive">Abgelehnt</Badge>;
      case "CANCELLED":
        return <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">Storniert</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const BookingCard = ({ booking }: { booking: typeof bookings[0] }) => {
    const nights = getDaysBetween(booking.startDate, booking.endDate);
    const isPending = booking.status === "PENDING";

    // All bookings (including PENDING) are now clickable to view/edit details
    return (
      <Card className="hover:bg-muted/50 transition-colors">
        <Link href={`/admin/bookings/${booking.id}`} className="block">
          <CardHeader className="pb-3 sm:pb-6">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <CardTitle className="text-sm sm:text-base lg:text-lg truncate">
                  {booking.guestName || booking.guestEmail}
                </CardTitle>
                <CardDescription className="space-y-0.5 sm:space-y-1">
                  <div className="truncate text-[10px] sm:text-xs lg:text-sm">{booking.guestEmail}</div>
                  <div className="font-mono text-[9px] sm:text-[10px] lg:text-xs">{booking.bookingCode}</div>
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {getStatusBadge(booking.status)}
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 lg:space-y-4 pt-0">
            <div className="grid gap-1.5 sm:gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1 lg:gap-2 text-[11px] sm:text-xs lg:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium text-[11px] sm:text-xs lg:text-sm">
                    {formatDate(booking.startDate)} - {formatDate(booking.endDate)}
                  </span>
                </div>
                <span className="text-muted-foreground text-[11px] sm:text-xs lg:text-sm ml-4 sm:ml-0">
                  ({nights} {nights === 1 ? "Nacht" : "Nächte"})
                </span>
              </div>
              <div className="text-[11px] sm:text-xs lg:text-sm">
                <span className="font-medium">Gäste:</span> {(() => {
                  const adults = booking.numberOfAdults ?? (booking as any).numberOfGuests ?? 1;
                  const children = booking.numberOfChildren ?? 0;
                  const total = adults + children;
                  if (children > 0) {
                    return `${total} (davon ${children} ${children === 1 ? "Kind" : "Kinder"})`;
                  }
                  return `${total}`;
                })()}
              </div>
              {booking.totalPrice && (
                <div className="text-xs sm:text-sm">
                  <span className="font-medium">Preis:</span>{" "}
                  {formatCurrency(parseFloat(booking.totalPrice.toString()))}
                </div>
              )}
              {/* Warnhinweise aus pricingDetails */}
              {(() => {
                const pricingDetails = booking.pricingDetails as any;
                const warnings = pricingDetails?.warnings as string[] | undefined;
                if (warnings && warnings.length > 0) {
                  return (
                    <div className="flex items-start gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                      <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        {warnings.map((warning, index) => (
                          <Badge key={index} variant="outline" className="text-[10px] sm:text-xs bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-200 w-full sm:w-auto justify-start">
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              {booking.message && (
                <div className="text-xs sm:text-sm">
                  <div className="font-medium">Nachricht:</div>
                  <div className="mt-0.5 sm:mt-1 text-muted-foreground line-clamp-2">{booking.message}</div>
                </div>
              )}
              {booking.rejectionReason && (
                <div className="text-xs sm:text-sm">
                  <div className="font-medium text-destructive">Ablehnungsgrund:</div>
                  <div className="mt-0.5 sm:mt-1 text-destructive line-clamp-2">{booking.rejectionReason}</div>
                </div>
              )}
              {booking.cancellationReason && (
                <div className="text-xs sm:text-sm">
                  <div className="font-medium text-muted-foreground">Stornierungsgrund:</div>
                  <div className="mt-0.5 sm:mt-1 text-muted-foreground line-clamp-2">{booking.cancellationReason}</div>
                </div>
              )}
              {booking.adminNotes && (
                <div className="text-xs sm:text-sm">
                  <div className="font-medium">Admin-Notizen:</div>
                  <div className="mt-0.5 sm:mt-1 text-muted-foreground line-clamp-2">{booking.adminNotes}</div>
                </div>
              )}
              <div className="text-[10px] sm:text-xs text-muted-foreground">
                Erstellt: {formatDate(booking.createdAt)}
              </div>
            </div>
          </CardContent>
        </Link>
        {isPending && user.canApproveBookings && (
          <CardContent className="pt-0">
            <PendingBookingActions bookingId={booking.id} initialAdminNotes={booking.adminNotes} />
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} />
      <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-6 lg:py-8 max-w-6xl lg:max-w-[85%] xl:max-w-[1200px]">
        <BookingsHeader />

        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-4 sm:mb-6 lg:mb-8">
          <StatCard
            title="admin.conflicts"
            value={conflictsCount}
            icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
          />
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
          conflictsCount={conflictsCount}
          pendingContent={
            pendingBookings.length === 0 ? (
              <Card>
                <CardContent className="py-8 sm:py-12 text-center">
                  <Clock className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">
                    Keine ausstehenden Buchungen
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
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
                <CardContent className="py-8 sm:py-12 text-center">
                  <CheckCircle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">
                    Keine bestätigten Buchungen
                  </h3>
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Noch keine Buchungen bestätigt
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
                <CardContent className="py-8 sm:py-12 text-center">
                  <XCircle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">
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

