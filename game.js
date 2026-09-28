const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const TILE_SIZE = 50; 
let savedData = JSON.parse(localStorage.getItem('castleBattleSave')) || null;

let gridSize = (savedData && savedData.gridSize) ? savedData.gridSize : 15;
let expansionCost = (savedData && savedData.expansionCost) ? savedData.expansionCost : 100;
let lastSaveTime = (savedData && savedData.lastSaveTime) ? savedData.lastSaveTime : Date.now();

let resources = savedData ? savedData.resources : { wood: 500, stone: 500, points: 0, troops: 0, coins: 0 };
if (resources.coins === undefined) resources.coins = 0; 

let buildings = savedData ? savedData.buildings : [];
let maxTroops = 0; 
let maxCoins = 100;

let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1 };
let isBuildMode = false; let inCombat = false; let combatOver = false; let frameCount = 0; 
let mySavedBase = []; let deployedTroops = []; let lasers = [];

let pendingBuildingType = null;
let pendingBuildingData = null;
let pGridX = -1; let pGridY = -1;

let selectedBuildingId = null;
let isRelocating = false;
let relocatingBuilding = null;

const entityData = {
    castle: { wood: 1000, stone: 1000, color: '#4a4a4a', emoji: '🏰', maxHp: 1000 },
    lumbermill: { wood: 150, stone: 50, color: '#27ae60', emoji: '🪚', maxHp: 150 },
    mine: { wood: 50, stone: 150, color: '#95a5a6', emoji: '⛏️', maxHp: 150 },
    goldmine: { wood: 250, stone: 250, color: '#f1c40f', emoji: '⛏️🟡', maxHp: 150 },
    vault: { wood: 400, stone: 400, color: '#9b59b6', emoji: '🏦', maxHp: 400, capacityCoins: 500 }, 
    camp: { wood: 200, stone: 150, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5 },
    wall: { wood: 40, stone: 20, color: '#7f8c8d', emoji: '', maxHp: 400 },
    tower: { wood: 150, stone: 150, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 20, range: 200 }
};

if (buildings.length === 0) {
    buildings.push({ id: Date.now(), gridX: Math.floor(gridSize/2), gridY: Math.floor(gridSize/2), type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp });
    saveGame();
}

let offlineSeconds = (Date.now() - lastSaveTime) / 1000;
buildings.forEach(b => {
    let decay = b.maxHp * (offlineSeconds / 86400);
    b.hp = Math.max(0, b.hp - decay);
});

let goldGenTimer = 0;
setInterval(() => {
    if (inCombat) return;
    let woodGen = 0, stoneGen = 0, goldGen = 0;
    goldGenTimer++;

    buildings.forEach(b => {
        if (b.hp > 0) {
            if (b.type === 'castle') { woodGen += 1; stoneGen += 1; }
            if (b.type === 'lumbermill') woodGen += 2;
            if (b.type === 'mine') stoneGen += 2;
            if (b.type === 'goldmine' && goldGenTimer >= 3) goldGen += 1; 
            b.hp = Math.max(0, b.hp - (b.maxHp / 86400));
        }
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
    if (inCombat && !combatOver) {
        buildings = buildings.filter(b => b.hp > 0);
        
        if (buildings.length === 0 && deployedTroops.length > 0) { resolveCombat('win'); return; }
        if (deployedTroops.length === 0 && resources.troops <= 0 && buildings.length > 0) { resolveCombat('lose'); return; }

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

    // Dibujar Estructuras Existentes
    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE, py = b.gridY * TILE_SIZE;
        
        // ESTADO RUINA (0% HP)
        if (b.hp <= 0) {
            ctx.fillStyle = '#333'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
            if (isBuildMode && selectedBuildingId === b.id) {
                ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            } else {
                ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            }
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText('🏚️', px + TILE_SIZE/2, py + TILE_SIZE/2);
            return; 
        }

        // ESTADO NORMAL Y BORDES DE DETERIORO
        ctx.fillStyle = b.color; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        
        let hpRatio = b.hp / b.maxHp;
        let perimeter = TILE_SIZE * 4;

        if (isBuildMode && selectedBuildingId === b.id) {
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
            
            if (hpRatio > 0 && hpRatio < 1) {
                ctx.strokeStyle = (hpRatio > 0.5) ? '#2ecc71' : '#e74c3c';
                ctx.setLineDash([perimeter * hpRatio, perimeter]);
                ctx.lineDashOffset = 0;
                ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.setLineDash([]); 
            }
        }

        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
    });

    // CAJA DE CONSTRUCCIÓN SEMITRANSPARENTE
    if (pendingBuildingData && pGridX >= 0 && pGridY >= 0) {
        let px = pGridX * TILE_SIZE; let py = pGridY * TILE_SIZE;
        let isOccupied = buildings.some(b => b.gridX === pGridX && b.gridY === pGridY);
        
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = pendingBuildingData.color; 
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        if (pendingBuildingData.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${TILE_SIZE * 0.6}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(pendingBuildingData.emoji, px + TILE_SIZE/2, py + TILE_SIZE/2);
        }
        ctx.globalAlpha = 1.0;

        let perimeter = TILE_SIZE * 4;
        let p = 1 - ((frameCount % 90) / 90); 
        
        ctx.strokeStyle = isOccupied ? '#e74c3c' : '#2ecc71';
        ctx.lineWidth = 4;
        ctx.setLineDash([perimeter * p, perimeter]);
        ctx.lineDashOffset = 0;
        ctx.strokeRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.setLineDash([]);
    }

    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(t.x - 6, t.y - 12, 12 * (t.hp/100), 3);
    });
    lasers.forEach(l => {
        ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    });

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); } gameLoop(); 

