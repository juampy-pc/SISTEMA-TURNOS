'use client';

import { useActionState, useRef, useState } from 'react';
import { PLANTILLAS, TIPOS_NEGOCIO, type ModoTurnos, type TipoNegocio } from '@/lib/dominio/plantillas';
import { esSlugValido, slugify } from '@/lib/dominio/slug';
import { registrar, verificarSlug, type EstadoRegistro } from './actions';

const inicial: EstadoRegistro = {};
const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-50';

export default function RegistroForm() {
  const [estado, accion, pendiente] = useActionState(registrar, inicial);
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState<TipoNegocio>('peluqueria');
  const [nombreNegocio, setNombreNegocio] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTocado, setSlugTocado] = useState(false);
  const [slugOk, setSlugOk] = useState<boolean | null>(null);
  const [vende, setVende] = useState(PLANTILLAS.peluqueria.vendeProductosSugerido);
  const [modo, setModo] = useState<ModoTurnos>(PLANTILLAS.peluqueria.modoTurnosSugerido);
  const formRef = useRef<HTMLFormElement>(null);

  const consulta = useRef(0);

  // Solo vale la última consulta: una respuesta vieja no puede pisar a una más nueva.
  async function comprobarSlug(valor: string) {
    const n = ++consulta.current;
    setSlugOk(null);
    const ok = await verificarSlug(valor);
    if (n === consulta.current) setSlugOk(ok);
  }

  function elegirTipo(nuevo: TipoNegocio) {
    setTipo(nuevo);
    setVende(PLANTILLAS[nuevo].vendeProductosSugerido);
    setModo(PLANTILLAS[nuevo].modoTurnosSugerido);
  }

  function cambiarNombreNegocio(valor: string) {
    setNombreNegocio(valor);
    if (!slugTocado) {
      const sugerido = slugify(valor);
      setSlug(sugerido);
      if (esSlugValido(sugerido)) void comprobarSlug(sugerido);
      else {
        consulta.current++;
        setSlugOk(null);
      }
    }
  }

  function siguiente(desde: number) {
    const fieldset = formRef.current?.querySelector<HTMLElement>(`[data-paso="${desde}"]`);
    const campos = fieldset?.querySelectorAll<HTMLInputElement>('input');
    if (campos && ![...campos].every((c) => c.reportValidity())) return;
    setPaso(desde + 1);
  }

  return (
    <form ref={formRef} action={accion} className="space-y-6">
      <p className="text-sm text-stone-500">Paso {paso} de 3</p>

      <fieldset data-paso="1" hidden={paso !== 1} className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Tu cuenta</legend>
        <label className="block">Tu nombre
          <input name="nombreDueno" required minLength={2} maxLength={80} className={input} />
        </label>
        <label className="block">Email
          <input name="email" type="email" required className={input} />
        </label>
        <label className="block">Contraseña
          <input name="password" type="password" required minLength={8} maxLength={72} className={input} />
        </label>
        <button type="button" onClick={() => siguiente(1)} className={boton}>Siguiente</button>
      </fieldset>

      <fieldset data-paso="2" hidden={paso !== 2} className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Tu negocio</legend>
        <label className="block">Nombre del negocio
          <input
            name="nombreNegocio" required minLength={2} maxLength={80} className={input}
            value={nombreNegocio} onChange={(e) => cambiarNombreNegocio(e.target.value)}
          />
        </label>
        <div role="radiogroup" className="space-y-2">
          {TIPOS_NEGOCIO.map((t) => (
            <label key={t} className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2">
              <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => elegirTipo(t)} />
              {PLANTILLAS[t].etiqueta}
            </label>
          ))}
        </div>
        <label className="block">Link de tu página
          <input
            name="slug" required className={input} value={slug}
            onChange={(e) => {
              const v = e.target.value.toLowerCase();
              setSlug(v);
              setSlugTocado(true);
              if (esSlugValido(v)) void comprobarSlug(v);
              else {
                consulta.current++;
                setSlugOk(false);
              }
            }}
          />
        </label>
        <p className="text-sm text-stone-500">
          Tus clientes van a entrar por /b/{slug || 'tu-negocio'}.{' '}
          {slugOk === true && <span className="text-green-700">Disponible</span>}
          {slugOk === false && <span className="text-red-700">No disponible</span>}
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={() => setPaso(1)} className="rounded-lg border border-stone-300 px-4 py-2">Atrás</button>
          <button type="button" disabled={slugOk !== true} onClick={() => siguiente(2)} className={boton}>Siguiente</button>
        </div>
      </fieldset>

      <fieldset data-paso="3" hidden={paso !== 3} className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Cómo trabajás</legend>
        <p>¿Vendés productos?</p>
        <label className="flex items-center gap-2">
          <input type="radio" name="vendeProductos" value="si" checked={vende} onChange={() => setVende(true)} />
          Sí, vendo productos
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="vendeProductos" value="no" checked={!vende} onChange={() => setVende(false)} />
          No, por ahora no
        </label>
        <p>¿Cómo son tus turnos?</p>
        <label className="flex items-center gap-2">
          <input type="radio" name="modoTurnos" value="fijo" checked={modo === 'fijo'} onChange={() => setModo('fijo')} />
          Turnos fijos (grilla de horarios)
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="modoTurnos" value="editable" checked={modo === 'editable'} onChange={() => setModo('editable')} />
          Turnos editables (según el servicio)
        </label>
        {estado.error && <p role="alert" className="text-red-700">{estado.error}</p>}
        <div className="flex gap-3">
          <button type="button" onClick={() => setPaso(2)} className="rounded-lg border border-stone-300 px-4 py-2">Atrás</button>
          <button type="submit" disabled={pendiente} className={boton}>Crear mi negocio</button>
        </div>
      </fieldset>
    </form>
  );
}
