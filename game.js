const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const TILE_SIZE = 50; 
let savedData = JSON.parse(localStorage.getItem('castleBattleSave')) || null;

let gridSize = (savedData && savedData.gridSize) ? savedData.gridSize : 15;
let expansionCost = (savedData && savedData.expansionCost) ? savedData.expansionCost : 100;

let resources = savedData ? savedData.resources : { wood: 300, stone: 300, points: 0, troops: 0, coins: 0 };
if (resources.coins === undefined) resources.coins = 0; 

let buildings = savedData ? savedData.buildings : [];
let maxTroops = 0; 
let maxCoins = 100;

let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1 };
let isBuildMode = false; let inCombat = false; let frameCount = 0; 
let mySavedBase = []; let deployedTroops = []; let lasers = [];

let pendingBuildingType = null;
let pendingBuildingData = null;
let pGridX = -1; let pGridY = -1;

let selectedBuildingId = null;
let isRelocating = false;
let relocatingBuilding = null;

const entityData = {
    castle: { color: '#4a4a4a', emoji: '🏰', maxHp: 1000 },
    lumbermill: { wood: 20, stone: 10, color: '#27ae60', emoji: '🪚', maxHp: 150 },
    mine: { wood: 10, stone: 20, color: '#95a5a6', emoji: '⛏️', maxHp: 150 },
    goldmine: { wood: 50, stone: 50, color: '#f1c40f', emoji: '⛏️🟡', maxHp: 150 },
    vault: { wood: 100, stone: 100, color: '#9b59b6', emoji: '🏦', maxHp: 400, capacityCoins: 500 }, 
    camp: { wood: 50, stone: 30, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5 },
    wall: { wood: 10, stone: 5, color: '#7f8c8d', emoji: '', maxHp: 400 },
    tower: { wood: 20, stone: 15, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 20, range: 200 }
};

if (buildings.length === 0) {
    buildings.push({ id: Date.now(), gridX: Math.floor(gridSize/2), gridY: Math.floor(gridSize/2), type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp });
    saveGame();
}

let goldGenTimer = 0;
setInterval(() => {
    if (inCombat) return;
    let woodGen = 0, stoneGen = 0, goldGen = 0;
    goldGenTimer++;

    buildings.forEach(b => {
        if (b.type === 'castle') { woodGen += 1; stoneGen += 1; }
        if (b.type === 'lumbermill') woodGen += 2;
        if (b.type === 'mine') stoneGen += 2;
        if (b.type === 'goldmine' && goldGenTimer >= 3) goldGen += 1; 
    });

    if (goldGenTimer >= 3) goldGenTimer = 0;

    let uiNeedsUpdate = false;
    if (woodGen > 0 || stoneGen > 0) { resources.wood += woodGen; resources.stone += stoneGen; uiNeedsUpdate = true; }
    if (goldGen > 0 && resources.coins < maxCoins) { 
        resources.coins = Math.min(resources.coins + goldGen, maxCoins); 
        uiNeedsUpdate = true; 
    }
    if (uiNeedsUpdate) { updateUI(); saveGame(); }
}, 1000);

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

function draw() {
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    let mapSize = gridSize * TILE_SIZE;
    ctx.fillStyle = '#4c7c2b'; ctx.fillRect(0, 0, mapSize, mapSize);

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
        
        if (isBuildMode && selectedBuildingId === b.id) {
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        }

        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
        if (b.hp < b.maxHp) {
            ctx.fillStyle = 'black'; ctx.fillRect(px, py - 10, TILE_SIZE, 6);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(px, py - 10, TILE_SIZE * (b.hp/b.maxHp), 6);
        }
    });

    if (pendingBuildingData && pGridX >= 0 && pGridY >= 0) {
        let px = pGridX * TILE_SIZE; let py = pGridY * TILE_SIZE;
        let isOccupied = buildings.some(b => b.gridX === pGridX && b.gridY === pGridY);
        
        ctx.fillStyle = isOccupied ? 'rgba(255, 0, 0, 0.5)' : 'rgba(46, 204, 113, 0.5)';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        
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

// --- MOTOR MULTI-TÁCTIL CORREGIDO ---
let pointers = new Map();
let initialCam = { x: 0, y: 0 };
let startDragPan = { x: 0, y: 0 };
let hasMoved = false;
let isCanvasTouch = false; // EVITA QUE LOS BOTONES BUGUEEN EL MAPA

function updatePointers(e) { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }

canvas.addEventListener('pointerdown', e => {
    isCanvasTouch = true;
    updatePointers(e);
    hasMoved = false;

    if (pointers.size === 1) {
        let pts = Array.from(pointers.values());
        if (pendingBuildingData) {
            let worldX = ((pts[0].x - canvas.width/2) / camera.zoom) + camera.x;
            let worldY = ((pts[0].y - canvas.height/2) / camera.zoom) + camera.y;
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - 1));
            pGridY = Math.max(0, Math.min(pGridY, gridSize - 1));
        } else {
            startDragPan = { x: pts[0].x, y: pts[0].y };
            initialCam = { x: camera.x, y: camera.y };
        }
    } else if (pointers.size === 2) {
        let pts = Array.from(pointers.values());
        startDragPan = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 };
        initialCam = { x: camera.x, y: camera.y };
    }
});

