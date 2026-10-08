begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function public.test_roles() returns jsonb language sql as $$
  select '[
    {"nombre":"Dueño","es_dueno":true,"permisos":{}},
    {"nombre":"Recepción","es_dueno":false,"permisos":{"gestionar_turnos":true}},
    {"nombre":"Profesional","es_dueno":false,"permisos":{"gestionar_turnos":true}}
  ]'::jsonb
$$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.com');

-- A dueña de barberia-uno; B dueño de cancha-b
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select public.crear_negocio('Barbería Uno', 'barberia-uno', 'peluqueria', true, 'editable', 'Ana', public.test_roles());
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select public.crear_negocio('Cancha B', 'cancha-b', 'cancha', false, 'fijo', 'Beto', public.test_roles());
reset role;

-- E: Profesional de A (sin gestionar_servicios)
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', r.id, 'Eva', 'eva'
  from public.negocios n join public.roles r on r.negocio_id = n.id
  where n.slug = 'barberia-uno' and r.nombre = 'Profesional';

select set_config('t.neg_a', (select id::text from public.negocios where slug = 'barberia-uno'), true);
select set_config('t.neg_b', (select id::text from public.negocios where slug = 'cancha-b'), true);

-- A (dueña) carga datos (1-4)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.recursos (negocio_id, nombre) values (current_setting('t.neg_a')::uuid, 'Sillón 1')$$, 'A crea un recurso');
select lives_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Corte', 30, 8000)$$, 'A crea un servicio');
select lives_ok($$insert into public.recurso_servicio (negocio_id, recurso_id, servicio_id)
  select negocio_id, (select id from public.recursos limit 1), id from public.servicios limit 1$$, 'A asigna el servicio al recurso');
select lives_ok($$insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  values (current_setting('t.neg_a')::uuid, (select id from public.recursos limit 1), 1, 540, 780)$$, 'A carga una franja');
select set_config('t.rec_a', (select id::text from public.recursos limit 1), true);
select set_config('t.srv_a', (select id::text from public.servicios limit 1), true);

-- Solapamientos y rangos (5-8)
select throws_ok($$insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  values (current_setting('t.neg_a')::uuid, current_setting('t.rec_a')::uuid, 1, 720, 1080)$$, '23P01', null, 'una franja superpuesta se rechaza');
select lives_ok($$insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  values (current_setting('t.neg_a')::uuid, current_setting('t.rec_a')::uuid, 1, 780, 1080)$$, 'una franja pegada es válida');
select lives_ok($$insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  values (current_setting('t.neg_a')::uuid, current_setting('t.rec_a')::uuid, 2, 720, 1080)$$, 'el mismo horario en otro día es válido');
select throws_ok($$insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  values (current_setting('t.neg_a')::uuid, current_setting('t.rec_a')::uuid, 3, 800, 800)$$, '23514', null, 'franja vacía o invertida se rechaza');

-- Validaciones de servicio (9-11)
select throws_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Cero', 0, 1)$$, '23514', null, 'duración 0 se rechaza');
select throws_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Barato', 30, -1)$$, '23514', null, 'precio negativo se rechaza');
select throws_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, '   ', 30, 1)$$, '23514', null, 'nombre en blanco se rechaza');

-- Bloqueos y configuración (12-15)
select lives_ok($$insert into public.bloqueos (negocio_id, desde, hasta, motivo) values (current_setting('t.neg_a')::uuid, '2026-12-25', '2026-12-25', 'Navidad')$$, 'bloqueo de todo el negocio');
select throws_ok($$insert into public.bloqueos (negocio_id, recurso_id, desde, hasta) values (current_setting('t.neg_a')::uuid, current_setting('t.rec_a')::uuid, '2026-12-25', '2026-12-24')$$, '23514', null, 'bloqueo con fin anterior al inicio se rechaza');
select throws_ok($$update public.negocios set paso_minutos = 7$$, '23514', null, 'paso inválido se rechaza');
select lives_ok($$update public.negocios set paso_minutos = 30$$, 'el dueño cambia el paso');
reset role;

-- E sin permiso (16-18)
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.servicios), 1, 'E puede leer los servicios de su negocio');
select throws_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Tinte', 60, 1)$$, '42501', null, 'E sin permiso no puede crear servicios');
update public.negocios set paso_minutos = 15;
reset role;
select is((select paso_minutos from public.negocios where slug = 'barberia-uno'), 30, 'E sin permiso no cambia la configuración');

-- E con permiso (19)
update public.roles set permisos = '{"gestionar_servicios":true}'::jsonb where nombre = 'Profesional' and negocio_id = current_setting('t.neg_a')::uuid;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Tinte', 60, 1)$$, 'E con permiso crea servicios');
reset role;

-- B: aislamiento y referencias cruzadas (20-24)
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.recursos) + (select count(*)::int from public.servicios) + (select count(*)::int from public.horarios), 0, 'B no ve datos de A');
select throws_ok($$insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  values (current_setting('t.neg_b')::uuid, current_setting('t.rec_a')::uuid, 4, 540, 600)$$, '23503', null, 'B no puede cargar horarios en un recurso de A');
select throws_ok($$insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Intruso', 30, 1)$$, '42501', null, 'B no puede crear servicios en A');
select lives_ok($$insert into public.recursos (negocio_id, nombre) values (current_setting('t.neg_b')::uuid, 'Cancha 1')$$, 'B crea su recurso');
select throws_ok($$insert into public.recurso_servicio (negocio_id, recurso_id, servicio_id)
  values (current_setting('t.neg_b')::uuid, (select id from public.recursos limit 1), current_setting('t.srv_a')::uuid)$$, '23503', null, 'B no puede asignar un servicio de A a su recurso');
reset role;

-- E desactivado (25)
update public.miembros set activo = false where usuario = 'eva';
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.servicios), 0, 'un empleado desactivado no ve servicios');
reset role;

select * from finish();
rollback;
