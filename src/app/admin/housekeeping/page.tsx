import { redirect } from "next/navigation";
import { getCurrentUser, hasAdminRights } from "@/lib/auth";
import { AdminHousekeepingView } from "@/components/admin/admin-housekeeping-view";
import prisma from "@/lib/prisma";

export default async function AdminHousekeepingPage() {
  const user = await getCurrentUser();

  if (!user || !hasAdminRights(user.role)) {
    redirect("/");
  }

  // Load last sent setting
  const housekeeperLastSentSetting = await prisma.setting.findUnique({
    where: { key: "HOUSEKEEPER_LAST_SENT" },
  });

  return (
    <AdminHousekeepingView
      lastSentAt={housekeeperLastSentSetting?.value || null}
    />
  );
}

