/**
 * Generiert einen zufälligen Gäste-Zugangscode
 * Format: 8-stelliger alphanumerischer Code (z.B. GUEST2024)
 */
export function generateGuestCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne 0, O, I, 1 für bessere Lesbarkeit
  let result = 'GUEST';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

