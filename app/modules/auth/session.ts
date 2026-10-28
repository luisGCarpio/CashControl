import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET environment variable is missing or shorter than 32 characters. A secure 32+ character key is required.'
    );
  }
  return new TextEncoder().encode(secret);
}

const SECRET_KEY = getJwtSecret();

export const COOKIE_NAME = 'negocio_session_token';

export async function createSessionToken(payload: { userId: number; username: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('pulso-caja-api')
    .setAudience('pulso-caja-app')
    .setSubject(String(payload.userId))
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY, {
      algorithms: ['HS256'],
      issuer: 'pulso-caja-api',
      audience: 'pulso-caja-app',
    });

    if (typeof payload.userId !== 'number' || payload.userId <= 0) {
      return null;
    }

    return payload as { userId: number; username: string };
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}
