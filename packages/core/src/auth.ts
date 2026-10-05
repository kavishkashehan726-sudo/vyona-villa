// Admin sign-in. The browser keeps a random token in an httpOnly cookie; the
// database keeps only its SHA-256, so a copy of the database is no use for
// logging in. Sessions last two weeks and end on sign-out or password change.

import { createHash, randomBytes } from 'node:crypto';
import { prisma, type AdminUser } from '@vyona/db';
import { DUMMY_HASH, hashPassword, MIN_PASSWORD, verifyPassword } from '@vyona/db/password';

export const SESSION_DAYS = 14;
export { MIN_PASSWORD };

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export type Admin = Pick<AdminUser, 'id' | 'email' | 'name'>;

/** The admin for an email and password, or null. Takes as long for an unknown email as for a wrong password. */
export async function checkLogin(email: string, password: string): Promise<Admin | null> {
  const user = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? { id: user.id, email: user.email, name: user.name } : null;
}

export async function createSession(userId: string, now = new Date()) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.adminSession.create({ data: { id: digest(token), userId, expiresAt } }),
    prisma.adminUser.update({ where: { id: userId }, data: { lastLoginAt: now } }),
  ]);
  return { token, expiresAt };
}

export async function sessionAdmin(token: string | undefined, now = new Date()): Promise<Admin | null> {
  if (!token) return null;
  const s = await prisma.adminSession.findUnique({
    where: { id: digest(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  return s && s.expiresAt > now ? s.user : null;
}

export async function endSession(token: string) {
  await prisma.adminSession.deleteMany({ where: { id: digest(token) } });
}

/** Changes the password and signs out every other browser. */
export async function changePassword(userId: string, current: string, next: string, keepToken?: string) {
  const user = await prisma.adminUser.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) return 'WRONG_PASSWORD' as const;
  if (next.length < MIN_PASSWORD) return 'TOO_SHORT' as const;
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    prisma.adminSession.deleteMany({ where: { userId, ...(keepToken ? { id: { not: digest(keepToken) } } : {}) } }),
  ]);
  return 'OK' as const;
}
