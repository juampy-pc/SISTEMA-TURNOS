-- Intervalo configurable entre horarios de inicio (negocios de turnos editables).
alter table public.negocios
  add column intervalo_min int not null default 15 check (intervalo_min in (10, 15, 20, 30, 60));

grant update (intervalo_min) on public.negocios to authenticated;

create or replace function private.huecos(p_recurso uuid, p_servicio uuid, p_fecha date)
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
