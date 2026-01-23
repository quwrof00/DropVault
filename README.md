# DropVault

DropVault is a modern, secure, and collaborative workspace application designed to streamline team productivity. It combines real-time collaboration with secure file management, all wrapped in a sleek, responsive user interface.

## Features

- **Real-time Collaboration**: Work together on notes and documents in real-time using Tiptap and Yjs. See changes instantly as team members type.
- **Secure Architecture**: Built with security in mind, featuring client-side encryption for sensitive data.
- **Room-based Workspaces**: Create dedicated rooms for different projects or teams to keep your work organized.
- **File Management**: Efficient management system for Files, Notes, and Images.
- **Modern UI/UX**: A polished interface featuring glassmorphism, smooth animations, and a responsive design built with Tailwind CSS.
- **Interactive Dashboard**: A personal dashboard to manage your tasks, rooms, and files at a glance.
- **Secure Authentication**: Robust user registration and login flows.

## Tech Stack

- **Frontend**: [React](https://react.dev/) (v19), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Collaboration**: [Yjs](https://github.com/yjs/yjs) (CRDTs), [Tiptap](https://tiptap.dev/), [Socket.io](https://socket.io/) / WebSockets
- **Backend/Storage**: [Supabase](https://supabase.com/), Node.js (for collab server)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

Follow these steps to get the project running on your local machine.

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/quwrof00/drop-vault.git
    cd drop-vault
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory and configure your environment variables. You may need Supabase credentials and WebSocket URL configuration.
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_WS_URL=ws://localhost:1234
    ```

### Running the Application

1.  **Start the Collaboration Server** (Required for real-time features)
    ```bash
    npm run collab:server
    ```

2.  **Start the Frontend Development Server**
    ```bash
    npm run dev
    ```

    The application should now be running at `http://localhost:5173`.

## Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Builds the application for production.
- `npm run lint`: Runs ESLint to check for code quality issues.
- `npm run preview`: Previews the production build locally.
- `npm run collab:server`: Starts the WebSocket server for real-time collaboration.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
