const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow Vercel frontend to connect
        methods: ["GET", "POST"]
    }
});

app.use(express.static('public'));

// Catch-all route to serve index.html for any remaining requests (SPA routing fallback)
app.get('*', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const roomTimers = new Map();

function startRoomTimer(code) {
    if (roomTimers.has(code)) {
        clearTimeout(roomTimers.get(code));
    }
    const timer = setTimeout(() => {
        const room = io.sockets.adapter.rooms.get(code);
        if (room && room.size <= 1) {
            io.to(code).emit('roomExpired');
            io.in(code).socketsLeave(code);
        }
        roomTimers.delete(code);
    }, 60000); // 1 minute expiration
    roomTimers.set(code, timer);
}

function clearRoomTimer(code) {
    if (roomTimers.has(code)) {
        clearTimeout(roomTimers.get(code));
        roomTimers.delete(code);
    }
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', () => {
        // Generate 4 digit code
        let code = Math.floor(1000 + Math.random() * 9000).toString();
        socket.join(code);
        socket.emit('roomCreated', code);
        startRoomTimer(code);
    });

    socket.on('joinRoom', (code) => {
        const room = io.sockets.adapter.rooms.get(code);

        if (!room) {
            return socket.emit('error', 'Room does not exist. Create a new one!');
        }

        if (room.size === 1) {
            socket.join(code);
            clearRoomTimer(code);
            socket.emit('roomJoined', code);
            socket.to(code).emit('userJoined');
        } else if (room.size >= 2) {
            socket.emit('error', 'Room is currently full.');
        }
    });

    socket.on('chatMessage', ({ room, message }) => {
        socket.to(room).emit('chatMessage', message);
    });

    socket.on('typing', (room) => {
        socket.to(room).emit('typing');
    });

    socket.on('stopTyping', (room) => {
        socket.to(room).emit('stopTyping');
    });

    socket.on('leaveRoom', (room) => {
        socket.leave(room);
        socket.to(room).emit('userLeft');
        // Let the remaining user know they are waiting again
        socket.to(room).emit('waitingForPartner');
        startRoomTimer(room);
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (room !== socket.id) {
                socket.to(room).emit('userLeft');
                socket.to(room).emit('waitingForPartner');
                startRoomTimer(room);
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
