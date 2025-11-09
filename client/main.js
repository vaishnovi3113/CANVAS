import { CanvasManager } from './canvas.js';
import { WebSocketManager } from './websocket.js';

class CollaborativeCanvas {
  constructor() {
    this.canvas = document.getElementById('canvas');
    this.canvasManager = new CanvasManager(this.canvas);
    this.users = new Map();
    this.cursors = new Map();
    this.currentRoom = null;

    this.wsManager = new WebSocketManager(
      this.canvasManager,
      (data) => this.handleInit(data),
      (update) => this.handleUserUpdate(update)
    );

    this.setupEventListeners();
    this.setupRoomModal();
    this.wsManager.connect();
  }

  setupRoomModal() {
    const modal = document.getElementById('room-modal');
    const roomInput = document.getElementById('room-input');
    const joinBtn = document.getElementById('join-btn');
    const changeRoomBtn = document.getElementById('change-room-btn');

    const showModal = () => {
      modal.classList.add('show');
      roomInput.focus();
    };

    const hideModal = () => {
      modal.classList.remove('show');
    };

    const joinRoom = () => {
      const roomId = roomInput.value.trim() || 'default';
      this.wsManager.joinRoom(roomId);
      hideModal();
      roomInput.value = '';
    };

    joinBtn.addEventListener('click', joinRoom);
    changeRoomBtn.addEventListener('click', showModal);

    roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinRoom();
      }
    });

    showModal();
  }

  setupEventListeners() {
    this.setupToolbar();
    this.setupCanvasEvents();
    this.setupKeyboardShortcuts();
  }

  setupToolbar() {
    const brushBtn = document.getElementById('brush-tool');
    const eraserBtn = document.getElementById('eraser-tool');
    const colorPicker = document.getElementById('color-picker');
    const strokeWidth = document.getElementById('stroke-width');
    const widthValue = document.getElementById('width-value');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const clearBtn = document.getElementById('clear-btn');

    brushBtn.addEventListener('click', () => {
      this.canvasManager.setTool('brush');
      brushBtn.classList.add('active');
      eraserBtn.classList.remove('active');
    });

    eraserBtn.addEventListener('click', () => {
      this.canvasManager.setTool('eraser');
      eraserBtn.classList.add('active');
      brushBtn.classList.remove('active');
    });

    colorPicker.addEventListener('input', (e) => {
      this.canvasManager.setColor(e.target.value);
    });

    strokeWidth.addEventListener('input', (e) => {
      const width = parseInt(e.target.value);
      this.canvasManager.setWidth(width);
      widthValue.textContent = width;
    });

    undoBtn.addEventListener('click', () => {
      const lastOp = this.canvasManager.undo();
      if (lastOp) {
        this.wsManager.emitUndo();
      }
    });

    redoBtn.addEventListener('click', () => {
      const operation = this.canvasManager.redo();
      if (operation) {
        this.wsManager.emitRedo(operation);
      }
    });

    clearBtn.addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This will affect all users.')) {
        this.canvasManager.clear();
        this.wsManager.emitClear();
      }
    });
  }

  setupCanvasEvents() {
    let lastCursorEmit = 0;
    const CURSOR_THROTTLE = 50;

    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.canvasManager.getCoordinates(e);
      this.canvasManager.startDrawing(x, y);
      this.wsManager.emitDrawStart(
        x, y,
        this.canvasManager.currentColor,
        this.canvasManager.currentWidth,
        this.canvasManager.currentTool
      );
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const { x, y } = this.canvasManager.getCoordinates(e);

      if (this.canvasManager.isDrawing) {
        this.canvasManager.draw(x, y);
        this.wsManager.emitDrawMove(x, y);
      }

      const now = Date.now();
      if (now - lastCursorEmit > CURSOR_THROTTLE) {
        this.wsManager.emitCursorMove(x, y);
        lastCursorEmit = now;
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      const operation = this.canvasManager.endDrawing();
      if (operation) {
        this.wsManager.emitDrawEnd(operation);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      const operation = this.canvasManager.endDrawing();
      if (operation) {
        this.wsManager.emitDrawEnd(operation);
      }
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const { x, y } = this.canvasManager.getTouchCoordinates(e);
      this.canvasManager.startDrawing(x, y);
      this.wsManager.emitDrawStart(
        x, y,
        this.canvasManager.currentColor,
        this.canvasManager.currentWidth,
        this.canvasManager.currentTool
      );
    });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const { x, y } = this.canvasManager.getTouchCoordinates(e);
      this.canvasManager.draw(x, y);
      this.wsManager.emitDrawMove(x, y);
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const operation = this.canvasManager.endDrawing();
      if (operation) {
        this.wsManager.emitDrawEnd(operation);
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const lastOp = this.canvasManager.undo();
        if (lastOp) {
          this.wsManager.emitUndo();
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        const operation = this.canvasManager.redo();
        if (operation) {
          this.wsManager.emitRedo(operation);
        }
      }
    });
  }

  handleInit(data) {
    this.currentRoom = data.roomId;
    document.getElementById('status').textContent = `Connected as ${data.userName}`;
    document.getElementById('status').classList.add('connected');
    document.getElementById('room-name').textContent = data.roomId;

    this.users.clear();
    this.cursors.forEach(cursor => cursor.remove());
    this.cursors.clear();

    data.users.forEach(user => {
      if (user.id !== data.userId) {
        this.users.set(user.id, user);
      }
    });

    this.updateUsersList();
  }

  handleUserUpdate(update) {
    if (update.type === 'joined') {
      this.users.set(update.user.id, update.user);
      this.updateUsersList();
    } else if (update.type === 'left') {
      this.users.delete(update.userId);
      this.removeCursor(update.userId);
      this.updateUsersList();
    } else if (update.type === 'cursor') {
      this.updateCursor(update.userId, update.x, update.y);
    }
  }

  updateUsersList() {
    const usersList = document.getElementById('users-list');
    usersList.innerHTML = '';

    this.users.forEach((user, userId) => {
      const userIndicator = document.createElement('div');
      userIndicator.className = 'user-indicator';
      userIndicator.style.backgroundColor = user.color;
      const initials = user.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase() : 'U';
      userIndicator.textContent = initials;
      userIndicator.title = user.name || 'Unknown User';
      usersList.appendChild(userIndicator);
    });
  }

  updateCursor(userId, x, y) {
    const cursorsContainer = document.getElementById('cursors-container');
    let cursor = this.cursors.get(userId);

    if (!cursor) {
      cursor = document.createElement('div');
      cursor.className = 'remote-cursor';
      const user = this.users.get(userId);
      if (user) {
        cursor.style.backgroundColor = user.color;
        cursor.setAttribute('data-user', user.name || 'Unknown');
      }
      cursorsContainer.appendChild(cursor);
      this.cursors.set(userId, cursor);
    }

    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  }

  removeCursor(userId) {
    const cursor = this.cursors.get(userId);
    if (cursor) {
      cursor.remove();
      this.cursors.delete(userId);
    }
  }
}

new CollaborativeCanvas();
