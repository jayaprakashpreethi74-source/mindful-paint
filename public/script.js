const socket = io();
const canvas = document.getElementById("drawing-board");
const ctx = canvas.getContext("2d");

// Responsive Canvas
canvas.width = document.querySelector('.canvas-wrapper').clientWidth;
canvas.height = document.querySelector('.canvas-wrapper').clientHeight;

window.addEventListener('resize', () => {
    canvas.width = document.querySelector('.canvas-wrapper').clientWidth;
    canvas.height = document.querySelector('.canvas-wrapper').clientHeight;
});

// App State
const state = {
    isPainting: false,
    tool: 'pen', // 'pen', 'brush', 'marker', 'eraser', 'spray', 'line', 'rectangle', 'circle', 'ellipse', 'triangle', 'star'
    color: '#2D3436',
    lineWidth: 5,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    snapshot: null,
    symmetry: false,
    isZenMode: false,
    roomId: null,
    history: [],
    historyStep: -1
};

// --- Collaborative Drawing Logic ---
function startPosition(e) {
    state.isPainting = true;
    const rect = canvas.getBoundingClientRect();
    state.startX = e.clientX - rect.left;
    state.startY = e.clientY - rect.top;

    // Save snapshot for shapes to avoid trails
    if (['line', 'rectangle', 'circle', 'ellipse', 'triangle', 'star'].includes(state.tool)) {
        state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    draw(e);
}

function finishedPosition(e) {
    if (!state.isPainting) return;
    state.isPainting = false;
    ctx.beginPath();

    // Handle shape finalization and emit
    if (['line', 'rectangle', 'circle', 'ellipse', 'triangle', 'star'].includes(state.tool)) {
        const rect = canvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        if (state.roomId) {
            socket.emit('draw-shape', {
                roomId: state.roomId,
                type: state.tool,
                startX: state.startX,
                startY: state.startY,
                endX: endX,
                endY: endY,
                color: state.color,
                width: state.lineWidth
            });
        }
    }

    // Save to history after drawing is complete
    saveToHistory();
}

function draw(e) {
    if (!state.isPainting) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (['line', 'rectangle', 'circle'].includes(state.tool)) {
        // Restore snapshot to clear previous frame of shape
        if (state.snapshot) {
            ctx.putImageData(state.snapshot, 0, 0);
        }
        drawShape(state.tool, state.startX, state.startY, x, y, state.color, state.lineWidth);
    } else if (state.tool === 'spray') {
        sprayPaint(x, y, state.color, state.lineWidth);
        if (state.roomId) {
            socket.emit('draw', {
                roomId: state.roomId,
                x: x,
                y: y,
                color: state.color,
                width: state.lineWidth,
                tool: 'spray'
            });
        }
    } else {
        // Normal drawing (Pen, Brush, Marker, Eraser)
        drawOnCanvas(x, y, state.color, state.lineWidth, state.tool);

        // Broadcast if in a room
        if (state.roomId) {
            socket.emit('draw', {
                roomId: state.roomId,
                x: x,
                y: y,
                color: state.color,
                width: state.lineWidth,
                tool: state.tool
            });
        }

        if (state.symmetry) {
            const symX = canvas.width - x;
            drawOnCanvas(symX, y, state.color, state.lineWidth, state.tool);
        }
    }

    state.lastX = x;
    state.lastY = y;
}

function drawOnCanvas(x, y, color, width, tool) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'brush') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
    } else if (tool === 'marker') {
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = color; // Ensure color is set
    } else {
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    ctx.lineTo(x, y);
    ctx.stroke();

    // For smoother lines
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function sprayPaint(x, y, color, width) {
    ctx.fillStyle = color;
    const density = 20;
    for (let i = 0; i < density; i++) {
        const offset = width * 2; // Spread
        const offsetX = Math.random() * offset - offset / 2;
        const offsetY = Math.random() * offset - offset / 2;
        ctx.fillRect(x + offsetX, y + offsetY, 1, 1);
    }
}

function drawShape(type, startX, startY, endX, endY, color, width) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (type === 'line') {
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
    } else if (type === 'rectangle') {
        ctx.rect(startX, startY, endX - startX, endY - startY);
    } else if (type === 'circle') {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
    } else if (type === 'ellipse') {
        const radiusX = Math.abs(endX - startX) / 2;
        const radiusY = Math.abs(endY - startY) / 2;
        const centerX = startX + (endX - startX) / 2;
        const centerY = startY + (endY - startY) / 2;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    } else if (type === 'triangle') {
        const midX = (startX + endX) / 2;
        ctx.moveTo(midX, startY);
        ctx.lineTo(endX, endY);
        ctx.lineTo(startX, endY);
        ctx.closePath();
    } else if (type === 'star') {
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const outerRadius = Math.sqrt(Math.pow(endX - centerX, 2) + Math.pow(endY - centerY, 2));
        const innerRadius = outerRadius / 2;
        const spikes = 5;

        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / spikes - Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    }

    ctx.stroke();
}

