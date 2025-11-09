# Collaborative Canvas

A real-time multi-user drawing application where multiple people can draw simultaneously on the same canvas with instant synchronization.

## Features

- **Real-time Drawing**: See other users' drawings as they draw, not after they finish
- **Drawing Tools**: Brush and eraser with adjustable colors and stroke widths
- **User Indicators**: Visual indicators showing who's online and where they're drawing
- **Global Undo/Redo**: Undo and redo operations that work across all users
- **Conflict Resolution**: Smooth handling when multiple users draw in overlapping areas
- **Touch Support**: Works on mobile devices with touch drawing support
- **User Management**: Shows online users with color-coded indicators

### DEPLOYED DEMO LINK - https://canvas-production-30e0.up.railway.app/
## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Navigate to the project directory:
```bash
cd collaborative-canvas
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### Testing with Multiple Users

To test the collaborative features:

1. Start the server with `npm start`
2. Open `http://localhost:3000` in multiple browser windows or tabs
3. Start drawing in one window and observe real-time updates in others
4. Try the undo/redo functionality to see global operation history
5. Move your cursor to see cursor indicators in other windows

4. Click on the local URL in the terminal output (Ctrl+Click on Windows/Linux, Cmd+Click on Mac)

## Known Limitations

- **Canvas State**: Canvas state is stored in server memory, so restarting the server clears all drawings
- **Scalability**: Current implementation uses in-memory storage, not suitable for large-scale production
- **Undo/Redo**: Global undo removes the last operation from any user, which may be unexpected
- **Network Latency**: High latency connections may experience slight delays in drawing synchronization
- **Browser Compatibility**: Best performance in modern browsers (Chrome, Firefox, Safari, Edge)

## Time Spent

Approximately 9-10 hours were spent on this project, including:
- Architecture design and planning (1 hr)
- WebSocket server implementation (2 hr)
- Canvas drawing logic (2 hour)
- Real-time synchronization (2 hour)
- UI/UX polish and styling (1 hr)
- Testing and bug fixes (1 hr)
- Documentation (45 minutes)

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.io
- **No frameworks**: Built with pure JavaScript to demonstrate core web development skills

## Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Main HTML interface
│   ├── style.css           # Styling and responsive design
│   ├── canvas.js           # Canvas drawing logic
│   ├── websocket.js        # WebSocket client management
│   └── main.js             # Application initialization
├── server/
│   └── server.js           # Express + Socket.io server
├── package.json            # Project dependencies
├── README.md              # This file
└── ARCHITECTURE.md         # Technical architecture details
```
