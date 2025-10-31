"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/contexts/LanguageContext";

interface BackButtonProps {
  href: string;
}

export function BackButton({ href }: BackButtonProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-6">
      <Link href={href}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("admin.backToOverview")}
        </Button>
      </Link>
    </div>
  );
}

