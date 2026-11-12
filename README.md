# Historias clínicas — Dra. Gricel Pérez

Aplicación web responsiva para registrar historias clínicas médico-ocupacionales y exportar el **PDF original** diligenciado.

## Características
- 12 secciones del formulario original, con navegación, indicadores de avance y validación básica.
- Matriz de exposición a riesgos actuales y anteriores, antecedentes médicos, signos vitales e IMC.
- Exportación 100 % en el navegador sobre las **4 hojas físicas** de la plantilla adjunta, no sobre una reproducción en HTML.
- Mantiene casillas, encabezados, tablas y espacios para **firmas manuscritas**.
- Si una respuesta extensa no cabe en su espacio de origen, agrega anexo para no truncarla.
- Si se configura Supabase, requiere acceso por usuario médico autorizado; historial con lectura/edición solo de sus propios registros.
- Sin Supabase, permite **rellenar y exportar localmente**; no almacena datos automáticamente.

## Importante: confidencialidad
Esta es una primera versión técnica, **no un sistema clínico certificado**. Antes de tratar pacientes reales, validar la normativa aplicable, retención, seguridad, control de usuarios, respaldos, consentimiento y el PDF generado por personal clínico. Las firmas quedan pendientes de firma física; el documento exportado no lleva firma electrónica certificada. **No registrar datos reales hasta completar el despliegue seguro y su revisión.**

Las librerías PDF y Supabase se cargan de versiones fijadas desde CDN público, aunque los datos del formulario no se envían al CDN. Para producción clínica se recomienda agrupar/hospedar localmente dependencias tras una auditoría de suministro de software.

## Inicio local
No requiere `npm install`. Ejecutar desde el raíz:
```bash
python -m http.server 8080
```
Abrir `http://localhost:8080`. Para probar la compilación de Render:
```bash
node scripts/build.mjs
python -m http.server 8080 --directory dist
```

## Render Static Site
- **Repository**: `Luisrome01/dra-gricel-perez-historias`
- **Branch**: `main`
- **Build Command**: `node scripts/build.mjs`
- **Publish Directory**: `dist`
- **Auto Deploy**: habilitado
- **Variables opcionales y públicas**: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

Las variables se trasladan a `dist/config.js` durante la compilación y son visibles para los visitantes. Nunca usar `service_role`, `sb_secret_...` ni credenciales privadas.

## Supabase — Cuenta PERSONAL exclusivamente
La conexión visible durante el desarrollo solo incluía proyectos de **Proporca**, por lo que NO se tocó ninguna base ajena.

1. Vincular el proyecto personal de Supabase.
2. Ejecutar `supabase/schema.sql` en **ese proyecto personal**.
3. Crear al médico en Authentication y desactivar registro libre de usuarios.
4. Activar el médico con su UUID en la tabla `public.clinic_staff`.
5. En Render, establecer las dos variables de entorno públicas indicadas.
6. Probar que un usuario no autorizado no tenga acceso y que uno autorizado vea exclusivamente sus registros.

Las tablas llevan RLS; las políticas impiden acceso anónimo y restringen los historiales a su creador, siempre que sea personal autorizado. La aplicación no ofrece eliminación directa de historias.

## Archivos
- `index.html`: estructura.
- `src/main.js`: formulario, navegación, autenticación, historial.
- `src/schema.js`: definición de las 12 secciones.
- `src/pdf.js`: escritura en coordenadas sobre PDF original.
- `src/styles.css`: diseño responsivo.
- `public/plantilla.pdf.gz.b64`: original proporcionado, comprimido sin modificaciones.
- `config.js`: configuración local vacía (segura).
- `scripts/build.mjs`: genera assets para Render.
- `supabase/schema.sql`: tabla y políticas seguras.
