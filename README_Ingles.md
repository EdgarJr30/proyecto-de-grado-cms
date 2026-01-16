# MLM (Manteniendo la Misión)

A modern maintenance ticket management system built with React and TypeScript, featuring a Kanban board interface for efficient workflow management.

## 🚀 Overview

MLM is a web-based application designed to streamline maintenance request management across multiple locations. The system provides an intuitive Kanban board interface for tracking tickets from creation to completion.

## ✨ Features

- **WorkOrders Board Interface**: Visual workflow management
- **Ticket Creation**: Comprehensive form for creating maintenance requests
- **User Authentication**: Secure login system with protected routes
- **Priority Management**: Urgent ticket flagging system
- **Photo Attachments**: Ability to attach images to maintenance requests
- **Location Tracking**: Dropdown selection for various facility locations
- **Incident Dating**: Track when issues originally occurred
- **Status Management**: Three-stage workflow (Pending, In Progress, Completed)
- **Visual Indicators**: Color-coded tags and icons for quick status identification
- **Sequential Numbering**: Automatic ticket numbering for internal tracking

## ✨ New Features
- **Global Search 🔎**: Global search within the Kanban board that performs database searches by the fields title and requester to find tickets.
- **Badge Notifications ❶**: Badge de notificaciones en la campana para nuevos tickets insertados en la BD

## 🏢 Supported Locations

- Operadora de Servicios Alimenticios
- Adrian Tropical 27
- Adrian Tropical Malecón
- Adrian Tropical Lincoln
- Adrian Tropical San Vicente
- Atracciones el Lago
- M7
- E. Arturo Trading
- Edificio Comunitario

## 🛠️ Tech Stack

- **Frontend**: React 19.1.0 + TypeScript
- **Build Tool**: Vite 6.3.5
- **Styling**: TailwindCSS 4.1.8
- **Database**: Supabase
- **Routing**: React Router DOM 7.6.1
- **UI Components**: Radix UI, Heroicons, Lucide React
- **Notifications**: React Toastify, SweetAlert2

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/EdgarJr30/cilm_easy_mant.git
   cd cilm_easy_mant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   Run the SQL script to create the necessary tables:
   ```bash
   # Execute the create_database.sql file in your Supabase dashboard
   ```

## 🚦 Usage

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```
## 📱 Application Structure

- `/login` - User authentication
- `/crear-ticket` - New maintenance request form
- `/kanban` - Main dashboard with ticket management (protected route)
- `/` - Redirects to Kanban board

## 🔐 Authentication

The application uses protected routes to ensure only authenticated users can access the main dashboard. Ticket creation is available for all users to allow easy request submission.

## 🎨 UI/UX Features

- Responsive design for desktop and mobile
- Toast notifications for user feedback
- Color-coded status indicators
- Modern, clean design with TailwindCSS

## 📊 Database

The application includes a pre-configured database structure. Import the `MLM.csv` file to populate initial data if needed.

## 📄 License

This project is private and proprietary.

---

Built with ❤️ for efficient maintenance management
```