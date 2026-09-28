const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

// MAPA ESTILO CLASH (Cuadritos pequeños)
const TILE_SIZE = 25; 
let gridSize = 40; 
let expansionCost = 100;

// SIN GUARDADO LOCAL (Evita bugs en Modo Incógnito)
let resources = { wood: 500, stone: 500, points: 0, troops: 5, coins: 0 };
let buildings = [];
let maxTroops = 0; let maxCoins = 100;

let camera = { x: (gridSize*TILE_SIZE)/2, y: (gridSize*TILE_SIZE)/2, zoom: 1.2 };
let isBuildMode = false; let inCombat = false; let frameCount = 0; 
let mySavedBase = []; let deployedTroops = []; let lasers = [];

// ESTADOS DEL COMBATE
let combatPhase = 'none'; // 'none', 'prep', 'battle', 'end'
let combatSeconds = 0;
let combatTimerInterval = null;

let pendingBuildingType = null; let pendingBuildingData = null; let pGridX = -1; let pGridY = -1;
let selectedBuildingId = null; let isRelocating = false; let relocatingBuilding = null;

const entityData = {
    castle: { wood: 1000, stone: 1000, color: '#4a4a4a', emoji: '🏰', maxHp: 1000, w: 4, h: 4 },
    camp: { wood: 200, stone: 150, color: '#8B4513', emoji: '⛺', maxHp: 200, capacity: 5, w: 3, h: 3 },
    barracks: { wood: 300, stone: 200, color: '#d35400', emoji: '⚔️', maxHp: 250, w: 3, h: 3 }, 
    builder_hut: { wood: 100, stone: 0, color: '#f39c12', emoji: '🏠', maxHp: 100, w: 2, h: 2 },
    lumbermill: { wood: 150, stone: 50, color: '#27ae60', emoji: '🪚', maxHp: 150, w: 3, h: 3 },
    mine: { wood: 50, stone: 150, color: '#95a5a6', emoji: '⛏️', maxHp: 150, w: 3, h: 3 },
    goldmine: { wood: 250, stone: 250, color: '#f1c40f', emoji: '⛏️🟡', maxHp: 150, w: 3, h: 3 },
    miner_hut: { wood: 150, stone: 150, color: '#7f8c8d', emoji: '⛺⛏️', maxHp: 150, w: 2, h: 2 },
    vault_wood: { wood: 200, stone: 200, color: '#d35400', emoji: '📦🪵', maxHp: 400, w: 3, h: 3 },
    vault_stone: { wood: 200, stone: 200, color: '#8e44ad', emoji: '📦🪨', maxHp: 400, w: 3, h: 3 },
    vault_coins: { wood: 400, stone: 400, color: '#2ecc71', emoji: '🏦', maxHp: 400, capacityCoins: 500, w: 3, h: 3 }, 
    cannon: { wood: 200, stone: 200, color: '#7f8c8d', emoji: '💣', maxHp: 300, damage: 25, range: 180, w: 3, h: 3 },
    tower: { wood: 250, stone: 250, color: '#c0392b', emoji: '🗼', maxHp: 300, damage: 15, range: 250, w: 3, h: 3 },
    wall: { wood: 40, stone: 20, color: '#555', emoji: '🧱', maxHp: 400, w: 1, h: 1 }
};

// Crear base inicial si está vacía
if (buildings.length === 0) {
    buildings.push({ id: Date.now(), gridX: 18, gridY: 18, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp });
    buildings.push({ id: Date.now()+1, gridX: 14, gridY: 18, type: 'camp', ...entityData.camp, hp: entityData.camp.maxHp });
    updateCapacity();
}

// Economía Pasiva Online
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
            b.hp = Math.max(0, b.hp - (b.maxHp / 86400)); // Deterioro pasivo de 24h
        }
    });

    if (goldGenTimer >= 3) goldGenTimer = 0;
    
    if (woodGen > 0 || stoneGen > 0) { resources.wood += woodGen; resources.stone += stoneGen; }
    if (goldGen > 0 && resources.coins < maxCoins) { resources.coins = Math.min(resources.coins + goldGen, maxCoins); }
    updateUI();
}, 1000);

// BUCLE DE COMBATE EN TIEMPO REAL
function update() {
    frameCount++;
    if (inCombat && combatPhase === 'battle') {
        buildings = buildings.filter(b => b.hp > 0);
        
        let castleAlive = buildings.some(b => b.type === 'castle');
        if (!castleAlive) { resolveCombat('win'); return; }
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
        let bx = b.gridX * TILE_SIZE + (b.w * TILE_SIZE)/2;
        let by = b.gridY * TILE_SIZE + (b.h * TILE_SIZE)/2;
        let dist = Math.hypot(bx - x, by - y);
        if (dist < minDist) { minDist = dist; nearest = b; }
    });
    return nearest;
}

