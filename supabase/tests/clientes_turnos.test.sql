begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

create function public.test_roles() returns jsonb language sql as $$
  select '[
    {"nombre":"Dueño","es_dueno":true,"permisos":{}},
    {"nombre":"Recepción","es_dueno":false,"permisos":{"gestionar_turnos":true,"gestionar_clientes":true,"ver_agendas_ajenas":true}},
    {"nombre":"Profesional","es_dueno":false,"permisos":{"gestionar_turnos":true}}
  ]'::jsonb
$$;

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.com');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select public.crear_negocio('Barbería Uno', 'barberia-uno', 'peluqueria', true, 'editable', 'Ana', public.test_roles());
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select public.crear_negocio('Cancha B', 'cancha-b', 'cancha', false, 'fijo', 'Beto', public.test_roles());
reset role;

-- Datos de A (como superusuario): P es Profesional y es dueño del recurso R1; R2 es de nadie.
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', r.id, 'Pablo', 'pablo'
  from public.negocios n join public.roles r on r.negocio_id = n.id
  where n.slug = 'barberia-uno' and r.nombre = 'Profesional';

select set_config('t.neg_a', (select id::text from public.negocios where slug = 'barberia-uno'), true);
select set_config('t.neg_b', (select id::text from public.negocios where slug = 'cancha-b'), true);
select set_config('t.fecha', (current_date + 3)::text, true);

insert into public.recursos (negocio_id, nombre, miembro_id)
  select current_setting('t.neg_a')::uuid, 'Sillón 1', (select id from public.miembros where usuario = 'pablo' and negocio_id = current_setting('t.neg_a')::uuid);
insert into public.recursos (negocio_id, nombre) values (current_setting('t.neg_a')::uuid, 'Sillón 2');
insert into public.servicios (negocio_id, nombre, duracion_min, precio) values (current_setting('t.neg_a')::uuid, 'Corte', 30, 8000);
select set_config('t.r1', (select id::text from public.recursos where nombre = 'Sillón 1' and negocio_id = current_setting('t.neg_a')::uuid), true);
select set_config('t.r2', (select id::text from public.recursos where nombre = 'Sillón 2' and negocio_id = current_setting('t.neg_a')::uuid), true);
select set_config('t.srv', (select id::text from public.servicios where nombre = 'Corte' and negocio_id = current_setting('t.neg_a')::uuid), true);
insert into public.recurso_servicio (negocio_id, recurso_id, servicio_id)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid),
         (current_setting('t.neg_a')::uuid, current_setting('t.r2')::uuid, current_setting('t.srv')::uuid);
insert into public.horarios (negocio_id, recurso_id, dia_semana, desde_min, hasta_min)
  select current_setting('t.neg_a')::uuid, r, extract(dow from current_setting('t.fecha')::date)::int, 540, 780
  from unnest(array[current_setting('t.r1')::uuid, current_setting('t.r2')::uuid]) r;
insert into public.clientes (negocio_id, nombre, telefono) values
  (current_setting('t.neg_a')::uuid, 'Carla', '+5491144445555'),
  (current_setting('t.neg_a')::uuid, 'Carla Dup', '+5491144445556');
select set_config('t.c1', (select id::text from public.clientes where nombre = 'Carla' and negocio_id = current_setting('t.neg_a')::uuid), true);
select set_config('t.c2', (select id::text from public.clientes where nombre = 'Carla Dup' and negocio_id = current_setting('t.neg_a')::uuid), true);
select set_config('t.h10', ((current_setting('t.fecha')::date)::timestamp + interval '10 hours') at time zone 'America/Argentina/Buenos_Aires' || '', true);

-- Disponibilidad y exclusión (A, dueña) (1-12)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 15, 'hay 15 huecos de 30 min cada 15 en 09:00-13:00');
select lives_ok($$update public.negocios set intervalo_min = 30 where id = current_setting('t.neg_a')::uuid$$, 'el dueño cambia el intervalo entre horarios');
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 8, 'con intervalo de 30 min hay 8 huecos en 09:00-13:00');
select throws_ok($$update public.negocios set intervalo_min = 7 where id = current_setting('t.neg_a')::uuid$$, '23514', null, 'un intervalo inválido se rechaza');
update public.negocios set intervalo_min = 15 where id = current_setting('t.neg_a')::uuid;
select lives_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz, current_setting('t.h10')::timestamptz + interval '30 minutes', 'confirmado')$$, 'A crea un turno');
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 12, 'el turno ocupa 3 huecos');
select throws_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz + interval '15 minutes', current_setting('t.h10')::timestamptz + interval '45 minutes', 'pendiente')$$,
  '23P01', null, 'un turno que pisa a otro se rechaza');
select lives_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r2')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz, current_setting('t.h10')::timestamptz + interval '30 minutes', 'confirmado')$$, 'el mismo horario en otro recurso es válido');
update public.turnos set estado = 'cancelado' where recurso_id = current_setting('t.r1')::uuid;
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 15, 'cancelar libera el hueco');
select lives_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz, current_setting('t.h10')::timestamptz + interval '30 minutes', 'pendiente')$$, 'se puede reservar sobre un turno cancelado');
update public.turnos set estado = 'no_vino' where recurso_id = current_setting('t.r1')::uuid and estado = 'pendiente';
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 15, 'no vino libera el hueco');
update public.turnos set estado = 'completado' where recurso_id = current_setting('t.r1')::uuid and estado = 'no_vino';
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 12, 'completado sigue ocupando');
select throws_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz + interval '2 hours', current_setting('t.h10')::timestamptz + interval '2 hours')$$,
  '23514', null, 'un turno sin duración se rechaza');
