# Architecture Documentation

## Overview

This document provides a detailed technical overview of the Collaborative Canvas application, including data flow, WebSocket protocol, undo/redo strategy, performance decisions, and conflict resolution mechanisms.

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Actions                            │
│  (Mouse/Touch Events, Tool Selection, Undo/Redo, Clear)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Canvas Manager                              │
│  • Handles local drawing operations                             │
│  • Manages operation history (operations array)                 │
│  • Provides undo/redo stack management                          │
│  • Renders all strokes on HTML5 Canvas                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  WebSocket Manager (Client)                     │
│  • Emits drawing events to server                               │
│  • Listens for remote drawing events                            │
│  • Manages cursor position updates                              │
│  • Handles user join/leave notifications                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼ WebSocket Connection (Socket.io)
                           │
┌─────────────────────────────────────────────────────────────────┐
│                   Socket.io Server                              │
│  • Broadcasts drawing events to all clients                     │
│  • Maintains global operation history                           │
│  • Manages connected users and their states                     │
│  • Handles global undo/redo operations                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Server State Store                            │
│  • operations: Array of all drawing operations                  │
│  • users: Map of connected users (id, color, cursor)            │
└─────────────────────────────────────────────────────────────────┘
```
## WebSocket Protocol

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `draw:start` | `{ x, y, color, width, tool }` | User begins a stroke |
| `draw:move` | `{ x, y }` | User continues drawing (high frequency) |
| `draw:end` | `{ type, tool, color, width, points, timestamp }` | User completes a stroke |
| `cursor:move` | `{ x, y }` | User's cursor position (throttled) |
| `undo` | none | Request to undo last operation |
| `redo` | `{ operation }` | Request to redo an operation |
| `clear` | none | Request to clear entire canvas |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `init` | `{ userId, userColor, operations[], users[] }` | Initial state on connection |
| `user:joined` | `{ id, color, cursor }` | New user connected |
| `user:left` | `{ userId }` | User disconnected |
| `draw:start` | `{ x, y, color, width, tool, userId }` | Remote user started drawing |
| `draw:move` | `{ x, y, userId }` | Remote user drawing update |
| `draw:end` | `{ userId, operationId, ...operation }` | Remote user finished stroke |
| `cursor:move` | `{ userId, x, y }` | Remote user's cursor moved |
| `operation:undo` | `{ operationId }` | Global undo performed |
| `operation:redo` | `{ operation }` | Global redo performed |
| `canvas:clear` | none | Canvas was cleared |

### Message Format

Operations are serialized as plain JavaScript objects:

```javascript
{
  id: 1699123456789.123,        // Unique identifier
  type: 'stroke',               // Operation type
  tool: 'brush',                // Tool used (brush/eraser)
  color: '#FF0000',             // Stroke color
  width: 5,                     // Stroke width
  points: [                     // Array of path points
    { x: 100, y: 150 },
    { x: 102, y: 152 },
    ...
  ],
  timestamp: 1699123456789      // Creation timestamp
}
```

## Undo/Redo Strategy

### Global Operation History

The undo/redo system maintains a **global operation history** shared across all users:

```javascript
// Server-side state
drawingState = {
  operations: [],  // All operations in chronological order
  users: Map()     // Connected users
}

// Client-side state (Canvas Manager)
this.operations = [];  // Synchronized with server
this.redoStack = [];   // Local redo stack
```

### Undo Implementation

1. **User triggers undo** (Ctrl+Z or button click)
2. **Client** pops last operation from local stack
3. **Client** emits `undo` event to server
4. **Server** pops last operation from global operations array
5. **Server** broadcasts `operation:undo` with operation ID to ALL clients
6. **All clients** remove the operation and redraw canvas

```javascript
// Server
socket.on('undo', () => {
  if (drawingState.operations.length > 0) {
    const lastOp = drawingState.operations.pop();
    io.emit('operation:undo', { operationId: lastOp.id });
  }
});