window.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    if (!isCanvasTouch) return; // Bloquea si estás deslizando un botón
    updatePointers(e);

    if (pointers.size === 1) {
        let pts = Array.from(pointers.values());
        if (pendingBuildingData) {
            let worldX = ((pts[0].x - canvas.width/2) / camera.zoom) + camera.x;
            let worldY = ((pts[0].y - canvas.height/2) / camera.zoom) + camera.y;
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - 1)); pGridY = Math.max(0, Math.min(pGridY, gridSize - 1));
        } else {
            let dx = pts[0].x - startDragPan.x, dy = pts[0].y - startDragPan.y;
            if (Math.abs(dx) > 10 || Math.abs(dy) > 10) hasMoved = true;
            camera.x = initialCam.x - (dx / camera.zoom); camera.y = initialCam.y - (dy / camera.zoom);
        }
    } else if (pointers.size === 2) {
        let pts = Array.from(pointers.values());
        let midX = (pts[0].x + pts[1].x)/2, midY = (pts[0].y + pts[1].y)/2;
        let dx = midX - startDragPan.x, dy = midY - startDragPan.y;
        hasMoved = true;
        camera.x = initialCam.x - (dx / camera.zoom); camera.y = initialCam.y - (dy / camera.zoom);
    }
});

window.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    if (!isCanvasTouch) return; // Si tocaste la UI, no hagas nada en el mapa
    
    if (pointers.size === 0 && !hasMoved) {
        let worldX = ((e.clientX - canvas.width/2) / camera.zoom) + camera.x;
        let worldY = ((e.clientY - canvas.height/2) / camera.zoom) + camera.y;
        
        if (inCombat) {
            deployTroop(worldX, worldY);
        } else if (isBuildMode && !pendingBuildingData) {
            let gX = Math.floor(worldX / TILE_SIZE);
            let gY = Math.floor(worldY / TILE_SIZE);
            let clickedBuilding = buildings.find(b => b.gridX === gX && b.gridY === gY);
            
            if (clickedBuilding) {
                selectExistingBuilding(clickedBuilding.id);
            } else if (selectedBuildingId) {
                cancelEdit();
            }
        }
    }
    if (pointers.size === 0) isCanvasTouch = false;
});
window.addEventListener('pointercancel', e => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) isCanvasTouch = false;
});

// --- TIENDA ---
function openShop() { 
    document.getElementById('shop-ui').classList.remove('hidden');
    document.getElementById('expansion-cost-text').innerText = expansionCost;
}
function closeShop() { document.getElementById('shop-ui').classList.add('hidden'); }

function buyExpansion() {
    if (resources.coins >= expansionCost) {
        resources.coins -= expansionCost;
        gridSize += 5;
        expansionCost += 100;
        document.getElementById('expansion-cost-text').innerText = expansionCost;
        showNotification(`¡Mapa expandido a ${gridSize}x${gridSize}!`);
        updateUI(); saveGame();
    } else {
        showNotification("No tienes suficientes Monedas");
    }
}

// --- UI DE CONSTRUCCIÓN ---
function enterBuildMode() {
    isBuildMode = true;
    document.getElementById('normal-ui').classList.add('hidden');
    document.getElementById('build-ui').classList.remove('hidden');
    document.getElementById('build-tray').classList.remove('hidden');
}

function exitBuildMode() {
    isBuildMode = false; 
    cancelPlacement(); 
    cancelEdit();
    document.getElementById('build-ui').classList.add('hidden');
    document.getElementById('normal-ui').classList.remove('hidden');
}

function selectBuilding(type) {
    if(selectedBuildingId) cancelEdit();
    pendingBuildingType = type;
    pendingBuildingData = entityData[type];
    pGridX = Math.floor(camera.x / TILE_SIZE);
    pGridY = Math.floor(camera.y / TILE_SIZE);
    document.getElementById('build-tray').classList.add('hidden');
    document.getElementById('placement-controls').classList.remove('hidden');
}

function cancelPlacement() {
    if (isRelocating && relocatingBuilding) {
        buildings.push(relocatingBuilding); 
        isRelocating = false; relocatingBuilding = null;
    }
    pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
    document.getElementById('placement-controls').classList.add('hidden');
    
    // Regresar de forma segura al carrusel
    selectedBuildingId = null;
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('build-tray').classList.remove('hidden');
}