// --- Zen AI Partner ---
let zenPartnerInterval;
let breathingInterval;
let kaleidoscopeMode = false;
let breathingMode = false;
function toggleZenMode() {
    state.isZenMode = !state.isZenMode;
    const btn = document.getElementById('ai-partner-btn');

    if (state.isZenMode) {
        btn.classList.add('active');
        btn.innerText = 'Stop Zen';
        startZenBot();
    } else {
        btn.classList.remove('active');
        btn.innerText = 'Zen Partner';
        clearInterval(zenPartnerInterval);
    }
}

function startZenBot() {
    let angle = 0;
    zenPartnerInterval = setInterval(() => {
        if (!state.isPainting) {
            // Mandalas or soft orbital lines
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = Math.abs(Math.sin(angle) * 200) + 50;

            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            const size = Math.random() * 15 + 2;

            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = getComplementaryColor(state.color);
            ctx.globalAlpha = 0.15;
            ctx.fill();
            ctx.globalAlpha = 1;

            angle += 0.1;
        }
    }, 100); // Faster but more subtle dots
}

function getComplementaryColor(hex) {
    // Return a soft relaxing color
    const colors = ["#A8E6CF", "#DCEDC1", "#FFD3B6", "#FFAAA5", "#6C5B7B"];
    return colors[Math.floor(Math.random() * colors.length)];
}

// --- History Management (Undo/Redo) ---
function saveToHistory() {
    // Remove any future states if we're not at the end
    state.history = state.history.slice(0, state.historyStep + 1);

    // Save current canvas state
    const canvasData = canvas.toDataURL();
    state.history.push(canvasData);
    state.historyStep++;

    // Limit history to 20 steps to save memory
    if (state.history.length > 20) {
        state.history.shift();
        state.historyStep--;
    }
}

function undo() {
    if (state.historyStep > 0) {
        state.historyStep--;
        restoreFromHistory();
    }
}

function redo() {
    if (state.historyStep < state.history.length - 1) {
        state.historyStep++;
        restoreFromHistory();
    }
}

function restoreFromHistory() {
    const img = new Image();
    img.src = state.history[state.historyStep];
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
    };
}

// --- Event Listeners ---
canvas.addEventListener("mousedown", startPosition);
canvas.addEventListener("mouseup", finishedPosition);
canvas.addEventListener("mousemove", draw);

document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const tool = e.target.getAttribute('data-tool');
        if (tool) {
            state.tool = tool;
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Adjust line width based on tool
            if (tool === 'pen') state.lineWidth = 2;
            if (tool === 'brush') state.lineWidth = 15;
            if (tool === 'marker') state.lineWidth = 10;
            if (tool === 'spray') state.lineWidth = 20;
            if (['line', 'rectangle', 'circle', 'ellipse', 'triangle', 'star'].includes(tool)) state.lineWidth = 3;
        }
    });
});

document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
        state.color = e.target.getAttribute('data-color');
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
    });
});

// Custom color picker
document.getElementById('custom-color').addEventListener('input', (e) => {
    state.color = e.target.value;
    // Remove active class from swatches when using custom color
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
});

document.getElementById('ai-partner-btn').addEventListener('click', toggleZenMode);