// Client
canvasManager.undoOperation(operationId) {
  const index = this.operations.findIndex(op => op.id === operationId);
  if (index !== -1) {
    this.operations.splice(index, 1);
    this.redrawAll();  // Complete canvas redraw
  }
}
```

### Redo Implementation

1. **User triggers redo** (Ctrl+Y)
2. **Client** pops operation from redo stack
3. **Client** emits `redo` event with operation to server
4. **Server** adds operation back to global operations array
5. **Server** broadcasts `operation:redo` to ALL clients
6. **All clients** add operation and redraw

## Performance Decisions

### 1. Event Throttling

**Problem**: Mouse move events fire at 60+ times per second, overwhelming the network.

**Solution**: Throttle cursor position updates to 50ms intervals:

```javascript
let lastCursorEmit = 0;
const CURSOR_THROTTLE = 50;  // milliseconds

if (now - lastCursorEmit > CURSOR_THROTTLE) {
  this.wsManager.emitCursorMove(x, y);
  lastCursorEmit = now;
}
```

**Drawing events** are NOT throttled to preserve stroke accuracy.

### 2. Canvas Rendering Strategy

**Problem**: Redrawing entire canvas on every operation is slow.

**Solution**: Incremental drawing with occasional full redraws:

```javascript
// During drawing: Draw only new segments
draw(x, y) {
  this.ctx.lineTo(x, y);
  this.ctx.stroke();
}

// On undo/redo: Full redraw required
redrawAll() {
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  this.operations.forEach(op => this.drawOperation(op));
}
```

### 3. High-DPI Display Support

**Problem**: Canvas appears blurry on high-DPI screens (Retina, 4K).

**Solution**: Scale canvas by device pixel ratio:

```javascript
resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  this.canvas.width = rect.width * dpr;
  this.canvas.height = rect.height * dpr;
  this.ctx.scale(dpr, dpr);
}
```

### 4. Path Optimization

**Problem**: Storing every single mouse position creates huge data structures.

**Solution**: Store all points (no optimization) for accuracy. Future optimization could use:
- **Douglas-Peucker algorithm** to reduce point count
- **Bezier curve fitting** to smooth paths
- **Point sampling** at fixed intervals

### 5. Memory Management

**Current approach**: Store all operations in memory (server & client).

**Limitations**:
- Server memory grows unbounded
- No persistence after server restart
- Not suitable for production

**Production solutions** (not implemented):
- Database persistence (PostgreSQL, MongoDB)
- Operation log pruning/archiving
- Canvas state snapshots + deltas

## Conflict Resolution

### Overlapping Strokes

**Problem**: What happens when two users draw in the same area simultaneously?

**Solution**: Last-write-wins with operation ordering:

```javascript
// Server maintains operation order
drawingState.operations.push(operation);

// All clients apply operations in chronological order
this.operations.forEach(op => this.drawOperation(op));
```

**Result**: Strokes are layered in the order they were completed, not started. This creates a natural "layers" effect.

### Visual Example

```
User A draws red line:   ─────────
User B draws blue line:  ─────────
Result:                  Red then blue overlap
```

### Eraser Conflicts

**Problem**: Eraser removes pixels, not operations. What if User A erases while User B is drawing?

**Solution**: Eraser treated as a stroke with `destination-out` composite operation:

```javascript
ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
```

**Result**: Eraser operations are layered like normal strokes. Subsequent drawings can appear "over" erased areas.

### Undo/Redo Conflicts

**Problem**: User A undoes while User B is drawing.

**Solution**:
- Undo removes operations from global history immediately
- In-progress strokes are not affected (not in history yet)
- When User B completes stroke, it's added to the updated history

**Edge Case**: If User B's in-progress stroke overlaps with undone stroke, the overlap remains until full redraw.

### Network Latency

**Problem**: Network delays cause drawings to appear out of order.

**Solution**:
- Server is source of truth for operation order
- Clients apply operations in received order, not drawn order
- Timestamps used for operation IDs but not for ordering

### Current Limitations

1. **Single Server**: No horizontal scaling
2. **In-Memory State**: Lost on restart
3. **No Authentication**: Anyone can join
4. **No Room System**: All users share one canvas

