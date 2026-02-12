from flask import Flask, render_template, request
from flask_socketio import SocketIO, join_room, emit
import os

app = Flask(__name__, static_folder='public', static_url_path='', template_folder='public')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Serve index.html
@app.route('/')
def index():
    return app.send_static_file('index.html')

# SocketIO Events
@socketio.on('join-room')
def on_join(room_id):
    join_room(room_id)
    print(f'User {request.sid} joined room {room_id}')
    emit('user-joined', request.sid, room=room_id, include_self=False)

@socketio.on('draw')
def on_draw(data):
    emit('draw', data, room=data['roomId'], include_self=False)

@socketio.on('draw-start')
def on_draw_start(data):
    emit('draw-start', data, room=data['roomId'], include_self=False)

@socketio.on('draw-end')
def on_draw_end(data):
    emit('draw-end', data, room=data['roomId'], include_self=False)

@socketio.on('draw-shape')
def on_draw_shape(data):
    emit('draw-shape', data, room=data['roomId'], include_self=False)

@socketio.on('clear-canvas')
def on_clear(room_id):
    emit('clear-canvas', room=room_id, include_self=False)

@socketio.on('connect')
def on_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def on_disconnect():
    print(f'Client disconnected: {request.sid}')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
