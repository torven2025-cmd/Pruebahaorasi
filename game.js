const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const TILE_SIZE = 25; 
let gridSize = 40; 

// SIN GUARDADO LOCAL - ECONOMÍA: MONEDAS, ELIXIR, GEMAS
let resources = { gold: 1500, elixir: 1500, points: 0, troops: 0, gems: 0 };
let buildings = [];

const thStats = [
    { hp: 0, cap: 0, cost: 0 },
    { hp: 400, cap: 1000, cost: 0 },         
    { hp: 800, cap: 2500, cost: 1000 },      
    { hp: 1200, cap: 5000, cost: 2500 },     
    { hp: 1600, cap: 10000, cost: 5000 },    
    { hp: 2000, cap: 20000, cost: 10000 },   
    { hp: 2500, cap: 35000, cost: 25000 },   
    { hp: 3000, cap: 50000, cost: 50000 },   
    { hp: 3800, cap: 75000, cost: 100000 },  
    { hp: 4600, cap: 100000, cost: 250000 }, 
    { hp: 5500, cap: 150000, cost: 500000 }  
];

const entityData = {
    townhall: { color: '#4a4a4a', emoji: '🏛️', w: 4, h: 4 }, 
    camp: { gold: 200, elixir: 150, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5, w: 3, h: 3 },
    barracks: { gold: 300, elixir: 200, color: '#d35400', emoji: '⚔️', maxHp: 250, w: 3, h: 3 }, 
    builder_hut: { gold: 100, elixir: 0, color: '#f39c12', emoji: '🏠', maxHp: 100, w: 2, h: 2 },
    elixir_pump: { gold: 50, elixir: 150, color: '#95a5a6', emoji: '💧', maxHp: 150, w: 3, h: 3 },
    goldmine: { gold: 250, elixir: 250, color: '#f1c40f', emoji: '⛏️🟡', maxHp: 150, w: 3, h: 3 },
    vault_elixir: { gold: 200, elixir: 200, color: '#8e44ad', emoji: '🫙', maxHp: 400, w: 3, h: 3 },
    vault_gold: { gold: 400, elixir: 400, color: '#2ecc71', emoji: '🏦', maxHp: 400, w: 3, h: 3 }, 
    cannon: { gold: 200, elixir: 200, color: '#7f8c8d', emoji: '💣', maxHp: 300, damage: 25, range: 180, w: 3, h: 3 },
    tower: { gold: 250, elixir: 250, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 15, range: 250, w: 3, h: 3 },
    wall: { gold: 40, elixir: 20, color: '#555', emoji: '🧱', maxHp: 400, w: 1, h: 1 }
};

let maxTroops = 0; let maxGold = 1000; let maxElixir = 1000;
let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1.2 };
let isBuildMode = false; let frameCount = 0; 

let pendingBuildingType = null; let pendingBuildingData = null; let pGridX = -1; let pGridY = -1;
let selectedBuildingId = null; let isRelocating = false; let relocatingBuilding = null;

// CREACIÓN BASE INICIAL (Con Ayuntamiento Nivel 1 y Choza)
if (buildings.length === 0) {
    buildings.push({ id: 1, gridX: 18, gridY: 18, type: 'townhall', level: 1, ...entityData.townhall, maxHp: 400, hp: 400 });
    buildings.push({ id: 2, gridX: 15, gridY: 18, type: 'builder_hut', ...entityData.builder_hut, maxHp: 100, hp: 100 });
    buildings.push({ id: 3, gridX: 14, gridY: 14, type: 'camp', ...entityData.camp, maxHp: 200, hp: 200 });
    updateCapacity();
}

// GENERACIÓN DE RECURSOS (Cero deterioro)
let resourceTimer = 0;
setInterval(() => {
    let goldGen = 0, elixirGen = 0;
    resourceTimer++;

    buildings.forEach(b => {
        if (b.hp > 0) {
            if (b.type === 'townhall') { goldGen += 1; elixirGen += 1; }
            if (b.type === 'goldmine') goldGen += 2;
            if (b.type === 'elixir_pump') elixirGen += 2;
        }
    });

    if (resourceTimer >= 3) resourceTimer = 0;
    
    if (goldGen > 0 || elixirGen > 0) { 
        resources.gold = Math.min(resources.gold + goldGen, maxGold);
        resources.elixir = Math.min(resources.elixir + elixirGen, maxElixir);
        updateUI();
    }
}, 1000);

function update() {
    frameCount++;
    // Combate eliminado por completo para mantener la estabilidad
}

