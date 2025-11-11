# Discord-Style Messenger

Полноценный мессенджер в стиле Discord с реальной базой данных, перепиской и кликабельными кнопками.

## Технологии

- **Backend**: Python 3 + Flask + Socket.IO
- **Frontend**: HTML/CSS/JavaScript (Discord-style UI)
- **База данных**: JSON файл (легко заменить на SQLite/PostgreSQL)

## Установка и запуск

### 1. Установи Python 3.8+

Проверь версию:
```bash
python --version
# или
python3 --version
```

### 2. Установи зависимости

```bash
pip install -r requirements.txt
# или
pip3 install -r requirements.txt
```

### 3. Запусти сервер

```bash
python server.py
# или
python3 server.py
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
├── server.py          # Python backend (Flask + Socket.IO)
├── requirements.txt   # Python зависимости
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

1. Создай новый Web Service
2. Подключи GitHub репозиторий
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `python server.py`
5. Добавь переменную окружения `PORT` (Render установит автоматически)

### Другие платформы

Проект работает на любом хостинге с поддержкой Python 3:
- Railway
- Fly.io
- Heroku
- DigitalOcean App Platform

## Лицензия

MIT

