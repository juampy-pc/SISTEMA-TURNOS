begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select public.crear_negocio('Barbería Pública', 'barberia-publica', 'peluqueria', false, 'editable', 'Ana',
  '[{"nombre":"Dueño","es_dueno":true,"permisos":{}}]'::jsonb);
reset role;

select set_config('t.neg', (select id::text from public.negocios where slug = 'barberia-publica'), true);
select set_config('t.fecha', (current_date + 3)::text, true);
insert into public.recursos (negocio_id, nombre, orden) values
  (current_setting('t.neg')::uuid, 'Sillón 1', 1), (current_setting('t.neg')::uuid, 'Sillón 2', 2);
insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg')::uuid, 'Corte', 30, 8000);
select set_config('t.r1', (select id::text from public.recursos where nombre = 'Sillón 1' and negocio_id = current_setting('t.neg')::uuid), true);
select set_config('t.r2', (select id::text from public.recursos where nombre = 'Sillón 2' and negocio_id = current_setting('t.neg')::uuid), true);
select set_config('t.srv', (select id::text from public.servicios where negocio_id = current_setting('t.neg')::uuid), true);
insert into public.recurso_servicio (negocio_id, recurso_id, servicio_id)
  select current_setting('t.neg')::uuid, r, current_setting('t.srv')::uuid
  from unnest(array[current_setting('t.r1')::uuid, current_setting('t.r2')::uuid]) r;
insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  select current_setting('t.neg')::uuid, r, extract(dow from current_setting('t.fecha')::date)::int, 540, 600
  from unnest(array[current_setting('t.r1')::uuid, current_setting('t.r2')::uuid]) r;
select set_config('t.h9', (((current_setting('t.fecha')::date)::timestamp + interval '9 hours') at time zone 'America/Argentina/Buenos_Aires')::text, true);
select set_config('t.tok', repeat('a', 64), true);
select set_config('t.tok2', repeat('b', 64), true);

-- Permisos: solo service_role ejecuta las funciones públicas (1-4)
set local role anon;
select throws_ok($$select public.negocio_publico('barberia-publica')$$, '42501', null, 'anon no puede leer el negocio directo');
select throws_ok($$select * from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz, 'Carla', '+5491144445555', '', null, '1.1.1.1')$$, '42501', null, 'anon no puede reservar directo');
reset role;
set local role authenticated;
select throws_ok($$select public.negocio_publico('barberia-publica')$$, '42501', null, 'authenticated tampoco');
reset role;
set local role service_role;
select is(public.negocio_publico('barberia-publica') ->> 'nombre', 'Barbería Pública', 'service_role lee los datos públicos');

-- Disponibilidad (5-6)
select is((select count(*)::int from public.huecos_publicos(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null, current_setting('t.fecha')::date)),
  6, 'cualquiera: 3 huecos por sillón');
select is((select count(*)::int from public.huecos_publicos(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, current_setting('t.r2')::uuid, current_setting('t.fecha')::date)),
  3, 'un sillón puntual');

-- Cliente nuevo: queda pendiente y se asigna el primer sillón libre (7-10)
select is((select estado from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz, 'Carla', '+5491144445555', 'Primera vez', current_setting('t.tok'), '1.1.1.1')), 'pendiente', 'cliente nuevo: pendiente');
select is((select r.nombre from public.turnos t join public.recursos r on r.id = t.recurso_id
  where t.negocio_id = current_setting('t.neg')::uuid and t.inicio = current_setting('t.h9')::timestamptz), 'Sillón 1', 'cualquiera asigna el primer sillón');
select is((select nota_cliente from public.turnos where negocio_id = current_setting('t.neg')::uuid), 'Primera vez', 'guarda la nota del cliente');
select is((select count(*)::int from public.dispositivos_confiables where negocio_id = current_setting('t.neg')::uuid and not confiable), 1, 'registra el dispositivo sin confiar');

-- Mismo horario: va al segundo sillón; tercero, ocupado (11-12)
select is((select estado from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz, 'Beto', '+5491155556666', '', null, '2.2.2.2')), 'pendiente', 'otro cliente al mismo horario usa el otro sillón');
select throws_ok($$select * from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz, 'Dora', '+5491166667777', '', null, '3.3.3.3')$$, 'P0001', 'horario_ocupado', 'sin sillón libre: horario_ocupado');

-- Confirmar el turno vuelve confiable al dispositivo; la próxima reserva se confirma sola (13-16)
reset role;
update public.turnos set estado = 'confirmado'
  where negocio_id = current_setting('t.neg')::uuid and cliente_id = (select id from public.clientes where telefono = '+5491144445555');
select ok((select confiable from public.dispositivos_confiables where token_hash = current_setting('t.tok')), 'confirmar vuelve confiable el dispositivo');
set local role service_role;
select is((select estado from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz + interval '30 minutes', 'Carla', '+5491144445555', '', current_setting('t.tok'), '1.1.1.1')), 'confirmado', 'dispositivo confiable: confirmado');
select is((select estado from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz + interval '30 minutes', 'Carla', '+5491144445555', '', current_setting('t.tok2'), '1.1.1.1')), 'pendiente', 'mismo teléfono, otro dispositivo: pendiente');
select is((select nombre from public.datos_dispositivo(current_setting('t.neg')::uuid, current_setting('t.tok'))), 'Carla', 'el dispositivo confiable precarga los datos');

-- Validaciones y límites (17-20)
select throws_ok($$select * from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz, 'Eva', '1144', '', null, '4.4.4.4')$$, 'P0001', 'datos_invalidos', 'teléfono no normalizado se rechaza');
select is((select count(*)::int from public.datos_dispositivo(current_setting('t.neg')::uuid, current_setting('t.tok2'))), 0, 'un dispositivo no confiable no precarga');
reset role;
insert into private.intentos_reserva (negocio_id, ip, telefono)
  select current_setting('t.neg')::uuid, '9.9.9.9', '+5491100000000' from generate_series(1, 20);
set local role service_role;
select throws_ok($$select * from public.reservar_publico(current_setting('t.neg')::uuid, current_setting('t.srv')::uuid, null,
  current_setting('t.h9')::timestamptz + interval '15 minutes', 'Fede', '+5491177778888', '', null, '9.9.9.9')$$, 'P0001', 'limite_alcanzado', 'límite por IP');
reset role;
select is((select count(*)::int from public.turnos where negocio_id = current_setting('t.neg')::uuid), 4, 'quedan solo los 4 turnos válidos');

select * from finish();
rollback;
