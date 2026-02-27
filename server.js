const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('createRoom', () => {
    // Generate 4 digit code
    let code = Math.floor(1000 + Math.random() * 9000).toString();
    socket.join(code);
    socket.emit('roomCreated', code);
  });

  socket.on('joinRoom', (code) => {
    const room = io.sockets.adapter.rooms.get(code);
    if (room && room.size === 1) {
      socket.join(code);
      socket.emit('roomJoined', code);
      socket.to(code).emit('userJoined');
    } else if (room && room.size >= 2) {
      socket.emit('error', 'Room is full');
    } else {
      socket.emit('error', 'Room does not exist');
    }
  });

  socket.on('chatMessage', ({ room, message }) => {
    socket.to(room).emit('chatMessage', message);
  });

  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => {
      if (room !== socket.id) {
        socket.to(room).emit('userLeft');
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
