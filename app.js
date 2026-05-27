let ws;
let myUsername = localStorage.getItem('chat_username') || '';
let myRoomCode = localStorage.getItem('chat_roomCode') || '';
let myUserId = localStorage.getItem('chat_userId') || Math.random().toString(36).substring(2, 11);
let isHostInstance = localStorage.getItem('chat_isHost') === 'true';

// SAVE YOUR LIVE BACKEND URL HERE (Omit the trailing slash)
const PRODUCTION_BACKEND_URL = "https://discord-lite-backend.onrender.com/";

localStorage.setItem('chat_userId', myUserId);

window.addEventListener('DOMContentLoaded', () => {
    if (myUsername && myRoomCode) {
        document.getElementById('username').value = myUsername;
        document.getElementById('room-code').value = myRoomCode;
        initChat(isHostInstance, true);
    }
});

function initChat(isHost, isRestoring = false) {
    if (!isRestoring) {
        myUsername = document.getElementById('username').value.trim();
        myRoomCode = document.getElementById('room-code').value.trim();
        isHostInstance = isHost;

        if (!myUsername || !myRoomCode) {
            alert('Please fill out all fields completely.');
            return;
        }

        localStorage.setItem('chat_username', myUsername);
        localStorage.setItem('chat_roomCode', myRoomCode);
        localStorage.setItem('chat_isHost', isHostInstance ? 'true' : 'false');
    }

    // Determine if connecting locally or to production deployment
    let backendUrl;
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        backendUrl = "ws://localhost:8080";
    } else {
        // Automatically switches secure WebSockets (wss://) based on your HTTPS url
        backendUrl = PRODUCTION_BACKEND_URL.replace(/^http/, "ws");
    }

    ws = new WebSocket(backendUrl);

    ws.onopen = () => {
        ws.send(JSON.stringify({
            type: 'join_or_restore',
            roomCode: myRoomCode,
            username: myUsername,
            userId: myUserId,
            isHost: isHostInstance
        }));

        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('chat-screen').classList.remove('hidden');
        document.getElementById('display-room').innerText = myRoomCode;
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'history') {
            document.getElementById('chat-messages').innerHTML = ''; 
            data.data.forEach(msg => appendMessage(msg));
            
            if (data.isHostUser) {
                document.getElementById('host-badge').classList.remove('hidden');
                document.getElementById('btn-stop-action').classList.remove('hidden');
                document.getElementById('btn-leave-action').classList.add('hidden');
            }
        } else if (data.type === 'room_destroyed') {
            alert(data.message);
            clearLocalSession();
        } else {
            appendMessage(data);
        }
    };

    ws.onclose = () => {
        if (localStorage.getItem('chat_roomCode')) {
            console.log("WebSocket lost connection. Retrying sync loop...");
            setTimeout(() => initChat(isHostInstance, true), 3000);
        }
    };

    setupInputListeners();
}

function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    if (!message) return;

    ws.send(JSON.stringify({
        type: 'chat',
        username: myUsername,
        content: message
    }));
    input.value = '';
}

function leaveRoom() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_room', username: myUsername }));
    }
    clearLocalSession();
}

function stopRoom() {
    if (confirm("Are you sure you want to completely destroy this room server?")) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stop_room' }));
        }
    }
}

function clearLocalSession() {
    localStorage.removeItem('chat_username');
    localStorage.removeItem('chat_roomCode');
    localStorage.removeItem('chat_isHost');
    window.location.reload();
}

function setupInputListeners() {
    const msgInput = document.getElementById('message-input');
    if (!msgInput.dataset.hasListener) {
        msgInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        document.getElementById('image-input').addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    ws.send(JSON.stringify({
                        type: 'image',
                        username: myUsername,
                        content: e.target.result
                    }));
                };
                reader.readAsDataURL(this.files[0]);
            }
        });
        msgInput.dataset.hasListener = "true";
    }
}

function appendMessage(data) {
    const container = document.getElementById('chat-messages');

    if (data.type === 'system') {
        const sysDiv = document.createElement('div');
        sysDiv.className = 'system-msg';
        sysDiv.innerText = data.message;
        container.appendChild(sysDiv);
    } else {
        const isSelf = data.user === myUsername;
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${isSelf ? 'self' : ''}`;

        let contentPayload = (data.type === 'image') 
            ? `<img src="${data.content}" class="msg-img"/>`
            : `<div class="msg-bubble">${data.content}</div>`;

        msgDiv.innerHTML = `
            <div class="msg-meta">
                <span class="user-tag">${data.user}</span>
                <span class="timestamp">${data.timestamp}</span>
            </div>
            ${contentPayload}
        `;
        container.appendChild(msgDiv);
    }
    container.scrollTop = container.scrollHeight;
}