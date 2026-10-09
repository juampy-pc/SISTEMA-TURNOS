import Link from 'next/link';

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold">Sistema de Turnos</h1>
      <p className="text-stone-600">Turnos, clientes y productos de tu negocio en un solo lugar.</p>
      <div className="flex gap-3">
        <Link href="/registro" className="rounded-lg bg-stone-900 px-4 py-2 text-white">Crear mi negocio</Link>
        <Link href="/login" className="rounded-lg border border-stone-300 px-4 py-2">Entrar</Link>
      </div>
    </main>
  );
}
