'use client';

export default function ErrorPanel({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">No pudimos cargar el panel</h1>
      <p className="mt-2 text-sm text-niebla">Fue un problema momentáneo. Tu sesión sigue abierta.</p>
      <button onClick={reset} className="boton mt-4">
        Reintentar
      </button>
    </div>
  );
}
