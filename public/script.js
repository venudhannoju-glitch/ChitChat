const socket = io();

// UI Elements
const landingView = document.getElementById('landing-view');
const chatView = document.getElementById('chat-view');
const createBtn = document.getElementById('create-btn');
const joinForm = document.getElementById('join-form');
const codeBoxes = document.querySelectorAll('.code-box');
const errorMsg = document.getElementById('error-msg');
const currentRoomCodeSpan = document.getElementById('current-room-code');
const chatStatus = document.getElementById('chat-status');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const copyBtn = document.getElementById('copy-btn');
const leaveBtn = document.getElementById('leave-btn');
const typingIndicator = document.getElementById('typing-indicator');

let currentRoom = null;
let typingTimeout = null;

// Event Listeners for UI
createBtn.addEventListener('click', () => {
    socket.emit('createRoom');
});

codeBoxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
        box.value = box.value.replace(/[^0-9]/g, '');
        if (box.value && index < codeBoxes.length - 1) {
            codeBoxes[index + 1].focus();
        }
    });

    box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && index > 0) {
            codeBoxes[index - 1].focus();
        }
    });

    box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 4);
        if (pastedData) {
            for (let i = 0; i < pastedData.length; i++) {
                if (codeBoxes[index + i]) {
                    codeBoxes[index + i].value = pastedData[i];
                    if (index + i < codeBoxes.length - 1) {
                        codeBoxes[index + i + 1].focus();
                    } else {
                        codeBoxes[index + i].focus();
                    }
                }
            }
        }
    });
});

joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = Array.from(codeBoxes).map(box => box.value).join('');
    if (code.length === 4) {
        socket.emit('joinRoom', code);
    } else {
        showError('Please enter a valid 4-digit code.');
    }
});

copyBtn.addEventListener('click', () => {
    if (currentRoom) {
        navigator.clipboard.writeText(currentRoom);
        const originalTitle = copyBtn.title;
        copyBtn.title = 'Copied!';
        setTimeout(() => copyBtn.title = originalTitle, 2000);
    }
});

leaveBtn.addEventListener('click', () => {
    if (currentRoom) {
        socket.emit('leaveRoom', currentRoom);
        resetToLanding();
    }
});

chatInput.addEventListener('input', () => {
    if (!currentRoom) return;
    socket.emit('typing', currentRoom);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stopTyping', currentRoom);
    }, 1000);
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (message && currentRoom) {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        appendMessage(message, 'sent', time);
        socket.emit('chatMessage', { room: currentRoom, message });
        socket.emit('stopTyping', currentRoom);
        chatInput.value = '';
    }
});

// Socket Events
socket.on('roomCreated', (code) => {
    currentRoom = code;
    showChatView(code);
    updateStatus('Waiting for partner...', 'waiting');
    addSystemMessage('Room created. Share the code ' + code + ' to chat.');
});

socket.on('roomJoined', (code) => {
    currentRoom = code;
    showChatView(code);
    enableChat();
    updateStatus('Connected', 'connected');
    addSystemMessage('Joined room ' + code);
});

socket.on('userJoined', () => {
    enableChat();
    updateStatus('Connected', 'connected');
    addSystemMessage('Your partner has joined the chat.');
});

socket.on('chatMessage', (message) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    appendMessage(message, 'received', time);
});

socket.on('typing', () => {
    typingIndicator.classList.remove('hidden');
});

socket.on('stopTyping', () => {
    typingIndicator.classList.add('hidden');
});

socket.on('userLeft', () => {
    disableChat();
    updateStatus('Partner left', 'disconnected');
    addSystemMessage('Your partner has left the chat.');
    typingIndicator.classList.add('hidden');
});

socket.on('waitingForPartner', () => {
    updateStatus('Waiting for partner...', 'waiting');
    addSystemMessage('You are now waiting for a new partner to join the room.');
});

socket.on('error', (msg) => {
    showError(msg);
});

// Helper Functions
function resetToLanding() {
    currentRoom = null;
    chatMessages.innerHTML = '';
    landingView.classList.add('active');
    chatView.classList.remove('active');
    codeBoxes.forEach(box => box.value = '');
    codeBoxes[0].focus();
    typingIndicator.classList.add('hidden');
}
function showChatView(code) {
    landingView.classList.remove('active');
    chatView.classList.add('active');
    currentRoomCodeSpan.textContent = code;
}

function showError(msg) {
    errorMsg.textContent = msg;
    setTimeout(() => { errorMsg.textContent = ''; }, 3000);
}

function updateStatus(text, state) {
    chatStatus.textContent = text;
    chatStatus.className = 'status ' + state;
}

function enableChat() {
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
}

function disableChat() {
    chatInput.disabled = true;
    sendBtn.disabled = true;
}

function appendMessage(text, type, time = '') {
    const el = document.createElement('div');
    el.classList.add('message', type);
    el.textContent = text;

    if (time) {
        const timeEl = document.createElement('span');
        timeEl.classList.add('timestamp');
        timeEl.textContent = time;
        el.appendChild(timeEl);
    }

    chatMessages.appendChild(el);
    scrollToBottom();
}

function addSystemMessage(text) {
    const el = document.createElement('div');
    el.classList.add('message', 'system-msg');
    el.textContent = text;
    chatMessages.appendChild(el);
    scrollToBottom();
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
