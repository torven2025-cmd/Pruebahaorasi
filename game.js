const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- SISTEMA CORE Y ESTADOS ---
const TILE_SIZE = 50; 
let gridSize = 15;
let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1 };

let resources = { wood: 200, stone: 200, points: 0, troops: 0 };
let maxTroops = 0; // Capacidad basada en campamentos

// Estados del juego
let isNavMode = true; 
let inCombat = false; 

// Base de datos de Entidades
let mySavedBase = []; // Guarda tu base mientras atacas
let buildings = [];
let deployedTroops = []; // Tropas vivas en el mapa
let frameCount = 0; // Para medir tiempo de ataques

// Costes y Stats de Edificios (AHORA TIENEN HP)
const entityData = {
    castle: { color: '#4a4a4a', emoji: '🏰', maxHp: 1000 },
    camp: { wood: 50, stone: 30, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5 },
    wall: { wood: 10, stone: 5, color: '#7f8c8d', emoji: '', maxHp: 400 },
    tower: { wood: 20, stone: 15, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 10, range: 150 }
};

let currentSelection = null;

// Inicializar base del jugador
buildings.push({ id: Date.now(), gridX: 7, gridY: 7, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp });

// --- LÓGICA DE ACTUALIZACIÓN (SIMULACIÓN EN TIEMPO REAL) ---
function update() {
    frameCount++;

    if (inCombat) {
        // Eliminar edificios destruidos
        buildings = buildings.filter(b => b.hp > 0);

        // Si no quedan edificios enemigos, ganaste
        if (buildings.length === 0 && deployedTroops.length > 0) {
            winCombat();
            return;
        }

        // IA de las Tropas (Bárbaros)
        deployedTroops.forEach((troop, tIndex) => {
            // Si su objetivo fue destruido, buscar uno nuevo
            if (!troop.target || troop.target.hp <= 0) {
                troop.target = getNearestBuilding(troop.x, troop.y);
            }

            if (troop.target) {
                // Calcular distancia al centro del edificio
                let targetX = troop.target.gridX * TILE_SIZE + TILE_SIZE/2;
                let targetY = troop.target.gridY * TILE_SIZE + TILE_SIZE/2;
                let dx = targetX - troop.x;
                let dy = targetY - troop.y;
                let dist = Math.hypot(dx, dy);

                if (dist > (TILE_SIZE/2 + troop.radius)) {
                    // Moverse hacia el objetivo
                    troop.x += (dx / dist) * troop.speed;
                    troop.y += (dy / dist) * troop.speed;
                } else {
                    // Atacar (Golpea 1 vez por segundo aprox a 60fps)
                    if (frameCount % 60 === 0) {
                        troop.target.hp -= troop.damage;
                    }
                }
            }
        });

        // Eliminar tropas muertas (A implementar Torres Defensivas en Beta 5.0)
        deployedTroops = deployedTroops.filter(t => t.hp > 0);
        
        // Perder: Sin tropas y sin tropas por desplegar
        if (deployedTroops.length === 0 && resources.troops <= 0 && buildings.length > 0) {
            loseCombat();
        }
    }
}

// Encuentra el edificio vivo más cercano
function getNearestBuilding(x, y) {
    let nearest = null;
    let minDist = Infinity;
    buildings.forEach(b => {
        let bx = b.gridX * TILE_SIZE + TILE_SIZE/2;
        let by = b.gridY * TILE_SIZE + TILE_SIZE/2;
        let dist = Math.hypot(bx - x, by - y);
        if (dist < minDist) { minDist = dist; nearest = b; }
    });
    return nearest;
}

// --- RENDERIZADO VISUAL ---
function draw() {
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    let mapSize = gridSize * TILE_SIZE;

    // Fondo verde del mapa
    ctx.fillStyle = '#4c7c2b'; ctx.fillRect(0, 0, mapSize, mapSize);

    // Borde rojo si es enemigo, dorado si es tu base
    ctx.strokeStyle = inCombat ? '#ff4500' : '#d4af37';
    ctx.lineWidth = 4; ctx.strokeRect(0, 0, mapSize, mapSize);

    // Dibujar Edificios y Barras de Vida
    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE; let py = b.gridY * TILE_SIZE;
        ctx.fillStyle = b.color; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }

        // Barra de Vida si está dañado
        if (b.hp < b.maxHp) {
            ctx.fillStyle = 'black'; ctx.fillRect(px, py - 10, TILE_SIZE, 6);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(px, py - 10, TILE_SIZE * (b.hp/b.maxHp), 6);
        }
    });

    // Dibujar Tropas en combate
    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; // Color bárbaro
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.stroke();
        // Detalle de arma
        ctx.fillStyle = '#bdc3c7'; ctx.fillRect(t.x, t.y - 10, 4, 15);
    });

    ctx.restore();
}

// Bucle Maestro
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
gameLoop(); // Iniciar

// --- INTERACCIONES, CÁMARA Y DESPLIEGUE ---
let isDragging = false, hasMoved = false, startDrag = { x: 0, y: 0 }, initialCam = { x: 0, y: 0 };
function getCords(e) { return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }

canvas.addEventListener('pointerdown', e => {
    isDragging = true; hasMoved = false;
    let pos = getCords(e);
    startDrag = pos; initialCam = { x: camera.x, y: camera.y };
});

window.addEventListener('pointermove', e => {
    if (isDragging) {
        let pos = getCords(e);
        let dx = pos.x - startDrag.x, dy = pos.y - startDrag.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMoved = true;
        
        // Si no estamos en modo construcción, permite arrastrar el mapa
        if (isNavMode || inCombat) {
            camera.x = initialCam.x - (dx / camera.zoom);
            camera.y = initialCam.y - (dy / camera.zoom);
        }
    }
});

