/**
 * Generiert einen einfachen, leicht einzugebenden Buchungscode
 * Format: 6-stellige Zahlen (z.B. 123456)
 */
export function generateBookingCode(): string {
  // Generiere 6-stellige Zahl
  const min = 100000;
  const max = 999999;
  const code = Math.floor(Math.random() * (max - min + 1)) + min;
  
  return code.toString();
}

/**
 * Validiert ein Buchungscode-Format
 */
export function isValidBookingCode(code: string): boolean {
  // Prüft ob es eine 6-stellige Zahl ist
  return /^\d{6}$/.test(code);
}

