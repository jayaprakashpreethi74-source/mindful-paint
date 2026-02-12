const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Store active rooms
const rooms = {};

io.on('connection', (socket) => {
    console.log('a user connected', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }
        rooms[roomId].push(socket.id);
        console.log(`User ${socket.id} joined room ${roomId}`);

        // Notify others in room
        socket.to(roomId).emit('user-joined', socket.id);
    });

    socket.on('draw-start', (data) => {
        socket.to(data.roomId).emit('draw-start', data);
    });

    socket.on('draw', (data) => {
        socket.to(data.roomId).emit('draw', data);
    });

    socket.on('draw-end', (data) => {
        socket.to(data.roomId).emit('draw-end', data);
    });

    socket.on('clear-canvas', (roomId) => {
        io.to(roomId).emit('clear-canvas');
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
        // Cleanup room logic later
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
