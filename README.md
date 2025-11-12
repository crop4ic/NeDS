# Discord-Style Messenger

Полноценный мессенджер в стиле Discord с реальной базой данных, перепиской и кликабельными кнопками.

## Технологии

- **Backend**: Node.js + Express + Socket.IO
- **Frontend**: HTML/CSS/JavaScript (Discord-style UI)
- **База данных**: JSON файл (легко заменить на SQLite/PostgreSQL)

## Установка и запуск

### 1. Установи Node.js 20+

Проверь версию:
```bash
node --version
```

### 2. Установи зависимости

```bash
npm install
```

### 3. Запусти сервер

```bash
npm run dev
# или
npm start
```

Сервер запустится на `http://localhost:3000`

### 4. Открой в браузере

Открой `http://localhost:3000` и используй мессенджер!

## Возможности

- ✅ Список серверов и каналов
- ✅ Реальная переписка с сохранением в БД
- ✅ Realtime обновления через Socket.IO
- ✅ Список пользователей с статусами
- ✅ Кликабельные кнопки и модальные окна
- ✅ Поиск каналов
- ✅ Эмодзи пикер

## Структура проекта

```
NeDS/
├── server.js          # Node.js backend (Express + Socket.IO)
├── package.json       # Node.js зависимости
├── public/
│   └── index.html     # Frontend
├── data/
│   └── store.json     # База данных (создаётся автоматически)
└── README.md
```

## API Endpoints

- `GET /api/servers` - Список серверов
- `GET /api/servers/:serverId/channels` - Каналы сервера
- `GET /api/users` - Список пользователей
- `GET /api/channels/:channelId/messages` - Сообщения канала
- `POST /api/messages` - Отправить сообщение

## Socket.IO Events

- `channel:join` - Присоединиться к каналу
- `message:new` - Новое сообщение (broadcast)

## Деплой

### Render.com

1. Создай новый **Web Service**
2. Подключи GitHub репозиторий
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Root Directory**: оставь пустым
6. **Environment Variables**: не нужны (PORT устанавливается автоматически)
7. **Node Version**: выбери Node.js 20.x
8. Включи **Auto-Deploy** если нужно

### Другие платформы

Проект работает на любом хостинге с поддержкой Node.js:
- Railway
- Fly.io
- Heroku
- DigitalOcean App Platform
- Vercel (serverless)

## Лицензия

MIT

