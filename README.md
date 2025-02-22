# Workio - Backend

## Descripción
Workio es un sistema web responsive para la reserva de espacios de coworking en Bogotá. Este repositorio contiene el backend del sistema, desarrollado en Node.js y TypeScript, proporcionando una API REST para la gestión de reservas, autenticación de usuarios y administración de espacios de coworking. El desarrollo sigue la metodología SCRUM dentro de la asignatura de Ingeniería de Software 2.

## Características Principales
- API RESTful para la gestión de usuarios, reservas y espacios de coworking.
- Autenticación y autorización mediante JWT.
- Base de datos con PostgreSQL.
- Manejo de roles y permisos.
- Validación y sanitización de datos.
- Integración con servicios externos (como pasarelas de pago, notificaciones por correo, etc.).

## Tecnologías Utilizadas
- Node.js
- TypeScript
- Express.js
- PostgreSQL
- JWT para autenticación
- Zod para validaciones
- Dotenv para gestión de variables de entorno

## Requisitos Previos
Antes de ejecutar el proyecto, asegúrate de tener instalado:
- [Node.js](https://nodejs.org/) (versión recomendada: 18.x o superior)
- [PostgreSQL](https://www.postgresql.org/)
- [Git](https://git-scm.com/)
- Un gestor de paquetes como `npm` o `yarn`

## Instalación y Configuración
Sigue estos pasos para configurar el backend:

1. Clona el repositorio:
   ```bash
   git clone https://github.com/Daniel1309-gon/BACKEND-WORKIO
   cd BACKEND-WORKIO
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto con la configuración necesaria:
   ```env
   PORT=5000
   DATABASE_URL=postgres://user:password@localhost:5432/workio
   JWT_SECRET=44qxfMyztMufSwfPuVXpDeVF5Km6A4Ab
   ```

4. Ejecuta las migraciones de la base de datos (si aplica):
   ```bash
   npm run migrate
   ```

## Ejecución del Servidor
Para iniciar el backend en modo desarrollo, ejecuta:
```bash
npm run dev
```
El servidor se ejecutará en `http://localhost:5000/`.

## Rutas Principales de la API
Algunas de las rutas disponibles en la API incluyen:

- **Usuarios**
  - `POST /api/auth/register` → Registro de usuario.
  - `POST /api/auth/login` → Autenticación de usuario.

- **Espacios de coworking**
  - `GET /api/spaces` → Listado de espacios disponibles.
  - `POST /api/spaces` → Creación de un nuevo espacio (requiere permisos).

- **Reservas**
  - `GET /api/reservations` → Listado de reservas.
  - `POST /api/reservations` → Creación de una reserva.

## Contribuciones
Las contribuciones son bienvenidas. Para contribuir:
1. Realiza un fork del repositorio.
2. Crea una nueva rama con tu mejora (`git checkout -b feature/nueva-mejora`).
3. Realiza los cambios y haz un commit (`git commit -m 'Descripción de la mejora'`).
4. Envía un pull request para revisión.

## Licencia
Este proyecto está bajo la licencia MIT. Consulta el archivo `LICENSE` para más detalles.

