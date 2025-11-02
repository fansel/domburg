"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/contexts/LanguageContext";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
}

export function StatCard({ title, value, icon }: StatCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="text-xs sm:text-sm font-medium">{t(title)}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
        <div className="text-xl sm:text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

