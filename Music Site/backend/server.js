require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Redis = require('ioredis');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  }
});

const redis = new Redis(REDIS_URL);
const REDIS_SET_KEY = 'mazdoor_wala_active_listeners';

// Clean up the set on server start in case of previous unclean shutdown (optional, 
// but if running multiple instances, this should be handled carefully. 
// For a single instance, it's safe to clear the set on startup.)
redis.del(REDIS_SET_KEY);

// Broadcast the current count to all clients
async function broadcastCount() {
  try {
    const count = await redis.scard(REDIS_SET_KEY);
    io.emit('count', count);
  } catch (err) {
    console.error('Error fetching listener count:', err);
  }
}

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  try {
    // We use a Redis SET instead of INCR/DECR. This ensures that if the server crashes
    // and disconnect events aren't fired, we don't end up with a permanently drifting
    // count. SCARD gets the accurate count of unique socket IDs currently connected.
    await redis.sadd(REDIS_SET_KEY, socket.id);
    await broadcastCount();
  } catch (err) {
    console.error('Redis Error on connection:', err);
  }

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.id}`);
    try {
      await redis.srem(REDIS_SET_KEY, socket.id);
      await broadcastCount();
    } catch (err) {
      console.error('Redis Error on disconnect:', err);
    }
  });
});

app.get('/health', async (req, res) => {
  try {
    const activeListeners = await redis.scard(REDIS_SET_KEY);
    res.json({ status: 'ok', activeListeners });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

const https = require('https');
app.get('/api/video-info/:id', (req, res) => {
    const videoId = req.params.id;
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    https.get(url, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
            try {
                if (response.statusCode === 200) {
                    const jsonData = JSON.parse(data);
                    res.json({ title: jsonData.title, author: jsonData.author_name });
                } else {
                    res.status(response.statusCode).json({ error: 'Failed to fetch' });
                }
            } catch (e) {
                res.status(500).json({ error: 'Parse error' });
            }
        });
    }).on('error', (err) => {
        res.status(500).json({ error: err.message });
    });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
