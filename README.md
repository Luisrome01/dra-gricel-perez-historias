# Historias clínicas — Dra. Gricel Pérez

Aplicación web para diligenciar historias clínicas médico-ocupacionales y exportarlas sobre el formato PDF original.

## Seguridad y estado de conexión

- El formulario funciona localmente en el navegador, sin enviar información clínica a servicios externos.
- **No guarda automáticamente** datos sensibles en el dispositivo.
- La integración con Supabase requiere configurar el proyecto PERSONAL y ejecutar `supabase/schema.sql` allí.
- El repositorio no contiene credenciales privadas ni historias reales.
- Para usar historias guardadas se requiere inicio de sesión y aprobación en la tabla `clinic_staff` (RLS).
- La exportación PDF conserva las cuatro páginas físicas del documento original; las firmas se dejan en blanco para firma manuscrita.
- La generación de PDF **no** constituye firma electrónica certificada.

## Estructura

`index.html`, `src/main.js`, `src/schema.js`, `src/pdf.js`, `src/styles.css`, `public/plantilla.pdf.gz.b64`, `supabase/schema.sql`.

## Ejecutar

```bash
npm install
npm run dev
```

## Variables de entorno (solo claves públicas)

Crear `.env` local a partir de `.env.example`:

```
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`service_role` y claves secretas nunca deben colocarse en el frontend ni en GitHub. Sin configuración, la aplicación ofrece exportación local únicamente.

## Render

Servicio **Static Site**; comando `npm ci && npm run build`; carpeta pública `dist`; rama `main`. Configure únicamente las dos variables VITE públicas anteriores si se habilita la base de datos.

## Activación de base de datos

1. Vincular el proyecto personal de Supabase y ejecutar `supabase/schema.sql` en ese proyecto (nunca en el entorno de Proporca).
2. Crear usuario médico en Supabase Authentication; deshabilitar registro libre.
3. Autorizar al usuario insertando su UUID en `public.clinic_staff`, como `active = true`.
4. Configurar las variables públicas de Render; desplegar y validar políticas RLS desde un usuario autorizado y otro no autorizado.
5. Revisar obligaciones legales y de privacidad aplicables antes de usar datos de pacientes reales.
