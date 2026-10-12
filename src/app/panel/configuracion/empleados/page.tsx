import { redirect } from 'next/navigation';
import { normalizarPermisos, PERMISOS } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { alternarActivo, cambiarRol, crearEmpleado, guardarPermisos, resetearPassword } from './actions';


export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; nombre?: string; usuario?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!ctx.rol.es_dueno) redirect('/panel');
  const { ok, error, nombre, usuario } = await searchParams;

  const supabase = await crearClienteServidor();
  const [{ data: miembros }, { data: roles }] = await Promise.all([
    supabase.from('miembros').select('id, nombre, usuario, activo, rol_id').order('created_at'),
    supabase.from('roles').select('id, nombre, es_dueno, permisos').order('nombre'),
  ]);
  const rolesEditables = (roles ?? []).filter((r) => !r.es_dueno);
  const nombreDeRol = new Map((roles ?? []).map((r) => [r.id, r]));

  return (
    <div className="space-y-10">
      <h2 className="titulo">Empleados</h2>
      {ok && <p role="status" className="aviso-ok">{ok}</p>}
      {error && <p role="alert" className="aviso-error">{error}</p>}

      <section className="space-y-3">
        <h3 className="subtitulo">Nuevo empleado</h3>
        <form action={crearEmpleado} className="grid gap-3 sm:grid-cols-2">
          <label>Nombre<input name="nombre" defaultValue={nombre ?? ''} required minLength={2} maxLength={80} className="campo" /></label>
          <label>Usuario<input name="usuario" defaultValue={usuario ?? ''} required autoCapitalize="none" className="campo" /></label>
          <label>Contraseña<input name="password" type="password" required minLength={8} maxLength={72} className="campo" /></label>
          <label>Rol
            <select name="rolId" required className="campo">
              {rolesEditables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <button className="boton">Crear empleado</button>
          </div>
        </form>
        <p className="text-sm text-niebla">
          Tu equipo entra desde la pantalla de login con su usuario, su contraseña y el código del negocio:{' '}
          <strong>{ctx.negocio.slug}</strong>.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="subtitulo">Equipo</h3>
        <ul className="lista">
          {(miembros ?? []).map((m) => {
            const rol = nombreDeRol.get(m.rol_id);
            const esDueno = rol?.es_dueno ?? false;
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{m.nombre} {!m.activo && <span className="text-sm text-senal">(desactivado)</span>}</p>
                  <p className="text-sm text-niebla">{m.usuario}</p>
                </div>
                {esDueno ? (
                  <span className="text-sm text-niebla">Dueño</span>
                ) : (
                  <>
                    <form action={cambiarRol} className="flex gap-2">
                      <input type="hidden" name="miembroId" value={m.id} />
                      <select name="rolId" defaultValue={m.rol_id} aria-label={`Rol de ${m.nombre}`} className="rounded-xl border border-linea bg-noche px-3 py-2 text-sm">
                        {rolesEditables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                      <button className="boton-sec">Guardar rol</button>
                    </form>
                    <form action={resetearPassword} className="flex gap-2">
                      <input type="hidden" name="miembroId" value={m.id} />
                      <input name="password" type="password" required minLength={8} maxLength={72} placeholder="Nueva contraseña" aria-label={`Nueva contraseña de ${m.nombre}`} className="rounded-xl border border-linea bg-noche px-3 py-2 text-sm" />
                      <button className="boton-sec">Cambiar</button>
                    </form>
                    <form action={alternarActivo}>
                      <input type="hidden" name="miembroId" value={m.id} />
                      <input type="hidden" name="activar" value={m.activo ? 'no' : 'si'} />
                      <button className="boton-sec">{m.activo ? 'Desactivar' : 'Activar'}</button>
                    </form>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="subtitulo">Qué puede hacer cada rol</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {rolesEditables.map((r) => {
            const actuales = normalizarPermisos(r.permisos);
            return (
              <form key={r.id} action={guardarPermisos} className="space-y-2 tarjeta">
                <input type="hidden" name="rolId" value={r.id} />
                <h4 className="font-medium">{r.nombre}</h4>
                {PERMISOS.map((p) => (
                  <label key={p.clave} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={p.clave} defaultChecked={actuales[p.clave] === true} />
                    {p.etiqueta}
                  </label>
                ))}
                <button className="boton">Guardar permisos</button>
              </form>
            );
          })}
        </div>
        <p className="text-sm text-niebla">El rol Dueño siempre puede todo y no se puede modificar.</p>
      </section>
    </div>
  );
}
