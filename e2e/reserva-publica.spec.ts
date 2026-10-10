import { expect, test, type Page } from '@playwright/test';
import { hoyISO, sumarDias } from '../src/lib/dominio/fechas';
import { llenarHastaPaso3, type Cuenta } from './helpers';

const sufijo = Date.now().toString(36);
const dueno: Cuenta = { email: `rp-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Rocío' };
const slug = `publica-${sufijo}`;

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

async function elegirCorte(page: Page) {
  const opcion = await page.locator('select[name="servicio"] option', { hasText: /^Corte ·/ }).first().textContent();
  await page.getByLabel('Servicio').selectOption({ label: opcion ?? '' });
}

async function pedirTurno(page: Page, hora: string, datos?: { nombre: string; telefono: string; nota?: string }) {
  await page.goto(`/b/${slug}`);
  await elegirCorte(page);
  await page.getByLabel('Día').fill(fecha);
  await page.getByRole('button', { name: 'Ver horarios' }).click();
  await page.getByRole('radio', { name: new RegExp(`^${hora}`) }).check({ force: true });
  if (datos) {
    await page.getByLabel('Tu nombre').fill(datos.nombre);
    await page.getByLabel('Tu teléfono (WhatsApp)').fill(datos.telefono);
    if (datos.nota) await page.getByLabel('Nota para el negocio (opcional)').fill(datos.nota);
  }
  await page.getByRole('button', { name: 'Pedir turno' }).click();
}

test('el dueño registra su negocio y carga su WhatsApp', async ({ page }) => {
  await llenarHastaPaso3(page, dueno, 'Página Pública E2E', slug);
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page).toHaveURL(/\/panel\/primeros-pasos$/);
  await page.getByRole('button', { name: 'Cargar y seguir' }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await page.goto('/panel/configuracion');
  await page.getByLabel('WhatsApp del negocio').fill('011 15-2222-3333');
  await page.getByRole('button', { name: 'Guardar WhatsApp' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('WhatsApp guardado.');
  await expect(page.getByRole('link', { name: `/b/${slug}` })).toBeVisible();
});

test('un slug inexistente da 404', async ({ page }) => {
  const res = await page.goto(`/b/no-existe-${sufijo}`);
  expect(res?.status()).toBe(404);
});

test('cliente nuevo: el turno queda pendiente, el dueño lo confirma y el dispositivo pasa a ser confiable', async ({ browser, page }) => {
  const cliente = await browser.newContext();
  const pc = await cliente.newPage();
  await pedirTurno(pc, '09:00', { nombre: 'Marta Ruiz', telefono: '11 5555-6666', nota: 'Vengo con mi hija' });
  await expect(pc).toHaveURL(new RegExp(`/b/${slug}/listo`));
  await expect(pc.getByRole('heading', { name: 'Pediste tu turno' })).toBeVisible();
  await expect(pc.getByRole('link', { name: 'Avisar por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/5491122223333\?text=/);

  // El horario ya no se ofrece.
  await pc.goto(`/b/${slug}`);
  await elegirCorte(pc);
  await pc.getByLabel('Día').fill(fecha);
  await pc.getByRole('button', { name: 'Ver horarios' }).click();
  await expect(pc.getByRole('radio', { name: /^09:00/ })).toHaveCount(0);

  await entrar(page);
  const pendientes = page.getByRole('region', { name: 'Pendientes de confirmar' });
  await expect(pendientes).toContainText('Marta Ruiz');
  await expect(pendientes).toContainText('Vengo con mi hija');
  await pendientes.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Turno actualizado.');

  // Mismo dispositivo: los datos se precargan y el turno se confirma solo.
  await pc.goto(`/b/${slug}`);
  await elegirCorte(pc);
  await pc.getByLabel('Día').fill(fecha);
  await pc.getByRole('button', { name: 'Ver horarios' }).click();
  await expect(pc.getByLabel('Tu nombre')).toHaveValue('Marta Ruiz');
  await pc.getByRole('radio', { name: /^10:00/ }).check({ force: true });
  await pc.getByRole('button', { name: 'Pedir turno' }).click();
  await expect(pc.getByRole('heading', { name: '¡Tu turno está confirmado!' })).toBeVisible();
  await cliente.close();

  // Otro dispositivo con el mismo teléfono: vuelve a quedar pendiente.
  const otro = await browser.newContext();
  const po = await otro.newPage();
  await pedirTurno(po, '11:00', { nombre: 'Marta', telefono: '+54 9 11 5555-6666' });
  await expect(po.getByRole('heading', { name: 'Pediste tu turno' })).toBeVisible();
  await otro.close();

  // Todo quedó en la misma ficha, con el dispositivo confiable.
  await page.goto('/panel/clientes');
  await expect(page.getByRole('link', { name: /Marta/ })).toHaveCount(1);
  await page.getByRole('link', { name: /Marta/ }).click();
  await expect(page.getByRole('region', { name: 'Dispositivos confiables' })).toContainText('Dispositivo 1');
});

test('quitar el dispositivo hace que el próximo pedido vuelva a quedar pendiente', async ({ browser, page }) => {
  const cliente = await browser.newContext();
  const pc = await cliente.newPage();
  await pedirTurno(pc, '09:30', { nombre: 'Nico Paz', telefono: '11 7777-8888' });
  await expect(pc.getByRole('heading', { name: 'Pediste tu turno' })).toBeVisible();

  await entrar(page);
  await page.getByRole('region', { name: 'Pendientes de confirmar' }).getByRole('listitem').filter({ hasText: 'Nico Paz' })
    .getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Turno actualizado.');
  await page.goto('/panel/clientes');
  await page.getByRole('link', { name: /Nico Paz/ }).click();
  await page.getByRole('region', { name: 'Dispositivos confiables' }).getByRole('button', { name: 'Quitar' }).click();
  await expect(page.getByRole('main').getByRole('status')).toContainText('Dispositivo quitado');

  await pedirTurno(pc, '10:30', { nombre: 'Nico Paz', telefono: '11 7777-8888' });
  await expect(pc.getByRole('heading', { name: 'Pediste tu turno' })).toBeVisible();
  await cliente.close();
});
