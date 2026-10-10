# Mi negocio y productos — Plan (sub-proyectos 3 y 4)

Spec: `docs/superpowers/specs/2026-10-07-sistema-turnos-saas-design.md`, secciones 4 (productos), 6 (Mi negocio, Catálogo, Stock, página pública) y 8 (stock insuficiente).

## Decisiones

- **Mi negocio** (`/panel/negocio`, permiso `editar_negocio`): nombre, descripción, dirección, Instagram, WhatsApp, color (paleta fija de 8, todos con buen contraste sobre blanco) y "Vendo productos". Se guarda con `public.guardar_negocio`, así el permiso de servicios no alcanza para cambiar la marca. El WhatsApp pasó de Configuración avanzada a esta pantalla.
- **Imágenes** (logo y una foto por producto): bucket público `imagenes`, hasta 2 MB, JPG/PNG/WebP. Sube el servidor con `service_role` después de verificar el permiso; la base solo acepta URLs de ese bucket dentro de la carpeta del negocio (`private.url_imagen_valida`). Al reemplazar o quitar, se borra la anterior.
- **Productos** (`/panel/productos`): "Vendí uno" descuenta 1 y suma el precio; "Más opciones" permite cantidad, monto y cliente por teléfono. `public.registrar_venta` descuenta stock en la misma transacción y falla con `stock_insuficiente`; la pantalla pide confirmación y, si se confirma, el stock queda en 0. Las ventas de las últimas 24 horas se pueden anular (devuelve el stock).
- **Stock y precios** (`/panel/stock`, permiso `editar_catalogo`): tabla editable que guarda solo las filas que cambiaron.
- **Permisos:** ver productos requiere `registrar_ventas` o `editar_catalogo`; crearlos y editarlos, `editar_catalogo`; ver ventas, `registrar_ventas` o `ver_ingresos`. Productos y Stock solo aparecen en el menú si el negocio vende productos.
- **Página pública:** banda de color, logo, descripción, dirección (link a Google Maps), Instagram y catálogo de solo lectura (sin costo ni stock exacto; solo "Sin stock por ahora").
- `unir_clientes` ahora también mueve las ventas; la ficha del cliente muestra sus compras.

## Tareas

- [x] Migración `20261011120000_negocio_productos.sql` y pgTAP `negocio_productos.test.sql` (22).
- [x] Esquemas de dominio y tests (`esquemas-negocio.ts`), menú con productos.
- [x] Pantallas: Mi negocio, Productos, editar producto, Stock y precios; compras en la ficha; marca y catálogo en `/b/[slug]`.
- [x] E2E `negocio-productos.spec.ts`.