function isOccupied(gX, gY, w, h, ignoreId = null) {
    for (let b of buildings) {
        if (b.id === ignoreId) continue;
        let bw = b.w || 3; let bh = b.h || 3;
        if (gX < b.gridX + bw && gX + w > b.gridX && gY < b.gridY + bh && gY + h > b.gridY) return true;
    }
    return false;
}

function draw() {
    ctx.fillStyle = '#2c3e50'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom); ctx.translate(-camera.x, -camera.y);

    let mapSize = gridSize * TILE_SIZE;
    ctx.fillStyle = '#4c7c2b'; ctx.fillRect(0, 0, mapSize, mapSize);

    if (isBuildMode || selectedBuildingId || pendingBuildingData) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = 0; x <= mapSize; x += TILE_SIZE) { ctx.moveTo(x, 0); ctx.lineTo(x, mapSize); }
        for (let y = 0; y <= mapSize; y += TILE_SIZE) { ctx.moveTo(0, y); ctx.lineTo(mapSize, y); }
        ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.strokeRect(0, 0, mapSize, mapSize);

    buildings.forEach(b => {
        let bw = b.w || 3; let bh = b.h || 3;
        let px = b.gridX * TILE_SIZE, py = b.gridY * TILE_SIZE;
        let pxW = bw * TILE_SIZE; let pyH = bh * TILE_SIZE;
        
        if (b.hp <= 0) {
            ctx.fillStyle = '#333'; ctx.fillRect(px, py, pxW, pyH);
            ctx.strokeStyle = (selectedBuildingId === b.id) ? '#f1c40f' : 'rgba(0,0,0,0.8)'; 
            ctx.lineWidth = (selectedBuildingId === b.id) ? 4 : 2; ctx.strokeRect(px, py, pxW, pyH);
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(pxW, pyH) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText('🏚️', px + pxW/2, py + pyH/2);
            return; 
        }

        ctx.fillStyle = b.color; ctx.fillRect(px, py, pxW, pyH);
        let hpRatio = b.hp / b.maxHp; 
        if(isNaN(hpRatio) || !isFinite(hpRatio)) hpRatio = 1;

        let perimeter = (pxW * 2) + (pyH * 2);

        if (isBuildMode && selectedBuildingId === b.id) {
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(px, py, pxW, pyH);
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, pxW, pyH);
            if (hpRatio > 0 && hpRatio < 1) {
                ctx.strokeStyle = (hpRatio > 0.5) ? '#2ecc71' : '#e74c3c';
                ctx.lineWidth = 3; ctx.setLineDash([perimeter * hpRatio, perimeter]); ctx.lineDashOffset = 0;
                ctx.strokeRect(px, py, pxW, pyH); ctx.setLineDash([]); 
            }
        }

        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(pxW, pyH) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + pxW/2, py + pyH/2);
            if(b.type === 'townhall') {
                ctx.fillStyle = 'yellow'; ctx.font = `14px Arial`; ctx.fillText('Lv.' + b.level, px + pxW/2, py + pyH - 15);
            }
        }
    });

    if (pendingBuildingData && pGridX >= 0 && pGridY >= 0) {
        let bw = pendingBuildingData.w || 3; let bh = pendingBuildingData.h || 3;
        let px = pGridX * TILE_SIZE; let py = pGridY * TILE_SIZE;
        let pxW = bw * TILE_SIZE; let pyH = bh * TILE_SIZE;
        let occupied = isOccupied(pGridX, pGridY, bw, bh, relocatingBuilding ? relocatingBuilding.id : null);
        
        ctx.globalAlpha = 0.6; ctx.fillStyle = pendingBuildingData.color; ctx.fillRect(px, py, pxW, pyH);
        if (pendingBuildingData.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(pxW, pyH) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(pendingBuildingData.emoji, px + pxW/2, py + pyH/2);
        }
        ctx.globalAlpha = 1.0;

        let perimeter = (pxW * 2) + (pyH * 2); let p = 1 - ((frameCount % 90) / 90); 
        ctx.strokeStyle = occupied ? '#e74c3c' : '#2ecc71';
        ctx.lineWidth = 4; ctx.setLineDash([perimeter * p, perimeter]); ctx.lineDashOffset = 0;
        ctx.strokeRect(px, py, pxW, pyH); ctx.setLineDash([]);
    }

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); } gameLoop(); 

