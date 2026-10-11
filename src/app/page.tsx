import Link from 'next/link';
import { Isotipo, Logo } from '@/components/marca/Logo';

const VALORES = [
  { titulo: 'Abierto', texto: 'Los horarios libres se ven al instante. Nada escondido, nada que preguntar por mensaje.' },
  { titulo: 'Puntual', texto: 'Cada turno en su hora: una agenda que respeta el tiempo de todos.' },
  { titulo: 'Simple', texto: 'Reservar, confirmar o cancelar en pocos toques. Sin manual, sin vueltas.' },
];

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6">
        <Logo className="h-7 w-auto" />
        <Link href="/login" className="boton-sec">Entrar</Link>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 py-10 md:grid-cols-[1fr_auto]">
        <section className="space-y-6">
          <h1 className="font-display text-7xl leading-[0.9] font-bold tracking-[0.03em] uppercase sm:text-8xl">
            Tu agenda,
            <br />
            abierta.
          </h1>
          <p className="max-w-md text-lg text-niebla">
            Open es el sistema de turnos que ordena el día de tu negocio y le deja a cada cliente un horario libre a un toque.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/registro" className="boton">Crear mi negocio</Link>
            <Link href="/login" className="boton-sec">Ya tengo cuenta</Link>
          </div>
        </section>
        <Isotipo className="mx-auto w-48 sm:w-64 md:w-80" />
      </main>

      <section aria-label="Qué es Open" className="mx-auto w-full max-w-6xl px-4 pb-16">
        <ul className="grid border-t border-linea md:grid-cols-3">
          {VALORES.map((v) => (
            <li key={v.titulo} className="space-y-2 border-b border-linea py-6 md:border-b-0 md:pr-8">
              <h2 className="subtitulo">{v.titulo}</h2>
              <p className="text-niebla">{v.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-4 py-6">
        <p className="etiqueta">Open · un producto de SMZ/LABS</p>
      </footer>
    </div>
  );
}
