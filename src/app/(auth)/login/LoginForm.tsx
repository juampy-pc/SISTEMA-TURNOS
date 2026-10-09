'use client';

import { useActionState, useState } from 'react';
import { iniciarSesion, type EstadoLogin } from './actions';

const inicial: EstadoLogin = {};
const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';

export default function LoginForm({ aviso }: { aviso?: string }) {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial);
  const [modo, setModo] = useState<'dueno' | 'empleado'>('dueno');
  // Controlados: React 19 resetea los inputs no controlados al terminar la acción.
  const [email, setEmail] = useState('');
  const [usuario, setUsuario] = useState('');
  const [codigo, setCodigo] = useState('');

  return (
    <form action={accion} className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="dueno" checked={modo === 'dueno'} onChange={() => setModo('dueno')} />
          Soy dueño
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="modo" value="empleado" checked={modo === 'empleado'} onChange={() => setModo('empleado')} />
          Soy empleado
        </label>
      </div>

      {modo === 'dueno' ? (
        <label className="block">Email
          <input name="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
      ) : (
        <>
          <label className="block">Usuario
            <input name="usuario" autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} className={input} autoCapitalize="none" />
          </label>
          <label className="block">Código del negocio
            <input name="codigo" autoComplete="organization" required value={codigo} onChange={(e) => setCodigo(e.target.value)} className={input} autoCapitalize="none" />
          </label>
        </>
      )}
      <label className="block">Contraseña
        <input name="password" type="password" autoComplete="current-password" required className={input} />
      </label>

      {aviso && <p role="status" className="text-amber-700">{aviso}</p>}
      {estado.error && <p role="alert" className="text-red-700">{estado.error}</p>}
      <button type="submit" disabled={pendiente} className="min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-50">
        Entrar
      </button>
    </form>
  );
}
