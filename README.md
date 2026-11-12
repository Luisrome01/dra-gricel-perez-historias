# Historias clínicas — Dra. Gricel Pérez

## Estado de despliegue (12 de noviembre de 2026)

- **Aplicación:** https://dra-gricel-perez-historias.onrender.com
- **GitHub:** `Luisrome01/dra-gricel-perez-historias`, rama `main`.
- **Render:** sitio estático `dra-gricel-perez-historias`, construcción `node scripts/build.mjs`, publicación `dist` y despliegue automático.
- **Supabase clínica, independiente:** proyecto `Dra. Gricel Pérez` (`wnowjnynikivspolcuvp`), organización personal `luis romero`. **Este es el único proyecto al que debe apuntar Render**.
- **Modelo clínico:** `public.clinic_staff`, `public.clinic_histories` y lista privada `clinic_private.invites`, con RLS habilitado.
- **Autorizaciones pendientes:** `gricellinda@gmail.com` (`doctor`) y `luisrome3005@gmail.com` (`assistant`). Las direcciones están preautorizadas en la base privada; NO son usuarios Auth hasta que completen alta y verificación.
- **Proyecto Everywear original:** `pzkspmqwdhcfyxrbndaa`, separado de la app médica. Hay tablas clínicas legadas con 0 historias en ese proyecto; quedan sin utilizar y no se eliminan sin una revisión de limpieza.
- **Antes del uso real:** crear usuarios nuevos en Authentication del proyecto clínico, revisar permisos y exportación PDF en navegador, protección de cuentas, respaldo, retención y requisitos legales aplicables.

No utilizar contraseñas cortas ni colocar claves de servicio en GitHub o Render. Nunca compartir el usuario de la cuenta personal con la doctora.

Aplicación web responsiva para registrar historias clínicas médico-ocupacionales y exportar el **PDF original** diligenciado.

## Interfaz de gestión (12 de noviembre de 2026)

El panel contiene **exactamente dos módulos principales**:

1. **Historias clínicas:** tabla de evaluaciones con búsqueda y filtros por fecha y tipo de evaluación; creación y edición mediante el botón «Nueva historia» o «Abrir». El formulario conserva los 12 apartados en una barra horizontal de pestañas desplazables. En la pestaña final ofrece guardar y exportar en PDF.
2. **Pacientes y empresas:** registro y edición de directorios separados (pestañas internas). Pueden elegirse desde el formulario para precargar datos de identificación y contexto empresarial; las historias mantienen la instantánea de los datos usados en cada valoración.

La migración `supabase/patients_companies.sql` crea `public.clinic_patients`, `public.clinic_companies` y añade `patient_id` / `company_id` opcionales a `public.clinic_histories` con referencias y políticas RLS por propietario. **Ya se aplicó** al proyecto independiente `wnowjnynikivspolcuvp`.

**Privacidad:** el diseño actual conserva el aislamiento por propietario: cada usuario autorizado ve sus propios pacientes, empresas e historias. Para colaboración de expedientes entre médicos y asistentes se requerirá un control de acceso a nivel de clínica, roles y auditoría que debe diseñarse antes de habilitarlo. No usar datos reales sin validación de requisitos normativos, respaldo y pruebas de seguridad.

## Invitaciones para nuevas cuentas médicas

Dos correos han sido incorporados a la lista privada de invitaciones en Supabase, con roles `doctor` y `assistant`. No se insertan correos ni contraseñas en este repositorio.

- La creación real de cuentas de **Supabase Authentication** se realiza mediante `Authentication > Users > Add user > Send invitation` en el dashboard del proyecto personal.
- El usuario debe aceptar la invitación, verificar su correo y establecer una contraseña segura.
- Un trigger de base de datos (`supabase/verified_invites.sql`) activa `clinic_staff` únicamente para correos previamente invitados y confirmados.
- Los correos preautorizados **no representan usuarios creados** hasta que Supabase Authentication los registre.
- No configurar contraseñas cortas o compartidas. Nunca colocar contraseñas en SQL, GitHub o Render.

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
La base de la aplicación está en el proyecto independiente **Dra. Gricel Pérez** (`wnowjnynikivspolcuvp`). Las migraciones `supabase/schema.sql` y `supabase/verified_invites.sql` ya se aplicaron allí. Las dos invitaciones están en la tabla privada. La conexión de Render usa la URL y la clave *publicable* del proyecto clínico.

1. Abrir Authentication > Users en el **proyecto clínico**, no en Everywear.
2. Invitar a cada correo clínico autorizado y exigir verificación + contraseña segura.
3. Revisar que el trigger otorgue permisos solo después de confirmar el correo.
4. Probar RLS con usuarios autorizados y no autorizados, además de la exportación PDF.
5. Ajustar políticas de seguridad, auditoría y retención antes de datos reales.

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
