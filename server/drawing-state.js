export class DrawingState {
    constructor() {
      this.operations = [];
      this.users = new Map();
    }
  
    addOperation(operation) {
      this.operations.push(operation);
      return operation;
    }
  
    removeLastOperation() {
      return this.operations.pop();
    }
  
    clearOperations() {
      this.operations = [];
    }
  
    getOperations() {
      return this.operations;
    }
  
    addUser(userId, user) {
      this.users.set(userId, user);
    }
  
    removeUser(userId) {
      this.users.delete(userId);
    }
  
    getUser(userId) {
      return this.users.get(userId);
    }
  
    getUsers() {
      return Array.from(this.users.values());
    }
  
    updateUserCursor(userId, cursor) {
      const user = this.users.get(userId);
      if (user) {
        user.cursor = cursor;
      }
    }
  
    getUserCount() {
      return this.users.size;
    }
  }
  