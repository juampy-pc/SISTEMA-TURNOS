import Link from 'next/link';
import { Logo } from '@/components/marca/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-md px-4 pt-8">
        <Link href="/" aria-label="Open, ir al inicio" className="inline-block">
          <Logo className="h-7 w-auto" />
        </Link>
      </header>
      {children}
    </div>
  );
}
