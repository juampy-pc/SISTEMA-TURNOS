-- Mover o editar un turno (hora, recurso o servicio) validando que el horario esté libre.
-- private.huecos suma p_excluir: el propio turno no ocupa su lugar cuando se lo mueve.

drop function private.huecos(uuid, uuid, date);

create function private.huecos(p_recurso uuid, p_servicio uuid, p_fecha date, p_excluir uuid default null)
returns table (inicio timestamptz, fin timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  n public.negocios;
  v_dur int;
  v_len int;
  v_paso int;
  v_dow int;
  v_min int;
  v_ini timestamptz;
  v_fin timestamptz;
  f record;
begin
  select ng.* into n
  from public.negocios ng join public.recursos r on r.negocio_id = ng.id
  where r.id = p_recurso and r.activo;
  if not found then return; end if;

  select s.duracion_min into v_dur
  from public.servicios s
  join public.recurso_servicio rs on rs.servicio_id = s.id and rs.recurso_id = p_recurso
  where s.id = p_servicio and s.activo and s.negocio_id = n.id;
  if not found then return; end if;

  if exists (
    select 1 from public.bloqueos b
    where b.negocio_id = n.id and (b.recurso_id is null or b.recurso_id = p_recurso)
      and p_fecha between b.desde and b.hasta
  ) then return; end if;

  v_len := case when n.modo_turnos = 'fijo' then n.paso_minutos else v_dur end;
  v_paso := case when n.modo_turnos = 'fijo' then n.paso_minutos else n.intervalo_min end;
  v_dow := extract(dow from p_fecha)::int;

  for f in
    select h.desde_min, h.hasta_min from public.horarios h
    where h.recurso_id = p_recurso and h.dia_semana = v_dow order by h.desde_min
  loop
    v_min := f.desde_min;
    while v_min + v_len <= f.hasta_min loop
      v_ini := (p_fecha::timestamp + make_interval(mins => v_min)) at time zone n.zona_horaria;
      v_fin := v_ini + make_interval(mins => v_len);
      if v_ini >= now() + make_interval(hours => n.anticipacion_min_horas)
         and v_ini <= now() + make_interval(days => n.anticipacion_max_dias)
         and not exists (
           select 1 from public.turnos t
           where t.recurso_id = p_recurso
             and t.estado in ('pendiente', 'confirmado', 'completado')
             and (p_excluir is null or t.id <> p_excluir)
             and tstzrange(t.inicio, t.fin) && tstzrange(v_ini, v_fin)
         ) then
        inicio := v_ini;
        fin := v_fin;
        return next;
      end if;
      v_min := v_min + v_paso;
    end loop;
  end loop;
end
$$;

revoke all on function private.huecos(uuid, uuid, date, uuid) from public, anon, authenticated;

-- Un turno se puede mover si quien lo pide gestiona turnos y ve ambas agendas (la actual y la nueva).
create function private.turno_movible(p_turno uuid, p_recurso uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.turnos t
    where t.id = p_turno
      and t.negocio_id = (select private.mi_negocio_id())
      and t.estado in ('pendiente', 'confirmado')
      and private.tiene_permiso('gestionar_turnos')
      and private.puede_ver_recurso(t.recurso_id)
      and private.puede_ver_recurso(p_recurso)
  )
$$;

revoke all on function private.turno_movible(uuid, uuid) from public, anon, authenticated;

create function public.huecos_para_mover(p_turno uuid, p_recurso uuid, p_servicio uuid, p_fecha date)
returns table (inicio timestamptz, fin timestamptz)
language sql stable security definer set search_path = '' as $$
  select h.inicio, h.fin from private.huecos(p_recurso, p_servicio, p_fecha, p_turno) h
  where private.turno_movible(p_turno, p_recurso)
$$;

create function public.mover_turno(p_turno uuid, p_recurso uuid, p_servicio uuid, p_inicio timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_zona text;
  v_fin timestamptz;
begin
  if not private.turno_movible(p_turno, p_recurso) then
    raise exception 'no_movible';
  end if;
  select n.zona_horaria into v_zona from public.negocios n where n.id = (select private.mi_negocio_id());

  select h.fin into v_fin
  from private.huecos(p_recurso, p_servicio, (p_inicio at time zone v_zona)::date, p_turno) h
  where h.inicio = p_inicio;
  if not found then
    raise exception 'horario_ocupado';
  end if;

  -- La exclusión por rango sigue siendo la defensa final ante dos cambios simultáneos.
  update public.turnos
  set recurso_id = p_recurso, servicio_id = p_servicio, inicio = p_inicio, fin = v_fin
  where id = p_turno;
end
$$;

revoke all on function public.huecos_para_mover(uuid, uuid, uuid, date), public.mover_turno(uuid, uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.huecos_para_mover(uuid, uuid, uuid, date), public.mover_turno(uuid, uuid, uuid, timestamptz)
  to authenticated;
