import http from "http";
import {Server} from "socket.io";

const server = http.createServer();
const io = new Server(server, { 
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Track active rooms and files
const roomData = new Map();

// Helper to get or create room data
function getRoomData(roomId) {
  if (!roomData.has(roomId)) {
    roomData.set(roomId, {
      files: new Map(), // fileName -> Set of socketIds
      sockets: new Map() // socketId -> { socketId, currentFiles: Set }
    });
  }
  return roomData.get(roomId);
}

// Helper to clean up empty rooms
function cleanupRoom(roomId) {
  const room = roomData.get(roomId);
  if (!room) return;
  
  if (room.sockets.size === 0) {
    roomData.delete(roomId);
    console.log(`Cleaned up empty room: ${roomId}`);
  }
}

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Handle joining a specific file in a room
  socket.on("join-file", ({ roomId, fileName }) => {
    console.log(`Socket ${socket.id} joining file "${fileName}" in room "${roomId}"`);
    
    // Join the socket.io room
    socket.join(roomId);
    
    const room = getRoomData(roomId);
    
    // Track socket in room
    if (!room.sockets.has(socket.id)) {
      room.sockets.set(socket.id, {
        socketId: socket.id,
        currentFiles: new Set()
      });
    }
    
    // Add socket to file tracking
    if (!room.files.has(fileName)) {
      room.files.set(fileName, new Set());
    }
    room.files.get(fileName).add(socket.id);
    room.sockets.get(socket.id).currentFiles.add(fileName);
    
    console.log(`Room ${roomId} now has ${room.sockets.size} sockets, file "${fileName}" has ${room.files.get(fileName).size} editors`);
  });

  // Handle leaving a specific file in a room
  socket.on("leave-file", ({ roomId, fileName }) => {
    console.log(`Socket ${socket.id} leaving file "${fileName}" in room "${roomId}"`);
    
    const room = roomData.get(roomId);
    if (!room) return;
    
    // Remove socket from file tracking
    if (room.files.has(fileName)) {
      room.files.get(fileName).delete(socket.id);
      if (room.files.get(fileName).size === 0) {
        room.files.delete(fileName);
        console.log(`File "${fileName}" no longer has any editors in room ${roomId}`);
        
        // Trigger final save for this file
        io.to(roomId).emit("save-final", { roomId, fileName });
      }
    }
    
    // Remove file from socket tracking
    if (room.sockets.has(socket.id)) {
      room.sockets.get(socket.id).currentFiles.delete(fileName);
    }
  });

  // Handle requesting sync for a specific file
  socket.on("request-file-sync", ({ roomId, fileName }) => {
    console.log(`Socket ${socket.id} requesting sync for file "${fileName}" in room "${roomId}"`);
    
    const room = roomData.get(roomId);
    if (!room || !room.files.has(fileName)) return;
    
    // Ask other clients editing this specific file to send their state
    const editorsInFile = room.files.get(fileName);
    editorsInFile.forEach(editorSocketId => {
      if (editorSocketId !== socket.id) {
        io.to(editorSocketId).emit("request-sync", { 
          requester: socket.id, 
          fileName 
        });
      }
    });
  });

  // Relay YJS updates to other clients editing the same file
  socket.on("yjs-update", ({ roomId, fileName, update }) => {
    const room = roomData.get(roomId);
    if (!room || !room.files.has(fileName)) return;
    
    // Only send to other clients editing this specific file
    const editorsInFile = room.files.get(fileName);
    editorsInFile.forEach(editorSocketId => {
      if (editorSocketId !== socket.id) {
        io.to(editorSocketId).emit("yjs-update", { update, fileName });
      }
    });
  });

  // Handle direct sync replies
  socket.on("reply-sync", ({ to, fileName, update }) => {
    if (to) {
      io.to(to).emit("yjs-update", { update, fileName });
    }
  });

  // Legacy support for simple room joining (fallback)
  socket.on("join-room", (roomId) => {
    console.log(`Socket ${socket.id} joining room (legacy): ${roomId}`);
    socket.join(roomId);
    
    // Ask other clients in the room to send their state
    socket.to(roomId).emit("request-sync", { requester: socket.id });
  });

  // Handle socket disconnection
  socket.on("disconnect", (reason) => {
    console.log(`Socket ${socket.id} disconnected: ${reason}`);
    
    // Clean up from all rooms and files
    for (const [roomId, room] of roomData.entries()) {
      if (room.sockets.has(socket.id)) {
        const socketData = room.sockets.get(socket.id);
        
        // Remove from all files this socket was editing
        for (const fileName of socketData.currentFiles) {
          if (room.files.has(fileName)) {
            room.files.get(fileName).delete(socket.id);
            
            // If no more editors for this file, trigger final save
            if (room.files.get(fileName).size === 0) {
              room.files.delete(fileName);
              console.log(`File "${fileName}" no longer has any editors in room ${roomId} (socket disconnected)`);
              io.to(roomId).emit("save-final", { roomId, fileName });
            }
          }
        }
        
        // Remove socket from room
        room.sockets.delete(socket.id);
        cleanupRoom(roomId);
      }
    }
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(`Socket ${socket.id} error:`, error);
  });
});

// Cleanup interval to remove stale data
setInterval(() => {
  let cleaned = 0;
  
  for (const [roomId, room] of roomData.entries()) {
    // Check for disconnected sockets that weren't properly cleaned up
    const socketsToRemove = [];
    
    room.sockets.forEach((socketData, socketId) => {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket || !socket.connected) {
        socketsToRemove.push(socketId);
      }
    });
    
    // Clean up disconnected sockets
    for (const socketId of socketsToRemove) {
      const socketData = room.sockets.get(socketId);
      if (socketData) {
        for (const fileName of socketData.currentFiles) {
          if (room.files.has(fileName)) {
            room.files.get(fileName).delete(socketId);
            if (room.files.get(fileName).size === 0) {
              room.files.delete(fileName);
            }
          }
        }
        room.sockets.delete(socketId);
        cleaned++;
      }
    }
    
    // Clean up empty room
    if (room.sockets.size === 0) {
      roomData.delete(roomId);
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} stale socket connections`);
  }
}, 60000); // Run every minute

// Server status endpoint
server.on('request', (req, res) => {
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connectedSockets: io.sockets.sockets.size,
      activeRooms: roomData.size,
      roomDetails: Array.from(roomData.entries()).map(([roomId, room]) => ({
        roomId,
        sockets: room.sockets.size,
        files: Array.from(room.files.entries()).map(([fileName, editors]) => ({
          fileName,
          editors: editors.size
        }))
      }))
    }, null, 2));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Y-relay server running on port ${PORT}`);
  console.log(`Status endpoint available at http://localhost:${PORT}/status`);
});