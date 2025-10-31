/**
 * Generiert einen lesbaren Buchungscode
 * Format: DOM-A1B2C3 (6 Zeichen: Buchstaben + Zahlen gemischt)
 */
export function generateBookingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne I, O, 0, 1 (Verwechslungsgefahr)
  let code = '';
  
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `DOM-${code}`;
}

/**
 * Validiert ein Buchungscode-Format
 */
export function isValidBookingCode(code: string): boolean {
  return /^DOM-[A-Z2-9]{6}$/.test(code);
}

