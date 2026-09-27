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

// Cargar partida guardada o usar valores por defecto
let savedData = JSON.parse(localStorage.getItem('castleBattleSave')) || null;

let resources = savedData ? savedData.resources : { wood: 300, stone: 300, points: 0, troops: 0 };
let buildings = savedData ? savedData.buildings : [];
let maxTroops = 0; 

let isNavMode = true; 
let inCombat = false; 
let mySavedBase = []; 
let deployedTroops = []; 
let frameCount = 0; 

// Base de datos de Entidades
const entityData = {
    castle: { color: '#4a4a4a', emoji: '🏰', maxHp: 1000 },
    camp: { wood: 50, stone: 30, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5 },
    wall: { wood: 10, stone: 5, color: '#7f8c8d', emoji: '', maxHp: 400 },
    tower: { wood: 20, stone: 15, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 20, range: 200 }
};

let currentSelection = null;
let hoverGridX = -1; let hoverGridY = -1;
let lasers = []; // Para los disparos de las torres

// Si es partida nueva, generar castillo central
if (buildings.length === 0) {
    buildings.push({ id: Date.now(), gridX: 7, gridY: 7, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp });
    saveGame();
}

// --- LÓGICA DE ACTUALIZACIÓN (SIMULACIÓN Y COMBATE) ---
function update() {
    frameCount++;

    if (inCombat) {
        buildings = buildings.filter(b => b.hp > 0);

        if (buildings.length === 0 && deployedTroops.length > 0) {
            winCombat(); return;
        }

        // IA DE TROPAS (Buscando objetivos)
        deployedTroops.forEach(troop => {
            if (!troop.target || troop.target.hp <= 0) troop.target = getNearestBuilding(troop.x, troop.y);

            if (troop.target) {
                let targetX = troop.target.gridX * TILE_SIZE + TILE_SIZE/2;
                let targetY = troop.target.gridY * TILE_SIZE + TILE_SIZE/2;
                let dx = targetX - troop.x; let dy = targetY - troop.y;
                let dist = Math.hypot(dx, dy);

                if (dist > (TILE_SIZE/2 + troop.radius)) {
                    troop.x += (dx / dist) * troop.speed;
                    troop.y += (dy / dist) * troop.speed;
                } else if (frameCount % 60 === 0) { // Golpe cada segundo
                    troop.target.hp -= troop.damage;
                }
            }
        });

        // IA DE DEFENSAS (Torres disparando a las tropas)
        if (frameCount % 45 === 0) { // Cadencia de disparo de la torre
            buildings.forEach(b => {
                if (b.type === 'tower') {
                    let bx = b.gridX * TILE_SIZE + TILE_SIZE/2;
                    let by = b.gridY * TILE_SIZE + TILE_SIZE/2;
                    let target = null; let minDist = b.range;
                    
                    deployedTroops.forEach(t => {
                        let dist = Math.hypot(t.x - bx, t.y - by);
                        if (dist < minDist && t.hp > 0) { minDist = dist; target = t; }
                    });

                    if (target) {
                        target.hp -= b.damage;
                        lasers.push({ x1: bx, y1: by, x2: target.x, y2: target.y, life: 10 }); // Efecto visual
                    }
                }
            });
        }

        // Limpiar tropas muertas y lásers
        deployedTroops = deployedTroops.filter(t => t.hp > 0);
        lasers.forEach(l => l.life--);
        lasers = lasers.filter(l => l.life > 0);
        
        if (deployedTroops.length === 0 && resources.troops <= 0 && buildings.length > 0) loseCombat();
    }
}

function getNearestBuilding(x, y) {
    let nearest = null; let minDist = Infinity;
    buildings.forEach(b => {
        let bx = b.gridX * TILE_SIZE + TILE_SIZE/2; let by = b.gridY * TILE_SIZE + TILE_SIZE/2;
        let dist = Math.hypot(bx - x, by - y);
        if (dist < minDist) { minDist = dist; nearest = b; }
    });
    return nearest;
}

// --- RENDERIZADO VISUAL (CON CUADRÍCULAS) ---
function draw() {
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    let mapSize = gridSize * TILE_SIZE;
    ctx.fillStyle = '#4c7c2b'; ctx.fillRect(0, 0, mapSize, mapSize);

    // CUADRÍCULA ESTILO CLASH OF CLANS (Solo visible en modo construcción)
    if (!isNavMode) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= mapSize; x += TILE_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, mapSize); }
        for (let y = 0; y <= mapSize; y += TILE_SIZE) { ctx.moveTo(0, y); ctx.lineTo(mapSize, y); }
        ctx.stroke();

        // Cursor de pre-visualización verde/rojo
        if (currentSelection && hoverGridX >= 0 && hoverGridX < gridSize && hoverGridY >= 0 && hoverGridY < gridSize) {
            let isOccupied = buildings.some(b => b.gridX === hoverGridX && b.gridY === hoverGridY);
            ctx.fillStyle = isOccupied ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 0, 0.4)';
            ctx.fillRect(hoverGridX * TILE_SIZE, hoverGridY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }

    ctx.strokeStyle = inCombat ? '#ff4500' : '#d4af37';
    ctx.lineWidth = 4; ctx.strokeRect(0, 0, mapSize, mapSize);

    // Dibujar Edificios
    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE; let py = b.gridY * TILE_SIZE;
        ctx.fillStyle = b.color; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);

        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
        if (b.hp < b.maxHp) {
            ctx.fillStyle = 'black'; ctx.fillRect(px, py - 10, TILE_SIZE, 6);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(px, py - 10, TILE_SIZE * (b.hp/b.maxHp), 6);
        }
    });

    // Dibujar Tropas
    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; 
        ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.stroke();
        
        // Barra de vida de la tropa
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(t.x - 6, t.y - 12, 12 * (t.hp/100), 3);
    });

    // Dibujar Láseres de Defensas
    lasers.forEach(l => {
        ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    });

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
gameLoop(); 

