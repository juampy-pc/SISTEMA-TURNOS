begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.com');

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;

select pg_temp.como('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select public.crear_negocio('Barbería Uno', 'barberia-uno', 'peluqueria', true, 'editable', 'Ana', '[
  {"nombre":"Dueño","es_dueno":true,"permisos":{}},
  {"nombre":"Profesional","es_dueno":false,"permisos":{"gestionar_turnos":true}}
]'::jsonb);
reset role;
select pg_temp.como('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set local role authenticated;
select public.crear_negocio('Cancha B', 'cancha-b', 'cancha', false, 'fijo', 'Beto', '[{"nombre":"Dueño","es_dueno":true,"permisos":{}}]'::jsonb);
reset role;

select set_config('t.neg', (select id::text from public.negocios where slug = 'barberia-uno'), true);
select set_config('t.fecha', (current_date + 3)::text, true);
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', r.id, 'Pablo', 'pablo'
  from public.negocios n join public.roles r on r.negocio_id = n.id where n.slug = 'barberia-uno' and r.nombre = 'Profesional';
insert into public.recursos (negocio_id, nombre, miembro_id)
  select current_setting('t.neg')::uuid, 'Sillón 1', (select id from public.miembros where usuario = 'pablo');
insert into public.recursos (negocio_id, nombre) values (current_setting('t.neg')::uuid, 'Sillón 2');
insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg')::uuid, 'Corte', 30, 8000);
select set_config('t.r1', (select id::text from public.recursos where nombre = 'Sillón 1'), true);
select set_config('t.r2', (select id::text from public.recursos where nombre = 'Sillón 2'), true);
select set_config('t.srv', (select id::text from public.servicios where nombre = 'Corte' and negocio_id = current_setting('t.neg')::uuid), true);
insert into public.recurso_servicio (negocio_id, recurso_id, servicio_id)
  select current_setting('t.neg')::uuid, r, current_setting('t.srv')::uuid
  from unnest(array[current_setting('t.r1')::uuid, current_setting('t.r2')::uuid]) r;
insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  select current_setting('t.neg')::uuid, r, extract(dow from current_setting('t.fecha')::date)::int, 540, 780
  from unnest(array[current_setting('t.r1')::uuid, current_setting('t.r2')::uuid]) r;
insert into public.clientes (negocio_id, nombre, telefono) values (current_setting('t.neg')::uuid, 'Carla', '+5491144445555');

create function pg_temp.hora(h int) returns timestamptz language sql as $$
  select (current_setting('t.fecha')::date::timestamp + make_interval(hours => h)) at time zone 'America/Argentina/Buenos_Aires'
$$;
insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado)
  select current_setting('t.neg')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, c.id,
         pg_temp.hora(h), pg_temp.hora(h) + interval '30 minutes', e
  from public.clientes c, (values (10, 'confirmado'), (12, 'confirmado'), (11, 'cancelado')) v(h, e)
  where c.nombre = 'Carla';
select set_config('t.t10', (select id::text from public.turnos where inicio = pg_temp.hora(10)), true);
select set_config('t.t11', (select id::text from public.turnos where inicio = pg_temp.hora(11)), true);

-- Dueña (1-6)
select pg_temp.como('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select ok(exists(select 1 from public.huecos_para_mover(current_setting('t.t10')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date) where inicio = pg_temp.hora(10)),
  'el propio turno no ocupa su lugar al moverlo');
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 9,
  'huecos_disponibles sigue contando los turnos activos');
select lives_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t10'), current_setting('t.r1'), current_setting('t.srv'), pg_temp.hora(11)),
  'se mueve a un horario libre (el cancelado no ocupa)');
select is((select inicio from public.turnos where id = current_setting('t.t10')::uuid), pg_temp.hora(11), 'quedó a las 11');
select throws_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t10'), current_setting('t.r1'), current_setting('t.srv'), pg_temp.hora(12)),
  'P0001', 'horario_ocupado', 'no se mueve encima de otro turno');
select lives_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t10'), current_setting('t.r2'), current_setting('t.srv'), pg_temp.hora(12)),
  'sí a la misma hora en otro sillón');
reset role;

-- Profesional sin ver agendas ajenas (7-8)
select pg_temp.como('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
set local role authenticated;
select throws_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t10'), current_setting('t.r1'), current_setting('t.srv'), pg_temp.hora(9)),
  'P0001', 'no_movible', 'un Profesional no mueve turnos de agendas ajenas');
select is((select count(*)::int from public.huecos_para_mover(current_setting('t.t10')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 0,
  'ni ve sus huecos');
reset role;

-- Otro negocio, turnos cancelados y anónimos (9-11)
select pg_temp.como('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set local role authenticated;
select throws_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t10'), current_setting('t.r2'), current_setting('t.srv'), pg_temp.hora(9)),
  'P0001', 'no_movible', 'otro negocio no mueve turnos ajenos');
reset role;
select pg_temp.como('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select throws_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t11'), current_setting('t.r1'), current_setting('t.srv'), pg_temp.hora(9)),
  'P0001', 'no_movible', 'un turno cancelado no se mueve');
reset role;
set local role anon;
select throws_ok(format($$select public.mover_turno(%L, %L, %L, %L)$$, current_setting('t.t10'), current_setting('t.r1'), current_setting('t.srv'), pg_temp.hora(9)),
  '42501', null, 'anónimo no puede llamar mover_turno');
reset role;

select * from finish();
rollback;
