import Link from 'next/link';
import RegistroForm from './RegistroForm';

export default function RegistroPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Creá tu negocio</h1>
      <RegistroForm />
      <p className="mt-6 text-sm text-stone-600">
        ¿Ya tenés cuenta? <Link href="/login" className="underline">Entrá</Link>
      </p>
    </main>
  );
}
