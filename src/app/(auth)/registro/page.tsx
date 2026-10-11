import Link from 'next/link';
import RegistroForm from './RegistroForm';

export default function RegistroPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="titulo mb-6">Creá tu negocio</h1>
      <RegistroForm />
      <p className="mt-6 text-sm text-niebla">
        ¿Ya tenés cuenta? <Link href="/login" className="enlace">Entrá</Link>
      </p>
    </main>
  );
}