// --- MOTOR MULTI-TÁCTIL ---
let pointers = new Map();
let initialCam = { x: 0, y: 0 };
let startDragPan = { x: 0, y: 0 };
let hasMoved = false;
let isCanvasTouch = false; 

function updatePointers(e) { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }

canvas.addEventListener('pointerdown', e => {
    isCanvasTouch = true; updatePointers(e); hasMoved = false;
    if (pointers.size === 1) {
        let pts = Array.from(pointers.values());
        if (pendingBuildingData) {
            let worldX = ((pts[0].x - canvas.width/2) / camera.zoom) + camera.x;
            let worldY = ((pts[0].y - canvas.height/2) / camera.zoom) + camera.y;
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - 1)); pGridY = Math.max(0, Math.min(pGridY, gridSize - 1));
        } else {
            startDragPan = { x: pts[0].x, y: pts[0].y }; initialCam = { x: camera.x, y: camera.y };
        }
    } else if (pointers.size === 2) {
        let pts = Array.from(pointers.values());
        startDragPan = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 }; initialCam = { x: camera.x, y: camera.y };
    }
});

window.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    if (!isCanvasTouch) return; 
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
        let dx = midX - startDragPan.x, dy = midY - startDragPan.y; hasMoved = true;
        camera.x = initialCam.x - (dx / camera.zoom); camera.y = initialCam.y - (dy / camera.zoom);
    }
});

window.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    if (!isCanvasTouch) return; 
    
    if (pointers.size === 0 && !hasMoved) {
        let worldX = ((e.clientX - canvas.width/2) / camera.zoom) + camera.x;
        let worldY = ((e.clientY - canvas.height/2) / camera.zoom) + camera.y;
        
        if (inCombat && !combatOver) {
            deployTroop(worldX, worldY);
        } else if (isBuildMode && !pendingBuildingData) {
            let gX = Math.floor(worldX / TILE_SIZE); let gY = Math.floor(worldY / TILE_SIZE);
            let clickedBuilding = buildings.find(b => b.gridX === gX && b.gridY === gY);
            
            if (clickedBuilding) selectExistingBuilding(clickedBuilding.id);
            else if (selectedBuildingId) cancelEdit();
        }
    }
    if (pointers.size === 0) isCanvasTouch = false;
});
window.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size === 0) isCanvasTouch = false; });

// --- FUNCIONALIDADES GENERALES ---
function openShop() { document.getElementById('shop-ui').classList.remove('hidden'); document.getElementById('expansion-cost-text').innerText = expansionCost; }
function closeShop() { document.getElementById('shop-ui').classList.add('hidden'); }

function buyExpansion() {
    if (resources.coins >= expansionCost) {
        resources.coins -= expansionCost; gridSize += 5; expansionCost += 100;
        document.getElementById('expansion-cost-text').innerText = expansionCost;
        showNotification(`¡Mapa expandido a ${gridSize}x${gridSize}!`); updateUI(); saveGame();
    } else showNotification("No tienes suficientes Monedas");
}

function enterBuildMode() {
    isBuildMode = true; document.getElementById('normal-ui').classList.add('hidden');
    document.getElementById('build-ui').classList.remove('hidden'); document.getElementById('build-tray').classList.remove('hidden');
}

function exitBuildMode() {
    isBuildMode = false; cancelPlacement(); cancelEdit();
    document.getElementById('build-ui').classList.add('hidden'); document.getElementById('normal-ui').classList.remove('hidden');
}

