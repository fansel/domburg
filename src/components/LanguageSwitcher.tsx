"use client";

import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { language, setLanguage, isReady, t } = useTranslation();

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[100] pointer-events-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-14 h-14 md:w-16 md:h-16 shadow-lg hover:shadow-xl transition-shadow bg-background"
          >
            <Globe className="h-6 w-6 md:h-7 md:w-7" />
            <span className="sr-only">{isReady ? t("common.switchLanguage") : "Switch language"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem
            onClick={() => setLanguage("de")}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span>🇩🇪 Deutsch</span>
              {language === "de" && <Check className="h-4 w-4 ml-2" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLanguage("en")}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span>🇬🇧 English</span>
              {language === "en" && <Check className="h-4 w-4 ml-2" />}
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setLanguage("nl")}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span>🇳🇱 Nederlands</span>
              {language === "nl" && <Check className="h-4 w-4 ml-2" />}
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

