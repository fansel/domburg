"use client";

import { useTranslation } from "@/contexts/LanguageContext";

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function PageHeader({ title, description, icon }: PageHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 sm:mb-8">
      {icon && (
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          {icon}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">{t(title)}</h1>
        </div>
      )}
      {!icon && <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2">{t(title)}</h1>}
      <p className="text-sm sm:text-base text-muted-foreground">{t(description)}</p>
    </div>
  );
}

