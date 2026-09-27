const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const TILE_SIZE = 50; 
let gridSize = 15;
let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1 };

let savedData = JSON.parse(localStorage.getItem('castleBattleSave')) || null;
let resources = savedData ? savedData.resources : { wood: 100, stone: 100, points: 0, troops: 0 };
let buildings = savedData ? savedData.buildings : [];
let maxTroops = 0; 

let isBuildMode = false; 
let inCombat = false; 
let frameCount = 0; 
let mySavedBase = []; let deployedTroops = []; let lasers = [];

// ESTADOS DEL DRAG & DROP DE CONSTRUCCIÓN
let pendingBuildingType = null;
let pendingBuildingData = null;
let pGridX = -1; let pGridY = -1;

const entityData = {
    castle: { color: '#4a4a4a', emoji: '🏰', maxHp: 1000 },
    lumbermill: { wood: 20, stone: 10, color: '#27ae60', emoji: '🪚', maxHp: 150 },
    mine: { wood: 10, stone: 20, color: '#95a5a6', emoji: '⛏️', maxHp: 150 },
    camp: { wood: 50, stone: 30, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5 },
    wall: { wood: 10, stone: 5, color: '#7f8c8d', emoji: '', maxHp: 400 },
    tower: { wood: 20, stone: 15, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 20, range: 200 }
};

if (buildings.length === 0) {
    buildings.push({ id: Date.now(), gridX: 7, gridY: 7, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp });
    saveGame();
}

// Economía Pasiva
setInterval(() => {
    if (inCombat) return;
    let woodGen = 0, stoneGen = 0;
    buildings.forEach(b => {
        if (b.type === 'castle') { woodGen += 1; stoneGen += 1; }
        if (b.type === 'lumbermill') woodGen += 2;
        if (b.type === 'mine') stoneGen += 2;
    });
    if (woodGen > 0 || stoneGen > 0) {
        resources.wood += woodGen; resources.stone += stoneGen;
        updateUI(); saveGame();
    }
}, 1000);

// Actualización y Motor 
function update() {
    frameCount++;
    if (inCombat) {
        buildings = buildings.filter(b => b.hp > 0);
        if (buildings.length === 0 && deployedTroops.length > 0) { winCombat(); return; }

        deployedTroops.forEach(troop => {
            if (!troop.target || troop.target.hp <= 0) troop.target = getNearestBuilding(troop.x, troop.y);
            if (troop.target) {
                let tx = troop.target.gridX * TILE_SIZE + TILE_SIZE/2, ty = troop.target.gridY * TILE_SIZE + TILE_SIZE/2;
                let dx = tx - troop.x, dy = ty - troop.y; let dist = Math.hypot(dx, dy);
                if (dist > (TILE_SIZE/2 + troop.radius)) {
                    troop.x += (dx / dist) * troop.speed; troop.y += (dy / dist) * troop.speed;
                } else if (frameCount % 60 === 0) troop.target.hp -= troop.damage;
            }
        });

        if (frameCount % 45 === 0) {
            buildings.forEach(b => {
                if (b.type === 'tower') {
                    let bx = b.gridX * TILE_SIZE + TILE_SIZE/2, by = b.gridY * TILE_SIZE + TILE_SIZE/2;
                    let target = null, minDist = b.range;
                    deployedTroops.forEach(t => {
                        let dist = Math.hypot(t.x - bx, t.y - by);
                        if (dist < minDist && t.hp > 0) { minDist = dist; target = t; }
                    });
                    if (target) { target.hp -= b.damage; lasers.push({ x1: bx, y1: by, x2: target.x, y2: target.y, life: 10 }); }
                }
            });
        }
        deployedTroops = deployedTroops.filter(t => t.hp > 0);
        lasers.forEach(l => l.life--); lasers = lasers.filter(l => l.life > 0);
        if (deployedTroops.length === 0 && resources.troops <= 0 && buildings.length > 0) loseCombat();
    }
}

function getNearestBuilding(x, y) {
    let nearest = null, minDist = Infinity;
    buildings.forEach(b => {
        let bx = b.gridX * TILE_SIZE + TILE_SIZE/2, by = b.gridY * TILE_SIZE + TILE_SIZE/2;
        let dist = Math.hypot(bx - x, by - y);
        if (dist < minDist) { minDist = dist; nearest = b; }
    });
    return nearest;
}

