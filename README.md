# Tutoría Conecta — Proyecto Final de Desarrollo Web 2026

Plataforma web que conecta estudiantes con tutores de idiomas, deportes, ciencias, tecnología y posgrado. Permite buscar tutorías, contratar bloques de sesiones, consultar agendas, conversar en tiempo real y gestionar reportes y apelaciones.

Proyecto académico de la Universidad Mariano Gálvez de Guatemala, Sede El Naranjo.

## Integrantes

| Integrante | Carné | Contribución principal |
|---|---|---|
| Fredy Leonel Morales Albizures | 9490-23-16408 | Backend e integración |
| Mauricio Isaí Pérez Saban | 9490-23-25701 | Páginas del frontend |

## Enlaces

- Plataforma: https://tutoria-conecta.netlify.app/
- API: https://tutoria-conecta.onrender.com/api
- Repositorio: https://github.com/fmoralesa6-lgtm/tutoria-conecta.

La API requiere autenticación en sus recursos protegidos. Abrir una dirección directamente en el navegador no envía el encabezado de autorización.

## Tecnologías

### Frontend

- React y TypeScript.
- Vite.
- SASS/SCSS.
- React Context y useReducer para autenticación.
- Google Sign-In.
- Leaflet y OpenStreetMap.
- FullCalendar.
- Recharts.
- Socket.io Client.

### Backend

- Node.js y Express.
- TypeScript.
- PostgreSQL mediante el paquete `pg`.
- JSON Web Tokens.
- Google Auth Library.
- Socket.io.
- Zod para validación de datos.
- OpenRouteService para rutas viales.
- Brevo para notificaciones por correo.

### Despliegue

- Frontend en Netlify.
- Backend y base de datos PostgreSQL en Render.

## Funcionalidades

### Autenticación y perfiles

- Inicio de sesión mediante Google.
- Registro inicial como estudiante o tutor.
- Captura de teléfono, género, dirección, ubicación en mapa, identificación y categorías de interés.
- Registro de portafolio HTTPS, biografía y tarifa base para tutores.
- Aprobación administrativa del tutor antes de publicar.
- Autenticación mediante JWT.
- Duración del token configurable mediante `JWT_TTL_SECONDS`.
- Cierre de sesión ante respuestas de sesión inválida o vencida.
- Documento de identificación cifrado con AES-256-GCM.
- Consulta administrativa de identificación registrada en auditoría.

### Oferta académica y búsqueda

- Publicación y edición de tutorías.
- Categorías y subcategorías administrables.
- Modalidad virtual, en sede del tutor o a domicilio.
- Tarifa por hora y tarifa adicional por kilómetro.
- Filtros por categoría, modalidad, precio, cercanía, estrellas y cantidad de reseñas.
- Compartición de ofertas mediante WhatsApp.

### Reservas y calendario

- Disponibilidad semanal configurable por tutor.
- Contratación de bloques de 1, 4 u 8 semanas.
- Selección de días fijos, horario y duración.
- Reserva del horario desde el estado pendiente.
- Prevención de traslapes para tutor y estudiante.
- Transacciones y restricciones de exclusión en PostgreSQL.
- Aprobación y cancelación de bloques.
- Liberación de horarios de sesiones pendientes o aprobadas al cancelar.
- Calendario diario, semanal y mensual.
- Registro de sesiones impartidas y no impartidas.

### Mapas y presupuesto

- Cercanía geográfica calculada a partir de coordenadas.
- Ruta vial mediante OpenRouteService para tutorías a domicilio.
- Visualización de la trayectoria en un mapa.
- Desglose de clases, traslado y total del bloque.
- Recálculo del precio y validación de disponibilidad al reservar.

### Comunicación y cursos

- Chat privado entre estudiante y tutor.
- Mensajes en tiempo real con fecha y confirmación de lectura.
- Adjuntos PDF e imágenes JPG, PNG y WEBP.
- Validación de archivos y acceso restringido a participantes.
- Tableros de anuncios, materiales y enlaces de clases.
- Acceso a tableros para estudiantes con inscripción aprobada.
- Notificaciones por correo de enlaces de clases virtuales.

### Reseñas y moderación

- Calificación de 1 a 5 estrellas y comentario después de una sesión impartida.
- Promedio y cantidad de reseñas visibles en el catálogo.
- Reportes por inasistencia, conducta inapropiada y cobros indebidos.
- Suspensión de cuentas con motivo y fecha.
- Vista restringida y formulario de apelación.
- Reactivación mediante aceptación administrativa de la apelación.
- Historial de reportes y registro de acciones de auditoría.

### Administración y reportería

- Revisión y aprobación de tutores.
- CRUD de categorías y subcategorías.
- Gestión de denuncias y apelaciones.
- Consulta de inscripciones y horarios de estudiantes.
- Ranking histórico de tutores con acceso a reseñas.
- Horas contratadas por categoría.
- Sesiones por estado y mes.
- Gráficos y tablas que cambian según el mes seleccionado.

## Estructura del proyecto

