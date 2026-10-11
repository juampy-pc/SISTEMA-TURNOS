# Identidad visual de Open

Resumen operativo de la guía de marca v1.0 (octubre 2026). La fuente es `Open-Brand-Guidelines.pdf`; la intención de fondo, `filosofia-visual.md` ("Precisión Abierta"). Si algo de acá contradice al PDF, gana el PDF.

## Esencia

- **Nombre:** Open. Sistema de turnos. Firma verbal: **"Tu agenda, abierta."**
- **Propósito:** que ningún turno se pierda por desorden.
- **Valores:** Abierto (los horarios libres se ven al instante), Puntual (cada turno en su hora), Simple (reservar, mover o cancelar en pocos toques).
- **Concepto, el ángulo abierto:** la O es un reloj y sus agujas forman 135°. Nunca se cierran: un ángulo abierto es un lugar libre en la agenda. "Abierto" quiere decir abierto al público y también que hay turno disponible.

## Isotipo y wordmark

- **Isotipo:** un círculo lleno (R = 100 u) con dos agujas de grosor 18,2 u, extremos y encuentro redondeados (r = 9,1 u), pivote en el centro.
  - Aguja larga: vertical hacia arriba, 54,9 u.
  - Aguja corta: a 135° de la larga (abajo a la derecha), 38,7 u.
- **Wordmark:** la O es el reloj; sigue "PEN" en mayúsculas condensadas de trazo grueso, con aire amplio entre letras. La altura de caja es 0,87 del diámetro del círculo. Está dibujado, no tipeado: en la app sale de `src/components/marca/Logo.tsx`.
- **Firmas:**
  - Horizontal (reloj + PEN): la principal.
  - Isotipo solo: para espacios chicos o cuando el nombre ya está presente.
  - Ícono de app: isotipo al 58 % sobre un cuadrado Noche con esquinas del 22 %.
- **Zona de respeto:** ¼ del diámetro del círculo en los cuatro lados.
- **Tamaño mínimo:** firma horizontal 120 px; isotipo 20 px.
- **Versiones de color** (no hay otras):

  | Versión | Logo | Fondo |
  |---|---|---|
  | Principal | Cielo | Noche |
  | Inverso | Noche | Cielo |
  | Alterno | Señal | Blanco |
  | Alterno inverso | Blanco | Señal |

- **Prohibido:**
  - deformar, rotar o inclinar;
  - colores fuera de la paleta;
  - sombras, brillos o degradés;
  - un isotipo de solo contorno;
  - cambiar el ángulo de las agujas;
  - Cielo sobre Blanco;
  - reemplazar el wordmark por otra tipografía.

## Paleta

| Token | Hex | Uso |
|---|---|---|
| Noche | `#000000` | Fondo principal. Profundidad. |
| Cielo | `#9BE7FF` | Color de marca. Disponible, libre. Acción principal. |
| Señal | `#FF4C14` | Reservado, ahora, atención. |
| Blanco | `#FFFFFF` | Fondos claros y pausas. |
| Grafito | `#111214` | Neutro de interfaz (superficies, pasado, cancelado). |
| Niebla | `#8C9399` | Texto secundario sobre Noche. |
| Piedra | `#5F666C` | Texto secundario sobre Blanco. |

- **Proporción:** Noche 55 %, Cielo 20 %, Blanco 15 %, Señal 10 %. Casi todo es Noche.
- **Contraste permitido:**
  - Blanco/Noche (21:1).
  - Cielo sobre Noche (15,3:1).
  - Señal sobre Noche (6,3:1, AA).
  - Noche sobre Cielo y sobre Señal.
- **Contraste a evitar:**
  - Cielo sobre Blanco y Señal sobre Cielo: nunca.
  - Señal sobre Blanco: solo en texto grande.
  - Texto chico sobre Señal: siempre en Noche.

## Color de estado (turnos)

| Estado | Forma |
|---|---|
| Libre | Cápsula Cielo, texto Noche. |
| Reservado | Cápsula Señal, texto Noche. |
| Ahora | Cápsula Blanca con anillo blanco, texto Noche. |
| Pasado / cancelado | Cápsula Grafito, texto apagado. Sin protagonismo. |

El color informa, no decora. No van más de dos estados de color por fila en material de marca.

## Tipografía: tres voces

| Voz | Fuente | Uso |
|---|---|---|
| Display | Big Shoulders (Display) Bold | Titulares, números, carteles. Mayúsculas, tracking +3 a +5 %. |
| Texto | DM Sans Regular / Medium | Interfaz y párrafos. Interlineado 1,4–1,5. |
| Técnica | Space Mono Regular | Horarios, estados, etiquetas. Mayúsculas, tracking +8 a +14 %. |

## Elementos gráficos

- **Turnos:** cápsulas de largo proporcional a la duración. Cielo libre, Señal reservado, gris pasado.
- **Dial:** 60 marcas (una por minuto) con el sector de 135° resaltado.
- **Horarios:** una retícula de relojes con el par de agujas rotando, con pocos Señal.

## Voz y tono: "como un buen recepcionista"

- **Directo:** primero lo que importa: día, hora y lugar.
- **Cálido:** voseo y trato cercano, sin ser informal de más.
- **Puntual:** mensajes cortos que llegan a tiempo.

| Sí | No |
|---|---|
| "Tu turno quedó confirmado: martes 14, 17:30." | "Estimado cliente, se ha procedido a registrar su reserva." |
| "Elegí un horario libre." | "Seleccione una franja horaria disponible." |
| "No pudimos reservar. Probá con otro horario." | "Error 409: conflicto de agenda." |

## La marca en la app

- Fondo Noche, Cielo para la acción principal y Señal para los turnos tomados.
- Títulos en Big Shoulders y horarios en Space Mono.
- Los botones principales son cápsulas Cielo con texto Noche.
- Las superficies son Grafito con un borde fino y esquinas redondeadas a un mismo radio.

### Cómo está implementado

- **Tokens** (`src/app/globals.css`, `@theme`):
  - Colores: `noche`, `grafito`, `linea`, `niebla`, `piedra`, `cielo`, `senal`, `blanco`.
  - Fuentes: `font-display`, `font-sans`, `font-mono`.
- **Clases de componente** (`globals.css`):
  - Botones: `boton`, `boton-sec`, `boton-peligro`.
  - Formularios y superficies: `campo`, `tarjeta`, `lista`.
  - Avisos: `aviso-ok`, `aviso-error`, `aviso-nota`.
  - Texto: `titulo`, `subtitulo`, `etiqueta`, `enlace`.
  - Estados: `capsula` con `capsula-libre`, `capsula-reservado`, `capsula-ahora`, `capsula-pasado`.
- **Componentes** (`src/components/marca/`): `Logo` (firma horizontal), `Isotipo`.
- **Página pública de cada negocio** (`/b/[slug]`): usa el color propio del negocio solo como acento. La estructura, la tipografía y el fondo son de Open.
- **Comercial:** el endoso "un producto de SMZ/LABS" va solo en pies de página, créditos y material institucional.
