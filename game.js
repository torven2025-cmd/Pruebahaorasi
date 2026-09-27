const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- SISTEMA DE CUADRÍCULA, MAPA Y CÁMARA ---
const TILE_SIZE = 50; 
let gridSize = 15; // Límite inicial de 15x15
let expandCost = { wood: 100, stone: 100 };

let camera = { x: 0, y: 0, zoom: 1 };
// Centrar la cámara en el medio del mapa inicial
camera.x = (gridSize * TILE_SIZE) / 2;
camera.y = (gridSize * TILE_SIZE) / 2;

// --- ESTADOS Y RECURSOS ---
let isNavMode = true; // Inicia en modo navegación
let resources = { wood: 150, stone: 150, points: 0 };
let power = { attack: 5, defense: 50 };

// El castillo se posiciona en el centro matemático del grid inicial (7, 7)
let buildings = [
    { gridX: Math.floor(gridSize/2), gridY: Math.floor(gridSize/2), type: 'castle', color: '#4a4a4a', emoji: '🏰' }
];
let currentSelection = null;

const buildCosts = {
    wall: { wood: 10, stone: 5, color: '#7f8c8d', emoji: '', def: 20, atk: 0 },
    tower: { wood: 20, stone: 15, color: '#c0392b', emoji: '🗼', def: 30, atk: 5 },
    archer: { wood: 10, stone: 0, color: '#f1c40f', emoji: '🏹', def: 0, atk: 15 }
};

// --- INICIALIZACIÓN UI ---
function initModeUI() {
    let btn = document.getElementById('btn-toggle-mode');
    btn.classList.add('mode-nav');
    btn.innerHTML = "✋ Modo Navegación";
}
initModeUI();

function toggleMode() {
    isNavMode = !isNavMode;
    let btn = document.getElementById('btn-toggle-mode');
    
    if (isNavMode) {
        btn.classList.replace('mode-build', 'mode-nav');
        btn.innerHTML = "✋ Modo Navegación";
        // Limpiar selección de edificio al cambiar de modo
        currentSelection = null;
        document.querySelectorAll('.build-btn').forEach(b => b.classList.remove('selected'));
        showNotification("Modo Navegación Activo");
    } else {
        btn.classList.replace('mode-nav', 'mode-build');
        btn.innerHTML = "🔨 Modo Construir";
        showNotification("Modo Construir Activo. Selecciona un edificio.");
    }
}

// --- RENDERIZADO DEL MUNDO ---
function drawWorld() {
    // Fondo base exterior (Fuera del mapa)
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // Cámara
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    let mapWidth = gridSize * TILE_SIZE;
    let mapHeight = gridSize * TILE_SIZE;

    // Fondo del territorio jugable
    ctx.fillStyle = '#4c7c2b';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    // Dibujar líneas de Cuadrícula (Estrictamente dentro del límite)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= mapWidth; x += TILE_SIZE) {
        ctx.moveTo(x, 0); ctx.lineTo(x, mapHeight);
    }
    for (let y = 0; y <= mapHeight; y += TILE_SIZE) {
        ctx.moveTo(0, y); ctx.lineTo(mapWidth, y);
    }
    ctx.stroke();

    // Dibujar borde del mapa
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, mapWidth, mapHeight);

    // Dibujar Edificios
    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE;
        let py = b.gridY * TILE_SIZE;
        
        ctx.fillStyle = b.color;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
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

// --- CONTROLES Y SEPARACIÓN DE NAVEGACIÓN/CONSTRUCCIÓN ---
function changeZoom(amount) {
    camera.zoom += amount;
    if (camera.zoom < 0.4) camera.zoom = 0.4;
    if (camera.zoom > 2.5) camera.zoom = 2.5;
}

let isDragging = false;
let startDrag = { x: 0, y: 0 };
let initialCamera = { x: 0, y: 0 };

function getEventCords(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

canvas.addEventListener('pointerdown', (e) => {
    // Si es modo navegación, preparamos el arrastre
    if (isNavMode) {
        isDragging = true;
        let pos = getEventCords(e);
        startDrag = { x: pos.x, y: pos.y };
        initialCamera = { x: camera.x, y: camera.y };
    }
});

window.addEventListener('pointermove', (e) => {
    // Solo permitimos mover el mapa si el modo de navegación está activo
    if (isNavMode && isDragging) {
        let pos = getEventCords(e);
        let dx = pos.x - startDrag.x;
        let dy = pos.y - startDrag.y;
        
        camera.x = initialCamera.x - (dx / camera.zoom);
        camera.y = initialCamera.y - (dy / camera.zoom);
    }
});

window.addEventListener('pointerup', (e) => {
    if (isNavMode) {
        isDragging = false;
    } else {
        // En modo construcción, un toque coloca el edificio directamente
        let pos = getEventCords(e);
        handlePlacement(pos.x, pos.y);
    }
});

// --- EXPANSIÓN Y CONSTRUCCIÓN ---
function expandGrid() {
    if (resources.wood >= expandCost.wood && resources.stone >= expandCost.stone) {
        resources.wood -= expandCost.wood;
        resources.stone -= expandCost.stone;
        
        gridSize += 5; // Expande la cuadrícula a +5 (ej: 15x15 -> 20x20)
        
        // Aumentar el coste para la próxima vez
        expandCost.wood += 50;
        expandCost.stone += 50;
        
        document.getElementById('expand-cost').innerText = `${expandCost.wood}🪵 ${expandCost.stone}🪨`;
        updateUI();
        showNotification(`¡Territorio expandido a ${gridSize}x${gridSize}!`);
    } else {
        showNotification("Recursos insuficientes para expandir");
    }
}

function selectBuilding(type) {
    if (isNavMode) {
        showNotification("¡Cambia al Modo Construir primero!");
        return;
    }
    currentSelection = type;
    document.querySelectorAll('.build-btn').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
}

function handlePlacement(screenX, screenY) {
    if (!currentSelection) {
        showNotification("Selecciona un edificio abajo");
        return;
    }

    let worldX = ((screenX - canvas.width / 2) / camera.zoom) + camera.x;
    let worldY = ((screenY - canvas.height / 2) / camera.zoom) + camera.y;

    let gridX = Math.floor(worldX / TILE_SIZE);
    let gridY = Math.floor(worldY / TILE_SIZE);

    // Verificar si el toque está fuera de los límites (15x15 o el tamaño actual)
    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) {
        showNotification("Límite del territorio alcanzado");
        return;
    }

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

// --- UI y COMBATE ---
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
