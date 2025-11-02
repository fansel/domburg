/**
 * Generiert ein sicheres, zufälliges Passwort
 * Format: 12 Zeichen mit Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen
 */
export function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789'; // Ohne 0 und 1
  const symbols = '!@#$%&*?';
  
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  
  // Mindestens je ein Zeichen aus jeder Kategorie
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Rest auf 12 Zeichen auffüllen
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Passwort mischen (Fisher-Yates)
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }
  
  return passwordArray.join('');
}

