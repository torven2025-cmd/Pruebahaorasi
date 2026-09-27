const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- SISTEMA DE CUADRÍCULA Y CÁMARA ---
const TILE_SIZE = 50; 
let camera = { x: 0, y: 0, zoom: 1 };
// Centrar la cámara inicialmente
camera.x = canvas.width / 2;
camera.y = canvas.height / 2;

// Recursos y Stats
let resources = { wood: 50, stone: 50, points: 0 };
let power = { attack: 5, defense: 50 };

// Mapa (Construcciones)
// El castillo base inicia en el centro del mundo (0,0)
let buildings = [
    { gridX: 0, gridY: 0, type: 'castle', color: '#4a4a4a', emoji: '🏰' }
];
let currentSelection = null;

const buildCosts = {
    wall: { wood: 10, stone: 5, color: '#7f8c8d', emoji: '', def: 20, atk: 0 },
    tower: { wood: 20, stone: 15, color: '#c0392b', emoji: '🗼', def: 30, atk: 5 },
    archer: { wood: 10, stone: 0, color: '#f1c40f', emoji: '🏹', def: 0, atk: 15 }
};

// --- RENDERIZADO ---
function drawWorld() {
    // 1. Limpiar pantalla
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // 2. Aplicar transformaciones de cámara (Mover y hacer Zoom)
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // 3. Dibujar fondo verde
    ctx.fillStyle = '#4c7c2b';
    ctx.fillRect(camera.x - 2000, camera.y - 2000, 4000, 4000); // Mundo grande

    // 4. Dibujar Cuadrícula (Grid)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 2;
    let startX = Math.floor((camera.x - (canvas.width/2)/camera.zoom) / TILE_SIZE) * TILE_SIZE;
    let endX = Math.floor((camera.x + (canvas.width/2)/camera.zoom) / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
    let startY = Math.floor((camera.y - (canvas.height/2)/camera.zoom) / TILE_SIZE) * TILE_SIZE;
    let endY = Math.floor((camera.y + (canvas.height/2)/camera.zoom) / TILE_SIZE) * TILE_SIZE + TILE_SIZE;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += TILE_SIZE) {
        ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += TILE_SIZE) {
        ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // 5. Dibujar Edificios
    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE;
        let py = b.gridY * TILE_SIZE;
        
        // Base del edificio
        ctx.fillStyle = b.color;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        
        // Borde interior para dar estilo 3D/Pixel
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        if (b.emoji) {
            ctx.fillStyle = 'white';
            ctx.font = `${TILE_SIZE * 0.6}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
    });

    ctx.restore();
    requestAnimationFrame(drawWorld);
}
drawWorld();

// --- CONTROLES Y NAVEGACIÓN ---
function changeZoom(amount) {
    camera.zoom += amount;
    if (camera.zoom < 0.4) camera.zoom = 0.4; // Límite alejar
    if (camera.zoom > 2.5) camera.zoom = 2.5; // Límite acercar
}

// Variables para arrastrar el mapa
let isDragging = false;
let startDrag = { x: 0, y: 0 };
let initialCamera = { x: 0, y: 0 };
let hasMoved = false; // Diferenciar entre "tap" (construir) y "drag" (mover)

function getEventCords(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    hasMoved = false;
    let pos = getEventCords(e);
    startDrag = { x: pos.x, y: pos.y };
    initialCamera = { x: camera.x, y: camera.y };
});

window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    let pos = getEventCords(e);
    let dx = pos.x - startDrag.x;
    let dy = pos.y - startDrag.y;
    
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMoved = true;

    if (hasMoved) {
        // Mover cámara (Invertimos signos para que arrastrar mueva el mundo como en el móvil)
        camera.x = initialCamera.x - (dx / camera.zoom);
        camera.y = initialCamera.y - (dy / camera.zoom);
    }
});

window.addEventListener('pointerup', (e) => {
    isDragging = false;
    if (!hasMoved) {
        let pos = getEventCords(e);
        handlePlacement(pos.x, pos.y);
    }
});

// --- LÓGICA DE CONSTRUCCIÓN ---
function selectBuilding(type) {
    currentSelection = type;
    document.querySelectorAll('.build-btn').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    showNotification("Toque una cuadrícula vacía");
}

function handlePlacement(screenX, screenY) {
    if (!currentSelection) return;

    // Convertir coordenadas de pantalla a coordenadas del mundo 2D
    let worldX = ((screenX - canvas.width / 2) / camera.zoom) + camera.x;
    let worldY = ((screenY - canvas.height / 2) / camera.zoom) + camera.y;

    // Encajar en la cuadrícula (Snap to grid)
    let gridX = Math.floor(worldX / TILE_SIZE);
    let gridY = Math.floor(worldY / TILE_SIZE);

    // Verificar si la casilla está ocupada
    let isOccupied = buildings.some(b => b.gridX === gridX && b.gridY === gridY);
    if (isOccupied) {
        showNotification("¡Casilla ocupada!");
        return;
    }

    let cost = buildCosts[currentSelection];
    if (resources.wood >= cost.wood && resources.stone >= cost.stone) {
        resources.wood -= cost.wood;
        resources.stone -= cost.stone;
        power.attack += cost.atk;
        power.defense += cost.def;

        buildings.push({
            gridX: gridX,
            gridY: gridY,
            type: currentSelection,
            color: cost.color,
            emoji: cost.emoji
        });

        updateUI();
        showNotification("¡Construido!");
    } else {
        showNotification("Recursos insuficientes");
    }
}

// --- UI y RECURSOS ---
function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood;
    document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-points').innerText = resources.points;
}
updateUI();

function gatherResources() {
    let gainedWood = Math.floor(Math.random() * 5) + 2;
    let gainedStone = Math.floor(Math.random() * 3) + 1;
    resources.wood += gainedWood;
    resources.stone += gainedStone;
    showNotification(`+${gainedWood}🪵 +${gainedStone}🪨`);
    updateUI();
}

function showNotification(msg) {
    uiLog.innerText = msg;
    setTimeout(() => uiLog.innerText = "", 2000);
}

// --- COMBATE ---
let combatState = { active: false, playerHp: 100, enemyHp: 100 };

function openCombat() {
    document.getElementById('combat-overlay').classList.remove('hidden');
    let maxPlayerHp = 100 + power.defense;
    let maxEnemyHp = 80 + (resources.points * 5) + Math.floor(Math.random() * 50);
    combatState = { active: true, playerHp: maxPlayerHp, enemyHp: maxEnemyHp, maxPlayerHp, maxEnemyHp };
    updateCombatUI();
    document.getElementById('combat-log').innerText = "¡Combate encontrado!";
}

function performAttack() {
    if (!combatState.active) return;
    let myDamage = power.attack + Math.floor(Math.random() * 10);
    let enemyDamage = (5 + (resources.points * 2)) + Math.floor(Math.random() * 10);

    combatState.enemyHp -= myDamage;
    combatState.playerHp -= enemyDamage;
    document.getElementById('combat-log').innerText = `Hiciste ${myDamage} daño. Recibiste ${enemyDamage} daño.`;
    
    if (combatState.enemyHp <= 0 || combatState.playerHp <= 0) resolveCombat();
    updateCombatUI();
}

function resolveCombat() {
    combatState.active = false;
    if (combatState.enemyHp <= 0 && combatState.playerHp <= 0) {
        document.getElementById('combat-log').innerText = "¡Empate!";
    } else if (combatState.enemyHp <= 0) {
        combatState.enemyHp = 0;
        resources.points += 10; resources.wood += 30; resources.stone += 20;
        document.getElementById('combat-log').innerText = "¡VICTORIA! +10🏆 +Materiales";
        updateUI();
    } else {
        combatState.playerHp = 0;
        resources.wood = Math.max(0, resources.wood - 10); resources.stone = Math.max(0, resources.stone - 10);
        document.getElementById('combat-log').innerText = "DERROTA. Pierdes recursos.";
        updateUI();
    }
    setTimeout(fleeCombat, 3000);
}

function updateCombatUI() {
    let pBar = document.getElementById('hp-player'); let eBar = document.getElementById('hp-enemy');
    pBar.max = combatState.maxPlayerHp; pBar.value = combatState.playerHp;
    eBar.max = combatState.maxEnemyHp; eBar.value = combatState.enemyHp;
    document.getElementById('hp-player-text').innerText = `${combatState.playerHp}/${combatState.maxPlayerHp}`;
    document.getElementById('hp-enemy-text').innerText = `${combatState.enemyHp}/${combatState.maxEnemyHp}`;
}

function fleeCombat() { document.getElementById('combat-overlay').classList.add('hidden'); combatState.active = false; }