function selectBuilding(type) {
    if(selectedBuildingId) cancelEdit();
    pendingBuildingType = type; pendingBuildingData = entityData[type];
    pGridX = Math.floor(camera.x / TILE_SIZE); pGridY = Math.floor(camera.y / TILE_SIZE);
    document.getElementById('build-tray').classList.add('hidden'); document.getElementById('placement-controls').classList.remove('hidden');
}

function cancelPlacement() {
    if (isRelocating && relocatingBuilding) { buildings.push(relocatingBuilding); isRelocating = false; relocatingBuilding = null; }
    pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
    document.getElementById('placement-controls').classList.add('hidden');
    selectedBuildingId = null; document.getElementById('edit-controls').classList.add('hidden'); document.getElementById('ruin-controls').classList.add('hidden'); document.getElementById('build-tray').classList.remove('hidden');
}

function confirmPlacement() {
    if (!pendingBuildingData) return;
    if (buildings.some(b => b.gridX === pGridX && b.gridY === pGridY)) return showNotification("Casilla ocupada");
    
    if (isRelocating) {
        let dmg = Math.floor(relocatingBuilding.maxHp * 0.05); 
        relocatingBuilding.hp = Math.max(0, relocatingBuilding.hp - dmg);
        relocatingBuilding.gridX = pGridX; relocatingBuilding.gridY = pGridY;
        
        buildings.push(relocatingBuilding);
        isRelocating = false; relocatingBuilding = null;
        
        showNotification("Estructura reubicada (-5% HP)");
        pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
        document.getElementById('placement-controls').classList.add('hidden'); document.getElementById('build-tray').classList.remove('hidden');
        selectedBuildingId = null; saveGame(); return;
    }

    if (resources.wood < pendingBuildingData.wood || resources.stone < pendingBuildingData.stone) return showNotification("Recursos insuficientes");
    resources.wood -= pendingBuildingData.wood; resources.stone -= pendingBuildingData.stone;
    buildings.push({ id: Date.now(), gridX: pGridX, gridY: pGridY, type: pendingBuildingType, ...pendingBuildingData, hp: pendingBuildingData.maxHp });
    
    updateCapacity(); updateUI(); saveGame(); showNotification("¡Construcción finalizada!"); cancelPlacement(); 
}

function getRepairCost(b) {
    let data = entityData[b.type]; let ratio = 1 - (b.hp / b.maxHp);
    return { wood: Math.ceil((data.wood || 0) * ratio), stone: Math.ceil((data.stone || 0) * ratio) };
}

