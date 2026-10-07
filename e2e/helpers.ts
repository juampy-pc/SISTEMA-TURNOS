import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

/** Lee .env.local (lo genera scripts/env-local.sh) para consultar la base con la service role. */
function env(nombre: string): string {
  const linea = readFileSync('.env.local', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${nombre}=`));
  if (!linea) throw new Error(`Falta ${nombre} en .env.local`);
  return linea.slice(nombre.length + 1).trim();
}

async function rest(ruta: string): Promise<unknown[]> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}${ruta}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  return (await res.json()) as unknown[];
}

export async function negociosConSlug(slug: string): Promise<number> {
  return (await rest(`/rest/v1/negocios?select=id&slug=eq.${encodeURIComponent(slug)}`)).length;
}

export async function usuariosConEmail(email: string): Promise<number> {
  const res = (await rest('/auth/v1/admin/users?per_page=1000')) as unknown as { users?: { email: string }[] };
  return (res.users ?? []).filter((u) => u.email === email).length;
}

export interface Cuenta {
  email: string;
  password: string;
  nombre: string;
}

/** Recorre los pasos 1 y 2 del registro y deja el formulario en el paso 3. */
export async function llenarHastaPaso3(page: Page, cuenta: Cuenta, nombreNegocio: string, slug: string) {
  await page.goto('/registro');
  await page.getByLabel('Tu nombre').fill(cuenta.nombre);
  await page.getByLabel('Email').fill(cuenta.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.password);
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByLabel('Nombre del negocio').fill(nombreNegocio);
  await page.getByLabel('Link de tu página').fill(slug);
  await expect(page.getByText('Disponible', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByRole('button', { name: 'Crear mi negocio' })).toBeVisible();
}

export async function registrarNegocio(page: Page, cuenta: Cuenta, nombreNegocio: string, slug: string) {
  await llenarHastaPaso3(page, cuenta, nombreNegocio, slug);
  await page.getByRole('button', { name: 'Crear mi negocio' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

export async function loginDuenoCon(page: Page, cuenta: Cuenta) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(cuenta.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(cuenta.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

export async function loginEmpleadoCon(page: Page, usuarioTipeado: string, slug: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Soy empleado').check();
  await page.getByLabel('Usuario').fill(usuarioTipeado);
  await page.getByLabel('Código del negocio').fill(slug);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

export async function crearEmpleadoUI(page: Page, e: { nombre: string; usuario: string; password: string }) {
  await page.goto('/panel/empleados');
  await page.getByLabel('Nombre', { exact: true }).fill(e.nombre);
  await page.getByLabel('Usuario', { exact: true }).fill(e.usuario);
  await page.getByLabel('Contraseña', { exact: true }).fill(e.password);
  await page.getByRole('button', { name: 'Crear empleado' }).click();
}
