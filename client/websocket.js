export class WebSocketManager {
  constructor(canvasManager, onInit, onUserUpdate) {
    this.canvasManager = canvasManager;
    this.onInit = onInit;
    this.onUserUpdate = onUserUpdate;
    this.socket = null;
    this.userId = null;
    this.userColor = null;
    this.currentRoom = null;
    this.remoteDrawingSessions = new Map();
  }

  connect() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('init', (data) => {
      this.userId = data.userId;
      this.userColor = data.userColor;
      this.currentRoom = data.roomId;

      this.canvasManager.clear();
      data.operations.forEach(op => {
        this.canvasManager.addOperation(op);
      });

      this.onInit(data);
    });

    this.socket.on('user:joined', (user) => {
      this.onUserUpdate({ type: 'joined', user });
    });

    this.socket.on('user:left', (data) => {
      this.onUserUpdate({ type: 'left', userId: data.userId });
      this.remoteDrawingSessions.delete(data.userId);
    });

    this.socket.on('draw:start', (data) => {
      this.remoteDrawingSessions.set(data.userId, {
        points: [{ x: data.x, y: data.y }],
        color: data.color,
        width: data.width,
        tool: data.tool
      });
    });

    this.socket.on('draw:move', (data) => {
      const session = this.remoteDrawingSessions.get(data.userId);
      if (session) {
        const points = session.points;
        const lastPoint = points[points.length - 1];

        this.canvasManager.ctx.beginPath();
        this.canvasManager.ctx.strokeStyle = session.tool === 'eraser' ? '#FFFFFF' : session.color;
        this.canvasManager.ctx.lineWidth = session.width;
        this.canvasManager.ctx.globalCompositeOperation = session.tool === 'eraser' ? 'destination-out' : 'source-over';

        this.canvasManager.ctx.moveTo(lastPoint.x, lastPoint.y);
        this.canvasManager.ctx.lineTo(data.x, data.y);
        this.canvasManager.ctx.stroke();

        this.canvasManager.ctx.globalCompositeOperation = 'source-over';

        points.push({ x: data.x, y: data.y });
      }
    });

    this.socket.on('draw:end', (data) => {
      const session = this.remoteDrawingSessions.get(data.userId);
      if (session) {
        const operation = {
          id: data.operationId,
          type: 'stroke',
          tool: session.tool,
          color: session.color,
          width: session.width,
          points: session.points,
          timestamp: Date.now()
        };

        this.canvasManager.operations.push(operation);
        this.remoteDrawingSessions.delete(data.userId);
      }
    });

    this.socket.on('cursor:move', (data) => {
      this.onUserUpdate({ type: 'cursor', userId: data.userId, x: data.x, y: data.y });
    });

    this.socket.on('operation:undo', (data) => {
      this.canvasManager.undoOperation(data.operationId);
    });

    this.socket.on('operation:redo', (operation) => {
      this.canvasManager.addOperation(operation);
    });

    this.socket.on('canvas:clear', () => {
      this.canvasManager.clear();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return this.socket;
  }

  emitDrawStart(x, y, color, width, tool) {
    this.socket.emit('draw:start', { x, y, color, width, tool });
  }

  emitDrawMove(x, y) {
    this.socket.emit('draw:move', { x, y });
  }

  emitDrawEnd(operation) {
    this.socket.emit('draw:end', operation);
  }

  emitCursorMove(x, y) {
    this.socket.emit('cursor:move', { x, y });
  }

  emitUndo() {
    this.socket.emit('undo');
  }

  emitRedo(operation) {
    this.socket.emit('redo', operation);
  }

  emitClear() {
    this.socket.emit('clear');
  }

  joinRoom(roomId) {
    this.socket.emit('join:room', roomId);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
