"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "de" | "en" | "nl";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, any>) => string;
  isReady: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize with detected language immediately (for SSR compatibility, start with "de")
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      // Client-side: Detect immediately
      const saved = localStorage.getItem("language") as Language;
      if (saved && (saved === "de" || saved === "en" || saved === "nl")) {
        return saved;
      }
      const browserLang = navigator.language || navigator.languages?.[0] || "de";
      const langCode = browserLang.toLowerCase().split("-")[0];
      if (langCode === "nl") return "nl";
      if (langCode === "de") return "de";
      if (langCode === "en") return "en";
    }
    return "de"; // Default for SSR
  });
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Detect language from browser/IP
  const detectLanguage = (): Language => {
    if (typeof window === "undefined") return "de";
    
    // First check localStorage for user preference
    const saved = localStorage.getItem("language") as Language;
    if (saved && (saved === "de" || saved === "en" || saved === "nl")) {
      return saved;
    }
    
    // Detect from browser language
    const browserLang = navigator.language || navigator.languages?.[0] || "de";
    const langCode = browserLang.toLowerCase().split("-")[0];
    const fullLang = browserLang.toLowerCase();
    
    // Check for Dutch (nl or nl-NL)
    if (langCode === "nl" || fullLang.startsWith("nl-")) {
      return "nl";
    }
    
    // Check for German (de or de-DE, de-AT, de-CH)
    if (langCode === "de" || fullLang.startsWith("de-")) {
      return "de";
    }
    
    // Check for English (en or en-*)
    if (langCode === "en" || fullLang.startsWith("en-")) {
      return "en";
    }
    
    // Default to German
    return "de";
  };

  // Hydration-safe mounting and language detection
  useEffect(() => {
    setIsMounted(true);
    // Detect language from browser/IP if no saved preference
    const detectedLang = detectLanguage();
    setLanguageState(detectedLang);
    // Save detected language if no preference was saved
    if (!localStorage.getItem("language")) {
      localStorage.setItem("language", detectedLang);
    }
  }, []);

  // Ensure language is set immediately on client mount
  useEffect(() => {
    if (typeof window !== "undefined" && !isMounted) {
      const detectedLang = detectLanguage();
      if (detectedLang !== language) {
        setLanguageState(detectedLang);
      }
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    // Load translations
    setIsReady(false);
    fetch(`/api/locales/${language}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setTranslations(data);
        setIsReady(true);
      })
      .catch((err) => {
        console.error("Failed to load translations:", err);
        // Fallback: Versuche direkt aus public Ordner zu laden
        fetch(`/locales/${language}.json`)
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data) {
              setTranslations(data);
            }
          })
          .catch(() => {});
        setIsReady(true); // Set ready even on error
      });
  }, [language, isMounted]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (isMounted) {
      localStorage.setItem("language", lang);
    }
  };

  const t = (key: string, vars?: Record<string, any>): string => {
    const keys = key.split(".");
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === "object") {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    if (typeof value !== "string") {
      return key;
    }

    // Replace variables like {{count}}, {{value}}
    if (vars) {
      return value.replace(/\{\{(\w+)\}\}/g, (match: string, varName: string) => {
        return vars[varName]?.toString() || match;
      });
    }

    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isReady }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useTranslation must be used within LanguageProvider");
  }
  return context;
}

