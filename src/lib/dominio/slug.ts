// Debe mantenerse sincronizado con private.slugs_reservados() en la migración.
export const SLUGS_RESERVADOS = ['panel', 'login', 'registro', 'salir', 'api', 'b', 'admin', 'app', 'www', 'static', 'assets', 'soporte'] as const;

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function esSlugValido(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= 40 &&
    SLUG_REGEX.test(slug) &&
    !(SLUGS_RESERVADOS as readonly string[]).includes(slug)
  );
}

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}
