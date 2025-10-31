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
  const { language, setLanguage, isReady } = useTranslation();

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-shadow bg-background"
            disabled={!isReady}
          >
            <Globe className="h-5 w-5" />
            <span className="sr-only">Switch language</span>
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

