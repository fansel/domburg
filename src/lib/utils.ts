import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // Verwende lokale Zeitzone (Europe/Amsterdam) für konsistente Anzeige
  // Damit werden UTC-gespeicherte Daten korrekt in der lokalen Zeitzone interpretiert
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Amsterdam',
  }).format(d)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  // Verwende lokale Zeitzone (Europe/Amsterdam) für konsistente Anzeige
  return new Intl.DateTimeFormat('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam',
  }).format(d)
}

export function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate).setHours(0, 0, 0, 0)
  const end = new Date(endDate).setHours(0, 0, 0, 0)
  const diffTime = Math.abs(end - start)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) {
    return 'gerade eben'
  } else if (diffMins < 60) {
    return `vor ${diffMins} ${diffMins === 1 ? 'Minute' : 'Minuten'}`
  } else if (diffHours < 24) {
    return `vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`
  } else if (diffDays < 7) {
    return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`
  } else {
    return formatDate(d)
  }
}

/**
 * Gibt eine konsistente Google Calendar colorId für eine Buchung zurück
 * Verwendet eine Hash-Funktion basierend auf bookingId/bookingCode
 * Farbe 10 (Basilikum/Grün) wird NICHT verwendet, da sie für Info-Events reserviert ist
 * 
 * Verfügbare Farben: 1=Lavendel, 2=Salbei, 3=Traube, 4=Flamingo, 5=Banane,
 * 6=Mandarine, 7=Pfau, 8=Graphit, 9=Blaubeere, 11=Tomate
 */
export function getBookingColorId(bookingId: string): string {
  // Einfache Hash-Funktion basierend auf String
  let hash = 0;
  for (let i = 0; i < bookingId.length; i++) {
    const char = bookingId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Verfügbare Farb-IDs (ohne 10, da diese für Info-Events reserviert ist)
  const availableColors = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '11'];
  const colorIndex = Math.abs(hash) % availableColors.length;
  return availableColors[colorIndex];
}

/**
 * Gibt eine konsistente Tailwind CSS Farbe für eine Buchung zurück
 * Verwendet die gleiche Hash-Logik wie getBookingColorId
 */
export function getBookingColorClass(bookingId: string): string {
  const colorId = getBookingColorId(bookingId);
  
  // Mappe Google Calendar colorIds zu Tailwind Farben
  const colorMap: Record<string, string> = {
    '1': 'bg-purple-500',      // Lavendel
    '2': 'bg-green-500',        // Salbei
    '3': 'bg-slate-500',        // Traube
    '4': 'bg-pink-500',         // Flamingo
    '5': 'bg-yellow-500',       // Banane
    '6': 'bg-orange-500',       // Mandarine
    '7': 'bg-cyan-500',         // Pfau
    '8': 'bg-gray-600',          // Graphit
    '9': 'bg-blue-500',         // Blaubeere
    '11': 'bg-red-500',         // Tomate
  };
  
  return colorMap[colorId] || 'bg-primary';
}

/**
 * Gibt eine konsistente Tailwind CSS Text-Farbe für eine Buchung zurück
 */
export function getBookingTextColorClass(bookingId: string): string {
  const colorId = getBookingColorId(bookingId);
  
  const textColorMap: Record<string, string> = {
    '1': 'text-purple-900 dark:text-purple-100',
    '2': 'text-green-900 dark:text-green-100',
    '3': 'text-slate-900 dark:text-slate-100',
    '4': 'text-pink-900 dark:text-pink-100',
    '5': 'text-yellow-900 dark:text-yellow-100',
    '6': 'text-orange-900 dark:text-orange-100',
    '7': 'text-cyan-900 dark:text-cyan-100',
    '8': 'text-gray-900 dark:text-gray-100',
    '9': 'text-blue-900 dark:text-blue-100',
    '11': 'text-red-900 dark:text-red-100',
  };
  
  return textColorMap[colorId] || 'text-primary-foreground';
}

