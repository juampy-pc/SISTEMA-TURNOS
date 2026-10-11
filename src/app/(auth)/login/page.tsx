import Link from 'next/link';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="titulo mb-6">Entrar</h1>
      <LoginForm aviso={aviso === 'sin-acceso' ? 'Tu acceso fue desactivado o ya no existe.' : undefined} />
      <p className="mt-6 text-sm text-niebla">
        ¿Todavía no tenés tu negocio? <Link href="/registro" className="enlace">Creá uno</Link>
      </p>
    </main>
  );
}
