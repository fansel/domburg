import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Dashboard ist jetzt nur noch für Admins
// Gäste nutzen: Gastcode → Auswahl (Buchen oder Status prüfen)
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  // Admins direkt zum Admin-Bereich
  if (user.role === "ADMIN") {
    redirect("/admin/bookings");
  }

  // Andere User (falls vorhanden) zur Startseite
  redirect("/");
}
