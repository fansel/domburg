/**
 * Generiert einen zufälligen Gäste-Zugangscode
 * Format: 8-stelliger alphanumerischer Code (z.B. A3B7K9M2)
 */
export function generateGuestCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne 0, O, I, 1 für bessere Lesbarkeit
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