// Renderizado Visual
function draw() {
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    let mapSize = gridSize * TILE_SIZE;
    ctx.fillStyle = '#4c7c2b'; ctx.fillRect(0, 0, mapSize, mapSize);

    // Cuadrícula visible en modo construcción
    if (isBuildMode) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = 0; x <= mapSize; x += TILE_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, mapSize); }
        for (let y = 0; y <= mapSize; y += TILE_SIZE) { ctx.moveTo(0, y); ctx.lineTo(mapSize, y); }
        ctx.stroke();
    }

    ctx.strokeStyle = inCombat ? '#ff4500' : '#d4af37';
    ctx.lineWidth = 4; ctx.strokeRect(0, 0, mapSize, mapSize);

    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE, py = b.gridY * TILE_SIZE;
        ctx.fillStyle = b.color; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
        if (b.hp < b.maxHp) {
            ctx.fillStyle = 'black'; ctx.fillRect(px, py - 10, TILE_SIZE, 6);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(px, py - 10, TILE_SIZE * (b.hp/b.maxHp), 6);
        }
    });

    // DIBUJAR ESTRUCTURA PENDIENTE (Drag & Drop)
    if (pendingBuildingData && pGridX >= 0 && pGridY >= 0) {
        let px = pGridX * TILE_SIZE; let py = pGridY * TILE_SIZE;
        let isOccupied = buildings.some(b => b.gridX === pGridX && b.gridY === pGridY);
        
        // Base roja o verde indicando si se puede colocar
        ctx.fillStyle = isOccupied ? 'rgba(255, 0, 0, 0.5)' : 'rgba(46, 204, 113, 0.5)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        
        // Estructura flotante
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = pendingBuildingData.color; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        if (pendingBuildingData.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`;
            ctx.fillText(pendingBuildingData.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
        ctx.globalAlpha = 1.0;
    }

    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(t.x - 6, t.y - 12, 12 * (t.hp/100), 3);
    });

    lasers.forEach(l => {
        ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    });

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); } gameLoop(); 

// --- CONTROLES INTELIGENTES DE CÁMARA Y ARRASTRE ---
let isDraggingCamera = false; let isDraggingBuilding = false;
let startDrag = { x: 0, y: 0 }; let initialCam = { x: 0, y: 0 };
function getCords(e) { return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; }

canvas.addEventListener('pointerdown', e => {
    let pos = getCords(e);
    let worldX = ((pos.x - canvas.width/2) / camera.zoom) + camera.x;
    let worldY = ((pos.y - canvas.height/2) / camera.zoom) + camera.y;
    let gX = Math.floor(worldX / TILE_SIZE); let gY = Math.floor(worldY / TILE_SIZE);

    // Si tocaste justo en la estructura pendiente, la arrastras. Si no, arrastras la cámara.
    if (pendingBuildingData && gX === pGridX && gY === pGridY) {
        isDraggingBuilding = true;
    } else {
        isDraggingCamera = true;
        startDrag = pos; initialCam = { x: camera.x, y: camera.y };
        // Si tocas en otro lado de la cuadrícula, la estructura se mueve allí automáticamente
        if (pendingBuildingData && gX >= 0 && gX < gridSize && gY >= 0 && gY < gridSize) {
            pGridX = gX; pGridY = gY;
        }
    }
});

window.addEventListener('pointermove', e => {
    let pos = getCords(e);
    if (isDraggingCamera) {
        let dx = pos.x - startDrag.x, dy = pos.y - startDrag.y;
        camera.x = initialCam.x - (dx / camera.zoom); camera.y = initialCam.y - (dy / camera.zoom);
    } else if (isDraggingBuilding) {
        let worldX = ((pos.x - canvas.width/2) / camera.zoom) + camera.x;
        let worldY = ((pos.y - canvas.height/2) / camera.zoom) + camera.y;
        pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
        pGridX = Math.max(0, Math.min(pGridX, gridSize - 1)); // Límite de mapa
        pGridY = Math.max(0, Math.min(pGridY, gridSize - 1));
    }
});

window.addEventListener('pointerup', e => {
    isDraggingCamera = false; isDraggingBuilding = false;
    
    // Desplegar tropas si estamos en combate
    if (inCombat) {
        let pos = getCords(e);
        let worldX = ((pos.x - canvas.width/2) / camera.zoom) + camera.x;
        let worldY = ((pos.y - canvas.height/2) / camera.zoom) + camera.y;
        deployTroop(worldX, worldY);
    }
});

// --- UI DE CONSTRUCCIÓN ---
function enterBuildMode() {
    isBuildMode = true;
    document.getElementById('normal-ui').classList.add('hidden');
    document.getElementById('build-ui').classList.remove('hidden');
    document.getElementById('build-tray').classList.remove('hidden');
}

function exitBuildMode() {
    isBuildMode = false; cancelPlacement();
    document.getElementById('build-ui').classList.add('hidden');
    document.getElementById('normal-ui').classList.remove('hidden');
}

function selectBuilding(type) {
    pendingBuildingType = type;
    pendingBuildingData = entityData[type];
    pGridX = Math.floor(camera.x / TILE_SIZE); // Aparece en el centro de la cámara
    pGridY = Math.floor(camera.y / TILE_SIZE);
    
    // Ocultar carrusel, mostrar botones verde y rojo
    document.getElementById('build-tray').classList.add('hidden');
    document.getElementById('placement-controls').classList.remove('hidden');
}

function cancelPlacement() {
    pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
    document.getElementById('placement-controls').classList.add('hidden');
    document.getElementById('build-tray').classList.remove('hidden');
}

function confirmPlacement() {
    if (!pendingBuildingData) return;
    
    if (buildings.some(b => b.gridX === pGridX && b.gridY === pGridY)) return showNotification("Casilla ocupada");
    if (resources.wood < pendingBuildingData.wood || resources.stone < pendingBuildingData.stone) return showNotification("Recursos insuficientes");

    resources.wood -= pendingBuildingData.wood; resources.stone -= pendingBuildingData.stone;
    buildings.push({ id: Date.now(), gridX: pGridX, gridY: pGridY, type: pendingBuildingType, ...pendingBuildingData, hp: pendingBuildingData.maxHp });
    
    updateCapacity(); updateUI(); saveGame(); showNotification("¡Construcción finalizada!");
    cancelPlacement(); // Vuelve al carrusel
}

// --- UTILIDADES ---
function saveGame() { if (!inCombat) localStorage.setItem('castleBattleSave', JSON.stringify({ resources, buildings })); }
function updateCapacity() { maxTroops = buildings.filter(b => b.type === 'camp').length * entityData.camp.capacity; }

function trainTroop() {
    updateCapacity();
    if (resources.troops >= maxTroops) return showNotification(`Campamentos llenos (${maxTroops} max).`);
    if (resources.wood >= 10) { resources.wood -= 10; resources.troops++; updateUI(); saveGame(); showNotification("¡Bárbaro entrenado!");
    } else showNotification("Falta madera");
}

function startCombatMatch() {
    if (resources.troops <= 0) return showNotification("¡Entrena tropas primero!");
    mySavedBase = JSON.parse(JSON.stringify(buildings)); 
    buildings = [
        { id: 1, gridX: 7, gridY: 7, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp },
        { id: 2, gridX: 6, gridY: 7, type: 'wall', ...entityData.wall, hp: entityData.wall.maxHp },
        { id: 3, gridX: 8, gridY: 7, type: 'wall', ...entityData.wall, hp: entityData.wall.maxHp },
        { id: 4, gridX: 7, gridY: 5, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp },
        { id: 5, gridX: 7, gridY: 9, type: 'mine', ...entityData.mine, hp: entityData.mine.maxHp }
    ];
    inCombat = true; deployedTroops = []; lasers = [];
    document.getElementById('normal-ui').classList.add('hidden');
    document.getElementById('combat-ui').classList.remove('hidden');
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 0.8;
}

function deployTroop(x, y) {
    if (resources.troops <= 0) return showNotification("¡No te quedan tropas!");
    let boundary = gridSize * TILE_SIZE;
    if (x > 2*TILE_SIZE && x < boundary - 2*TILE_SIZE && y > 2*TILE_SIZE && y < boundary - 2*TILE_SIZE) return showNotification("Despliega tropas en las afueras");
    resources.troops--; updateUI();
    deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 8, target: null });
}

function winCombat() { showNotification("¡VICTORIA! 100🪵 100🪨 20🏆 ganados"); resources.wood += 100; resources.stone += 100; resources.points += 20; setTimeout(endCombat, 2500); }
function loseCombat() { showNotification("DERROTA... Tus tropas perecieron."); setTimeout(endCombat, 2500); }
function endCombat() {
    inCombat = false; deployedTroops = []; lasers = []; buildings = mySavedBase; updateCapacity(); 
    document.getElementById('combat-ui').classList.add('hidden'); document.getElementById('normal-ui').classList.remove('hidden');
    updateUI(); saveGame();
}

function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood; document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`; document.getElementById('res-points').innerText = resources.points;
}
function changeZoom(amount) { camera.zoom = Math.max(0.4, Math.min(camera.zoom + amount, 2.5)); }
function showNotification(msg) { uiLog.innerText = msg; setTimeout(() => uiLog.innerText = "", 2000); }

updateCapacity(); updateUI();
