// Isotipo y firma horizontal de Open, dibujados según la construcción de la guía
// (docs/marca/identidad-visual.md). No reemplazar por texto tipeado.

type Version = 'principal' | 'inverso' | 'alterno' | 'alterno-inverso';

const COLORES: Record<Version, { reloj: string; agujas: string; letras: string }> = {
  principal: { reloj: '#9BE7FF', agujas: '#000000', letras: '#FFFFFF' },
  inverso: { reloj: '#000000', agujas: '#9BE7FF', letras: '#000000' },
  alterno: { reloj: '#FF4C14', agujas: '#FFFFFF', letras: '#000000' },
  'alterno-inverso': { reloj: '#FFFFFF', agujas: '#FF4C14', letras: '#FFFFFF' },
};

// Círculo R = 100 u; agujas de 18,2 u con extremos redondeados; la corta a 135°.
function Reloj({ cx, cy, reloj, agujas }: { cx: number; cy: number; reloj: string; agujas: string }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={100} fill={reloj} />
      <path
        d="M0 -54.9 V0 L27.37 27.37"
        fill="none"
        stroke={agujas}
        strokeWidth={18.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

export function Isotipo({ version = 'principal', className }: { version?: Version; className?: string }) {
  const c = COLORES[version];
  return (
    <svg viewBox="-100 -100 200 200" className={className} role="img" aria-label="Open">
      <Reloj cx={0} cy={0} reloj={c.reloj} agujas={c.agujas} />
    </svg>
  );
}

// Altura de caja 175 u (0,87 del diámetro); separaciones O–P 44, P–E 64, E–N 68.
export function Logo({ version = 'principal', className }: { version?: Version; className?: string }) {
  const c = COLORES[version];
  return (
    <svg viewBox="0 -12.5 599 200" className={className} role="img" aria-label="Open">
      <Reloj cx={100} cy={87.5} reloj={c.reloj} agujas={c.agujas} />
      <g fill={c.letras} fillRule="evenodd">
        <path d="M244 0 H292 A30 30 0 0 1 322 30 V77 A30 30 0 0 1 292 107 H274 V175 H244 Z M274 27 H284 A7 7 0 0 1 291 34 V72 A7 7 0 0 1 284 79 H274 Z" />
        <path d="M386 0 H449 V27 H416 V71 H445 V101 H416 V148 H449 V175 H386 Z" />
        <path d="M517 0 H549 L570 112 V0 H599 V175 H567 L546 63 V175 H517 Z" />
      </g>
    </svg>
  );
}
