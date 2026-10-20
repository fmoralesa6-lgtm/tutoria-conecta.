# Tutoría Conecta — Proyecto de Desarrollo Web 2026

Marketplace educativo con React + TypeScript + SCSS, Express, PostgreSQL y Socket.io. Implementa estudiantes, tutores y administración, contratación de bloques recurrentes, rutas viales y moderación.

**Empieza por [la guía paso a paso](docs/01-GUIA-PASO-A-PASO.md).** Todos los archivos de código están incluidos. No necesitas crear otro proyecto Vite ni copiar código de la tienda anterior.

## Documentación

1. [Configuración local y despliegue](docs/01-GUIA-PASO-A-PASO.md).
2. [Manual técnico y diagramas](docs/02-MANUAL-TECNICO.md).
3. [Manual de usuario con capturas](docs/03-MANUAL-USUARIO.md).
4. [API y ejemplos](docs/04-API.md).
5. [Requisitos, pruebas y defensa](docs/05-PRUEBAS-Y-ENTREGA.md).

## Estado de esta entrega de código

El backend y frontend compilan. Las pruebas automatizadas de recurrencia y disponibilidad pasan. Se comprobó el esquema PostgreSQL y las restricciones de traslape en un motor PostgreSQL embebido. Se recorrieron pantallas en Chromium con datos de prueba, incluyendo móvil de 390 px.

**Todavía debes configurar tus cuentas, ejecutar las pruebas de integración y desplegar.** No se ha verificado el inicio de sesión real con tu Google Client ID, una ruta real con tu clave de OpenRouteService, ni chat entre dos cuentas en Render. Las capturas del manual usan datos de demostración; no certifican una instalación productiva.

## Decisiones del proyecto

- PostgreSQL en Render, por sus transacciones y restricciones de exclusión para evitar traslapes.
- Portafolio mediante URL HTTPS, una de las alternativas permitidas por el enunciado para las credenciales del tutor.
- Documento de identificación: número cifrado con AES-256-GCM.
- Bloques de 4 u 8 semanas; horarios de Guatemala (UTC−6); precios en quetzales.
- La cercanía del catálogo usa distancia geográfica; el cobro a domicilio utiliza la ruta vial devuelta por OpenRouteService.
- El costo de traslado corresponde al trayecto de ida por sesión y se informa antes de contratar.

## Enlaces de tu instalación

Completa después de publicar:

- Frontend: PENDIENTE.
- API: PENDIENTE.
- Repositorio: PENDIENTE.
- Integrante(s), carné y contribuciones en este proyecto: PENDIENTE DE COMPLETAR.

No se incluyen credenciales, usuarios falsos ni un modo de autenticación de prueba en la aplicación entregada.
