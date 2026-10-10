import { expect, test, type Page } from '@playwright/test';
import { hoyISO, sumarDias } from '../src/lib/dominio/fechas';
import { llenarHastaPaso3, type Cuenta } from './helpers';

const sufijo = Date.now().toString(36);
const dueno: Cuenta = { email: `tu-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Tomás' };
const slug = `turnos-${sufijo}`;

// Un día de atención (lunes a sábado) con anticipación suficiente.
let fecha = sumarDias(hoyISO(), 2);
if (new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0) fecha = sumarDias(fecha, 1);

test.describe.configure({ mode: 'serial' });

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

async function nuevoTurno(page: Page, hora: string, nombre: string, telefono: string) {
  await page.goto(`/panel/turnos?fecha=${fecha}`);
  await page.locator('select[name="servicio"]').selectOption({ label: 'Corte' });
  await page.getByRole('button', { name: 'Ver horarios libres' }).click();
  await page.getByRole('radio', { name: new RegExp(`^${hora}`) }).check({ force: true });
  await page.getByLabel('Nombre del cliente').fill(nombre);
  await page.getByLabel('Teléfono').fill(telefono);
  await page.getByRole('button', { name: 'Crear turno' }).click();
}

test('registro con plantilla y primer turno manual', async ({ page }) => {
  await llenarHastaPaso3(page, dueno, 'Turnos E2E', slug);
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page).toHaveURL(/\/panel\/primeros-pasos$/);
  await page.getByRole('button', { name: 'Cargar y seguir' }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await nuevoTurno(page, '09:00', 'Carla Gómez', '011 15-4444-5555');
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Turno creado.');
  await expect(page.getByText('09:00 a 09:30')).toBeVisible();
});

test('el horario ocupado desaparece y cancelar lo libera', async ({ page }) => {
  await entrar(page);
  await page.goto(`/panel/turnos?fecha=${fecha}`);
  await page.locator('select[name="servicio"]').selectOption({ label: 'Corte' });
  await page.getByRole('button', { name: 'Ver horarios libres' }).click();
  await expect(page.getByRole('radio', { name: /^09:00/ })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: /^09:30/ })).toHaveCount(1);

  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Turno actualizado.');
  await page.locator('select[name="servicio"]').selectOption({ label: 'Corte' });
  await page.getByRole('button', { name: 'Ver horarios libres' }).click();
  await expect(page.getByRole('radio', { name: /^09:00/ })).toHaveCount(1);
});

test('el mismo teléfono escrito distinto reutiliza la ficha', async ({ page }) => {
  await entrar(page);
  await nuevoTurno(page, '10:00', 'Carla G.', '+54 9 11 4444-5555');
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Turno creado.');
  await page.goto('/panel/clientes');
  await expect(page.getByRole('link', { name: /Carla/ })).toHaveCount(1);
});

test('un teléfono parecido se sugiere como duplicado y se puede unir', async ({ page }) => {
  await entrar(page);
  await nuevoTurno(page, '11:00', 'Carla Gómez 2', '1144445556');
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Turno creado.');
  await page.goto('/panel/clientes');
  await expect(page.getByRole('link', { name: /Carla/ })).toHaveCount(2);

  await page.getByRole('link', { name: /Carla Gómez 2/ }).click();
  await expect(page.getByRole('region', { name: 'Posibles duplicados' })).toBeVisible();
  await page.getByRole('button', { name: 'Unir en esta ficha' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Clientes unidos');
  await expect(page.getByRole('region', { name: 'Posibles duplicados' })).toHaveCount(0);
  await page.goto('/panel/clientes');
  await expect(page.getByRole('link', { name: /Carla/ })).toHaveCount(1);
});

test('alta manual de cliente y teléfono repetido lleva a la ficha existente', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/clientes');
  await page.getByText('Nuevo cliente').click();
  await page.getByLabel('Nombre', { exact: true }).fill('Lucía Pérez');
  await page.getByLabel('Teléfono').fill('011 15-3333-2222');
  await page.getByRole('button', { name: 'Agregar cliente' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Cliente agregado.');
  await expect(page.getByRole('heading', { name: 'Lucía Pérez' })).toBeVisible();

  await page.goto('/panel/clientes');
  await page.getByText('Nuevo cliente').click();
  await page.getByLabel('Nombre', { exact: true }).fill('Lucía otra');
  await page.getByLabel('Teléfono').fill('+54 9 11 3333-2222');
  await page.getByRole('button', { name: 'Agregar cliente' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Ya tenías un cliente con ese teléfono');
  await expect(page.getByRole('heading', { name: 'Lucía Pérez' })).toBeVisible();
});

test('se guarda un detalle por turno en la ficha del cliente', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/clientes');
  await page.getByRole('link', { name: /Carla/ }).click();
  await page.getByText('Agregar detalle').first().click();
  await page.getByLabel('Detalle del turno').first().fill('Corte degradé, número 2 a los costados.');
  await page.getByRole('button', { name: 'Guardar detalle' }).first().click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Detalle del turno guardado.');
  await expect(page.locator('p', { hasText: 'Corte degradé, número 2 a los costados.' })).toBeVisible();
});

test('un empleado sin permiso de turnos no entra a la agenda', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/turnos');
  await expect(page.getByRole('heading', { name: 'Turnos', level: 2 })).toBeVisible();
});
