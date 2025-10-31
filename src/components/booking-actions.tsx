"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { approveBooking, rejectBooking } from "@/app/actions/booking";
import { CheckCircle, XCircle } from "lucide-react";

interface BookingActionsProps {
  bookingId: string;
}

export function BookingActions({ bookingId }: BookingActionsProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const result = await approveBooking(bookingId, adminNotes);
      if (result.success) {
        toast({
          title: "Buchung genehmigt",
          description: "Die Buchung wurde erfolgreich genehmigt und im Kalender eingetragen.",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error || "Buchung konnte nicht genehmigt werden.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Bitte geben Sie einen Ablehnungsgrund an.",
      });
      return;
    }

    setIsRejecting(true);
    try {
      const result = await rejectBooking(bookingId, rejectionReason, adminNotes);
      if (result.success) {
        toast({
          title: "Buchung abgelehnt",
          description: "Die Buchung wurde abgelehnt.",
        });
        setShowRejectDialog(false);
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Fehler",
          description: result.error || "Buchung konnte nicht abgelehnt werden.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Fehler",
        description: "Ein unerwarteter Fehler ist aufgetreten.",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="space-y-4 pt-4 border-t">
      <div className="space-y-2">
        <Label htmlFor="adminNotes">Admin-Notizen (optional)</Label>
        <Textarea
          id="adminNotes"
          placeholder="Interne Notizen zur Buchung..."
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          rows={2}
        />
      </div>

      <div className="flex gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="default"
              className="flex-1"
              disabled={isApproving || isRejecting}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Genehmigen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Buchung genehmigen?</AlertDialogTitle>
              <AlertDialogDescription>
                Diese Buchung wird genehmigt und automatisch im Google Calendar eingetragen.
                Der Gast wird benachrichtigt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleApprove} disabled={isApproving}>
                {isApproving ? "Wird genehmigt..." : "Ja, genehmigen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isApproving || isRejecting}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Ablehnen
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Buchung ablehnen?</AlertDialogTitle>
              <AlertDialogDescription>
                Bitte geben Sie einen Grund für die Ablehnung an. Der Gast wird benachrichtigt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="rejectionReason">Ablehnungsgrund *</Label>
              <Textarea
                id="rejectionReason"
                placeholder="z.B. Zeitraum bereits gebucht, Haus in Renovierung, etc."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReject}
                disabled={isRejecting || !rejectionReason.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRejecting ? "Wird abgelehnt..." : "Ablehnen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

