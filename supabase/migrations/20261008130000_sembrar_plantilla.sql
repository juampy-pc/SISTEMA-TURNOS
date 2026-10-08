-- Carga inicial de recursos, servicios y horarios (paso "Primeros pasos").
-- Solo corre una vez por negocio: si ya hay recursos o servicios, falla.
create function public.sembrar_plantilla(
  p_recursos jsonb, p_servicios jsonb, p_dias int[], p_desde_min int, p_hasta_min int
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_negocio uuid := (select private.mi_negocio_id());
  v_recurso uuid;
  v_servicio uuid;
  v_dia int;
  v_nombre text;
  v_s jsonb;
begin
  if v_negocio is null or not (select private.tiene_permiso('gestionar_servicios')) then
    raise exception 'sin_permiso' using errcode = '42501';
  end if;
  if jsonb_typeof(p_recursos) <> 'array' or jsonb_typeof(p_servicios) <> 'array' then
    raise exception 'datos_invalidos';
  end if;
  if exists (select 1 from public.recursos where negocio_id = v_negocio)
     or exists (select 1 from public.servicios where negocio_id = v_negocio) then
    raise exception 'ya_configurado';
  end if;

  for v_s in select * from jsonb_array_elements(p_servicios) loop
    insert into public.servicios (negocio_id, nombre, duracion_min, precio)
    values (v_negocio, v_s ->> 'nombre', (v_s ->> 'duracion_min')::int, coalesce((v_s ->> 'precio')::numeric, 0));
  end loop;

  for v_nombre in select jsonb_array_elements_text(p_recursos) loop
    insert into public.recursos (negocio_id, nombre) values (v_negocio, v_nombre) returning id into v_recurso;
    insert into public.recurso_servicio (negocio_id, recurso_id, servicio_id)
      select v_negocio, v_recurso, s.id from public.servicios s where s.negocio_id = v_negocio;
    foreach v_dia in array coalesce(p_dias, '{}') loop
      insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
      values (v_negocio, v_recurso, v_dia, p_desde_min, p_hasta_min);
    end loop;
  end loop;
end
$$;

revoke all on function public.sembrar_plantilla(jsonb, jsonb, int[], int, int) from public, anon, authenticated;
grant execute on function public.sembrar_plantilla(jsonb, jsonb, int[], int, int) to authenticated;
