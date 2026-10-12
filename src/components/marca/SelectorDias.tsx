import Link from 'next/link';
import { etiquetaDia, partesDia } from '@/lib/dominio/fechas';

// Fila de días al estilo de la guía (pág. 17): día de la semana en mono, número en display.
// Con `nombre` son radios de un formulario; con `href` son links.

const base =
  'flex h-16 w-14 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors';
const libre = 'border-linea text-blanco hover:border-niebla';
const elegido = 'border-cielo bg-cielo text-noche';

function Contenido({ fecha, hoy }: { fecha: string; hoy?: string }) {
  const { semana, numero } = partesDia(fecha);
  return (
    <>
      <span className="font-mono text-[0.65rem] tracking-[0.12em] uppercase">{fecha === hoy ? 'hoy' : semana}</span>
      <span className="font-display text-2xl leading-none font-bold">{numero}</span>
    </>
  );
}

interface Props {
  dias: string[];
  seleccionado: string | null;
  hoy?: string;
  /** Modo formulario: nombre del radio. */
  nombre?: string;
  /** Modo links: arma el destino de cada día. */
  href?: (fecha: string) => string;
  etiqueta: string;
}

export function SelectorDias({ dias, seleccionado, hoy, nombre, href, etiqueta }: Props) {
  const fila = 'flex snap-x gap-2 overflow-x-auto pb-1';
  if (href) {
    return (
      <nav aria-label={etiqueta} className={`${fila} min-w-0`}>
        {dias.map((f) => (
          <Link
            key={f}
            href={href(f)}
            aria-label={etiquetaDia(f)}
            aria-current={f === seleccionado ? 'date' : undefined}
            className={`${base} ${f === seleccionado ? elegido : libre}`}
          >
            <Contenido fecha={f} hoy={hoy} />
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <fieldset className="min-w-0">
      <legend className="etiqueta mb-2">{etiqueta}</legend>
      <div className={fila}>
        {dias.map((f) => (
          <label key={f} className="relative cursor-pointer">
            <input
              type="radio"
              name={nombre}
              value={f}
              defaultChecked={f === seleccionado}
              required
              aria-label={etiquetaDia(f)}
              className="peer sr-only"
            />
            <span
              className={`${base} ${libre} peer-checked:border-cielo peer-checked:bg-cielo peer-checked:text-noche peer-focus-visible:ring-2 peer-focus-visible:ring-cielo`}
            >
              <Contenido fecha={f} hoy={hoy} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