// ZONA TRANSPARENTE EN COMBATE (Margen de 1 cuadro)
function isRestrictedZone(gX, gY) {
    for (let b of buildings) {
        if (gX >= b.gridX - 1 && gX < b.gridX + b.w + 1 &&
            gY >= b.gridY - 1 && gY < b.gridY + b.h + 1) {
            return true;
        }
    }
    return false;
}

function isOccupied(gX, gY, w, h, ignoreId = null) {
    for (let b of buildings) {
        if (b.id === ignoreId) continue;
        if (gX < b.gridX + b.w && gX + w > b.gridX &&
            gY < b.gridY + b.h && gY + h > b.gridY) {
            return true;
        }
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

    // ZONA TRANSPARENTE DE COMBATE
    if (inCombat) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (isRestrictedZone(x, y)) {
                    ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
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

    // TROPAS MEJORADAS VISUALMENTE
    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'white'; ctx.font = `12px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText('🗡️', t.x, t.y);
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(t.x - 8, t.y - 15, 16 * (t.hp/100), 4);
    });

    lasers.forEach(l => {
        ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    });

    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); } gameLoop(); 

// --- MOTOR MULTI-TÁCTIL (ZOOM POR PELLIZCO Y PANEO) ---
let pointers = new Map(); let initialCam = { x: 0, y: 0 }; let startDragPan = { x: 0, y: 0 }; 
let hasMoved = false; let isCanvasTouch = false; 
let initialPinchDist = null; let initialZoom = 1;

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
            if (isRestrictedZone(gX, gY)) showNotification("Área restringida. Despliega en zona verde.");
            else deployTroop(worldX, worldY);
        } else if (!pendingBuildingData) {
            let clickedBuilding = buildings.find(b => gX >= b.gridX && gX < b.gridX + b.w && gY >= b.gridY && gY < b.gridY + b.h);
            if (!clickedBuilding && !selectedBuildingId && isBuildMode) { exitBuildMode(); }
            else if (clickedBuilding) { enterBuildMode(); selectExistingBuilding(clickedBuilding.id); } 
            else if (selectedBuildingId) { cancelEdit(); }
        }
    }
    if (pointers.size === 0) isCanvasTouch = false;
});
window.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size === 0) isCanvasTouch = false; });


// --- SISTEMA DE COMBATE CON TEMPORIZADORES ---
function startCombatMatch() {
    if (resources.troops <= 0) return showNotification("¡Entrena tropas primero en un Cuartel!");
    
    // Guardar una copia profunda para poder restaurarla al rendirse/perder
    mySavedBase = JSON.parse(JSON.stringify(buildings)); 
    
    // Crear base enemiga de prueba
    buildings = [
        { id: 1, gridX: 18, gridY: 18, type: 'castle', ...entityData.castle, hp: entityData.castle.maxHp },
        { id: 4, gridX: 18, gridY: 14, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp },
        { id: 5, gridX: 23, gridY: 18, type: 'goldmine', ...entityData.goldmine, hp: entityData.goldmine.maxHp }
    ];
    
    inCombat = true; combatOver = false; deployedTroops = []; lasers = [];
    document.getElementById('main-hud').classList.add('hidden'); 
    document.getElementById('combat-ui').classList.remove('hidden');
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 0.8;

    // Iniciar Temporizador de Preparación (10s)
    combatPhase = 'prep';
    combatSeconds = 10;
    document.getElementById('combat-status-text').innerText = "El ataque comienza en:";
    updateCombatTimerUI();
    if(combatTimerInterval) clearInterval(combatTimerInterval);
    combatTimerInterval = setInterval(combatTick, 1000);
}

function combatTick() {
    if(combatPhase === 'end') return;
    combatSeconds--;
    
    if(combatPhase === 'prep') {
        if(combatSeconds <= 0) {
            autoDeployTroops();
            startBattlePhase();
        }
    } else if (combatPhase === 'battle') {
        if(combatSeconds <= 0) {
            let castle = buildings.find(b => b.type === 'castle');
            if(castle && castle.hp > 0) resolveCombat('lose_time');
            else resolveCombat('win');
        }
    }
    updateCombatTimerUI();
}

function startBattlePhase() {
    combatPhase = 'battle';
    combatSeconds = 180; // 3 Minutos
    document.getElementById('combat-status-text').innerText = "Tiempo restante:";
    updateCombatTimerUI();
}

function updateCombatTimerUI() {
    let m = Math.floor(combatSeconds / 60);
    let s = combatSeconds % 60;
    document.getElementById('combat-timer').innerText = m + ":" + (s < 10 ? "0" + s : s);
}

function autoDeployTroops() {
    let boundary = gridSize * TILE_SIZE;
    while(resources.troops > 0) {
        resources.troops--;
        let x = 0, y = 0;
        if(Math.random() > 0.5) {
            x = Math.random() > 0.5 ? 25 : boundary - 25;
            y = Math.random() * boundary;
        } else {
            x = Math.random() * boundary;
            y = Math.random() > 0.5 ? 25 : boundary - 25;
        }
        deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 12, target: null });
    }
    updateUI();
}

function deployTroop(x, y) {
    if (resources.troops <= 0) return;
    if (combatPhase === 'prep') startBattlePhase(); // Si colocas antes de 10s, empieza el ataque
    
    resources.troops--; updateUI();
    deployedTroops.push({ x: x, y: y, hp: 100, damage: 15, speed: 1.5, radius: 12, target: null });
}

function resolveCombat(type) {
    if (combatPhase === 'end') return;
    combatPhase = 'end';
    if(combatTimerInterval) clearInterval(combatTimerInterval);
    
    // Las tropas que sobrevivieron en el mapa + las que no usaste
    let surviving = deployedTroops.length + resources.troops; 
    resources.troops = Math.min(maxTroops, surviving);
    
    if (type === 'win') {
        let lootedCoins = 50; resources.wood += 250; resources.stone += 250; resources.points += 20; 
        resources.coins = Math.min(resources.coins + lootedCoins, maxCoins);
        showNotification(`¡VICTORIA! 250🪵 250🪨 ${lootedCoins}🪙\nRegresan: ${surviving} 🗡️`); 
    } else if (type === 'lose' || type === 'lose_time') { 
        showNotification(`DERROTA... El Castillo sobrevivió.\nRegresan: ${surviving} 🗡️`);
    } else if (type === 'surrender') { 
        showNotification(`TE RENDISTE.\nRegresan: ${surviving} 🗡️`); 
    }
    updateUI(); setTimeout(endCombat, 3000);
}

function surrender() { resolveCombat('surrender'); }

function endCombat() {
    inCombat = false; combatOver = false; combatPhase = 'none'; deployedTroops = []; lasers = []; 
    
    // RESTAURAR BASE PROFUNDAMENTE Y CENTRAR CÁMARA
    buildings = JSON.parse(JSON.stringify(mySavedBase)); 
    updateCapacity(); 
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 1.2;

    document.getElementById('combat-ui').classList.add('hidden'); 
    document.getElementById('main-hud').classList.remove('hidden');
    updateUI();
}


// --- GESTIÓN DE TIENDA Y CONSTRUCCIÓN ---
function openShop() { 
    isBuildMode = true; document.getElementById('main-hud').classList.add('hidden'); document.getElementById('shop-ui').classList.remove('hidden'); 
    document.getElementById('shop-wood').innerText = Math.floor(resources.wood); document.getElementById('shop-stone').innerText = Math.floor(resources.stone); document.getElementById('shop-coins').innerText = Math.floor(resources.coins);
}
function closeShop() { isBuildMode = false; document.getElementById('shop-ui').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden'); }

function switchShopTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.shop-grid').forEach(grid => grid.classList.add('hidden'));
    document.getElementById('tab-' + tabId).classList.remove('hidden');
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
        let dmg = Math.floor(relocatingBuilding.maxHp * 0.05); 
        relocatingBuilding.hp = Math.max(0, relocatingBuilding.hp - dmg);
        relocatingBuilding.gridX = pGridX; relocatingBuilding.gridY = pGridY;
        buildings.push(relocatingBuilding); isRelocating = false; relocatingBuilding = null;
        
        showNotification("Estructura reubicada (-5% HP)");
        pendingBuildingType = null; pendingBuildingData = null; pGridX = -1; pGridY = -1;
        document.getElementById('placement-controls').classList.add('hidden'); document.getElementById('main-hud').classList.remove('hidden');
        selectedBuildingId = null; isBuildMode = false; return;
    }

    if (resources.wood < pendingBuildingData.wood || resources.stone < pendingBuildingData.stone) return showNotification("Recursos insuficientes");
    resources.wood -= pendingBuildingData.wood; resources.stone -= pendingBuildingData.stone;
    buildings.push({ id: Date.now(), gridX: pGridX, gridY: pGridY, type: pendingBuildingType, ...pendingBuildingData, hp: pendingBuildingData.maxHp });
    
    updateCapacity(); updateUI(); showNotification("¡Construcción finalizada!"); cancelPlacement(); 
}

// --- EDICIÓN ---
function getRepairCost(b) {
    let data = entityData[b.type]; let ratio = 1 - (b.hp / b.maxHp);
    return { wood: Math.ceil((data.wood || 0) * ratio), stone: Math.ceil((data.stone || 0) * ratio) };
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
        document.getElementById('btn-rebuild').innerHTML = `🏗️ Reconstruir<br><small>${data.wood}🪵 ${data.stone}🪨</small>`;
    } else {
        document.getElementById('edit-controls').classList.remove('hidden');
        
        let btnTrain = document.getElementById('btn-train-troop');
        if (b.type === 'barracks') { btnTrain.style.display = 'block'; } else { btnTrain.style.display = 'none'; }

        let btnRepair = document.getElementById('btn-repair');
        if (b.hp < b.maxHp) {
            let cost = getRepairCost(b); btnRepair.style.display = 'block';
            btnRepair.innerHTML = `🔨 Reparar<br><small>${cost.wood}🪵 ${cost.stone}🪨</small>`;
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
    if (resources.wood >= cost.wood && resources.stone >= cost.stone) {
        resources.wood -= cost.wood; resources.stone -= cost.stone;
        b.hp = b.maxHp; updateCapacity(); updateUI(); showNotification("Estructura Reparada"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function rebuildBuilding() {
    let b = buildings.find(x => x.id === selectedBuildingId); let data = entityData[b.type];
    if (resources.wood >= data.wood && resources.stone >= data.stone) {
        resources.wood -= data.wood; resources.stone -= data.stone;
        b.hp = b.maxHp; updateCapacity(); updateUI(); showNotification("Estructura Reconstruida"); cancelEdit();
    } else showNotification("Recursos insuficientes");
}

function initDestroy() { document.getElementById('edit-controls').classList.add('hidden'); document.getElementById('ruin-controls').classList.add('hidden'); document.getElementById('destroy-controls').classList.remove('hidden'); }
function confirmDestroy() {
    let b = buildings.find(x => x.id === selectedBuildingId);
    if (b) {
        let refundWood = Math.floor((entityData[b.type].wood || 0) * 0.4); let refundStone = Math.floor((entityData[b.type].stone || 0) * 0.4);
        resources.wood += refundWood; resources.stone += refundStone; buildings = buildings.filter(x => x.id !== selectedBuildingId);
        updateCapacity(); updateUI(); showNotification(`Destruido: +${refundWood}🪵 +${refundStone}🪨 devueltos`);
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
    maxTroops = buildings.filter(b => b.type === 'camp' && b.hp > 0).length * entityData.camp.capacity; 
    maxCoins = 100 + (buildings.filter(b => b.type === 'vault_coins' && b.hp > 0).length * entityData.vault_coins.capacityCoins);
}

function trainTroop() {
    updateCapacity();
    if (resources.troops >= maxTroops) return showNotification(`Campamentos llenos (${maxTroops} max). Construye más campamentos.`);
    if (resources.wood >= 25) { resources.wood -= 25; resources.troops++; updateUI(); showNotification("¡Bárbaro entrenado!"); cancelEdit();
    } else showNotification("Falta madera");
}

function updateUI() {
    document.getElementById('res-wood').innerText = Math.floor(resources.wood); document.getElementById('res-stone').innerText = Math.floor(resources.stone);
    document.getElementById('res-coins').innerText = `${Math.floor(resources.coins)}/${maxCoins}`;
    document.getElementById('res-troops').innerText = `${resources.troops}/${maxTroops}`; document.getElementById('res-points').innerText = resources.points;
}

function changeZoom(amount) { camera.zoom = Math.max(0.4, Math.min(camera.zoom + amount, 3.0)); }
function showNotification(msg) { uiLog.innerText = msg; setTimeout(() => uiLog.innerText = "", 2500); }

function toggleFullScreen() {
    let doc = window.document; let docEl = doc.documentElement;
    let requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    let cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl).then(() => {
            if (screen.orientation && screen.orientation.lock) { screen.orientation.lock('landscape').catch(e => console.log(e)); }
        }).catch(err => { showNotification(`Error: ${err.message}`); });
    } else {
        cancelFullScreen.call(doc); if (screen.orientation && screen.orientation.unlock) { screen.orientation.unlock(); }
    }
}

updateCapacity(); updateUI();
setTimeout(() => { if(!inCombat && buildings.length > 0) showNotification("💡 Toca la Tienda para añadir estructuras."); }, 2000);