window.addEventListener('pointerup', e => {
    isDragging = false;
    if (!hasMoved) {
        let pos = getCords(e);
        let worldX = ((pos.x - canvas.width/2) / camera.zoom) + camera.x;
        let worldY = ((pos.y - canvas.height/2) / camera.zoom) + camera.y;

        if (inCombat) {
            deployTroop(worldX, worldY);
        } else if (!isNavMode) {
            handleBuild(worldX, worldY);
        }
    }
});

// --- SISTEMA DE TROPAS Y COMBATE ---
function updateCapacity() {
    maxTroops = buildings.filter(b => b.type === 'camp').length * entityData.camp.capacity;
}

function trainTroop() {
    if (inCombat) return showNotification("¡No puedes entrenar bajo fuego!");
    updateCapacity();
    if (resources.troops >= maxTroops) return showNotification(`Campamentos llenos (${maxTroops} max). Construye más.`);
    if (resources.wood >= 10) {
        resources.wood -= 10;
        resources.troops++;
        updateUI();
        showNotification("¡Bárbaro entrenado!");
    } else {
        showNotification("Falta madera");
    }
}

// INICIAR ATAQUE (Cargar base dummy)
function startCombatMatch() {
    if (resources.troops <= 0) return showNotification("¡Entrena tropas primero!");
    
    // 1. Guardar base actual
    mySavedBase = JSON.parse(JSON.stringify(buildings)); // Clon profundo rápido
    
    // 2. Generar base enemiga de prueba
    buildings = [
        { id: 1, gridX: 7, gridY: 7, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp },
        { id: 2, gridX: 6, gridY: 7, type: 'wall', ...entityData.wall, hp: entityData.wall.maxHp },
        { id: 3, gridX: 8, gridY: 7, type: 'wall', ...entityData.wall, hp: entityData.wall.maxHp },
        { id: 4, gridX: 7, gridY: 6, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp }
    ];

    inCombat = true;
    deployedTroops = [];
    
    // Cambiar UI
    document.getElementById('base-ui').classList.add('hidden');
    document.getElementById('combat-ui').classList.remove('hidden');
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 0.8;
}

function deployTroop(x, y) {
    if (resources.troops <= 0) return showNotification("¡No te quedan tropas!");
    
    // Evitar soltar tropas directamente ENCIMA de los edificios enemigos (Zona roja)
    let mapBoundary = gridSize * TILE_SIZE;
    if (x > 2*TILE_SIZE && x < mapBoundary - 2*TILE_SIZE && y > 2*TILE_SIZE && y < mapBoundary - 2*TILE_SIZE) {
        return showNotification("Debes desplegar en los bordes de la base");
    }

    resources.troops--;
    updateUI();
    
    deployedTroops.push({
        x: x, y: y,
        hp: 100, damage: 15, speed: 1.5, radius: 8,
        target: null
    });
}

function winCombat() {
    showNotification("¡VICTORIA! 100🪵 100🪨 20🏆 ganados");
    resources.wood += 100; resources.stone += 100; resources.points += 20;
    setTimeout(endCombat, 2000);
}

function loseCombat() {
    showNotification("DERROTA... Tus tropas perecieron.");
    setTimeout(endCombat, 2000);
}

function endCombat() {
    inCombat = false;
    deployedTroops = [];
    buildings = mySavedBase; // Restaurar tu base
    updateCapacity(); // Recalcular por si acaso
    document.getElementById('combat-ui').classList.add('hidden');
    document.getElementById('base-ui').classList.remove('hidden');
    updateUI();
}

// --- CONSTRUCCIÓN Y UI BASE ---
function toggleMode() {
    isNavMode = !isNavMode;
    let btn = document.getElementById('btn-toggle-mode');
    if (isNavMode) { btn.classList.replace('mode-build', 'mode-nav'); btn.innerHTML = "✋ Mover Mapa"; currentSelection = null; }
    else { btn.classList.replace('mode-nav', 'mode-build'); btn.innerHTML = "🔨 Modo Construir"; }
}

function selectBuilding(type) {
    if (isNavMode) return showNotification("¡Cambia a Modo Construir!");
    currentSelection = type;
}

function handleBuild(worldX, worldY) {
    if (!currentSelection) return;
    let gridX = Math.floor(worldX / TILE_SIZE); let gridY = Math.floor(worldY / TILE_SIZE);
    if (gridX < 0 || gridX >= gridSize || gridY < 0 || gridY >= gridSize) return showNotification("Fuera del mapa");
    if (buildings.some(b => b.gridX === gridX && b.gridY === gridY)) return showNotification("Casilla ocupada");

    let data = entityData[currentSelection];
    if (resources.wood >= data.wood && resources.stone >= data.stone) {
        resources.wood -= data.wood; resources.stone -= data.stone;
        buildings.push({ id: Date.now(), gridX, gridY, type: currentSelection, ...data, hp: data.maxHp });
        updateCapacity(); updateUI(); showNotification("Construido");
    } else showNotification("Recursos insuficientes");
}

function gatherResources() { resources.wood += 10; resources.stone += 10; updateUI(); }
function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood;
    document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`;
    document.getElementById('res-points').innerText = resources.points;
}
function changeZoom(amount) { camera.zoom = Math.max(0.4, Math.min(camera.zoom + amount, 2.5)); }
function showNotification(msg) { uiLog.innerText = msg; setTimeout(() => uiLog.innerText = "", 2000); }

updateCapacity(); updateUI(); // Init
