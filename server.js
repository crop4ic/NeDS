import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'app.sqlite');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_PATH);

function initializeDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      tag TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'online',
      avatar TEXT
    );
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT
    );
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('text','voice','private')),
      description TEXT,
      UNIQUE(server_id, name),
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const hasUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c > 0;
  if (!hasUsers) {
    const insertUser = db.prepare('INSERT INTO users (username, tag, status, avatar) VALUES (?, ?, ?, ?)');
    [
      ['User1', '#1111', 'online', null],
      ['Bot', '#0001', 'online', null],
      ['Admin', '#9999', 'busy', null],
      ['User2', '#2222', 'offline', null],
      ['User3', '#3333', 'offline', null]
    ].forEach(u => insertUser.run(...u));
  }

  const hasServers = db.prepare('SELECT COUNT(*) as c FROM servers').get().c > 0;
  if (!hasServers) {
    const insertServer = db.prepare('INSERT INTO servers (name, icon) VALUES (?, ?)');
    insertServer.run('General Server', 'discord');
    insertServer.run('Gaming', 'gamepad');
    insertServer.run('Music', 'music');
    insertServer.run('Study', 'graduation-cap');
  }

  const serverByName = db.prepare('SELECT id FROM servers WHERE name = ?');
  const generalServerId = serverByName.get('General Server').id;

  const hasChannels = db.prepare('SELECT COUNT(*) as c FROM channels WHERE server_id = ?').get(generalServerId).c > 0;
  if (!hasChannels) {
    const insertChannel = db.prepare('INSERT INTO channels (server_id, name, type, description) VALUES (?, ?, ?, ?)');
    insertChannel.run(generalServerId, 'general', 'text', 'Общий канал для общения');
    insertChannel.run(generalServerId, 'random', 'text', 'Разное');
    insertChannel.run(generalServerId, 'help', 'text', 'Вопросы и помощь');
    insertChannel.run(generalServerId, 'private-chat', 'private', 'Приватный канал');
    insertChannel.run(generalServerId, 'voice-general', 'voice', 'Голосовой канал General');
    insertChannel.run(generalServerId, 'voice-music', 'voice', 'Голосовой канал Music');
  }

  const channelIdGeneral = db.prepare('SELECT id FROM channels WHERE name = ? AND server_id = ?').get('general', generalServerId).id;
  const hasMessages = db.prepare('SELECT COUNT(*) as c FROM messages WHERE channel_id = ?').get(channelIdGeneral).c > 0;
  if (!hasMessages) {
    const getUserId = db.prepare('SELECT id FROM users WHERE username = ?');
    const insertMsg = db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)');
    // sample messages (timestamps use default datetime('now'))
    insertMsg.run(channelIdGeneral, getUserId.get('User1').id, 'Привет всем! Как дела?');
    insertMsg.run(channelIdGeneral, getUserId.get('Bot').id, 'Привет! Все отлично, спасибо за вопрос!');
    insertMsg.run(channelIdGeneral, getUserId.get('Admin').id, 'Не забудьте про встречу завтра в 15:00');
  }
}
initializeDatabase();

// Utilities
function mapUserRow(u) {
  return { id: u.id, username: u.username, tag: u.tag, status: u.status, avatar: u.avatar };
}
function mapMessageRow(m) {
  return {
    id: m.id,
    channelId: m.channel_id,
    content: m.content,
    createdAt: m.created_at,
    user: { id: m.user_id, username: m.username, tag: m.tag }
  };
}

// REST API
app.get('/api/servers', (req, res) => {
  const servers = db.prepare('SELECT id, name, icon FROM servers ORDER BY id').all();
  res.json(servers);
});

app.get('/api/servers/:serverId/channels', (req, res) => {
  const { serverId } = req.params;
  const channels = db.prepare('SELECT id, name, type, description FROM channels WHERE server_id = ? ORDER BY id').all(serverId);
  res.json(channels);
});

app.get('/api/users', (req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
  res.json(rows.map(mapUserRow));
});

app.get('/api/channels/:channelId/messages', (req, res) => {
  const { channelId } = req.params;
  const limit = Number(req.query.limit ?? 100);
  const rows = db.prepare(`
    SELECT m.*, u.username, u.tag
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.channel_id = ?
    ORDER BY m.created_at ASC, m.id ASC
    LIMIT ?
  `).all(channelId, limit);
  res.json(rows.map(mapMessageRow));
});

app.post('/api/messages', (req, res) => {
  const { channelId, userId, content } = req.body ?? {};
  if (!channelId || !userId || !content || String(content).trim() === '') {
    return res.status(400).json({ error: 'channelId, userId, content required' });
  }
  const insert = db.prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)');
  const info = insert.run(channelId, userId, String(content).trim());
  const row = db.prepare(`
    SELECT m.*, u.username, u.tag
    FROM messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).get(info.lastInsertRowid);
  const message = mapMessageRow(row);
  io.to(`channel:${channelId}`).emit('message:new', message);
  res.status(201).json(message);
});

// Static
app.use(express.static(path.join(process.cwd(), 'public')));

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


