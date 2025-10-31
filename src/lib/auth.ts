import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const TOKEN_EXPIRY = '7d';

// Secret als Uint8Array für jose
const getSecretKey = () => new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// JWT Token erstellen (Edge-kompatibel mit jose)
export async function createToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getSecretKey());
}

// JWT Token verifizieren (Edge-kompatibel mit jose)
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as JWTPayload;
  } catch (error: any) {
    return null;
  }
}

// Aktuellen Benutzer aus Cookie holen
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Prüfen ob Benutzer Admin ist
export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.role === 'ADMIN';
}

// Auth Token in Cookie setzen
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
    path: '/',
  });
}

// Auth Token aus Cookie löschen
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}

// Prüfen ob E-Mail eine Admin-E-Mail ist
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
  return adminEmails.includes(email);
}

// Magic Link Token generieren
export async function generateMagicLinkToken(userId: string): Promise<string> {
  const expirySeconds = parseInt(process.env.MAGIC_LINK_EXPIRY || '900');
  
  const token = await new SignJWT({ userId } as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expirySeconds)
    .sign(getSecretKey());

  const expiresAt = new Date(Date.now() + expirySeconds * 1000);

  await prisma.magicLink.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  return token;
}

// Magic Link Token verifizieren
export async function verifyMagicLinkToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const decoded = payload as { userId: string };
    
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink) {
      return null;
    }

    if (magicLink.usedAt) {
      return null; // Token bereits verwendet
    }

    if (magicLink.expiresAt < new Date()) {
      return null; // Token abgelaufen
    }

    // Token als verwendet markieren
    await prisma.magicLink.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return decoded.userId;
  } catch (error) {
    return null;
  }
}

// Gastcode verifizieren
export async function verifyGuestAccessToken(token: string): Promise<boolean> {
  const accessToken = await prisma.guestAccessToken.findUnique({
    where: { token },
  });

  if (!accessToken || !accessToken.isActive) {
    return false;
  }

  if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
    return false;
  }

  if (accessToken.maxUsage && accessToken.usageCount >= accessToken.maxUsage) {
    return false;
  }

  // Nutzungszähler erhöhen
  await prisma.guestAccessToken.update({
    where: { token },
    data: { usageCount: { increment: 1 } },
  });

  return true;
}

