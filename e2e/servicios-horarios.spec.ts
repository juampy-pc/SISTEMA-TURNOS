import { expect, test } from '@playwright/test';
import { llenarHastaPaso3, type Cuenta } from './helpers';

const sufijo = Date.now().toString(36);
const dueno: Cuenta = { email: `sh-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Sofía' };
const slug = `peluqueria-${sufijo}`;

test.describe.configure({ mode: 'serial' });

test('primeros pasos carga la plantilla del rubro y el checklist se completa', async ({ page }) => {
  await llenarHastaPaso3(page, dueno, 'Peluquería E2E', slug);
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page).toHaveURL(/\/panel\/primeros-pasos$/);

  await page.getByRole('button', { name: 'Cargar y seguir' }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByLabel('Primeros pasos').getByRole('listitem').filter({ hasText: 'Cargá tus servicios' })).toContainText('✅');

  // Con datos cargados, Primeros pasos ya no se muestra.
  await page.goto('/panel/primeros-pasos');
  await expect(page).toHaveURL(/\/panel$/);
});

test('servicios: alta, error de duración y desactivación', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await page.goto('/panel/servicios');
  await expect(page.getByRole('heading', { name: 'Servicios activos' })).toBeVisible();
  await page.getByRole('main').getByLabel('Nombre').first().fill('Masaje');
  await page.getByLabel('Duración (minutos)').fill('45');
  await page.getByRole('button', { name: 'Crear servicio' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText(/^Servicio creado y asignado a todos\./);

  // Repetido
  await page.getByRole('main').getByLabel('Nombre').first().fill('Masaje');
  await page.getByRole('button', { name: 'Crear servicio' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Ya tenés un servicio con ese nombre.');

  await page.getByRole('button', { name: 'Desactivar' }).last().click();
  await expect(page.getByText(/Servicios desactivados \(1\)/)).toBeVisible();
});

test('horarios: una franja superpuesta se rechaza y una contigua se acepta', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await page.goto('/panel/horarios');
  // El ejemplo ya cargó lun-sáb 09:00-18:00. Probamos una franja que pisa el lunes.
  const form = page.locator('form', { hasText: 'Agregar horario' });
  await form.getByRole('checkbox').evaluateAll((els) => els.forEach((e) => ((e as HTMLInputElement).checked = false)));
  await form.getByLabel('Lun').check();
  await form.getByLabel('Desde').fill('17:00');
  await form.getByLabel('Hasta').fill('20:00');
  await form.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Hay franjas que se superponen.');

  await form.getByLabel('Lun').check();
  await form.getByLabel('Desde').fill('18:00');
  await form.getByLabel('Hasta').fill('20:00');
  await form.getByRole('button', { name: 'Agregar' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Horario guardado.');
});

test('bloqueos: fecha de fin anterior se rechaza', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await page.goto('/panel/horarios');
  const form = page.locator('form', { hasText: 'Agregar bloqueo' });
  await form.getByLabel('Desde').fill('2030-12-25');
  await form.getByLabel('Hasta').fill('2030-12-24');
  await form.getByRole('button', { name: 'Agregar bloqueo' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('La fecha de fin no puede ser anterior a la de inicio.');

  await form.getByLabel('Hasta').fill('2030-12-26');
  await form.getByRole('button', { name: 'Agregar bloqueo' }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Bloqueo guardado.');
});

test('configuración avanzada: el intervalo entre horarios se guarda', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);

  await page.getByRole('link', { name: 'Configuración avanzada' }).click();
  await expect(page).toHaveURL(/\/panel\/configuracion$/);
  await page.getByLabel('Intervalo entre horarios').selectOption('30');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Configuración guardada.');
  await expect(page.getByLabel('Intervalo entre horarios')).toHaveValue('30');
});
