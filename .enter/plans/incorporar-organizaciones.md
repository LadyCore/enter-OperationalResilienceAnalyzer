# ORA — Optimización de carga inicial (A/B) del sitio

## Context

El sitio tarda en "aparecer" al abrir la URL (antes de interactuar). El objetivo es reducir el tiempo hasta que aparece la interfaz inicial (A) y hasta que queda interactiva (B), sin tocar auth/SMTP/DEMO/licencias/RLS/análisis ni ocultar la espera con un loading más bonito.

## Diagnóstico (causas concretas)

Medido con build real a /tmp (sin tocar el proyecto):

- **Chunk inicial (`index`)**: 842 KB min / **253 KB gzip** — es el JS que hay que descargar+parsear+ejecutar antes del primer render. Es la causa principal de la lentitud percibida (A y B).
- Contenido del chunk inicial (verificado por refs y por greps de uso):
  - **i18next + react-i18next + i18next-http-backend + languagedetector** (~decenas de KB) se importan e **inicializan en `main.tsx`** (`import "./i18n/config"`), aunque los únicos consumidores son `NotFound` y un `LanguageSwitcher` que **no está montado en ninguna parte**.
  - **@tanstack/react-query** (`QueryClientProvider` en `App.tsx`): **cero** `useQuery/useMutation` en todo el proyecto → peso muerto.
  - **Toaster radix** (`ui/toaster.tsx`, `hooks/use-toast.ts`): **cero** consumidores (todos los toasts usan `sonner`) → peso muerto.
  - **`AppShell` + `AccessGate` + pantallas de acceso** (DemoActivationScreen, AccessBlockedScreen, LicenseInfoDialog, ChangePasswordDialog, dropdowns, dialogs) se importan estáticamente desde `AppGuard`, así que **entran en el bundle inicial aunque un visitante anónimo solo vaya a ver el login**.
  - Las páginas de auth estáticas en `router.tsx` (`verify-email`, `forgot-password`, `reset-password`, `NotFound`) también van al chunk inicial.
- Correcto hoy: `framer-motion`, `recharts`, `xlsx`, `embla`, `chart`, `jszip` **no** están en el chunk inicial (lazy/tree-shaken); el CSS es 65 KB; las fuentes de Google ya cargan no-bloqueantes (`media=print` + `onload`); el shell estático de `index.html` es mínimo.

Decisión del usuario: **diferir i18n manteniendo la infraestructura** (no eliminar el soporte multi-idioma).

## Optimizaciones (seguras, sin cambiar comportamiento)

1. **i18n diferido (manteniendo infraestructura)**
   - `src/main.tsx`: quitar `import "./i18n/config"` (evita cargar i18next al arranque). El módulo `src/i18n/config.ts` y sus locales **no se borran**.
   - `src/pages/NotFound.tsx`: inicializar i18n al montar (`await import("@/i18n/config")` con flag `ready`) antes de usar `t()` → i18next pasa al chunk lazy de la 404 y solo se carga si se visita una ruta inexistente. `LanguageSwitcher` queda como está (sin montar, no entra al bundle).

2. **Quitar peso muerto del arranque**
   - `src/App.tsx`: eliminar `QueryClientProvider`/`QueryClient` (react-query sin uso) y el `<Toaster />` radix (sin consumidores). Se conserva `sonner` (único sistema de toasts real) y `TooltipProvider` (sí se usa en `sidebar.tsx`).

3. **Lazy-loading del shell y del gate de acceso** (reducen el chunk que ve un visitante anónimo)
   - `src/components/auth/AppGuard.tsx`: convertir `AppShell` y `AccessGate` en `React.lazy` con `Suspense` (fallback ligero reutilizando el spinner existente). Un visitante anónimo ya no descarga AppShell ni las pantallas DEMO/blocked/licencia.

4. **Lazy-loading de rutas públicas de auth**
   - `src/router.tsx`: `verify-email`, `forgot-password`, `reset-password` y `NotFound` pasan a `React.lazy` (patrón ya usado por las páginas del app).

5. **Diferir telemetría no esencial**
   - `src/main.tsx`: ejecutar `bootstrapGeneratedSiteAnalytics()` tras el primer render (`setTimeout(…, 0)` / post-paint) en vez de bloquearlo antes de `createRoot`. No bloquea render y mantiene el tracking.

6. **Fonts / CSS / shell** — sin cambios: ya son no-bloqueantes o mínimos.

No se tocan: auth/Supabase, SMTP, emails, redirects, DEMO, licencias, RLS, acceso, modelo de datos, análisis, ni la lógica de negocio. `pnpm run check`, `pnpm test`, `pnpm run build` deben seguir pasando.

## Archivos a modificar
- `src/main.tsx`
- `src/App.tsx`
- `src/components/auth/AppGuard.tsx`
- `src/router.tsx`
- `src/pages/NotFound.tsx`

## Implementation checklist
- [ ] `src/main.tsx`: quitar import eager de i18n; diferir `bootstrapGeneratedSiteAnalytics()` a post-render.
- [ ] `src/App.tsx`: quitar `QueryClientProvider`/`QueryClient` y `<Toaster />` radix; conservar `sonner` y `TooltipProvider`.
- [ ] `src/pages/NotFound.tsx`: inicializar i18n al montar (dynamic import + flag `ready`) antes de renderizar textos `t()`.
- [ ] `src/components/auth/AppGuard.tsx`: `AppShell` y `AccessGate` como `React.lazy` dentro de `Suspense` con fallback de spinner existente.
- [ ] `src/router.tsx`: lazy-load `verify-email`, `forgot-password`, `reset-password`, `NotFound` (patrón ya usado).
- [ ] Conservar intactos `src/i18n/config.ts`, locales y `LanguageSwitcher` (infraestructura i18n sin borrar).

## Verification checklist
- [ ] `pnpm run check` pasa (lint + `tsc --noEmit`).
- [ ] `pnpm test` pasa (54 tests).
- [ ] `pnpm run build` pasa; se compara el tamaño del chunk `index` (gzip) **antes vs después** (se reduce).
- [ ] Build a /tmp: el chunk inicial ya no contiene i18next/react-query/radix-toast/AppShell (verificar refs en `index-*.js`).
- [ ] Manual (preview): login se ve más rápido; al ingresar, AppShell carga igual; 404 muestra "Page not found" con los textos de locales (i18n funciona lazy); toasts de sonner siguen apareciendo; verificación/reset de email siguen funcionando.
- [ ] Sin regresión: auth, DEMO, licencias, RLS y análisis intactos (sin cambios en esos archivos).
- [ ] Nota de entorno: si aún persiste demora, queda acotada a hosting/red/parseo del bundle (medible en DevTools → Network → tiempo de `index-*.js`), no al flujo de datos de ORA.