// --- MOTOR TÁCTIL Y ZOOM ---
let pointers = new Map(); let initialCam = { x: 0, y: 0 }; let startDragPan = { x: 0, y: 0 }; 
let hasMoved = false; let isCanvasTouch = false; let initialPinchDist = null; let initialZoom = 1;

function updatePointers(e) { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }

canvas.addEventListener('pointerdown', e => {
    isCanvasTouch = true; updatePointers(e); hasMoved = false;
    if (pointers.size === 1) {
        let pts = Array.from(pointers.values());
        if (pendingBuildingData) {
            let worldX = ((pts[0].x - canvas.width/2) / camera.zoom) + camera.x; let worldY = ((pts[0].y - canvas.height/2) / camera.zoom) + camera.y;
            let bw = pendingBuildingData.w || 3; let bh = pendingBuildingData.h || 3;
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - bw)); pGridY = Math.max(0, Math.min(pGridY, gridSize - bh));
        } else {
            startDragPan = { x: pts[0].x, y: pts[0].y }; initialCam = { x: camera.x, y: camera.y };
        }
    } else if (pointers.size === 2) {
        let pts = Array.from(pointers.values());
        startDragPan = { x: (pts[0].x + pts[1].x)/2, y: (pts[0].y + pts[1].y)/2 }; initialCam = { x: camera.x, y: camera.y };
        initialPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); initialZoom = camera.zoom;
    }
});

window.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return; if (!isCanvasTouch) return; updatePointers(e);

    if (pointers.size === 1) {
        let pts = Array.from(pointers.values());
        if (pendingBuildingData) {
            let worldX = ((pts[0].x - canvas.width/2) / camera.zoom) + camera.x; let worldY = ((pts[0].y - canvas.height/2) / camera.zoom) + camera.y;
            let bw = pendingBuildingData.w || 3; let bh = pendingBuildingData.h || 3;
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - bw)); pGridY = Math.max(0, Math.min(pGridY, gridSize - bh));
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
        
        let currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (initialPinchDist) {
            let scaleRatio = currentDist / initialPinchDist;
            camera.zoom = Math.max(0.4, Math.min(initialZoom * scaleRatio, 3.0));
        }
    }
});

window.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId); if (!isCanvasTouch) return; 
    if (pointers.size < 2) initialPinchDist = null;

    if (pointers.size === 0 && !hasMoved) {
        let worldX = ((e.clientX - canvas.width/2) / camera.zoom) + camera.x; let worldY = ((e.clientY - canvas.height/2) / camera.zoom) + camera.y;
        let gX = Math.floor(worldX / TILE_SIZE); let gY = Math.floor(worldY / TILE_SIZE);

        if (!pendingBuildingData) {
            let clickedBuilding = buildings.find(b => {
                let bw = b.w || 3; let bh = b.h || 3;
                return gX >= b.gridX && gX < b.gridX + bw && gY >= b.gridY && gY < b.gridY + bh;
            });
            if (!clickedBuilding && !selectedBuildingId && isBuildMode) exitBuildMode();
            else if (clickedBuilding) { enterBuildMode(); selectExistingBuilding(clickedBuilding.id); } 
            else if (selectedBuildingId) cancelEdit();
        }
    }
    if (pointers.size === 0) isCanvasTouch = false;
});
window.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size === 0) isCanvasTouch = false; });

// --- GESTIÓN DE TIENDA Y CONSTRUCCIÓN ---
function openShop() { isBuildMode = true; document.getElementById('main-hud').classList.add('hidden'); document.getElementById('shop-ui').classList.remove('hidden'); document.getElementById('shop-wood').innerText = Math.floor(resources.gold); document.getElementById('shop-stone').innerText = Math.floor(resources.elixir); document.getElementById('shop-coins').innerText = Math.floor(resources.gems); }
function closeShop() { isBuildMode = false; document.getElementById('shop-ui').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden'); }

function switchShopTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); event.currentTarget.classList.add('active');
    document.querySelectorAll('.shop-grid').forEach(grid => grid.classList.add('hidden')); document.getElementById('tab-' + tabId).classList.remove('hidden');
}

function selectBuilding(type) {
    if (type !== 'builder_hut' && !buildings.some(b => b.type === 'builder_hut')) {
        return showNotification("¡Necesitas una Choza de Constructor primero!");
    }
    if(selectedBuildingId) cancelEdit();
    pendingBuildingType = type; pendingBuildingData = entityData[type];
    pGridX = Math.floor(camera.x / TILE_SIZE); pGridY = Math.floor(camera.y / TILE_SIZE);
    document.getElementById('shop-ui').classList.add('hidden'); document.getElementById('placement-controls').classList.remove('hidden');
    isBuildMode = true;
}

