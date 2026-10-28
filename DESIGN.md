# DESIGN.md - Sistema de Diseño Brutalista Monocromático (B&W)

Este documento define la especificación estricta de UI/UX para el proyecto **PULSO CAJA**.
Cualquier modificación o creación de interfaces debe cumplir rigurosamente estas reglas sin excepción.

---

## 1. Filosofía y Paleta Cromática Estricta

- **Solo 2 Colores:** Negro puro (`#000000` / `bg-black`, `text-white`, `border-black`) y Blanco puro (`#ffffff` / `bg-white`, `text-black`, `border-white`).
- **Cero Grises:** Prohibido usar `neutral-*`, `gray-*`, `zinc-*`, `slate-*`, `#fafafa`, `#f7f7f7`, `#a3a3a3`, `#777777` o similares en fondos, bordes, textos o hovers.
- **Estados Deshabilitados:** Los elementos interactivos deshabilitados no usan tonos grises; se representan mediante opacidad semitransparente sobre negro/blanco (`disabled:opacity-35 disabled:cursor-not-allowed`).

---

## 2. Regla Universal de Inversión en Hover

Todo estado `:hover` debe ser una inversión monocromática de alto contraste:

| Elemento Base | Estado Normal | Estado Hover |
| :--- | :--- | :--- |
| **Botón / Contenedor Blanco** | `bg-white text-black border-black` | `hover:bg-black hover:text-white` |
| **Botón / Contenedor Negro** | `bg-black text-white border-black` | `hover:bg-white hover:text-black` |
| **Enlace de Navegación Inactivo** | `bg-white text-black` | `hover:bg-black hover:text-white` |
| **Enlace de Navegación Activo** | `bg-black text-white` | `hover:bg-black hover:text-white` (permanece negro) |
| **Acción en Tabla (`.table-action-btn`)** | `bg-transparent text-black underline` | `hover:bg-black hover:text-white hover:no-underline` |
| **Enlace Tipográfico (`a:not(.no-underline)`)** | `text-black underline` | `hover:bg-black hover:text-white hover:no-underline` |
| **Fila de Tabla (`tr`)** | `bg-white text-black` | **Sin cambio de fondo** (mantiene `#ffffff` para no colisionar con botones internos) |

---

## 3. Geometría, Superficies y Rango de Alturas

- **0px de Redondeado:** Prohibido `rounded-*` en bordes, modales, botones, inputs o avatares (`border-radius: 0 !important`).
- **0 Sombras:** Prohibido `shadow-*`, resplandores o desenfoques (`box-shadow: none !important`).
- **Bordes:** Nítidos de 1px (`border border-black`).
- **Transiciones Instantáneas:** `transition-none` en elementos interactivos; respuesta inmediata sin animaciones lentas.
- **Altura Universal de Controles (`h-9`):** Todos los inputs de búsqueda, selects, botones de tipo y campos de fecha comparten exactamente la misma altura de **36px (`h-9`)**.

---

## 4. Estructura de Páginas Operativas (Anti-Clonado "3 Tarjetas + Tabla")

- **Tira Métrica Compacta (Summary Strip):** En lugar de bloques gigantes que devoran espacio vertical, las vistas operativas (`Movimientos`, `Productos`, `Recordatorios`) utilizan una barra horizontal compacta con divisores verticales (`border border-black bg-white flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-black font-mono text-xs`). El balance neto o capital prioritario lleva fondo negro y texto blanco (`bg-black text-white`).
- **Prioridad al DataTable:** La mayor parte del espacio de pantalla debe dedicarse a los datos operativos reales.

---

## 5. Barra de Herramientas del DataTable (Filtros y Búsqueda)

- **Distribución y Simetría Horizontal:**
  - El buscador de texto lleva `flex-1 min-w-[200px] w-full`, llenando fluidamente el espacio disponible hacia la izquierda. Incluye botón directo `✕` para limpiar búsqueda.
  - Sin botón de "Limpiar filtros": Los filtros deben ser directos y funcionales.
  - **Botones siempre pegados a la derecha (`shrink-0`):** La botonera y filtros de estado deben quedar anclados al ras del margen derecho del contenedor.
- **Modo Normal (Fila Única):**
  - Los selects y pestañas tienen anchos fijos y calibrados (`w-[200px]`, `w-[190px]`, `w-[210px]`), evitando espacios en blanco huérfanos.
- **Modo Rango Personalizado (2 Columnas Simétricas):**
  - **Columna 1 (`sm:w-[280px]`):** Selector de categoría arriba (`280px`) y contenedor de fechas abajo (`280px`).
  - **Columna 2 (`sm:w-[200px]`):** Selector de rango de fecha arriba (`200px`) y pestañas de tipo abajo (`200px`).
  - **Campos de Fecha sin letra "a":** Los inputs de fecha ocupan `flex-1` cada uno (`~136px`) con un `gap-2` limpio.
  - **Separación de Icono de Calendario:** Obligatorio `input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; margin-left: auto; padding-left: 8px; }` para que el formato `dd/mm/aaaa` y el ícono `📅` jamás se toquen ni se corten.

---

## 6. Consistencia en Tablas, Paginación y Celdas Fijas

- **Encabezados (`thead`):** `bg-black text-white uppercase text-xs p-3`.
  - Bordes separadores verticales (`border-r border-black`).
  - Hover con líneas visibles en los encabezados para indicar interactividad de ordenamiento (`↑`/`↓`).
- **Cuerpo (`tbody`):** `bg-white text-black divide-y divide-black`.
- **Anchos de Celdas Fijos:** Las columnas de fecha (`w-[130px]`), monto (`w-[150px]`), categoría (`w-[160px]`) y acciones (`w-[130px]`) tienen anchos declarados para evitar que la tabla cambie de tamaño ("baile") al cambiar de página.
- **Paginación Unificada:** Componente `<Pagination />` estandarizado en todas las vistas con información clara (`Mostrando X a Y de Z`) y botones (`← Anterior` / `Siguiente →`).

---

## 7. Modales y Eliminación de Ruido Decorativo

- **Sin Líneas Decorativas Innecesarias:** Prohibidos divisores gruesos decorativos (`border-b-2`, `border-t-2`) en formularios y modales.
- **Sin Iconos Ornamentales:** No enmarcar iconos en cajas decorativas dentro de encabezados. Solo se usan iconos funcionales (`✕` para cerrar, `+`/`-`).
- **Sin Pseudo-Indicadores:** Prohibidos textos de relleno como `"Control de Flujo..."`, `"Catálogo de Caja..."`, `"Monto recalculado..."`.
- **Jerarquía en Acciones de Destrucción:** Botones de confirmación de eliminación separados claramente de acciones comunes, usando botones reales con inversión (`border border-black bg-black text-white hover:bg-white hover:text-black`).

---

## 8. Formato de Datos y Diccionarios

- **Prohibido Mostrar Enums Crudos:** Se debe usar siempre el parser centralizado de [`lib/formatters.ts`](file:///c:/Proyect-React/prueba%20A1/lib/formatters.ts) para transformar cadenas como `VENTA_PRODUCTO`, `COMPRA_CATALOGO` y `PRODUCCION` a etiquetas limpias (`Venta de producto`, `Compra de catálogo`, `PRODUCCIÓN`).
- **Helper Único de Fechas:** `formatDate(isoString)` para unificar el formato en toda la aplicación.
