import { expect, test, type Page } from '@playwright/test';
import { llenarHastaPaso3, type Cuenta } from './helpers';

const sufijo = Date.now().toString(36);
const dueno: Cuenta = { email: `np-${sufijo}@example.com`, password: 'clave-segura-1', nombre: 'Nora' };
const slug = `negocio-${sufijo}`;
// PNG de 1×1 píxel.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

test.describe.configure({ mode: 'serial' });

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(dueno.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(dueno.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

function estado(page: Page) {
  return page.getByRole('main').getByRole('status');
}

test('Mi negocio: datos, marca, logo y activar productos', async ({ page }) => {
  await llenarHastaPaso3(page, dueno, 'Negocio E2E', slug);
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page).toHaveURL(/\/panel\/primeros-pasos$/);
  await page.getByRole('link', { name: 'Prefiero cargarlo yo' }).click();

  await page.getByRole('link', { name: 'Mi negocio' }).click();
  await page.getByLabel('Descripción').fill('Cortes clásicos y modernos.');
  await page.getByLabel('Instagram').fill('https://instagram.com/negocio.e2e');
  await page.getByText('Azul', { exact: true }).click();
  await page.getByLabel(/Vendo productos/).check();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(estado(page)).toHaveText('Datos del negocio guardados.');
  await expect(page.getByLabel('Instagram')).toHaveValue('@negocio.e2e');
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Productos' })).toBeVisible();

  await page.getByLabel(/Subir logo/).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.getByRole('button', { name: 'Subir', exact: true }).click();
  await expect(estado(page)).toHaveText('Logo actualizado.');
  await expect(page.getByRole('img', { name: 'Logo de Negocio E2E' })).toBeVisible();

  await page.getByLabel(/Subir logo/).setInputFiles({ name: 'logo.gif', mimeType: 'image/gif', buffer: PNG });
  await page.getByRole('button', { name: 'Subir', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('La imagen tiene que ser JPG, PNG o WebP.');
});

test('Productos: alta, vender, confirmar sin stock y anular', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/productos');
  await page.getByText('Nuevo producto').click();
  await page.getByLabel('Nombre').fill('Cera mate');
  await page.getByLabel('Precio ($)').fill('5000');
  await page.getByLabel('Stock inicial').fill('1');
  await page.getByRole('button', { name: 'Crear producto' }).click();
  await expect(estado(page)).toHaveText('Producto creado.');

  await page.getByRole('button', { name: 'Vendí uno de Cera mate' }).click();
  await expect(estado(page)).toHaveText('Venta registrada. Quedan 0 en stock.');

  await page.getByRole('button', { name: 'Vendí uno de Cera mate' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('No hay stock suficiente.');
  await page.getByRole('region', { name: 'Confirmar venta sin stock' }).getByRole('button', { name: 'Registrar igual' }).click();
  await expect(estado(page)).toHaveText('Venta registrada. Quedan 0 en stock.');

  const ventas = page.getByRole('region', { name: 'Últimas ventas' });
  await expect(ventas.getByRole('listitem')).toHaveCount(2);
  await ventas.getByRole('button', { name: 'Anular' }).first().click();
  await expect(estado(page)).toHaveText('Venta anulada: el stock volvió.');
  await expect(page.getByRole('region', { name: 'Catálogo' })).toContainText('Stock: 1');
});

test('Stock y precios: edición en bloque', async ({ page }) => {
  await entrar(page);
  await page.goto('/panel/stock');
  await page.getByLabel('Stock de Cera mate').fill('10');
  await page.getByLabel('Precio de Cera mate').fill('5500');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(estado(page)).toHaveText('Se actualizó 1 producto.');
  await expect(page.getByLabel('Stock de Cera mate')).toHaveValue('10');
});

test('la página pública muestra la marca y el catálogo', async ({ page }) => {
  await page.goto(`/b/${slug}`);
  await expect(page.getByRole('img', { name: 'Logo de Negocio E2E' })).toBeVisible();
  await expect(page.getByText('Cortes clásicos y modernos.')).toBeVisible();
  await expect(page.getByRole('link', { name: '@negocio.e2e' })).toBeVisible();
  const productos = page.getByRole('region', { name: 'Productos' });
  await expect(productos).toContainText('Cera mate');
  await expect(productos).toContainText('5.500');
});
