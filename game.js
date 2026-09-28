const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const TILE_SIZE = 25; 
let gridSize = 40; 

// SIN GUARDADO LOCAL - ECONOMÍA: MONEDAS, ELIXIR, GEMAS
let resources = { gold: 1500, elixir: 1500, points: 0, troops: 5, gems: 0 };
let buildings = [];

// DATOS DE ENTIDADES (Adaptados a Oro y Elixir)
const entityData = {
    townhall: { color: '#4a4a4a', emoji: '🏛️', w: 4, h: 4 }, // Sus stats dependen del nivel
    camp: { gold: 200, elixir: 150, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5, w: 3, h: 3 },
    barracks: { gold: 300, elixir: 200, color: '#d35400', emoji: '⚔️', maxHp: 250, w: 3, h: 3 }, 
    builder_hut: { gold: 100, elixir: 0, color: '#f39c12', emoji: '🏠', maxHp: 100, w: 2, h: 2 },
    lumbermill: { gold: 150, elixir: 50, color: '#27ae60', emoji: '🪚', maxHp: 150, w: 3, h: 3 },
    elixir_pump: { gold: 50, elixir: 150, color: '#95a5a6', emoji: '⛏️', maxHp: 150, w: 3, h: 3 },
    goldmine: { gold: 250, elixir: 250, color: '#f1c40f', emoji: '⛏️🟡', maxHp: 150, w: 3, h: 3 },
    miner_hut: { gold: 150, elixir: 150, color: '#7f8c8d', emoji: '⛺⛏️', maxHp: 150, w: 2, h: 2 },
    vault_wood: { gold: 200, elixir: 200, color: '#d35400', emoji: '📦', maxHp: 400, w: 3, h: 3 },
    vault_stone: { gold: 200, elixir: 200, color: '#8e44ad', emoji: '📦', maxHp: 400, w: 3, h: 3 },
    vault_coins: { gold: 400, elixir: 400, color: '#2ecc71', emoji: '🏦', maxHp: 400, w: 3, h: 3 }, 
    cannon: { gold: 200, elixir: 200, color: '#7f8c8d', emoji: '💣', maxHp: 300, damage: 25, range: 180, w: 3, h: 3 },
    tower: { gold: 250, elixir: 250, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 15, range: 250, w: 3, h: 3 },
    wall: { gold: 40, elixir: 20, color: '#555', emoji: '🧱', maxHp: 400, w: 1, h: 1 }
};

let maxTroops = 0; let maxGold = 2500; let maxElixir = 2500;
let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1.2 };
let isBuildMode = false; let frameCount = 0; 
let mySavedBase = []; let deployedTroops = []; let lasers = [];

// ESTADOS COMBATE
let inCombat = false; let combatPhase = 'none'; let combatSeconds = 0; let combatTimerInterval = null;

let pendingBuildingType = null; let pendingBuildingData = null; let pGridX = -1; let pGridY = -1;
let selectedBuildingId = null; let isRelocating = false; let relocatingBuilding = null;

// CREACIÓN BASE INICIAL (Con Ayuntamiento Nivel 2)
if (buildings.length === 0) {
    buildings.push({ id: 1, gridX: 18, gridY: 18, type: 'townhall', level: 2, ...entityData.townhall, maxHp: 800, hp: 800 });
    buildings.push({ id: 2, gridX: 14, gridY: 18, type: 'camp', ...entityData.camp, hp: entityData.camp.maxHp });
    buildings.push({ id: 3, gridX: 23, gridY: 18, type: 'barracks', ...entityData.barracks, hp: entityData.barracks.maxHp });
    updateCapacity();
}