// --- CONTROLES Y HOVER ---
let isDragging = false, hasMoved = false, startDrag = { x: 0, y: 0 }, initialCam = { x: 0, y: 0 };
function getCords(e) { return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }

canvas.addEventListener('pointerdown', e => {
    isDragging = true; hasMoved = false;
    let pos = getCords(e);
    startDrag = pos; initialCam = { x: camera.x, y: camera.y };
});

window.addEventListener('pointermove', e => {
    let pos = getCords(e);
    let worldX = ((pos.x - canvas.width/2) / camera.zoom) + camera.x;
    let worldY = ((pos.y - canvas.height/2) / camera.zoom) + camera.y;

    // Actualizar hover para la cuadrícula
    hoverGridX = Math.floor(worldX / TILE_SIZE);
    hoverGridY = Math.floor(worldY / TILE_SIZE);

    if (isDragging) {
        let dx = pos.x - startDrag.x, dy = pos.y - startDrag.y;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMoved = true;
        if (isNavMode || inCombat) {
            camera.x = initialCam.x - (dx / camera.zoom); camera.y = initialCam.y - (dy / camera.zoom);
        }
    }
});

window.addEventListener('pointerup', e => {
    isDragging = false;
    if (!hasMoved) {
        let pos = getCords(e);
        let worldX = ((pos.x - canvas.width/2) / camera.zoom) + camera.x;
        let worldY = ((pos.y - canvas.height/2) / camera.zoom) + camera.y;

        if (inCombat) deployTroop(worldX, worldY);
        else if (!isNavMode) handleBuild(worldX, worldY);
    }
    hoverGridX = -1; hoverGridY = -1; // Reset hover al soltar
});

// --- GUARDADO LOCAL ---
function saveGame() {
    if (!inCombat) {
        localStorage.setItem('castleBattleSave', JSON.stringify({ resources: resources, buildings: buildings }));
    }
}

// --- SISTEMA DE TROPAS Y COMBATE ---
function updateCapacity() { maxTroops = buildings.filter(b => b.type === 'camp').length * entityData.camp.capacity; }

function trainTroop() {
    if (inCombat) return showNotification("¡No puedes entrenar bajo fuego!");
    updateCapacity();
    if (resources.troops >= maxTroops) return showNotification(`Campamentos llenos (${maxTroops} max). Construye más.`);
    if (resources.wood >= 10) {
        resources.wood -= 10; resources.troops++; updateUI(); saveGame(); showNotification("¡Bárbaro entrenado!");
    } else showNotification("Falta madera");
}

function startCombatMatch() {
    if (resources.troops <= 0) return showNotification("¡Entrena tropas primero!");
    mySavedBase = JSON.parse(JSON.stringify(buildings)); // Guardar tu base actual
    
    // Generar base enemiga
    buildings = [
        { id: 1, gridX: 7, gridY: 7, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp },
        { id: 2, gridX: 6, gridY: 7, type: 'wall', ...entityData.wall, hp: entityData.wall.maxHp },
        { id: 3, gridX: 8, gridY: 7, type: 'wall', ...entityData.wall, hp: entityData.wall.maxHp },
        { id: 4, gridX: 7, gridY: 5, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp },
        { id: 5, gridX: 7, gridY: 9, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp }
    ];

    inCombat = true; deployedTroops = []; lasers = [];
    document.getElementById('base-ui').classList.add('hidden');
    document.getElementById('combat-ui').classList.remove('hidden');
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 0.8;
}

function deployTroop(x, y) {
    if (resources.troops <= 0) return showNotification("¡No te quedan tropas!");
    let boundary = gridSize * TILE_SIZE;
    if (x > 2*TILE_SIZE && x < boundary - 2*TILE_SIZE && y > 2*TILE_SIZE && y < boundary - 2*TILE_SIZE) {
        return showNotification("Despliega tropas en las afueras (zona verde oscura)");
    }
    resources.troops--; updateUI();
    deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 8, target: null });
}

function winCombat() {
    showNotification("¡VICTORIA! 100🪵 100🪨 20🏆 ganados");
    resources.wood += 100; resources.stone += 100; resources.points += 20;
    setTimeout(endCombat, 2500);
}

function loseCombat() {
    showNotification("DERROTA... Tus tropas perecieron.");
    setTimeout(endCombat, 2500);
}

function endCombat() {
    inCombat = false; deployedTroops = []; lasers = [];
    buildings = mySavedBase; 
    updateCapacity(); 
    document.getElementById('combat-ui').classList.add('hidden');
    document.getElementById('base-ui').classList.remove('hidden');
    updateUI(); saveGame();
}

// --- CONSTRUCCIÓN ---
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
        updateCapacity(); updateUI(); saveGame(); showNotification("Construido");
    } else showNotification("Recursos insuficientes");
}

function gatherResources() { resources.wood += 10; resources.stone += 10; updateUI(); saveGame(); }
function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood;
    document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`;
    document.getElementById('res-points').innerText = resources.points;
}
function changeZoom(amount) { camera.zoom = Math.max(0.4, Math.min(camera.zoom + amount, 2.5)); }
function showNotification(msg) { uiLog.innerText = msg; setTimeout(() => uiLog.innerText = "", 2000); }

updateCapacity(); updateUI();
