-- Correr esto en Vercel → Storage → (tu base) → Query, una sola vez,
-- para actualizar el negocio que ya quedó cargado con el primer deploy.
-- No hace falta volver a correr todo schema.sql.

update negocios
set nombre = 'Miriam García Cosmetología',
    whatsapp = '5493624912127'
where slug = 'miriam';

-- Para confirmar que quedó bien:
select slug, nombre, whatsapp from negocios;
