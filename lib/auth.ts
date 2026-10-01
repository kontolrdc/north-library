import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { getRequiredEnv } from './config';

export type UserSession = {
  userId: string;
  email: string;
  role: 'reader' | 'admin' | 'superadmin';
};

export function hasAdminAccess(session: UserSession | null): boolean {
  return session?.role === 'admin' || session?.role === 'superadmin';
}

const secret = new TextEncoder().encode(
  getRequiredEnv('JWT_SECRET', {
    fallback: 'development-secret',
    allowFallbackInDevelopment: true,
    defaultMessage:
      'JWT_SECRET is missing. Set a strong, unique secret in .env or your deployment environment before production use.',
  })
);

export const SESSION_COOKIE_NAME = getRequiredEnv('SESSION_COOKIE_NAME', {
  fallback: 'nhl_session',
  allowFallbackInDevelopment: true,
  defaultMessage: 'SESSION_COOKIE_NAME is missing. Set it in .env or the deployment environment.',
});
export async function signSession(session: UserSession) {
  return await new SignJWT({
    userId: session.userId,
    email: session.email,
    role: session.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: String(payload.userId ?? ''),
      email: String(payload.email ?? ''),
      role: payload.role === 'superadmin' ? 'superadmin' : payload.role === 'admin' ? 'admin' : 'reader',
    };
  } catch {
    return null;
  }
}

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;
  return await verifySession(token);
}