- `backend/src/`: API, autenticación, reservas, catálogo, chat, moderación y correo.
- `backend/schema.sql`: tablas, índices y restricciones de PostgreSQL.
- `backend/tests/`: prueba de concurrencia para una base de datos de pruebas.
- `frontend/src/`: componentes, pantallas, estado, cliente HTTP y estilos SCSS.
- `frontend/public/`: recursos públicos y configuración de redirecciones.
- `README.md`: descripción y configuración general.

## Configuración local

Se requiere Node.js 22.12 o superior y una base PostgreSQL con soporte para la extensión `btree_gist`.

### Variables del backend

Crear `backend/.env` con los valores correspondientes:

```dotenv
PORT=4000
DATABASE_URL=CONEXION_POSTGRESQL
JWT_SECRET=SECRETO_DE_AL_MENOS_32_CARACTERES
JWT_TTL_SECONDS=7200
GOOGLE_CLIENT_ID=CLIENT_ID_DE_GOOGLE
CLIENT_ORIGIN=http://localhost:5173
ADMIN_EMAILS=administrador@ejemplo.com
ORS_API_KEY=CLAVE_OPENROUTESERVICE
DOCUMENT_KEY=CLAVE_HEXADECIMAL_DE_64_CARACTERES
BREVO_API_KEY=CLAVE_BREVO
MAIL_FROM_EMAIL=remitente@ejemplo.com
MAIL_FROM_NAME=Tutoría Conecta
```

Los valores anteriores son marcadores y deben reemplazarse. Los correos administradores se separan por comas. El remitente debe estar autorizado en Brevo.

La conexión PostgreSQL está configurada para utilizar SSL con verificación del certificado.

### Variables del frontend

Crear `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=CLIENT_ID_DE_GOOGLE
```

Configurar también los orígenes permitidos en el cliente OAuth de Google.

### Iniciar el backend

Desde la carpeta principal:

```powershell
cd backend
npm ci
npm run migrate
npm run dev
```

La migración aplica `schema.sql` a la base configurada. Verificar la conexión antes de ejecutarla.

### Iniciar el frontend

En otra terminal, desde la carpeta principal:

```powershell
cd frontend
npm ci
npm run dev
```

## Compilación y pruebas

### Backend

```powershell
cd backend
npm test
```

Este comando compila el backend y ejecuta cinco pruebas sobre recurrencia, disponibilidad y distancia geográfica.

### Frontend

```powershell
cd frontend
npm run build
```

### Concurrencia en PostgreSQL

La prueba independiente requiere una base destinada a pruebas:

```powershell
cd backend
$env:TEST_DATABASE_URL="CONEXION_POSTGRESQL_DE_PRUEBAS"
node tests/concurrency.mjs
```

Esta prueba comprueba el rechazo de intervalos superpuestos y la aceptación de horarios adyacentes. No sustituye las pruebas completas de reservas mediante la API.

## Validaciones realizadas

- Compilación del frontend y backend.
- Cinco pruebas automatizadas aprobadas durante la revisión del código.
- Inicio de sesión real con Google.
- Registro, aprobación y publicación de un nuevo tutor.
- Búsqueda con filtros y exclusión de tutores sin calificaciones al exigir estrellas mínimas.
- Cálculo de ruta y presupuesto a domicilio.
- Reservas recurrentes, aprobación y cancelación.
- Intentos de reservas en conflicto para el mismo tutor.
- Horario bloqueado para un estudiante ocupado y disponible para otro estudiante libre.
- Chat, confirmaciones de lectura y descarga de adjuntos.
- Rechazo de acceso a conversaciones y adjuntos desde una cuenta ajena.
- Rechazo de acceso administrativo desde cuentas de estudiante y tutor.
- Reseñas, reportes, suspensión, apelación y reactivación.
- Cambio de mes en la reportería.
- Expiración de sesión con una duración temporal de prueba.
- Interfaz en escritorio y móvil, con modo claro y oscuro.

Estas validaciones corresponden a los escenarios revisados; no representan una auditoría exhaustiva de seguridad.

## Decisiones de funcionamiento

- Los horarios se muestran en hora de Guatemala, UTC−6.
- Los precios se expresan en quetzales.
- La cercanía del catálogo es geográfica; el traslado a domicilio utiliza distancia vial.
- El traslado corresponde al trayecto de ida por sesión.
- Las sesiones pendientes también reservan el horario.
- Cambiar la disponibilidad semanal no cancela reservas existentes.
- Las credenciales académicas del tutor se presentan mediante URL HTTPS.
- La plataforma no procesa pagos ni emite certificaciones oficiales.
- La duración habitual del JWT es de 7200 segundos, equivalente a dos horas.

## Documentación pendiente

- Manual técnico: componentes, uso de TypeScript, uso de SCSS y diagrama entidad-relación.
- Manual de usuario: capturas e instrucciones para estudiantes, tutores y administradores.

## Credenciales

Los archivos `.env`, tokens y claves privadas no deben incluirse en el repositorio ni en los entregables.

Las variables de producción se configuran directamente en Netlify y Render.