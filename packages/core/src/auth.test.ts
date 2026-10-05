import { prisma } from '@vyona/db';
import { hashPassword, verifyPassword } from '@vyona/db/password';
import { afterAll, describe, expect, it } from 'vitest';
import { changePassword, checkLogin, createSession, endSession, sessionAdmin } from './auth';

afterAll(() => prisma.$disconnect());

describe('passwords', () => {
  it('verifies the right password only', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterY', hash)).toBe(false);
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
  });
});

describe('sessions', () => {
  it('logs in, keeps the session and ends it', async () => {
    const email = `owner-${Date.now()}@example.com`;
    const user = await prisma.adminUser.create({ data: { email, name: 'Owner', passwordHash: await hashPassword('a long password') } });

    expect(await checkLogin(email, 'wrong password')).toBeNull();
    expect(await checkLogin('nobody@example.com', 'a long password')).toBeNull();
    expect(await checkLogin(` ${email.toUpperCase()} `, 'a long password')).toMatchObject({ id: user.id });

    const { token } = await createSession(user.id);
    const stored = await prisma.adminSession.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.id).not.toBe(token); // only the hash is kept
    expect(await sessionAdmin(token)).toMatchObject({ id: user.id, email });
    expect(await sessionAdmin('forged')).toBeNull();
    expect(await sessionAdmin(token, new Date(Date.now() + 15 * 86_400_000))).toBeNull();

    await endSession(token);
    expect(await sessionAdmin(token)).toBeNull();
  });

  it('signs out other browsers when the password changes', async () => {
    const user = await prisma.adminUser.create({
      data: { email: `pw-${Date.now()}@example.com`, name: 'Owner', passwordHash: await hashPassword('first password') },
    });
    const here = await createSession(user.id);
    const there = await createSession(user.id);

    expect(await changePassword(user.id, 'not it', 'second password')).toBe('WRONG_PASSWORD');
    expect(await changePassword(user.id, 'first password', 'short')).toBe('TOO_SHORT');
    expect(await changePassword(user.id, 'first password', 'second password', here.token)).toBe('OK');

    expect(await sessionAdmin(here.token)).not.toBeNull();
    expect(await sessionAdmin(there.token)).toBeNull();
    expect(await checkLogin(user.email, 'second password')).not.toBeNull();
  });
});
