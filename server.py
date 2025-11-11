#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Discord-Style Messenger Backend
Flask + Socket.IO + JSON storage
"""
import os
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import socketio

# Initialize Flask app
app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

# Initialize Socket.IO
# Use 'eventlet' mode for production (supports WebSocket properly)
# Falls back to 'threading' if eventlet not available
try:
    import eventlet
    async_mode = 'eventlet'
except ImportError:
    async_mode = 'threading'

sio = socketio.Server(cors_allowed_origins="*", async_mode=async_mode)
socketio_app = socketio.WSGIApp(sio, app)

# Data storage
DATA_DIR = Path(__file__).parent / 'data'
STORE_PATH = DATA_DIR / 'store.json'
DATA_DIR.mkdir(exist_ok=True)

# Thread lock for data access
data_lock = threading.Lock()


class DataStore:
    def __init__(self, file_path):
        self.file_path = Path(file_path)
        self.data = self.load()

    def load(self):
        if self.file_path.exists():
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    raw = f.read().strip()
                    if raw:
                        parsed = json.loads(raw)
                        return self.normalize(parsed)
            except Exception as e:
                print(f'Не удалось прочитать файл данных, создаю заново. {e}')
        
        defaults = self.get_default_data()
        self.save(defaults)
        return defaults

    def normalize(self, data):
        clone = {
            'nextIds': data.get('nextIds', {}),
            'users': data.get('users', []) if isinstance(data.get('users'), list) else [],
            'servers': data.get('servers', []) if isinstance(data.get('servers'), list) else [],
            'channels': data.get('channels', []) if isinstance(data.get('channels'), list) else [],
            'messages': data.get('messages', []) if isinstance(data.get('messages'), list) else []
        }
        self.ensure_counters(clone)
        return clone

    def ensure_counters(self, data):
        def calc(arr):
            if not arr:
                return 1
            ids = [int(item.get('id', 0)) for item in arr if item.get('id')]
            return max(ids) + 1 if ids else 1
        
        data['nextIds']['user'] = data['nextIds'].get('user') or calc(data['users'])
        data['nextIds']['server'] = data['nextIds'].get('server') or calc(data['servers'])
        data['nextIds']['channel'] = data['nextIds'].get('channel') or calc(data['channels'])
        data['nextIds']['message'] = data['nextIds'].get('message') or calc(data['messages'])

    def get_default_data(self):
        now = datetime.now()
        iso_ago = lambda minutes: (now - timedelta(minutes=minutes)).isoformat()

        users = [
            {'id': 1, 'username': 'User1', 'tag': '#1111', 'status': 'online', 'avatar': None},
            {'id': 2, 'username': 'Bot', 'tag': '#0001', 'status': 'online', 'avatar': None},
            {'id': 3, 'username': 'Admin', 'tag': '#9999', 'status': 'busy', 'avatar': None},
            {'id': 4, 'username': 'User2', 'tag': '#2222', 'status': 'offline', 'avatar': None},
            {'id': 5, 'username': 'User3', 'tag': '#3333', 'status': 'offline', 'avatar': None}
        ]

        servers = [
            {'id': 1, 'name': 'General Server', 'icon': 'discord'},
            {'id': 2, 'name': 'Gaming', 'icon': 'gamepad'},
            {'id': 3, 'name': 'Music', 'icon': 'music'},
            {'id': 4, 'name': 'Study', 'icon': 'graduation-cap'}
        ]

        channels = [
            {'id': 1, 'serverId': 1, 'name': 'general', 'type': 'text', 'description': 'Общий канал для общения'},
            {'id': 2, 'serverId': 1, 'name': 'random', 'type': 'text', 'description': 'Разное'},
            {'id': 3, 'serverId': 1, 'name': 'help', 'type': 'text', 'description': 'Вопросы и помощь'},
            {'id': 4, 'serverId': 1, 'name': 'private-chat', 'type': 'private', 'description': 'Приватный канал'},
            {'id': 5, 'serverId': 1, 'name': 'voice-general', 'type': 'voice', 'description': 'Голосовой канал General'},
            {'id': 6, 'serverId': 1, 'name': 'voice-music', 'type': 'voice', 'description': 'Голосовой канал Music'}
        ]

        messages = [
            {'id': 1, 'channelId': 1, 'userId': 1, 'content': 'Привет всем! Как дела?', 'createdAt': iso_ago(20)},
            {'id': 2, 'channelId': 1, 'userId': 2, 'content': 'Привет! Все отлично, спасибо за вопрос!', 'createdAt': iso_ago(18)},
            {'id': 3, 'channelId': 1, 'userId': 3, 'content': 'Не забудьте про встречу завтра в 15:00', 'createdAt': iso_ago(10)}
        ]

        return {
            'nextIds': {
                'user': len(users) + 1,
                'server': len(servers) + 1,
                'channel': len(channels) + 1,
                'message': len(messages) + 1
            },
            'users': users,
            'servers': servers,
            'channels': channels,
            'messages': messages
        }

    def save(self, data=None):
        with data_lock:
            if data is not None:
                self.data = data
            with open(self.file_path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)

    def get_servers(self):
        with data_lock:
            return self.data['servers'].copy()

    def get_channels_by_server(self, server_id):
        with data_lock:
            server_id = int(server_id)
            return [c for c in self.data['channels'] if int(c.get('serverId', 0)) == server_id]

    def get_users(self):
        with data_lock:
            return self.data['users'].copy()

    def get_user_by_id(self, user_id):
        with data_lock:
            user_id = int(user_id)
            return next((u for u in self.data['users'] if int(u.get('id', 0)) == user_id), None)

    def get_channel_by_id(self, channel_id):
        with data_lock:
            channel_id = int(channel_id)
            return next((c for c in self.data['channels'] if int(c.get('id', 0)) == channel_id), None)

    def get_messages_by_channel(self, channel_id, limit=100):
        with data_lock:
            channel_id = int(channel_id)
            filtered = [m for m in self.data['messages'] if int(m.get('channelId', 0)) == channel_id]
            filtered.sort(key=lambda m: (
                datetime.fromisoformat(m.get('createdAt', '1970-01-01')).timestamp(),
                int(m.get('id', 0))
            ))
            limited = filtered[-limit:] if len(filtered) > limit else filtered
            return [self.hydrate_message(m) for m in limited]

    def hydrate_message(self, message):
        user = self.get_user_by_id(message.get('userId'))
        return {
            'id': message.get('id'),
            'channelId': message.get('channelId'),
            'content': message.get('content'),
            'createdAt': message.get('createdAt'),
            'user': {
                'id': user['id'],
                'username': user['username'],
                'tag': user['tag']
            } if user else None
        }

    def add_message(self, channel_id, user_id, content):
        with data_lock:
            channel = self.get_channel_by_id(channel_id)
            if not channel:
                raise ValueError('CHANNEL_NOT_FOUND')
            
            user = self.get_user_by_id(user_id)
            if not user:
                raise ValueError('USER_NOT_FOUND')
            
            message = {
                'id': self.data['nextIds']['message'],
                'channelId': int(channel_id),
                'userId': int(user_id),
                'content': str(content).strip(),
                'createdAt': datetime.now().isoformat()
            }
            self.data['nextIds']['message'] += 1
            self.data['messages'].append(message)
            self.save()
            return self.hydrate_message(message)


# Initialize store
store = DataStore(STORE_PATH)


# REST API Routes
@app.route('/api/servers', methods=['GET'])
def get_servers():
    return jsonify(store.get_servers())


@app.route('/api/servers/<int:server_id>/channels', methods=['GET'])
def get_channels(server_id):
    channels = store.get_channels_by_server(server_id)
    return jsonify(channels)


@app.route('/api/users', methods=['GET'])
def get_users():
    return jsonify(store.get_users())


@app.route('/api/channels/<int:channel_id>/messages', methods=['GET'])
def get_messages(channel_id):
    limit = request.args.get('limit', 100, type=int)
    messages = store.get_messages_by_channel(channel_id, limit)
    return jsonify(messages)


@app.route('/api/messages', methods=['POST'])
def post_message():
    data = request.get_json() or {}
    channel_id = data.get('channelId')
    user_id = data.get('userId')
    content = data.get('content', '').strip()
    
    if not channel_id or not user_id or not content:
        return jsonify({'error': 'channelId, userId, content required'}), 400
    
    try:
        message = store.add_message(channel_id, user_id, content)
        sio.emit('message:new', message, room=f'channel:{channel_id}')
        return jsonify(message), 201
    except ValueError as e:
        error_code = str(e)
        if error_code == 'CHANNEL_NOT_FOUND':
            return jsonify({'error': 'Channel not found'}), 404
        if error_code == 'USER_NOT_FOUND':
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        print(f'Failed to add message: {e}')
        return jsonify({'error': 'Failed to add message'}), 500


# Serve static files
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


# Socket.IO Events
@sio.event
def connect(sid, environ):
    print(f'Client connected: {sid}')


@sio.event
def disconnect(sid):
    print(f'Client disconnected: {sid}')


def handle_channel_join(sid, data):
    """Handle channel:join event"""
    channel_id = data.get('channelId')
    if channel_id:
        # Leave all channel rooms
        rooms = sio.rooms(sid)
        for room in rooms:
            if room.startswith('channel:'):
                sio.leave_room(sid, room)
        # Join new channel room
        sio.enter_room(sid, f'channel:{channel_id}')


# Register the channel:join event handler (custom event name with colon)
sio.on('channel:join', handle_channel_join)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    
    # Use eventlet for production (supports WebSocket)
    # This is required for Socket.IO to work properly
    try:
        import eventlet
        eventlet.monkey_patch()  # Patch standard library for async
        print(f'Server running on http://0.0.0.0:{port} (eventlet)')
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', port)), socketio_app, log_output=False)
    except ImportError:
        print('ERROR: eventlet not installed!')
        print('Install it with: pip install eventlet')
        print('This is required for Socket.IO WebSocket support.')
        exit(1)
    except Exception as e:
        print(f'ERROR starting server: {e}')
        exit(1)

