export class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: false });
    this.isDrawing = false;
    this.currentPath = [];
    this.currentTool = 'brush';
    this.currentColor = '#000000';
    this.currentWidth = 5;
    this.operations = [];
    this.redoStack = [];

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupCanvas();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    this.ctx.scale(dpr, dpr);

    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';

    this.redrawAll();
  }

  setupCanvas() {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  startDrawing(x, y) {
    this.isDrawing = true;
    this.currentPath = [{ x, y }];
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  draw(x, y) {
    if (!this.isDrawing) return;

    this.currentPath.push({ x, y });

    this.ctx.strokeStyle = this.currentTool === 'eraser' ? '#FFFFFF' : this.currentColor;
    this.ctx.lineWidth = this.currentWidth;
    this.ctx.globalCompositeOperation = this.currentTool === 'eraser' ? 'destination-out' : 'source-over';

    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  endDrawing() {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    if (this.currentPath.length > 0) {
      const operation = {
        type: 'stroke',
        tool: this.currentTool,
        color: this.currentColor,
        width: this.currentWidth,
        points: [...this.currentPath],
        timestamp: Date.now()
      };

      this.operations.push(operation);
      this.redoStack = [];

      return operation;
    }

    return null;
  }

  drawRemotePath(points, color, width, tool = 'brush') {
    if (!points || points.length === 0) return;

    this.ctx.beginPath();
    this.ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    this.ctx.lineWidth = width;
    this.ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();

    this.ctx.globalCompositeOperation = 'source-over';
  }

  drawOperation(operation) {
    if (operation.type === 'stroke') {
      this.drawRemotePath(operation.points, operation.color, operation.width, operation.tool);
    }
  }

  redrawAll() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.operations.forEach(operation => {
      this.drawOperation(operation);
    });
  }

  undo() {
    if (this.operations.length > 0) {
      const lastOp = this.operations.pop();
      this.redoStack.push(lastOp);
      this.redrawAll();
      return lastOp;
    }
    return null;
  }

  redo() {
    if (this.redoStack.length > 0) {
      const operation = this.redoStack.pop();
      this.operations.push(operation);
      this.drawOperation(operation);
      return operation;
    }
    return null;
  }

  undoOperation(operationId) {
    const index = this.operations.findIndex(op => op.id === operationId);
    if (index !== -1) {
      const removed = this.operations.splice(index, 1)[0];
      this.redoStack.push(removed);
      this.redrawAll();
    }
  }

  addOperation(operation) {
    this.operations.push(operation);
    this.drawOperation(operation);
  }

  clear() {
    this.operations = [];
    this.redoStack = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setColor(color) {
    this.currentColor = color;
  }

  setWidth(width) {
    this.currentWidth = width;
  }

  getCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
  }

  getTouchCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    return { x, y };
  }
}
