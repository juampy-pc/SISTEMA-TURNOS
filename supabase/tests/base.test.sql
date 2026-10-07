begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

create function public.test_roles() returns jsonb language sql as $$
  select '[
    {"nombre":"Dueño","es_dueno":true,"permisos":{}},
    {"nombre":"Recepción","es_dueno":false,"permisos":{"gestionar_turnos":true,"gestionar_clientes":true}},
    {"nombre":"Profesional","es_dueno":false,"permisos":{"gestionar_turnos":true}}
  ]'::jsonb
$$;

-- Usuarios: A dueña de barberia-uno, B dueño de cancha-b, E empleado de A, C empleado de B
insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'e@test.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@test.com');

-- slug_disponible (1-4)
select ok(public.slug_disponible('mi-cancha'), 'un slug libre y válido está disponible');
select ok(not public.slug_disponible('panel'), 'un slug reservado no está disponible');
select ok(not public.slug_disponible('ab'), 'un slug demasiado corto no está disponible');
select ok(not public.slug_disponible('Mayus'), 'un slug con mayúsculas no es válido');

-- A crea su negocio (5-9)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select isnt(public.crear_negocio('Barbería Uno', 'barberia-uno', 'peluqueria', true, 'editable', 'Ana', public.test_roles()), null, 'A crea su negocio');
select is((select count(*)::int from public.negocios), 1, 'A ve su negocio');
select is((select count(*)::int from public.roles), 3, 'se crearon los 3 roles');
select is((select count(*)::int from public.miembros), 1, 'se creó el miembro dueño');
select ok(not public.slug_disponible('barberia-uno'), 'el slug tomado deja de estar disponible');
select throws_ok(
  $$select public.crear_negocio('Otro', 'otro-negocio', 'cancha', false, 'fijo', 'Ana', public.test_roles())$$,
  'P0001', 'ya_tiene_negocio', 'un usuario no puede crear dos negocios');

-- B: slug repetido falla, luego crea el suyo (10-13)
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.crear_negocio('Copia', 'barberia-uno', 'cancha', false, 'fijo', 'Beto', public.test_roles())$$,
  '23505', null, 'un slug repetido falla');
select isnt(public.crear_negocio('Cancha B', 'cancha-b', 'cancha', false, 'fijo', 'Beto', public.test_roles()), null, 'B crea su negocio');
select is((select count(*)::int from public.negocios), 1, 'B solo ve un negocio');
select is((select slug from public.negocios), 'cancha-b', 'y es el suyo');

-- El mismo usuario puede existir en dos negocios (14)
reset role;
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', r.id, 'Eva', 'juan'
  from public.negocios n join public.roles r on r.negocio_id = n.id
  where n.slug = 'barberia-uno' and r.nombre = 'Recepción';
select lives_ok($$
  insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
    select n.id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', r.id, 'Carlos', 'juan'
    from public.negocios n join public.roles r on r.negocio_id = n.id
    where n.slug = 'cancha-b' and r.nombre = 'Profesional'
$$, 'el mismo usuario puede existir en dos negocios');

-- E (Recepción de A): permisos y límites (15-18)
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select ok(not private.tiene_permiso('ver_ingresos'), 'Recepción no ve ingresos');
select ok(private.tiene_permiso('gestionar_turnos'), 'Recepción gestiona turnos');
select ok(not private.es_dueno(), 'Recepción no es dueño');
update public.roles set permisos = '{"ver_ingresos":true}'::jsonb where nombre = 'Profesional';
reset role;
select is(
  (select r.permisos from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'barberia-uno' and r.nombre = 'Profesional'),
  '{"gestionar_turnos": true}'::jsonb, 'un empleado no puede cambiar permisos de roles');

-- A (dueña): puede editar roles no-dueño, pero no el rol dueño ni columnas protegidas (19-25)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select ok(private.es_dueno(), 'A es dueña');
select ok(private.tiene_permiso('ver_ingresos'), 'el dueño tiene todos los permisos sin listarlos');
select throws_ok($$update public.miembros set usuario = 'x' where usuario = 'juan'$$, '42501', null, 'la columna usuario no se puede editar');
select throws_ok($$update public.roles set es_dueno = true where nombre = 'Recepción'$$, '42501', null, 'la columna es_dueno no se puede editar');
update public.roles set permisos = '{"registrar_ventas":true}'::jsonb where nombre = 'Recepción';
update public.roles set permisos = '{"ver_ingresos":false}'::jsonb where es_dueno;
update public.miembros set activo = false where usuario = 'dueno';
reset role;
select is(
  (select r.permisos from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'barberia-uno' and r.nombre = 'Recepción'),
  '{"registrar_ventas": true}'::jsonb, 'el dueño edita permisos de un rol no-dueño');
select is(
  (select r.permisos from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'barberia-uno' and r.es_dueno),
  '{}'::jsonb, 'el rol dueño no se puede modificar');
select ok(
  (select m.activo from public.miembros m join public.negocios n on n.id = m.negocio_id where n.slug = 'barberia-uno' and m.usuario = 'dueno'),
  'el miembro dueño no se puede desactivar');

-- A (dueña) no puede asignar roles de otro negocio (escalada entre inquilinos)
reset role;
select set_config('t.rol_b', (select r.id::text from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'cancha-b' and r.nombre = 'Profesional'), true);
select set_config('t.rol_dueno_b', (select r.id::text from public.roles r join public.negocios n on n.id = r.negocio_id where n.slug = 'cancha-b' and r.es_dueno), true);
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$update public.miembros set rol_id = current_setting('t.rol_b')::uuid where usuario = 'juan'$$, '23503', null, 'no se puede asignar un rol de otro negocio');
select throws_ok($$update public.miembros set rol_id = current_setting('t.rol_dueno_b')::uuid where usuario = 'juan'$$, '23503', null, 'no se puede asignar el rol dueño de otro negocio');
reset role;

-- A desactiva a E; E pierde acceso (26-27)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$update public.miembros set activo = false where usuario = 'juan'$$, 'el dueño desactiva a un empleado');
reset role;
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.negocios), 0, 'un empleado desactivado no ve ningún dato');

select * from finish();
rollback;
