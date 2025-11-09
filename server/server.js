import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { RoomManager } from './rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(join(__dirname, '../client')));

const roomManager = new RoomManager();

const USER_COLORS = [
  { hex: '#FF6B6B', name: 'Crimson' },
  { hex: '#4ECDC4', name: 'Teal' },
  { hex: '#45B7D1', name: 'Sky' },
  { hex: '#FFA07A', name: 'Coral' },
  { hex: '#98D8C8', name: 'Mint' },
  { hex: '#F7DC6F', name: 'Golden' },
  { hex: '#BB8FCE', name: 'Lavender' },
  { hex: '#85C1E2', name: 'Azure' }
];

const ANIMALS = [
  'Panda', 'Dragon', 'Phoenix', 'Tiger', 'Fox', 'Wolf', 'Eagle', 'Dolphin',
  'Owl', 'Bear', 'Hawk', 'Lion', 'Falcon', 'Raven', 'Lynx', 'Otter',
  'Jaguar', 'Leopard', 'Cheetah', 'Panther', 'Cobra', 'Viper', 'Sparrow',
  'Hummingbird', 'Butterfly', 'Deer', 'Moose', 'Elephant', 'Rhino', 'Hippo'
];

let colorIndex = 0;

function generateUserName(color) {
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${color.name} ${animal}`;
}

io.on('connection', (socket) => {
  const userId = socket.id;
  let currentRoomId = null;

  socket.on('join:room', (roomId) => {
    if (currentRoomId) {
      socket.leave(currentRoomId);
      const oldRoom = roomManager.getRoom(currentRoomId);
      if (oldRoom) {
        oldRoom.removeUser(userId);
        socket.to(currentRoomId).emit('user:left', { userId });
      }
    }

    currentRoomId = roomId || 'default';
    socket.join(currentRoomId);

    const room = roomManager.getRoomOrCreate(currentRoomId);

    const userColorObj = USER_COLORS[colorIndex % USER_COLORS.length];
    const userColor = userColorObj.hex;
    const userName = generateUserName(userColorObj);
    colorIndex++;

    const user = {
      id: userId,
      name: userName,
      color: userColor,
      cursor: { x: 0, y: 0 }
    };

    room.addUser(userId, user);

    socket.emit('init', {
      userId,
      userName,
      userColor,
      roomId: currentRoomId,
      operations: room.getOperations(),
      users: room.getUsers()
    });

    socket.to(currentRoomId).emit('user:joined', user);
  });

  socket.on('draw:start', (data) => {
    if (currentRoomId) {
      socket.to(currentRoomId).emit('draw:start', { ...data, userId });
    }
  });

  socket.on('draw:move', (data) => {
    if (currentRoomId) {
      socket.to(currentRoomId).emit('draw:move', { ...data, userId });
    }
  });

  socket.on('draw:end', (data) => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        const operation = {
          id: Date.now() + Math.random(),
          type: 'stroke',
          userId,
          timestamp: Date.now(),
          ...data
        };

        room.addOperation(operation);
        socket.to(currentRoomId).emit('draw:end', { ...data, userId, operationId: operation.id });
      }
    }
  });

  socket.on('cursor:move', (data) => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.updateUserCursor(userId, data);
        socket.to(currentRoomId).emit('cursor:move', { userId, ...data });
      }
    }
  });

  socket.on('undo', () => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        const lastOp = room.removeLastOperation();
        if (lastOp) {
          io.to(currentRoomId).emit('operation:undo', { operationId: lastOp.id });
        }
      }
    }
  });

  socket.on('redo', (data) => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        const operation = {
          id: Date.now() + Math.random(),
          type: 'stroke',
          userId,
          timestamp: Date.now(),
          ...data
        };

        room.addOperation(operation);
        io.to(currentRoomId).emit('operation:redo', operation);
      }
    }
  });

  socket.on('clear', () => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.clearOperations();
        io.to(currentRoomId).emit('canvas:clear');
      }
    }
  });

  socket.on('disconnect', () => {
    if (currentRoomId) {
      const room = roomManager.getRoom(currentRoomId);
      if (room) {
        room.removeUser(userId);
        socket.to(currentRoomId).emit('user:left', { userId });
      }
      roomManager.cleanEmptyRooms();
    }
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
