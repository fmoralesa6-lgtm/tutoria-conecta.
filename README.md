# Tutoría Conecta
## Proyecto Final de Desarrollo Web 2026

Tutoría Conecta es el proyecto que realizamos Mauricio y yo para el curso de Desarrollo Web de la Universidad Mariano Gálvez de Guatemala, Sede El Naranjo.

Desarrollamos una plataforma donde los estudiantes pueden buscar tutores, revisar sus horarios y solicitar clases virtuales, en la sede del tutor o a domicilio. También pueden consultar su agenda, conversar con el tutor y dejar una reseña después de recibir una clase.

Por parte del tutor, la plataforma permite publicar tutorías, definir disponibilidad y administrar las solicitudes. El administrador revisa los perfiles, las denuncias, las apelaciones y los indicadores.

## Integrantes

| Integrante | Carné | Trabajo principal |
|---|---|---|
| Fredy Leonel Morales Albizures | 9490-23-16408 | Backend e integración |
| Mauricio Isaí Pérez Saban | 9490-23-25701 | Páginas del frontend |

También realizamos pruebas con diferentes cuentas para revisar las funciones de estudiante, tutor y administrador.

## Enlaces del proyecto

- [Abrir Tutoría Conecta](https://tutoria-conecta.netlify.app/)
- [API del proyecto](https://tutoria-conecta.onrender.com/api)
- [Repositorio](https://github.com/fmoralesa6-lgtm/tutoria-conecta.)
- [Manuales del proyecto](docs/)

La API solicita autenticación en sus rutas protegidas. Si abrimos una de esas direcciones directamente en el navegador, no estamos enviando el token que necesita para permitir el acceso.

## Manuales

En la carpeta [`docs/`](docs/) dejamos los dos manuales finales:

- **Manual técnico:** explica la organización del código, los componentes, TypeScript, SCSS, la base de datos, la seguridad y las reglas de reservas.
- **Manual de usuario:** contiene las capturas y los pasos para utilizar la plataforma como estudiante, tutor o administrador.

## Tecnologías que utilizamos

En el frontend trabajamos con React, TypeScript y Vite. Para los estilos usamos SCSS y agregamos modo claro y oscuro.

También utilizamos:

- React Context y `useReducer` para la autenticación.
- Google Sign-In para ingresar.
- Leaflet y OpenStreetMap para mostrar mapas.
- FullCalendar para la agenda.
- Recharts para los gráficos.
- Socket.io Client para el chat.

En el backend usamos Node.js, Express y TypeScript. La base de datos es PostgreSQL y nos conectamos mediante el paquete `pg`, con consultas escritas en SQL.

Para completar las funciones utilizamos:

- JWT para las sesiones.
- Google Auth Library para verificar el ingreso.
- Zod para validar datos.
- Socket.io para los mensajes en tiempo real.
- OpenRouteService para calcular rutas.
- Brevo para enviar los avisos de clases virtuales.

Publicamos el frontend en Netlify y el backend y la base de datos en Render.

## Qué permite hacer la plataforma

### Ingreso y perfiles

El ingreso se realiza con Google. En el primer registro, la persona elige si será estudiante o tutor y completa su teléfono, género, dirección, identificación, ubicación en el mapa y categorías de interés.

Si elige ser tutor, también debe registrar su portafolio o credenciales mediante un enlace HTTPS, su biografía y su tarifa base por hora. El administrador debe aprobar el perfil antes de que pueda publicar tutorías.

Las sesiones utilizan JWT con el formato Bearer. Dejamos la duración configurable con `JWT_TTL_SECONDS`; en la instalación usamos 7200 segundos, equivalentes a dos horas. Cuando una solicitud protegida responde que la sesión es inválida o venció, el frontend elimina el token y vuelve al ingreso.

El número de identificación se guarda cifrado con AES-256-GCM. Su consulta administrativa queda registrada en auditoría.

### Tutorías y búsqueda

Un tutor aprobado puede publicar y editar sus ofertas, seleccionar una categoría y definir las modalidades que atenderá:

- Virtual.
- En la sede del tutor.
- A domicilio del estudiante.

Cada oferta tiene su tarifa por hora y una tarifa por kilómetro cuando corresponde el traslado.

El estudiante puede buscar por categoría, modalidad, precio, cercanía, estrellas y cantidad de reseñas. Desde el detalle también puede conversar con el tutor o compartir la oferta por WhatsApp.

### Reservas y agenda

El tutor registra su disponibilidad semanal. Con esos horarios, el estudiante puede solicitar bloques de 1, 4 u 8 semanas, indicando días fijos, hora y duración de cada sesión.

La disponibilidad se revisa para todas las fechas del bloque y para ambos participantes. Una solicitud pendiente ya ocupa el horario.

Esta fue una de las partes que más cuidamos: no queríamos permitir que un estudiante tuviera dos clases al mismo tiempo, aunque fueran con tutores diferentes. Por eso guardamos los intervalos del tutor y del estudiante y usamos restricciones de PostgreSQL para impedir los traslapes.

La reserva se guarda dentro de una transacción. Si una fecha tiene conflicto, rechazamos el bloque completo para no dejar una contratación a medias.

La agenda incluye vistas de mes, semana y día, además de una lista accesible de sesiones. Desde el detalle se pueden aprobar o cancelar bloques y registrar sesiones impartidas o no impartidas, según el rol y el estado correspondiente.

### Mapas y presupuesto

En el catálogo mostramos la cercanía geográfica a partir de las coordenadas del perfil.

Para las clases a domicilio usamos la ruta vial de OpenRouteService. La plataforma muestra el recorrido y separa el presupuesto en clases, traslado y total del bloque.

El traslado corresponde al viaje de ida por sesión. Al confirmar la solicitud, el servidor vuelve a revisar el precio y la disponibilidad.

### Chat y tableros

El chat permite conversar entre estudiante y tutor, con fecha de envío y confirmación de lectura.

También agregamos archivos PDF e imágenes JPEG, PNG y WEBP. El límite es de cinco archivos por mensaje y 5 MB por archivo. Solamente los participantes de la conversación pueden consultar sus mensajes y adjuntos.

En los tableros, el tutor puede publicar:

- Anuncios.
- Materiales de estudio mediante enlaces.
- Enlaces de clases virtuales.

Los estudiantes acceden cuando tienen una inscripción aprobada. Los anuncios y materiales quedan en el tablero sin enviar correo. Al publicar una clase virtual, se intenta enviar el enlace a los estudiantes con inscripción virtual aprobada y cuentas habilitadas.

### Reseñas y moderación

Después de una sesión marcada como impartida, el estudiante puede dejar una calificación de 1 a 5 estrellas y un comentario. Permitimos una reseña por sesión.

Tanto estudiantes como tutores pueden reportar inasistencia, conducta inapropiada o cobros indebidos, explicando lo ocurrido con evidencia textual.

Si el administrador suspende una cuenta, la persona puede ingresar, pero su navegación queda limitada a la pantalla de suspensión. Allí puede consultar el motivo, la fecha, las políticas y enviar una apelación.

La cuenta se reactiva cuando el administrador acepta la apelación.

### Administración

El administrador puede:

- Revisar y aprobar tutores.
- Consultar identificaciones y el historial de denuncias.
- Consultar las inscripciones y los horarios de un estudiante.
- Crear, editar, desactivar y eliminar categorías cuando no tengan relaciones que impidan el borrado.
- Revisar denuncias y resolver apelaciones.
- Consultar las acciones de auditoría.
- Revisar horas contratadas por categoría y sesiones por estado y mes.
- Consultar la clasificación histórica de tutores y sus reseñas.

El mes seleccionado cambia los indicadores de sesiones y demanda. La clasificación de tutores conserva sus valoraciones históricas.

## Organización del proyecto

```text
PROYECTO FINAL/
├── backend/
│   ├── src/
│   ├── tests/
│   ├── schema.sql
│   └── package.json
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── docs/
└── README.md
```

- `backend/src/`: rutas de la API, autenticación, reservas, chat, moderación y servicios.
- `backend/schema.sql`: tablas, índices y restricciones.
- `backend/tests/`: prueba independiente de concurrencia.
- `frontend/src/`: pantallas, componentes, autenticación, consultas y estilos.
- `frontend/public/`: recursos públicos y redirecciones.
- `docs/`: manual técnico y manual de usuario.

## Cómo ejecutar el proyecto

Se necesita Node.js 22.12 o superior, npm y una base PostgreSQL con soporte para `btree_gist`.

La conexión de la base debe ser compatible con la configuración SSL del proyecto.

### Configurar el backend

Crear `backend/.env` con los datos de la instalación:

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

Estos valores son ejemplos y deben reemplazarse.

Los correos de `ADMIN_EMAILS` se separan por comas. Esta configuración se toma al crear una cuenta nueva; agregar después el correo de una cuenta existente no cambia automáticamente su rol.

El remitente de correo debe estar autorizado en Brevo.

Para generar un secreto para JWT:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Para generar la clave de cifrado del documento:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

El segundo comando genera los 64 caracteres hexadecimales que necesita `DOCUMENT_KEY`. Esa clave debe conservarse para poder leer los documentos que ya fueron cifrados.

### Configurar el frontend

Crear `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=CLIENT_ID_DE_GOOGLE
```

En el cliente de Google también deben configurarse los orígenes que se utilizarán para el ingreso.

Las claves privadas se quedan en el backend. Las variables `VITE_` se incluyen en la compilación pública del frontend.

### Ejecutar el backend

Desde la carpeta principal:

```powershell
cd backend
npm ci
npm run migrate
npm run dev
```

`npm run migrate` aplica `schema.sql` a la base configurada. Antes de ejecutarlo, hay que revisar que la conexión corresponda a la base que queremos utilizar.

### Ejecutar el frontend

Abrir otra terminal desde la carpeta principal:

```powershell
cd frontend
npm ci
npm run dev
```

Después, abrir la dirección que indique Vite.

## Compilación y pruebas

### Backend

Desde la carpeta principal:

```powershell
cd backend
npm test
```

Este comando compila el backend y ejecuta cinco pruebas de recurrencia, disponibilidad y distancia geográfica.

### Frontend

Desde la carpeta principal:

```powershell
cd frontend
npm run build
```

La compilación genera la carpeta `dist`.

### Prueba de concurrencia

Para esta prueba se utiliza una base separada, con permisos para crear el esquema temporal.

Desde la carpeta principal:

```powershell
cd backend
$env:TEST_DATABASE_URL="CONEXION_POSTGRESQL_DE_PRUEBAS"
node tests/concurrency.mjs
```

La prueba revisa que PostgreSQL rechace intervalos superpuestos y permita horarios consecutivos. Por ejemplo, una clase que termina a las 13:00 no debe impedir otra que comienza exactamente a esa hora.

Esta prueba revisa la restricción de la base. Las reservas completas también deben comprobarse desde la aplicación.

## Publicación

### Netlify

Para el frontend utilizamos:

- Directorio base: `frontend`.
- Comando de compilación: `npm run build`.
- Directorio publicado: `dist`.
- `VITE_API_URL` con la dirección de producción terminada en `/api`.
- `VITE_GOOGLE_CLIENT_ID` con el identificador de Google.

El archivo `frontend/public/_redirects` permite recargar las rutas de la aplicación.

Cuando cambiamos una variable `VITE_`, necesitamos volver a compilar y publicar el frontend.

### Render

En Render configuramos las variables del backend, la conexión PostgreSQL y el origen permitido del frontend mediante `CLIENT_ORIGIN`.

Después de un cambio revisamos el commit activo en ambos servicios. Durante las pruebas nos pasó que Netlify ya tenía una actualización y Render todavía estaba ejecutando una versión anterior. Lo resolvimos desplegando el backend pendiente.

Por eso no damos por terminada una publicación solamente porque el sitio abre: comprobamos que ambos servicios tengan el cambio correspondiente.

## Pruebas que realizamos

Durante el desarrollo y la revisión comprobamos:

- Compilación del frontend y backend.
- Las cinco pruebas automatizadas del backend.
- Ingreso real con Google.
- Registro y aprobación de un nuevo tutor.
- Publicación y búsqueda de tutorías.
- Filtros de precio, categoría, modalidad, cercanía y valoraciones.
- Ruta y presupuesto a domicilio.
- Solicitud, aprobación y cancelación de bloques.
- Conflictos de horario para tutor y estudiante.
- Chat, lectura y descarga de archivos.
- Rechazo de acceso a conversaciones ajenas.
- Restricciones de las funciones administrativas.
- Reseñas y actualización de su consulta en el catálogo.
- Reportes, suspensión, apelación y reactivación.
- Consulta de indicadores por mes.
- Vencimiento de sesión.
- Uso en computadora y celular, con ambos temas de color.

Una prueba importante fue intentar reservar al mismo tutor desde dos cuentas para el mismo horario. Una solicitud se guardó y la otra recibió el aviso de traslape.

También revisamos un horario desde un estudiante que ya tenía otra tutoría y desde una cuenta libre. Para el primero apareció ocupado y para el segundo disponible.

Para comprobar el vencimiento de sesión redujimos temporalmente su duración. Después de la prueba restauramos los 7200 segundos.

Estas comprobaciones corresponden a los casos que revisamos; no significan que hayamos realizado una auditoría completa de seguridad.

## Reglas que debemos tener en cuenta

- Los horarios se muestran en hora de Guatemala, UTC−6.
- Los precios están en quetzales.
- Las solicitudes pendientes también ocupan el horario.
- Cambiar la disponibilidad semanal no cancela reservas existentes.
- Al cancelar un bloque se conservan las sesiones impartidas o no impartidas.
- La distancia del catálogo es geográfica y la del traslado es vial.
- El traslado se cobra por el trayecto de ida de cada sesión.
- Los kilómetros visibles pueden estar redondeados, pero el cálculo usa la precisión recibida.
- El presupuesto y la disponibilidad se revisan otra vez al confirmar.
- La plataforma no procesa pagos ni emite certificados oficiales.
- Los bloques no se renuevan automáticamente.

## Cuidados para mantener el proyecto

Los archivos `.env`, los tokens y las claves privadas no se incluyen en el repositorio. Las variables de producción se configuran directamente en Netlify y Render.

Antes de cambiar el esquema debemos respaldar la base y revisar cómo afectará los registros existentes. Los respaldos también deben incluir los adjuntos, porque se almacenan en PostgreSQL.

Cambiar `JWT_SECRET` invalida las sesiones anteriores. Cambiar `DOCUMENT_KEY` sin preparar una migración impediría descifrar los documentos guardados con la clave anterior.

Los archivos del chat tienen controles de formato y tamaño, pero no análisis antivirus. Las rutas y el envío de correo dependen de servicios externos.

El backend gratuito puede tardar en responder después de un periodo de inactividad. Conviene abrir la plataforma con anticipación cuando vayamos a realizar una demostración.