function enterBuildMode() { isBuildMode = true; } 
function exitBuildMode() { isBuildMode = false; cancelPlacement(); cancelEdit(); document.getElementById('shop-ui').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden'); }

function cancelPlacement() {
    if (isRelocating && relocatingBuilding) { buildings.push(relocatingBuilding); isRelocating = false; relocatingBuilding = null; }
    pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
    document.getElementById('placement-controls').classList.add('hidden');
    selectedBuildingId = null; document.getElementById('main-hud').classList.remove('hidden'); isBuildMode = false;
}

function confirmPlacement() {
    if (!pendingBuildingData) return;
    let bw = pendingBuildingData.w || 3; let bh = pendingBuildingData.h || 3;
    if (isOccupied(pGridX, pGridY, bw, bh, relocatingBuilding ? relocatingBuilding.id : null)) return showNotification("Casilla ocupada");
    
    if (isRelocating) {
        relocatingBuilding.gridX = pGridX; relocatingBuilding.gridY = pGridY;
        buildings.push(relocatingBuilding); isRelocating = false; relocatingBuilding = null;
        showNotification("Estructura reubicada"); pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
        document.getElementById('placement-controls').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden');
        selectedBuildingId = null; isBuildMode = false; return;
    }

    if (resources.gold < pendingBuildingData.gold || resources.elixir < pendingBuildingData.elixir) return showNotification("Recursos insuficientes");
    resources.gold -= pendingBuildingData.gold; resources.elixir -= pendingBuildingData.elixir;
    buildings.push({ id: Date.now(), gridX: pGridX, gridY: pGridY, type: pendingBuildingType, ...pendingBuildingData, hp: pendingBuildingData.maxHp });
    updateCapacity(); updateUI(); showNotification("¡Construcción finalizada!"); cancelPlacement(); 
}

// --- EDICIÓN (Mejorar) ---
function getRepairCost(b) {
    let data = entityData[b.type]; let ratio = 1 - (b.hp / b.maxHp);
    return { gold: Math.ceil((data.gold || 0) * ratio), elixir: Math.ceil((data.elixir || 0) * ratio) };
}

function selectExistingBuilding(id) {
    selectedBuildingId = id;
    let b = buildings.find(x => x.id === id); let data = entityData[b.type];
    
    document.getElementById('main-hud').classList.add('hidden');
    document.getElementById('placement-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.add('hidden');
    document.getElementById('edit-controls').classList.add('hidden');
    document.getElementById('ruin-controls').classList.add('hidden');
    
    if (b.hp <= 0) {
        document.getElementById('ruin-controls').classList.remove('hidden');
        let btnDestroyRuin = document.getElementById('btn-destroy-ruin');
        if(b.type === 'townhall') btnDestroyRuin.style.display = 'none'; else btnDestroyRuin.style.display = 'block';
        document.getElementById('btn-rebuild').innerHTML = `🏗️ Reconstruir<br><small>${data.gold || 0}🪙 ${data.elixir || 0}💧</small>`;
    } else {
        document.getElementById('edit-controls').classList.remove('hidden');
        
        let btnTrain = document.getElementById('btn-train-troop');
        if (b.type === 'barracks') { btnTrain.style.display = 'block'; } else { btnTrain.style.display = 'none'; }

        let btnUpgrade = document.getElementById('btn-upgrade');
        if (b.type === 'townhall' && b.level < 10) { 
            let nextLv = b.level + 1; let cost = thStats[nextLv].cost;
            btnUpgrade.style.display = 'block'; btnUpgrade.innerHTML = `✨ Mejorar (Lv.${nextLv})<br><small>${cost}🪙</small>`;
        } else { btnUpgrade.style.display = 'none'; }

        let btnDestroy = document.getElementById('btn-destroy-init');
        if (b.type === 'townhall') { btnDestroy.style.display = 'none'; } else { btnDestroy.style.display = 'block'; }

        let btnRepair = document.getElementById('btn-repair');
        if (b.hp < b.maxHp) {
            let cost = getRepairCost(b); btnRepair.style.display = 'block';
            btnRepair.innerHTML = `🔨 Reparar<br><small>${cost.gold}🪙 ${cost.elixir}💧</small>`;
        } else { btnRepair.style.display = 'none'; }
    }
}

function cancelEdit() {
    selectedBuildingId = null; isBuildMode = false;
    document.getElementById('edit-controls').classList.add('hidden'); document.getElementById('ruin-controls').classList.add('hidden');
    document.getElementById('destroy-controls').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden');
}

function repairBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId); let cost = getRepairCost(b);
    if (resources.gold >= cost.gold && resources.elixir >= cost.elixir) {
        resources.gold -= cost.gold; resources.elixir -= cost.elixir;
        b.hp = b.maxHp; updateCapacity(); updateUI(); showNotification("Estructura Reparada"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function rebuildBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId); let data = entityData[b.type];
    let costG = data.gold || 0; let costE = data.elixir || 0;
    if (resources.gold >= costG && resources.elixir >= costE) {
        resources.gold -= costG; resources.elixir -= costE;
        b.hp = b.maxHp; updateCapacity(); updateUI(); showNotification("Estructura Reconstruida"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function upgradeBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (b && b.type === 'townhall' && b.level < 10) {
        let nextLv = b.level + 1;
        let cost = thStats[nextLv].cost;
        if (resources.gold >= cost) {
            resources.gold -= cost;
            b.level = nextLv; b.maxHp = thStats[nextLv].hp; b.hp = b.maxHp;
            updateCapacity(); updateUI(); showNotification(`¡Ayuntamiento nivel ${nextLv}!`); cancelEdit();
        } else showNotification(`Faltan Monedas (${cost}🪙)`);
    }
}

function initDestroy() { document.getElementById('edit-controls').classList.add('hidden'); document.getElementById('ruin-controls').classList.add('hidden'); document.getElementById('destroy-controls').classList.remove('hidden'); }
function confirmDestroy() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (b) {
        let refundGold = Math.floor((entityData[b.type].gold || 0) * 0.4); let refundElixir = Math.floor((entityData[b.type].elixir || 0) * 0.4);
        resources.gold += refundGold; resources.elixir += refundElixir; buildings = buildings.filter(x => x.id !== selectedBuildingId);
        updateCapacity(); updateUI(); showNotification(`Destruido: +${refundGold}🪙 +${refundElixir}💧`);
    }
    cancelEdit();
}

function startRelocate() {
    let b = buildings.find(x => x.id === selectedBuildingId); if (!b) return;
    isRelocating = true; relocatingBuilding = b; pendingBuildingType = b.type; pendingBuildingData = entityData[b.type];
    pGridX = b.gridX; pGridY = b.gridY; buildings = buildings.filter(x => x.id !== selectedBuildingId);
    document.getElementById('edit-controls').classList.add('hidden'); document.getElementById('placement-controls').classList.remove('hidden');
    isBuildMode = true;
}

function updateCapacity() { 
    let th = buildings.find(b => b.type === 'townhall');
    let thLevel = th ? (th.level || 1) : 1;
    let baseCap = thStats[thLevel] ? thStats[thLevel].cap : 1000;
    
    maxGold = baseCap + (buildings.filter(b => b.type === 'vault_gold' && b.hp > 0).length * 500);
    maxElixir = baseCap + (buildings.filter(b => b.type === 'vault_elixir' && b.hp > 0).length * 500);
    maxTroops = buildings.filter(b => b.type === 'camp' && b.hp > 0).length * entityData.camp.capacity; 
}

function trainTroop() {
    updateCapacity();
    if (resources.troops >= maxTroops) return showNotification(`Campamentos llenos (${maxTroops} max). Construye más.`);
    if (resources.elixir >= 25) { resources.elixir -= 25; resources.troops++; updateUI(); showNotification("¡Bárbaro entrenado!"); cancelEdit();
    } else showNotification("Falta Elixir (25💧)");
}

function updateUI() {
    document.getElementById('res-gold').innerText = `${Math.floor(resources.gold)}/${maxGold}`;
    document.getElementById('res-elixir').innerText = `${Math.floor(resources.elixir)}/${maxElixir}`;
    document.getElementById('res-gems').innerText = Math.floor(resources.gems);
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`;
}

function toggleFullScreen() {
    let doc = window.document; let docEl = doc.documentElement;
    let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    let cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl).then(() => { if (screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape').catch(e => console.log(e)); } }).catch(err => { showNotification(`Error: ${err.message}`); });
    } else {
        cancelFullScreen.call(doc); if (screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); }
    }
}

function startCombatMatch() {
    showNotification("El combate ha sido desactivado temporalmente.");
}

updateCapacity(); updateUI();