// GENERACIÓN DE RECURSOS (Sin Deterioro)
let resourceTimer = 0;
setInterval(() => {
    if (inCombat) return;
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

// BUCLE DE COMBATE
function update() {
    frameCount++;
    if (inCombat && combatPhase === 'battle') {
        buildings = buildings.filter(b => b.hp > 0);
        
        let townhallAlive = buildings.some(b => b.type === 'townhall');
        if (!townhallAlive) { resolveCombat('win'); return; }
        if (deployedTroops.length === 0 && resources.troops <= 0) { resolveCombat('lose'); return; }

        deployedTroops.forEach(troop => {
            if (!troop.target || troop.target.hp <= 0) troop.target = getNearestBuilding(troop.x, troop.y);
            if (troop.target) {
                let tx = troop.target.gridX * TILE_SIZE + (troop.target.w * TILE_SIZE)/2;
                let ty = troop.target.gridY * TILE_SIZE + (troop.target.h * TILE_SIZE)/2;
                let dx = tx - troop.x, dy = ty - troop.y; let dist = Math.hypot(dx, dy);
                
                if (dist > (TILE_SIZE + troop.radius)) {
                    troop.x += (dx / dist) * troop.speed; troop.y += (dy / dist) * troop.speed;
                } else if (frameCount % 60 === 0) troop.target.hp -= troop.damage; 
            }
        });

        if (frameCount % 45 === 0) {
            buildings.forEach(b => {
                if (b.type === 'tower' || b.type === 'cannon') {
                    let bx = b.gridX * TILE_SIZE + (b.w * TILE_SIZE)/2, by = b.gridY * TILE_SIZE + (b.h * TILE_SIZE)/2;
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
        let bx = b.gridX * TILE_SIZE + (b.w * TILE_SIZE)/2, by = b.gridY * TILE_SIZE + (b.h * TILE_SIZE)/2;
        let dist = Math.hypot(bx - x, by - y);
        if (dist < minDist) { minDist = dist; nearest = b; }
    });
    return nearest;
}

function isRestrictedZone(gX, gY) {
    for (let b of buildings) {
        if (gX >= b.gridX - 1 && gX < b.gridX + b.w + 1 && gY >= b.gridY - 1 && gY < b.gridY + b.h + 1) return true;
    }
    return false;
}

function isOccupied(gX, gY, w, h, ignoreId = null) {
    for (let b of buildings) {
        if (b.id === ignoreId) continue;
        if (gX < b.gridX + b.w && gX + w > b.gridX && gY < b.gridY + b.h && gY + h > b.gridY) return true;
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

    // ZONA TRANSPARENTE AL ATACAR
    if (inCombat) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (isRestrictedZone(x, y)) { ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
            }
        }
    }

    buildings.forEach(b => {
        let px = b.gridX * TILE_SIZE, py = b.gridY * TILE_SIZE;
        let bw = b.w * TILE_SIZE, bh = b.h * TILE_SIZE;
        
        if (b.hp <= 0) {
            ctx.fillStyle = '#333'; ctx.fillRect(px, py, bw, bh);
            ctx.strokeStyle = (selectedBuildingId === b.id) ? '#f1c40f' : 'rgba(0,0,0,0.8)'; 
            ctx.lineWidth = (selectedBuildingId === b.id) ? 4 : 2; ctx.strokeRect(px, py, bw, bh);
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(bw, bh) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText('🏚️', px + bw/2, py + bh/2);
            return; 
        }

        ctx.fillStyle = b.color; ctx.fillRect(px, py, bw, bh);
        let hpRatio = b.hp / b.maxHp; let perimeter = (bw * 2) + (bh * 2);

        if (isBuildMode && selectedBuildingId === b.id) {
            ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 4; ctx.strokeRect(px, py, bw, bh);
        } else {
            ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, bw, bh);
            if (hpRatio > 0 && hpRatio < 1) {
                ctx.strokeStyle = (hpRatio > 0.5) ? '#2ecc71' : '#e74c3c';
                ctx.lineWidth = 3; ctx.setLineDash([perimeter * hpRatio, perimeter]); ctx.lineDashOffset = 0;
                ctx.strokeRect(px, py, bw, bh); ctx.setLineDash([]); 
            }
        }

        if (b.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(bw, bh) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.emoji, px + bw/2, py + bh/2);
            // Nivel del Ayuntamiento
            if(b.type === 'townhall') {
                ctx.fillStyle = 'yellow'; ctx.font = `14px Arial`; ctx.fillText('Lv.' + b.level, px + bw/2, py + bh - 15);
            }
        }
    });

    if (pendingBuildingData && pGridX >= 0 && pGridY >= 0) {
        let px = pGridX * TILE_SIZE; let py = pGridY * TILE_SIZE;
        let bw = pendingBuildingData.w * TILE_SIZE; let bh = pendingBuildingData.h * TILE_SIZE;
        let occupied = isOccupied(pGridX, pGridY, pendingBuildingData.w, pendingBuildingData.h, relocatingBuilding ? relocatingBuilding.id : null);
        
        ctx.globalAlpha = 0.6; ctx.fillStyle = pendingBuildingData.color; ctx.fillRect(px, py, bw, bh);
        if (pendingBuildingData.emoji) {
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(bw, bh) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(pendingBuildingData.emoji, px + bw/2, py + bh/2);
        }
        ctx.globalAlpha = 1.0;

        let perimeter = (bw * 2) + (bh * 2); let p = 1 - ((frameCount % 90) / 90); 
        ctx.strokeStyle = occupied ? '#e74c3c' : '#2ecc71';
        ctx.lineWidth = 4; ctx.setLineDash([perimeter * p, perimeter]); ctx.lineDashOffset = 0;
        ctx.strokeRect(px, py, bw, bh); ctx.setLineDash([]);
    }

    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'white'; ctx.font = `14px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText('🗡️', t.x, t.y);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(t.x - 10, t.y - 18, 20 * (t.hp/100), 4);
    });

    lasers.forEach(l => {
        ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    });

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); } gameLoop(); 

// --- MOTOR MULTI-TÁCTIL (ZOOM POR PELLIZCO ESTABLE) ---
let pointers = new Map(); let initialCam = { x: 0, y: 0 }; let startDragPan = { x: 0, y: 0 }; 
let hasMoved = false; let isCanvasTouch = false; let initialPinchDist = null; let initialZoom = 1;

function updatePointers(e) { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }

canvas.addEventListener('pointerdown', e => {
    isCanvasTouch = true; updatePointers(e); hasMoved = false;
    if (pointers.size === 1) {
        let pts = Array.from(pointers.values());
        if (pendingBuildingData) {
            let worldX = ((pts[0].x - canvas.width/2) / camera.zoom) + camera.x; let worldY = ((pts[0].y - canvas.height/2) / camera.zoom) + camera.y;
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - pendingBuildingData.w)); 
            pGridY = Math.max(0, Math.min(pGridY, gridSize - pendingBuildingData.h));
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
            pGridX = Math.floor(worldX / TILE_SIZE); pGridY = Math.floor(worldY / TILE_SIZE);
            pGridX = Math.max(0, Math.min(pGridX, gridSize - pendingBuildingData.w)); 
            pGridY = Math.max(0, Math.min(pGridY, gridSize - pendingBuildingData.h));
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

        if (inCombat && combatPhase !== 'end') {
            if (isRestrictedZone(gX, gY)) showNotification("Área restringida. Despliega en la zona verde.");
            else deployTroop(worldX, worldY);
        } else if (!pendingBuildingData) {
            let clickedBuilding = buildings.find(b => gX >= b.gridX && gX < b.gridX + b.w && gY >= b.gridY && gY < b.gridY + b.h);
            if (!clickedBuilding && !selectedBuildingId && isBuildMode) exitBuildMode();
            else if (clickedBuilding) { enterBuildMode(); selectExistingBuilding(clickedBuilding.id); } 
            else if (selectedBuildingId) cancelEdit();
        }
    }
    if (pointers.size === 0) isCanvasTouch = false;
});
window.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size === 0) isCanvasTouch = false; });

// --- COMBATE CON TEMPORIZADORES ---
function startCombatMatch() {
    if (resources.troops <= 0) return showNotification("¡Entrena tropas primero en el Cuartel!");
    
    mySavedBase = JSON.parse(JSON.stringify(buildings)); 
    
    buildings = [
        { id: 1, gridX: 18, gridY: 18, type: 'townhall', level: 2, ...entityData.townhall, hp: 800, maxHp: 800 },
        { id: 4, gridX: 18, gridY: 14, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp },
        { id: 5, gridX: 23, gridY: 18, type: 'goldmine', ...entityData.goldmine, hp: entityData.goldmine.maxHp }
    ];
    
    inCombat = true; combatPhase = 'prep'; combatSeconds = 10; deployedTroops = []; lasers = [];
    document.getElementById('main-hud').classList.add('hidden'); 
    document.getElementById('combat-ui').classList.remove('hidden');
    document.getElementById('combat-status-text').innerText = "El ataque comienza en:";
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 0.8;

    updateCombatTimerUI();
    if(combatTimerInterval) clearInterval(combatTimerInterval);
    combatTimerInterval = setInterval(combatTick, 1000);
}

function combatTick() {
    if(combatPhase === 'end') return;
    combatSeconds--;
    
    if(combatPhase === 'prep') {
        if(combatSeconds <= 0) { autoDeployTroops(); startBattlePhase(); }
    } else if (combatPhase === 'battle') {
        if(combatSeconds <= 0) {
            let th = buildings.find(b => b.type === 'townhall');
            if(th && th.hp > 0) resolveCombat('lose_time'); else resolveCombat('win');
        }
    }
    updateCombatTimerUI();
}

function startBattlePhase() {
    combatPhase = 'battle'; combatSeconds = 180; 
    document.getElementById('combat-status-text').innerText = "Tiempo restante:";
    updateCombatTimerUI();
}

function updateCombatTimerUI() {
    let m = Math.floor(combatSeconds / 60); let s = combatSeconds % 60;
    document.getElementById('combat-timer').innerText = m + ":" + (s < 10 ? "0" + s : s);
}

function autoDeployTroops() {
    let boundary = gridSize * TILE_SIZE;
    while(resources.troops > 0) {
        resources.troops--;
        let x, y, attempts = 0;
        do { x = Math.random() * boundary; y = Math.random() * boundary; attempts++;
        } while (isRestrictedZone(Math.floor(x/TILE_SIZE), Math.floor(y/TILE_SIZE)) && attempts < 50);
        deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 12, target: null });
    }
    updateUI();
}

function deployTroop(x, y) {
    if (resources.troops <= 0) return;
    if (combatPhase === 'prep') startBattlePhase(); 
    resources.troops--; updateUI();
    deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 12, target: null });
}

function resolveCombat(type) {
    if (combatPhase === 'end') return;
    combatPhase = 'end';
    if(combatTimerInterval) clearInterval(combatTimerInterval);
    
    let surviving = deployedTroops.length + resources.troops; 
    resources.troops = Math.min(maxTroops, surviving);
    
    if (type === 'win') {
        let lootedCoins = 50; resources.gold += 250; resources.elixir += 250; resources.points += 20; 
        resources.gems += 5; // Recompensa extra en gemas
        showNotification(`¡VICTORIA!\nRegresan: ${surviving} 🗡️`); 
    } else if (type === 'lose' || type === 'lose_time') { 
        showNotification(`DERROTA... El Ayuntamiento sobrevivió.\nRegresan: ${surviving} 🗡️`);
    } else if (type === 'surrender') { 
        showNotification(`TE RENDISTE.\nRegresan: ${surviving} 🗡️`); 
    }
    updateUI(); setTimeout(endCombat, 3000);
}

function surrender() { resolveCombat('surrender'); }

function endCombat() {
    inCombat = false; combatPhase = 'none'; deployedTroops = []; lasers = []; 
    buildings = JSON.parse(JSON.stringify(mySavedBase)); 
    updateCapacity(); 
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 1.2;
    document.getElementById('combat-ui').classList.add('hidden'); 
    document.getElementById('main-hud').classList.remove('hidden');
    updateUI();
}

// --- GESTIÓN DE TIENDA Y CONSTRUCCIÓN ---
function openShop() { isBuildMode = true; document.getElementById('main-hud').classList.add('hidden'); document.getElementById('shop-ui').classList.remove('hidden'); document.getElementById('shop-wood').innerText = Math.floor(resources.gold); document.getElementById('shop-stone').innerText = Math.floor(resources.elixir); document.getElementById('shop-coins').innerText = Math.floor(resources.gems); }
function closeShop() { isBuildMode = false; document.getElementById('shop-ui').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden'); }

function switchShopTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); event.currentTarget.classList.add('active');
    document.querySelectorAll('.shop-grid').forEach(grid => grid.classList.add('hidden')); document.getElementById('tab-' + tabId).classList.remove('hidden');
}

function selectBuilding(type) {
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
    if (isOccupied(pGridX, pGridY, pendingBuildingData.w, pendingBuildingData.h, relocatingBuilding ? relocatingBuilding.id : null)) return showNotification("Casilla ocupada");
    
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

// --- EDICIÓN (Mejorar, Entrenar) ---
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

        document.getElementById('btn-rebuild').innerHTML = `🏗️ Reconstruir<br><small>${data.gold}🪙 ${data.elixir}💧</small>`;
    } else {
        document.getElementById('edit-controls').classList.remove('hidden');
        
        let btnTrain = document.getElementById('btn-train-troop');
        if (b.type === 'barracks') { btnTrain.style.display = 'block'; } else { btnTrain.style.display = 'none'; }

        // MEJORAR AYUNTAMIENTO
        let btnUpgrade = document.getElementById('btn-upgrade');
        if (b.type === 'townhall' && b.level === 1) { btnUpgrade.style.display = 'block'; } else { btnUpgrade.style.display = 'none'; }

        // OCULTAR DESTRUIR SI ES AYUNTAMIENTO
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
    if (resources.gold >= data.gold && resources.elixir >= data.elixir) {
        resources.gold -= data.gold; resources.elixir -= data.elixir;
        b.hp = b.maxHp; updateCapacity(); updateUI(); showNotification("Estructura Reconstruida"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function upgradeBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (b && b.type === 'townhall' && b.level === 1) {
        if (resources.gold >= 1000) {
            resources.gold -= 1000;
            b.level = 2; b.maxHp = 800; b.hp = 800;
            updateCapacity(); updateUI(); showNotification("¡Ayuntamiento nivel 2!"); cancelEdit();
        } else showNotification("Faltan Monedas para mejorar.");
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
    let baseCap = (th && th.level === 2) ? 2500 : 1000;
    maxGold = baseCap + (buildings.filter(b => b.type === 'vault_wood' || b.type === 'vault_coins').filter(b => b.hp > 0).length * 500);
    maxElixir = baseCap + (buildings.filter(b => b.type === 'vault_stone' && b.hp > 0).length * 500);
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
    document.getElementById('res-points').innerText = resources.points;
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

updateCapacity(); updateUI();