select throws_ok($$insert into public.clientes (negocio_id, nombre, telefono) values (current_setting('t.neg_a')::uuid, 'Mal', '1144445555')$$, '23514', null, 'teléfono sin formato E.164 se rechaza');
select throws_ok($$insert into public.clientes (negocio_id, nombre, telefono) values (current_setting('t.neg_a')::uuid, 'Repetida', '+5491144445555')$$, '23505', null, 'el mismo teléfono en el mismo negocio se rechaza');

-- Bloqueo del día (13-14)
reset role;
insert into public.bloqueos (negocio_id, desde, hasta) values (current_setting('t.neg_a')::uuid, current_setting('t.fecha')::date, current_setting('t.fecha')::date);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r2')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 0, 'un bloqueo del negocio deja el día sin huecos');
reset role;
delete from public.bloqueos;
-- Anticipación mínima: con 72 horas ya no hay huecos para mañana
update public.negocios set anticipacion_min_horas = 100 where id = current_setting('t.neg_a')::uuid;
set local role authenticated;
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r2')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 0, 'la anticipación mínima oculta los huecos cercanos');
reset role;
update public.negocios set anticipacion_min_horas = 1 where id = current_setting('t.neg_a')::uuid;

-- B no ve nada de A (15-18)
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.turnos) + (select count(*)::int from public.clientes), 0, 'B no ve turnos ni clientes de A');
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 0, 'B no obtiene huecos de un recurso de A');
select throws_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin)
  values (current_setting('t.neg_b')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz + interval '3 hours', current_setting('t.h10')::timestamptz + interval '4 hours')$$,
  '23503', null, 'B no puede crear un turno con recursos y clientes de A');
select lives_ok($$insert into public.clientes (negocio_id, nombre, telefono) values (current_setting('t.neg_b')::uuid, 'Carla', '+5491144445555')$$, 'el mismo número en otro negocio es otro cliente');
reset role;

-- Profesional (P): solo su agenda (19-24)
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.turnos), 2, 'P ve los turnos de su recurso (cancelado y completado) y no los del otro');
select is((select count(*)::int from public.turnos where recurso_id = current_setting('t.r2')::uuid), 0, 'P no ve turnos de recursos ajenos');
select throws_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r2')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz + interval '2 hours', current_setting('t.h10')::timestamptz + interval '150 minutes')$$,
  '42501', null, 'P no puede crear turnos en recursos ajenos');
select lives_ok($$insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.c1')::uuid,
          current_setting('t.h10')::timestamptz + interval '2 hours', current_setting('t.h10')::timestamptz + interval '150 minutes')$$, 'P crea turnos en su recurso');
select throws_ok($$select public.unir_clientes(current_setting('t.c2')::uuid, current_setting('t.c1')::uuid)$$, '42501', null, 'P sin gestionar_clientes no puede unir clientes');
reset role;
update public.roles set permisos = '{"gestionar_turnos":true,"ver_agendas_ajenas":true}'::jsonb where nombre = 'Profesional' and negocio_id = current_setting('t.neg_a')::uuid;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.turnos where recurso_id = current_setting('t.r2')::uuid), 1, 'con ver_agendas_ajenas P ve las otras agendas');
reset role;

-- Unir clientes (25-33)
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.unir_clientes(current_setting('t.c2')::uuid, current_setting('t.c1')::uuid)$$, 'P0001', 'datos_invalidos', 'B no puede unir clientes de A');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$select public.unir_clientes(current_setting('t.c1')::uuid, current_setting('t.c1')::uuid)$$, 'P0001', 'datos_invalidos', 'no se une un cliente consigo mismo');
reset role;
insert into public.turnos (negocio_id, recurso_id, servicio_id, cliente_id, inicio, fin, estado)
  values (current_setting('t.neg_a')::uuid, current_setting('t.r2')::uuid, current_setting('t.srv')::uuid, current_setting('t.c2')::uuid,
          current_setting('t.h10')::timestamptz + interval '1 hour', current_setting('t.h10')::timestamptz + interval '90 minutes', 'confirmado');
update public.clientes set notas = 'Prefiere tarde' where id = current_setting('t.c2')::uuid;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$select public.unir_clientes(current_setting('t.c2')::uuid, current_setting('t.c1')::uuid)$$, 'A une dos clientes');
select is((select count(*)::int from public.clientes where id = current_setting('t.c2')::uuid), 0, 'el cliente origen desaparece');
select is((select count(*)::int from public.turnos where cliente_id = current_setting('t.c1')::uuid and recurso_id = current_setting('t.r2')::uuid), 2, 'los turnos pasan al cliente destino');
select is((select notas from public.clientes where id = current_setting('t.c1')::uuid), 'Prefiere tarde', 'las notas se conservan');
reset role;
-- Desactivado (P)
update public.miembros set activo = false where usuario = 'pablo' and negocio_id = current_setting('t.neg_a')::uuid;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.turnos) + (select count(*)::int from public.clientes), 0, 'un empleado desactivado no ve turnos ni clientes');
select is((select count(*)::int from public.huecos_disponibles(current_setting('t.r1')::uuid, current_setting('t.srv')::uuid, current_setting('t.fecha')::date)), 0, 'ni disponibilidad');
reset role;

select * from finish();
rollback;