// Kaleidoscope mode
document.getElementById('kaleidoscope-btn').addEventListener('click', () => {
    kaleidoscopeMode = !kaleidoscopeMode;
    const btn = document.getElementById('kaleidoscope-btn');
    btn.classList.toggle('active');
    btn.innerText = kaleidoscopeMode ? 'Stop Kaleidoscope' : 'Kaleidoscope';
});

// Breathing mode
document.getElementById('breathing-btn').addEventListener('click', () => {
    breathingMode = !breathingMode;
    const btn = document.getElementById('breathing-btn');
    btn.classList.toggle('active');
    btn.innerText = breathingMode ? 'Stop Breathing' : 'Breathing';
    if (breathingMode) startBreathingMode();
    else clearInterval(breathingInterval);
});

function startBreathingMode() {
    let size = 50;
    let growing = true;
    breathingInterval = setInterval(() => {
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, size, 0, Math.PI * 2);
        ctx.strokeStyle = '#A8E6CF';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (growing) size += 2;
        else size -= 2;

        if (size >= 150) growing = false;
        if (size <= 50) growing = true;
    }, 50);
}

document.getElementById('symmetry-toggle').addEventListener('change', (e) => {
    state.symmetry = e.target.checked;
});

document.getElementById('clear-btn').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveToHistory();
});

document.getElementById('undo-btn').addEventListener('click', undo);
document.getElementById('redo-btn').addEventListener('click', redo);

// Save canvas as image
document.getElementById('save-btn').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `mindful-paint-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// Save initial blank state
saveToHistory();

// --- Socket.io Listeners ---
socket.on('draw', (data) => {
    if (data.tool === 'spray') {
        sprayPaint(data.x, data.y, data.color, data.width);
    } else {
        drawOnCanvas(data.x, data.y, data.color, data.width, data.tool);
    }
});

socket.on('draw-shape', (data) => {
    drawShape(data.type, data.startX, data.startY, data.endX, data.endY, data.color, data.width);
});

// Room Logic (Simple)
const roomModal = document.getElementById('room-modal');
const joinRoomBtn = document.getElementById('join-room-btn');
const createRoomBtn = document.getElementById('create-room-btn');
const closeModalBtn = document.getElementById('close-modal');
const backBtn = document.getElementById('back-btn');

document.getElementById('duo-btn').addEventListener('click', () => {
    roomModal.classList.remove('hidden');
    backBtn.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    roomModal.classList.add('hidden');
    backBtn.classList.add('hidden');
});

backBtn.addEventListener('click', () => {
    roomModal.classList.add('hidden');
    backBtn.classList.add('hidden');
    // Reset to solo mode
    document.getElementById('solo-btn').classList.add('active');
    document.getElementById('duo-btn').classList.remove('active');
});

joinRoomBtn.addEventListener('click', () => {
    const room = document.getElementById('room-input').value;
    if (room) {
        state.roomId = room;
        socket.emit('join-room', room);
        roomModal.classList.add('hidden');
        alert(`Joined Room: ${room}`);
    }
});

createRoomBtn.addEventListener('click', () => {
    const room = Math.random().toString(36).substring(7);
    state.roomId = room;
    socket.emit('join-room', room);
    roomModal.classList.add('hidden');
    alert(`Created Room: ${room}. Share this code!`);
});

// --- Scroll Button Logic ---
const scrollContainer = document.querySelector('.tools-scroll-container');

if (scrollContainer) {
    document.getElementById('scroll-up').addEventListener('click', () => {
        console.log('Scroll up clicked');
        scrollContainer.scrollBy({ top: -200, behavior: 'smooth' });
    });

    document.getElementById('scroll-down').addEventListener('click', () => {
        console.log('Scroll down clicked');
        scrollContainer.scrollBy({ top: 200, behavior: 'smooth' });
    });
} else {
    console.error('Scroll container not found!');
}

// --- Tool Nav Shortcut Logic ---
document.querySelectorAll('.nav-icon').forEach(icon => {
    icon.addEventListener('click', (e) => {
        const sectionId = e.target.getAttribute('data-section');
        const section = document.getElementById(sectionId);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
