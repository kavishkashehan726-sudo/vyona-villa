import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Logo } from '@vyona/ui';
import { getAdmin } from '@/lib/session';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  if (await getAdmin()) redirect('/');
  const { next } = await searchParams;
  return (
    <main className="login">
      <div className="login__card">
        <Logo compact className="login__logo" title="VYONA" />
        <p className="eyebrow mt-8 text-center">Owner&rsquo;s desk</p>
        <LoginForm next={typeof next === 'string' ? next : '/'} />
      </div>
      <p className="login__foot">Weligama · Sri Lanka</p>
    </main>
  );
}
