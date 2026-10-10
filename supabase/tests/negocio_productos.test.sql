begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'r@test.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p@test.com');

create function pg_temp.como(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true)
$$;

select pg_temp.como('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select public.crear_negocio('Barbería Uno', 'barberia-uno', 'peluqueria', true, 'editable', 'Ana', '[
  {"nombre":"Dueño","es_dueno":true,"permisos":{}},
  {"nombre":"Recepción","es_dueno":false,"permisos":{"registrar_ventas":true,"editar_catalogo":true,"gestionar_clientes":true}},
  {"nombre":"Profesional","es_dueno":false,"permisos":{"gestionar_turnos":true}}
]'::jsonb);
reset role;
select pg_temp.como('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set local role authenticated;
select public.crear_negocio('Cancha B', 'cancha-b', 'cancha', true, 'fijo', 'Beto', '[{"nombre":"Dueño","es_dueno":true,"permisos":{}}]'::jsonb);
reset role;

select set_config('t.neg', (select id::text from public.negocios where slug = 'barberia-uno'), true);
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', r.id, 'Rita', 'rita'
  from public.negocios n join public.roles r on r.negocio_id = n.id where n.slug = 'barberia-uno' and r.nombre = 'Recepción';
insert into public.miembros (negocio_id, auth_user_id, rol_id, nombre, usuario)
  select n.id, 'dddddddd-dddd-dddd-dddd-dddddddddddd', r.id, 'Pablo', 'pablo'
  from public.negocios n join public.roles r on r.negocio_id = n.id where n.slug = 'barberia-uno' and r.nombre = 'Profesional';
insert into public.clientes (negocio_id, nombre, telefono) values
  (current_setting('t.neg')::uuid, 'Carla', '+5491144445555'),
  (current_setting('t.neg')::uuid, 'Carla Dup', '+5491144445556');

-- Mi negocio (1-5)
select pg_temp.como('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select lives_ok($$select public.guardar_negocio('Barbería Uno', 'Cortes clásicos', 'Calle 1', 'barberia.uno', '#1d4ed8', '+5491122223333', true)$$, 'el dueño guarda los datos del negocio');
select throws_ok($$select public.guardar_negocio('Barbería Uno', '', '', '', 'rojo', '', true)$$, '23514', null, 'un color inválido se rechaza');
select throws_ok($$select public.guardar_logo('https://otro.com/x.png')$$, 'P0001', 'datos_invalidos', 'un logo de otro origen se rechaza');
select lives_ok(format($$select public.guardar_logo('http://127.0.0.1:54321/storage/v1/object/public/imagenes/%s/logo-1.png')$$, current_setting('t.neg')), 'un logo del bucket y la carpeta del negocio se acepta');
reset role;
select pg_temp.como('cccccccc-cccc-cccc-cccc-cccccccccccc');
set local role authenticated;
select throws_ok($$select public.guardar_negocio('Otro', '', '', '', '#1d4ed8', '', true)$$, '42501', null, 'sin editar_negocio no se cambian los datos');

-- Productos (6-10)
select lives_ok($$insert into public.productos (negocio_id, nombre, precio, stock) values (current_setting('t.neg')::uuid, 'Cera', 5000, 2)$$, 'Recepción crea un producto');
select throws_ok($$insert into public.productos (negocio_id, nombre, precio, stock, foto_url) values (current_setting('t.neg')::uuid, 'Gel', 1, 1, 'https://otro.com/a.png')$$, '23514', null, 'una foto de otro origen se rechaza');
select set_config('t.cera', (select id::text from public.productos where nombre = 'Cera'), true);
reset role;
select pg_temp.como('dddddddd-dddd-dddd-dddd-dddddddddddd');
set local role authenticated;
select is((select count(*)::int from public.productos), 0, 'un Profesional sin permisos no ve productos');
select throws_ok($$insert into public.productos (negocio_id, nombre) values (current_setting('t.neg')::uuid, 'Shampoo')$$, '42501', null, 'ni los crea');
select throws_ok($$select public.registrar_venta(current_setting('t.cera')::uuid, 1, null, null, false)$$, '42501', null, 'ni registra ventas');
reset role;

-- Ventas (11-17)
select pg_temp.como('cccccccc-cccc-cccc-cccc-cccccccccccc');
set local role authenticated;
select is(public.registrar_venta(current_setting('t.cera')::uuid, 1, null, (select id from public.clientes where nombre = 'Carla Dup'), false), 1, 'vender uno descuenta stock');
select is((select monto from public.ventas limit 1), 5000.00, 'el monto por defecto es precio × cantidad');
select throws_ok($$select public.registrar_venta(current_setting('t.cera')::uuid, 3, null, null, false)$$, 'P0001', 'stock_insuficiente', 'sin stock suficiente pide confirmación');
select is(public.registrar_venta(current_setting('t.cera')::uuid, 3, 12000, null, true), 0, 'confirmada, el stock queda en 0');
select is((select count(*)::int from public.ventas), 2, 'quedan dos ventas');
select lives_ok($$select public.anular_venta((select id from public.ventas where cantidad = 3))$$, 'anular una venta del día');
select is((select stock from public.productos where id = current_setting('t.cera')::uuid), 3, 'anular devuelve el stock');
reset role;

-- Aislamiento entre negocios (18-19)
select pg_temp.como('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
set local role authenticated;
select is((select count(*)::int from public.productos), 0, 'otro negocio no ve los productos');
select throws_ok($$select public.registrar_venta(current_setting('t.cera')::uuid, 1, null, null, false)$$, 'P0001', 'datos_invalidos', 'ni vende un producto ajeno');
reset role;

-- Unir clientes mueve las ventas (20)
select pg_temp.como('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select public.unir_clientes((select id from public.clientes where nombre = 'Carla Dup'), (select id from public.clientes where nombre = 'Carla'));
select is((select c.nombre from public.ventas v join public.clientes c on c.id = v.cliente_id), 'Carla', 'la venta pasó al cliente destino');
reset role;

-- Página pública (21-22)
set local role service_role;
select is(jsonb_array_length(public.negocio_publico('barberia-uno') -> 'productos'), 1, 'el catálogo público muestra los productos');
reset role;
update public.negocios set vende_productos = false where id = current_setting('t.neg')::uuid;
set local role service_role;
select is(jsonb_array_length(public.negocio_publico('barberia-uno') -> 'productos'), 0, 'sin vender productos, no hay catálogo');
reset role;

select * from finish();
rollback;
