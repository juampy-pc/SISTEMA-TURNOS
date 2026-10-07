import Link from 'next/link';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Entrar</h1>
      <LoginForm aviso={aviso === 'sin-acceso' ? 'Tu acceso fue desactivado o ya no existe.' : undefined} />
      <p className="mt-6 text-sm text-stone-600">
        ¿Todavía no tenés tu negocio? <Link href="/registro" className="underline">Creá uno</Link>
      </p>
    </main>
  );
}
