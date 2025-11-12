import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

class DataStore {
  constructor(filePath) {
    this.filePath = filePath;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          return this.normalize(parsed);
        }
      } catch (err) {
        console.warn('Не удалось прочитать файл данных, создаю заново.', err);
      }
    }
    const defaults = this.getDefaultData();
    this.save(defaults);
    return defaults;
  }

  normalize(data) {
    const clone = {
      nextIds: data.nextIds ?? {},
      users: Array.isArray(data.users) ? data.users : [],
      servers: Array.isArray(data.servers) ? data.servers : [],
      channels: Array.isArray(data.channels) ? data.channels : [],
      messages: Array.isArray(data.messages) ? data.messages : []
    };
    this.ensureCounters(clone);
    return clone;
  }

  ensureCounters(data) {
    const calc = (arr) => (arr.length ? Math.max(...arr.map(item => Number(item.id) || 0)) + 1 : 1);
    data.nextIds.user = data.nextIds.user ?? calc(data.users);
    data.nextIds.server = data.nextIds.server ?? calc(data.servers);
    data.nextIds.channel = data.nextIds.channel ?? calc(data.channels);
    data.nextIds.message = data.nextIds.message ?? calc(data.messages);
  }

  getDefaultData() {
    const now = Date.now();
    const isoAgo = (minutes) => new Date(now - minutes * 60_000).toISOString();

    const users = [
      { id: 1, username: 'User1', tag: '#1111', status: 'online', avatar: null },
      { id: 2, username: 'Bot', tag: '#0001', status: 'online', avatar: null },
      { id: 3, username: 'Admin', tag: '#9999', status: 'busy', avatar: null },
      { id: 4, username: 'User2', tag: '#2222', status: 'offline', avatar: null },
      { id: 5, username: 'User3', tag: '#3333', status: 'offline', avatar: null }
    ];

    const servers = [
      { id: 1, name: 'General Server', icon: 'discord' },
      { id: 2, name: 'Gaming', icon: 'gamepad' },
      { id: 3, name: 'Music', icon: 'music' },
      { id: 4, name: 'Study', icon: 'graduation-cap' }
    ];

    const channels = [
      { id: 1, serverId: 1, name: 'general', type: 'text', description: 'Общий канал для общения' },
      { id: 2, serverId: 1, name: 'random', type: 'text', description: 'Разное' },
      { id: 3, serverId: 1, name: 'help', type: 'text', description: 'Вопросы и помощь' },
      { id: 4, serverId: 1, name: 'private-chat', type: 'private', description: 'Приватный канал' },
      { id: 5, serverId: 1, name: 'voice-general', type: 'voice', description: 'Голосовой канал General' },
      { id: 6, serverId: 1, name: 'voice-music', type: 'voice', description: 'Голосовой канал Music' }
    ];

    const messages = [
      { id: 1, channelId: 1, userId: 1, content: 'Привет всем! Как дела?', createdAt: isoAgo(20) },
      { id: 2, channelId: 1, userId: 2, content: 'Привет! Все отлично, спасибо за вопрос!', createdAt: isoAgo(18) },
      { id: 3, channelId: 1, userId: 3, content: 'Не забудьте про встречу завтра в 15:00', createdAt: isoAgo(10) }
    ];

    return {
      nextIds: {
        user: users.length + 1,
        server: servers.length + 1,
        channel: channels.length + 1,
        message: messages.length + 1
      },
      users,
      servers,
      channels,
      messages
    };
  }

  save(data = this.data) {
    this.data = data;
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  getServers() {
    return this.data.servers;
  }

  getChannelsByServer(serverId) {
    return this.data.channels.filter(c => Number(c.serverId) === Number(serverId));
  }

  getUsers() {
    return this.data.users;
  }

  getUserById(userId) {
    return this.data.users.find(u => Number(u.id) === Number(userId)) ?? null;
  }

  getChannelById(channelId) {
    return this.data.channels.find(c => Number(c.id) === Number(channelId)) ?? null;
  }

  getMessagesByChannel(channelId, limit = 100) {
    const filtered = this.data.messages
      .filter(m => Number(m.channelId) === Number(channelId))
      .sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return diff !== 0 ? diff : Number(a.id) - Number(b.id);
      });
    const limited = filtered.slice(-limit);
    return limited.map(m => this.hydrateMessage(m));
  }

  hydrateMessage(message) {
    const user = this.getUserById(message.userId);
    return {
      id: message.id,
      channelId: message.channelId,
      content: message.content,
      createdAt: message.createdAt,
      user: user ? { id: user.id, username: user.username, tag: user.tag } : null
    };
  }

  addMessage(channelId, userId, content) {
    const channel = this.getChannelById(channelId);
    if (!channel) {
      const err = new Error('Channel not found');
      err.code = 'CHANNEL_NOT_FOUND';
      throw err;
    }
    const user = this.getUserById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.code = 'USER_NOT_FOUND';
      throw err;
    }
    const message = {
      id: this.data.nextIds.message++,
      channelId: Number(channelId),
      userId: Number(userId),
      content: String(content).trim(),
      createdAt: new Date().toISOString()
    };
    this.data.messages.push(message);
    this.save();
    return this.hydrateMessage(message);
  }
}

const store = new DataStore(STORE_PATH);

// REST API
app.get('/api/servers', (req, res) => {
  res.json(store.getServers());
});

app.get('/api/servers/:serverId/channels', (req, res) => {
  const serverId = Number(req.params.serverId);
  if (Number.isNaN(serverId)) {
    return res.status(400).json({ error: 'Invalid serverId' });
  }
  const channels = store.getChannelsByServer(serverId);
  res.json(channels);
});

app.get('/api/users', (req, res) => {
  res.json(store.getUsers());
});

app.get('/api/channels/:channelId/messages', (req, res) => {
  const channelId = Number(req.params.channelId);
  if (Number.isNaN(channelId)) {
    return res.status(400).json({ error: 'Invalid channelId' });
  }
  const limit = Number(req.query.limit ?? 100);
  const messages = store.getMessagesByChannel(channelId, Number.isNaN(limit) ? 100 : limit);
  res.json(messages);
});

app.post('/api/messages', (req, res) => {
  const { channelId, userId, content } = req.body ?? {};
  if (!channelId || !userId || !content || String(content).trim() === '') {
    return res.status(400).json({ error: 'channelId, userId, content required' });
  }
  try {
    const message = store.addMessage(Number(channelId), Number(userId), String(content).trim());
    io.to(`channel:${channelId}`).emit('message:new', message);
    res.status(201).json(message);
  } catch (err) {
    if (err.code === 'CHANNEL_NOT_FOUND') {
      return res.status(404).json({ error: 'Channel not found' });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('Failed to add message', err);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO
io.on('connection', (socket) => {
  socket.on('channel:join', ({ channelId }) => {
    const rooms = [...socket.rooms].filter(r => r.startsWith('channel:'));
    rooms.forEach(r => socket.leave(r));
    if (channelId) socket.join(`channel:${channelId}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