function confirmPlacement() {
    if (!pendingBuildingData) return;
    if (buildings.some(b => b.gridX === pGridX && b.gridY === pGridY)) return showNotification("Casilla ocupada");
    
    if (isRelocating) {
        let dmg = Math.floor(relocatingBuilding.maxHp * 0.05);
        relocatingBuilding.hp = Math.max(1, relocatingBuilding.hp - dmg);
        relocatingBuilding.gridX = pGridX;
        relocatingBuilding.gridY = pGridY;
        
        buildings.push(relocatingBuilding);
        isRelocating = false; relocatingBuilding = null;
        
        showNotification("Estructura reubicada (-5% HP)");
        pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
        
        document.getElementById('placement-controls').classList.add('hidden');
        document.getElementById('build-tray').classList.remove('hidden');
        selectedBuildingId = null;
        saveGame();
        return;
    }

    if (resources.wood < pendingBuildingData.wood || resources.stone < pendingBuildingData.stone) return showNotification("Recursos insuficientes");
    resources.wood -= pendingBuildingData.wood; resources.stone -= pendingBuildingData.stone;
    buildings.push({ id: Date.now(), gridX: pGridX, gridY: pGridY, type: pendingBuildingType, ...pendingBuildingData, hp: pendingBuildingData.maxHp });
    
    updateCapacity(); updateUI(); saveGame(); showNotification("¡Construcción finalizada!");
    cancelPlacement(); 
}

// --- EDICIÓN (SELECCIÓN, DESTRUIR, REUBICAR) ---
function selectExistingBuilding(id) {
    selectedBuildingId = id;
    document.getElementById('build-tray').classList.add('hidden');
    document.getElementById('placement-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.add('hidden');
    document.getElementById('edit-controls').classList.remove('hidden');
}

function cancelEdit() {
    selectedBuildingId = null;
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.add('hidden');
    document.getElementById('build-tray').classList.remove('hidden');
}

function initDestroy() {
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.remove('hidden');
}

function confirmDestroy() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (b) {
        let data = entityData[b.type];
        let refundWood = Math.floor((data.wood || 0) * 0.4);
        let refundStone = Math.floor((data.stone || 0) * 0.4);
        
        resources.wood += refundWood;
        resources.stone += refundStone;
        buildings = buildings.filter(x => x.id !== selectedBuildingId);
        
        updateCapacity(); updateUI(); saveGame();
        showNotification(`Destruido: +${refundWood}🪵 +${refundStone}🪨 devueltos`);
    }
    cancelEdit();
}

function startRelocate() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (!b) return;
    
    isRelocating = true;
    relocatingBuilding = b;
    pendingBuildingType = b.type;
    pendingBuildingData = entityData[b.type];
    pGridX = b.gridX; 
    pGridY = b.gridY;
    
    buildings = buildings.filter(x => x.id !== selectedBuildingId);
    
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('placement-controls').classList.remove('hidden');
}

// --- UTILIDADES ---
function saveGame() { if (!inCombat) localStorage.setItem('castleBattleSave', JSON.stringify({ resources, buildings, gridSize, expansionCost })); }

function updateCapacity() { 
    maxTroops = buildings.filter(b => b.type === 'camp').length * entityData.camp.capacity; 
    maxCoins = 100 + (buildings.filter(b => b.type === 'vault').length * entityData.vault.capacityCoins);
}

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
        { id: 5, gridX: 7, gridY: 9, type: 'goldmine', ...entityData.goldmine, hp: entityData.goldmine.maxHp }
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

function winCombat() { 
    let lootedCoins = 25;
    showNotification(`¡VICTORIA! 100🪵 100🪨 ${lootedCoins}🪙 20🏆`); 
    resources.wood += 100; resources.stone += 100; resources.points += 20; 
    resources.coins = Math.min(resources.coins + lootedCoins, maxCoins);
    setTimeout(endCombat, 2500); 
}
function loseCombat() { showNotification("DERROTA... Tus tropas perecieron."); setTimeout(endCombat, 2500); }
function endCombat() {
    inCombat = false; deployedTroops = []; lasers = []; buildings = mySavedBase; updateCapacity(); 
    document.getElementById('combat-ui').classList.add('hidden'); document.getElementById('normal-ui').classList.remove('hidden');
    updateUI(); saveGame();
}

function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood; document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-coins').innerText = `${resources.coins}/${maxCoins}`;
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`; document.getElementById('res-points').innerText = resources.points;
}
function changeZoom(amount) { camera.zoom = Math.max(0.4, Math.min(camera.zoom + amount, 2.5)); }
function showNotification(msg) { uiLog.innerText = msg; setTimeout(() => uiLog.innerText = "", 2000); }

updateCapacity(); updateUI();
