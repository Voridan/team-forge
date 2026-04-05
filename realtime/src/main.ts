import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';

const PORT = parseInt(process.env.PORT || '3001', 10);

const httpServer = createServer((_, res) => {
  // Health check endpoint
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'realtime' }));
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Real-time service listening on port ${PORT}`);
});

export { io, httpServer };
