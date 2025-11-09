import { DrawingState } from './drawing-state.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new DrawingState());
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  getRoomOrCreate(roomId) {
    if (!this.rooms.has(roomId)) {
      this.createRoom(roomId);
    }
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  hasRoom(roomId) {
    return this.rooms.has(roomId);
  }

  getRoomCount() {
    return this.rooms.size;
  }

  cleanEmptyRooms() {
    for (const [roomId, state] of this.rooms.entries()) {
      if (state.getUserCount() === 0) {
        this.deleteRoom(roomId);
      }
    }
  }
}
