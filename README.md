# DropVault

DropVault is a secure, collaborative workspace application designed for seamless team productivity. It offers real-time synchronization, robust file management, and end-to-end security within a responsive and modern interface.

## Key Features

- Real-time Collaboration: Edit notes and documents simultaneously with your team using Tiptap and Yjs.
- Secure Architecture: Protect your sensitive information with client-side encryption.
- Organized Workspaces: Create dedicated rooms to compartmentalize projects and team activities.
- Comprehensive File Management: Upload, organize, and access files, notes, and images efficiently.
- Modern User Interface: Experience a sleek design featuring glassmorphism effects and responsive layouts built with Tailwind CSS.
- Interactive Dashboard: Monitor tasks, recent rooms, and managed files from a centralized hub.
- Robust Authentication: Secure user registration and login powered by Supabase.

## Technology Stack

### Frontend
- React (v19)
- TypeScript
- Vite
- Tailwind CSS

### Collaboration and Data Sync
- Yjs (CRDTs)
- Tiptap
- WebSockets via Socket.io

### Backend and Storage
- Node.js (Collaboration Server)
- Supabase

## Setup Instructions

Follow these steps to run DropVault locally on your machine.

### Prerequisites

- Node.js (version 18 or newer is recommended)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/quwrof00/drop-vault.git
cd drop-vault
```

2. Install all dependencies
```bash
npm install
```

3. Configure Environment Variables
Create a `.env` file in the root of your project and populate it with your specific details.
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_WS_URL=ws://localhost:1234
```

### Running the Application Locally

1. Start the Collaboration Server
This server handles real-time synchronizations.
```bash
npm run collab:server
```

2. Start the Frontend Server
Open a new terminal window and run the following command.
```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

## Available Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Compiles TypeScript and builds the application for production.
- `npm run lint`: Checks for code quality issues using ESLint.
- `npm run preview`: Hosts the production build locally for testing.
- `npm run collab:server`: Starts the WebSocket server for live collaboration features.

## Contributing

We welcome contributions. Please submit a Pull Request to propose your changes.

## License

This project is licensed under the MIT License. Please refer to the LICENSE file for details.
