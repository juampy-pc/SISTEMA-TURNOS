import { expect, test } from '@playwright/test';
import {
  crearEmpleadoUI,
  llenarHastaPaso3,
  loginDuenoCon,
  loginEmpleadoCon,
  negociosConSlug,
  registrarNegocio,
  usuariosConEmail,
  type Cuenta,
} from './helpers';

const sufijo = Date.now().toString(36);
const dueno: Cuenta = { email: `dueno-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Ana' };
const slug = `barberia-${sufijo}`;
const empleado = { nombre: 'Juan Pérez', usuario: `juan${sufijo}`, password: 'clave-empleado-1' };

const loginDueno = (page: import('@playwright/test').Page) => loginDuenoCon(page, dueno);
const loginEmpleado = (page: import('@playwright/test').Page) =>
  loginEmpleadoCon(page, ` ${empleado.usuario.toUpperCase()} `, slug, empleado.password);

test.describe.configure({ mode: 'serial' });

test('el dueño registra su negocio y llega al panel', async ({ page }) => {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill(dueno.nombre);
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Nombre del negocio').fill('Barbería E2E');
  await page.getByLabel('Peluquería / Barbería').check();
  await page.getByLabel('Link de tu página').fill(slug);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Sí, vendo productos').check();
  await page.getByLabel('Turnos editables (según el servicio)').check();
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();

  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Barbería E2E' })).toBeVisible();
  await expect(page.getByText('Primeros pasos')).toBeVisible();
});

test('un link ya usado se avisa antes de continuar', async ({ page }) => {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill('Otra');
  await page.getByLabel('Email').fill(`otra-${sufijo}@example.com`);
  await page.getByLabel('Contraseña', { exact: true }).fill('clave-segura-1');
  await page.getByRole('button', { name: 'Siguiente' }).click();

  await page.getByLabel('Nombre del negocio').fill('Copia');
  await page.getByLabel('Link de tu página').fill(slug);
  await expect(page.getByText('No disponible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

  await page.getByLabel('Link de tu página').fill('panel');
  await expect(page.getByText('No disponible')).toBeVisible();
});

test('registro con un link que se ocupa a último momento: avisa, conserva los datos y permite reintentar', async ({
  page,
  browser,
}) => {
  const cuenta: Cuenta = { email: `carrera-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Carla' };
  const slugCarrera = `carrera-${sufijo}`;
  const slugLibre = `carrera-libre-${sufijo}`;

  await llenarHastaPaso3(page, cuenta, 'Negocio Carrera', slugCarrera);

  // Mientras tanto, otra persona se queda con el link.
  const ctxOtro = await browser.newContext();
  const paginaOtro = await ctxOtro.newPage();
  await registrarNegocio(
    paginaOtro,
    { email: `ganador-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Gabi' },
    'Ganador',
    slugCarrera,
  );
  await ctxOtro.close();

  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page.locator('p[role=\"alert\"]')).toHaveText('Ese link ya está en uso. Elegí otro.');
  await expect(page.getByText('Paso 2 de 3')).toBeVisible();
  expect(await negociosConSlug(slugCarrera)).toBe(1);
  expect(await usuariosConEmail(cuenta.email)).toBe(0);

  // Los datos del paso 1 y 2 siguen ahí.
  await expect(page.locator('input[name="nombreDueno"]')).toHaveValue(cuenta.nombre);
  await expect(page.locator('input[name="email"]')).toHaveValue(cuenta.email);
  await expect(page.locator('input[name="nombreNegocio"]')).toHaveValue('Negocio Carrera');

  // Reintento con otro link: no lo frena la validación nativa de los campos ocultos.
  await page.getByLabel('Link de tu página').fill(slugLibre);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole('heading', { name: 'Negocio Carrera' })).toBeVisible();
  expect(await negociosConSlug(slugLibre)).toBe(1);
});

test('un link reservado se rechaza en el servidor y no se crea el negocio', async ({ page }) => {
  const cuenta: Cuenta = { email: `reservado-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Rita' };
  await llenarHastaPaso3(page, cuenta, 'Negocio Reservado', `reservado-${sufijo}`);

  // Se fuerza el valor saltando el control del cliente para probar la defensa del servidor.
  await page.evaluate(() => {
    const el = document.querySelector<HTMLInputElement>('input[name="slug"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, 'panel');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();

  await expect(page.locator('p[role=\"alert\"]')).toHaveText('Ese link está reservado, elegí otro.');
  await expect(page.getByText('Paso 2 de 3')).toBeVisible();
  expect(await negociosConSlug('panel')).toBe(0);
  expect(await usuariosConEmail(cuenta.email)).toBe(0);
});

test('el dueño crea un empleado que entra sin ver Empleados', async ({ page }) => {
  await loginDueno(page);
  await page.goto('/panel/empleados');
  await expect(page.getByRole('heading', { name: 'Empleados', exact: true })).toBeVisible();

  await page.getByLabel('Nombre', { exact: true }).fill(empleado.nombre);
  await page.getByLabel('Usuario', { exact: true }).fill(empleado.usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(empleado.password);
  await page.locator('select[name="rolId"]').first().selectOption({ label: 'Recepción' });
  await page.getByRole('button', { name: 'Crear empleado' }).click();
  await expect(page.getByText('Empleado creado.')).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();

  await loginEmpleado(page);
  await expect(page.getByRole('link', { name: 'Empleados' })).toHaveCount(0);
  await page.goto('/panel/empleados');
  await expect(page).toHaveURL(/\/panel$/);
});

test('un alta de empleado fallida conserva Nombre y Usuario y no manda la contraseña por la URL', async ({ page }) => {
  await loginDueno(page);
  const password = 'otra-clave-secreta-9';
  await crearEmpleadoUI(page, { nombre: 'Otro Juan', usuario: empleado.usuario, password });

  await expect(page.locator('p[role=\"alert\"]')).toHaveText('Ese usuario ya existe.');
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Otro Juan');
  await expect(page.getByLabel('Usuario', { exact: true })).toHaveValue(empleado.usuario);
  expect(page.url()).not.toContain(password);
  expect(page.url()).not.toContain('password');
});

test('el mismo usuario puede existir en dos negocios y el login tolera mayúsculas y espacios', async ({
  page,
  browser,
}) => {
  const compartido = { nombre: 'Compartido Uno', usuario: 'compartido', password: 'clave-empleado-1' };
  const slug2 = `otro-negocio-${sufijo}`;
  const dueno2: Cuenta = { email: `dueno2-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Beto' };

  await loginDueno(page);
  await crearEmpleadoUI(page, compartido);
  await expect(page.getByText('Empleado creado.')).toBeVisible();

  const ctx2 = await browser.newContext();
  const pagina2 = await ctx2.newPage();
  await registrarNegocio(pagina2, dueno2, 'Otro Negocio', slug2);
  await crearEmpleadoUI(pagina2, { ...compartido, nombre: 'Compartido Dos' });
  await expect(pagina2.getByText('Empleado creado.')).toBeVisible();
  await ctx2.close();

  for (const [codigo, nombre] of [
    [slug, 'Compartido Uno'],
    [slug2, 'Compartido Dos'],
  ]) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await loginEmpleadoCon(p, '  Compartido ', codigo, compartido.password);
    await expect(p.getByRole('heading', { name: `Hola, ${nombre}` })).toBeVisible();
    await ctx.close();
  }
});

test('un empleado desactivado con la sesión abierta pierde el acceso', async ({ browser }) => {
  const ctxEmpleado = await browser.newContext();
  const paginaEmpleado = await ctxEmpleado.newPage();
  await loginEmpleado(paginaEmpleado);

  const ctxDueno = await browser.newContext();
  const paginaDueno = await ctxDueno.newPage();
  await loginDueno(paginaDueno);
  await paginaDueno.goto('/panel/empleados');
  await paginaDueno
    .getByRole('listitem')
    .filter({ hasText: empleado.usuario })
    .getByRole('button', { name: 'Desactivar' })
    .click();
  await expect(paginaDueno.getByText('Empleado desactivado.')).toBeVisible();

  // Sin bucle de redirecciones: termina en el login con el aviso visible.
  await paginaEmpleado.goto('/panel');
  await expect(paginaEmpleado).toHaveURL(/\/login\?aviso=sin-acceso$/);
  await expect(paginaEmpleado.getByText('Tu acceso fue desactivado o ya no existe.')).toBeVisible();

  // Y la sesión quedó cerrada: /panel vuelve a pedir login (sin aviso) y /salir sigue andando.
  await paginaEmpleado.goto('/panel');
  await expect(paginaEmpleado).toHaveURL(/\/login$/);
  const salir = await paginaEmpleado.request.get('/salir', { maxRedirects: 0 });
  expect(salir.status()).toBeGreaterThanOrEqual(300);
  expect(salir.status()).toBeLessThan(400);

  await ctxEmpleado.close();
  await ctxDueno.close();
});