function selectExistingBuilding(id) {
    selectedBuildingId = id;
    let b = buildings.find(x => x.id === id);
    let data = entityData[b.type];
    
    document.getElementById('build-tray').classList.add('hidden');
    document.getElementById('placement-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.add('hidden');
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('ruin-controls').classList.add('hidden');
    
    if (b.hp <= 0) {
        document.getElementById('ruin-controls').classList.remove('hidden');
        document.getElementById('btn-rebuild').innerHTML = `🏗️ Reconstruir<br><small>${data.wood}🪵 ${data.stone}🪨</small>`;
    } else {
        document.getElementById('edit-controls').classList.remove('hidden');
        let btnRepair = document.getElementById('btn-repair');
        if (b.hp < b.maxHp) {
            let cost = getRepairCost(b);
            btnRepair.style.display = 'block';
            btnRepair.innerHTML = `🔨 Reparar<br><small>${cost.wood}🪵 ${cost.stone}🪨</small>`;
        } else {
            btnRepair.style.display = 'none'; 
        }
    }
}

function cancelEdit() {
    selectedBuildingId = null;
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('ruin-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.add('hidden');
    document.getElementById('build-tray').classList.remove('hidden');
}

function repairBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    let cost = getRepairCost(b);
    if (resources.wood >= cost.wood && resources.stone >= cost.stone) {
        resources.wood -= cost.wood; resources.stone -= cost.stone;
        b.hp = b.maxHp; updateCapacity(); updateUI(); saveGame(); showNotification("Estructura Reparada"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function rebuildBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    let data = entityData[b.type];
    if (resources.wood >= data.wood && resources.stone >= data.stone) {
        resources.wood -= data.wood; resources.stone -= data.stone;
        b.hp = b.maxHp; updateCapacity(); updateUI(); saveGame(); showNotification("Estructura Reconstruida"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function initDestroy() {
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('ruin-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.remove('hidden');
}

function confirmDestroy() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (b) {
        let data = entityData[b.type];
        let refundWood = Math.floor((data.wood || 0) * 0.4);
        let refundStone = Math.floor((data.stone || 0) * 0.4);
        
        resources.wood += refundWood; resources.stone += refundStone;
        buildings = buildings.filter(x => x.id !== selectedBuildingId);
        
        updateCapacity(); updateUI(); saveGame();
        showNotification(`Destruido: +${refundWood}🪵 +${refundStone}🪨 devueltos`);
    }
    cancelEdit();
}

function startRelocate() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (!b) return;
    
    isRelocating = true; relocatingBuilding = b; pendingBuildingType = b.type; pendingBuildingData = entityData[b.type];
    pGridX = b.gridX; pGridY = b.gridY;
    buildings = buildings.filter(x => x.id !== selectedBuildingId);
    
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('placement-controls').classList.remove('hidden');
}

function saveGame() { if (!inCombat) localStorage.setItem('castleBattleSave', JSON.stringify({ resources, buildings, gridSize, expansionCost, lastSaveTime: Date.now() })); }

function updateCapacity() { 
    maxTroops = buildings.filter(b => b.type === 'camp' && b.hp > 0).length * entityData.camp.capacity; 
    maxCoins = 100 + (buildings.filter(b => b.type === 'vault' && b.hp > 0).length * entityData.vault.capacityCoins);
}

function trainTroop() {
    updateCapacity();
    if (resources.troops >= maxTroops) return showNotification(`Campamentos llenos (${maxTroops} max).`);
    if (resources.wood >= 25) { resources.wood -= 25; resources.troops++; updateUI(); saveGame(); showNotification("¡Bárbaro entrenado!");
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
    inCombat = true; combatOver = false; deployedTroops = []; lasers = [];
    document.getElementById('normal-ui').classList.add('hidden'); document.getElementById('combat-ui').classList.remove('hidden');
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 0.8;
}

function deployTroop(x, y) {
    if (!inCombat || combatOver || resources.troops <= 0) return showNotification("¡No te quedan tropas!");
    let boundary = gridSize * TILE_SIZE;
    if (x > 2*TILE_SIZE && x < boundary - 2*TILE_SIZE && y > 2*TILE_SIZE && y < boundary - 2*TILE_SIZE) return showNotification("Despliega tropas en las afueras");
    resources.troops--; updateUI();
    deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 8, target: null });
}

function resolveCombat(type) {
    if (combatOver) return;
    combatOver = true;
    
    let surviving = deployedTroops.length; 
    resources.troops = Math.min(maxTroops, resources.troops + surviving);
    
    if (type === 'win') {
        let lootedCoins = 50;
        resources.wood += 250; resources.stone += 250; resources.points += 20; 
        resources.coins = Math.min(resources.coins + lootedCoins, maxCoins);
        showNotification(`¡VICTORIA! 250🪵 250🪨 ${lootedCoins}🪙\nSobreviven: ${surviving} 🗡️`); 
    } else if (type === 'lose') {
        showNotification(`DERROTA...\nSobreviven: ${surviving} 🗡️`);
    } else if (type === 'surrender') {
        showNotification(`TE RENDISTE.\nRegresan: ${surviving} 🗡️`);
    }
    
    updateUI(); saveGame();
    setTimeout(endCombat, 2500);
}

function winCombat() { resolveCombat('win'); }
function loseCombat() { resolveCombat('lose'); }
function surrender() { resolveCombat('surrender'); }

function endCombat() {
    inCombat = false; combatOver = false; deployedTroops = []; lasers = []; 
    buildings = mySavedBase; updateCapacity(); 
    document.getElementById('combat-ui').classList.add('hidden'); document.getElementById('normal-ui').classList.remove('hidden');
    updateUI(); saveGame();
}

function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood; document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-coins').innerText = `${Math.floor(resources.coins)}/${maxCoins}`;
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`; document.getElementById('res-points').innerText = resources.points;
}
function changeZoom(amount) { camera.zoom = Math.max(0.4, Math.min(camera.zoom + amount, 2.5)); }
function showNotification(msg) { uiLog.innerText = msg; setTimeout(() => uiLog.innerText = "", 2000); }

// --- NUEVO: SISTEMA DE PANTALLA COMPLETA ---
function toggleFullScreen() {
    let doc = window.document;
    let docEl = doc.documentElement;

    let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    let cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl).then(() => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(function(error) {
                    console.log("El bloqueo de orientación no es compatible en este dispositivo.", error);
                });
            }
            document.getElementById('btn-fs').innerText = "🗗";
        }).catch(err => { showNotification(`Error: ${err.message}`); });
    } else {
        cancelFullScreen.call(doc);
        if (screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); }
        document.getElementById('btn-fs').innerText = "🔲";
    }
}

updateCapacity(); updateUI();
