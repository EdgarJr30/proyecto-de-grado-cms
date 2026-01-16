# MLM (Manteniendo la Misión)

Un sistema moderno de gestión de tickets de mantenimiento, desarrollado con React y TypeScript, que incluye una interfaz de tablero Kanban para una gestión eficiente del flujo de trabajo.

## 🚀 Resumen

MLM es una aplicación web diseñada para optimizar la gestión de solicitudes de mantenimiento en múltiples ubicaciones. El sistema ofrece una interfaz Kanban intuitiva para el seguimiento de tickets desde su creación hasta su cierre.

## ✨ Funcionalidades

- **Tablero Kanban**: Gestión visual del flujo de trabajo.
- **Creación de Tickets**: Formulario completo para registrar solicitudes de mantenimiento.
- **Autenticación de Usuarios**: Inicio de sesión seguro y rutas protegidas.
- **Gestión de Prioridad**: Sistema de marcado de tickets urgentes.
- **Adjuntos de Fotos**: Permite adjuntar imágenes a las solicitudes.
- **Ubicaciones**: Selección mediante lista desplegable de las diferentes ubicaciones.
- **Fecha del Incidente**: Registro de la fecha de ocurrencia del problema.
- **Gestión de Estados**: Flujo de tres etapas (Pendiente, En Ejecución, Finalizadas).
- **Indicadores Visuales**: Etiquetas e íconos con código de colores para identificar el estado rápidamente.
- **Numeración Secuencial**: Asignación automática de número de ticket para seguimiento interno.

## ✨ Nuevas Funcionalidades

- **Búsqueda Global 🔎**: Busca tickets por título y solicitante directamente en la base de datos desde el Kanban.
- **Notificaciones con Badge ❶**: Muestra el número de nuevos tickets en la campana de notificaciones.
- **Módulo Bandeja de Entrada (WorkRequests)**:  
  - Permite aceptar tickets uno a uno o por lotes de 10.
  - Integra búsqueda global y filtrado específico por ubicación.
  - Los tickets aceptados pasan automáticamente al tablero Kanban.
  - (Funcionalidad de rechazo de tickets pendiente de implementación)
- **Tablero Kanban Mejorado**:  
  - Filtrado específico por ubicación.
  - Solo muestra tickets previamente aceptados.

## 🏢 Ubicaciones Soportadas

- Operadora de Servicios Alimenticios
- Adrian Tropical 27
- Adrian Tropical Malecón
- Adrian Tropical Lincoln
- Adrian Tropical San Vicente
- Atracciones el Lago
- M7
- E. Arturo Trading
- Edificio Comunitario

## 🛠️ Tecnologías

- **Frontend**: React 19.1.0 + TypeScript
- **Build Tool**: Vite 6.3.5
- **Estilos**: TailwindCSS 4.1.8
- **Base de Datos**: Supabase
- **Ruteo**: React Router DOM 7.6.1
- **Componentes UI**: Radix UI, Heroicons, Lucide React
- **Notificaciones**: React Toastify, SweetAlert2

## 📦 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/EdgarJr30/cilm_easy_mant.git
   cd cilm_easy_mant
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
   ```env
   VITE_SUPABASE_URL=tu_supabase_url
   VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
   ```

4. **Configurar la base de datos**
   Ejecuta el script SQL para crear las tablas necesarias:
   ```bash
   # Ejecuta el archivo create_database.sql desde el panel de Supabase
   ```

## 🚦 Uso

### Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:puerto

### Construir para Producción

```bash
npm run build
```

### Previsualizar Build de Producción

```bash
npm run preview
```

### Linter

```bash
npm run lint
```

## 📱 Estructura de la Aplicación

- `/login` - Autenticación de usuarios
- `/crear-ticket` - Formulario para nuevas solicitudes de mantenimiento
- `/kanban` - Tablero principal con gestión de tickets (ruta protegida)
-  `/WorkRequests` - 
- `/` - Redirecciona al tablero Kanban

## 🔐 Autenticación

La aplicación utiliza rutas protegidas para garantizar que solo los usuarios autenticados accedan al tablero principal. La creación de tickets está disponible para todos los usuarios, facilitando la solicitud de servicios.

## 🎨 Experiencia de Usuario (UI/UX)

- Diseño responsive para escritorio y móvil
- Notificaciones tipo Toast para retroalimentación al usuario
- Indicadores visuales con código de colores
- Diseño moderno y limpio usando TailwindCSS

## 📊 Base de Datos

La aplicación incluye una estructura de base de datos preconfigurada. Puedes importar el archivo `MLM.csv` para poblar datos iniciales si lo necesitas.

## 📄 Licencia

Este proyecto es privado y propietario.

---

Desarrollado con ❤️ para una gestión de mantenimiento eficiente