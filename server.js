const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8088;

// Servidor HTTP básico para que Render no devuelva error 426 al abrir la URL
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Servidor Trivia Help Desk Activo y Operando.');
});

// Adjuntamos el servidor WebSocket al mismo servidor HTTP
const wss = new WebSocket.Server({ server });

const rooms = {};

wss.on('connection', (ws) => {
    let currentRoom = null;
    let userName = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'CREATE_ROOM') {
                currentRoom = data.roomCode;
                rooms[currentRoom] = { host: ws, players: {} };
                console.log(`[HOST] Sala creada: ${currentRoom}`);
                ws.send(JSON.stringify({ type: 'ROOM_CREATED', roomCode: currentRoom }));
            }

            if (data.type === 'JOIN_ROOM') {
                currentRoom = data.roomCode;
                userName = data.name;

                if (rooms[currentRoom]) {
                    rooms[currentRoom].players[userName] = ws;
                    console.log(`[JUGADOR] '${userName}' se unió a la sala ${currentRoom}`);
                    
                    if (rooms[currentRoom].host && rooms[currentRoom].host.readyState === WebSocket.OPEN) {
                        rooms[currentRoom].host.send(JSON.stringify({ type: 'PLAYER_JOINED', name: userName }));
                    }
                    ws.send(JSON.stringify({ type: 'JOIN_ACK' }));
                } else {
                    ws.send(JSON.stringify({ type: 'ERROR', msg: 'Sala no encontrada.' }));
                }
            }

            if (data.type === 'BROADCAST_TO_PLAYERS' && rooms[currentRoom]) {
                Object.values(rooms[currentRoom].players).forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data.payload));
                    }
                });
            }

            if (data.type === 'SUBMIT_ANSWER' && rooms[currentRoom]) {
                if (rooms[currentRoom].host && rooms[currentRoom].host.readyState === WebSocket.OPEN) {
                    rooms[currentRoom].host.send(JSON.stringify({
                        type: 'PLAYER_ANSWERED',
                        name: userName,
                        isCorrect: data.isCorrect
                    }));
                }
            }
        } catch (err) {
            console.error('Error procesando mensaje:', err);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms[currentRoom] && userName) {
            delete rooms[currentRoom].players[userName];
        }
    });
});

server.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(` Servidor Activo en puerto ${PORT}`);
    console.log(`===========================================`);
});
