const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

const TILE_SIZE = 25; 
let gridSize = 40; 

// SIN GUARDADO LOCAL (Cero bugs en Incógnito)
let resources = { gold: 1500, elixir: 1500, points: 0, troops: 5, gems: 0 };
let buildings = [];

// STATS DEL AYUNTAMIENTO
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
let mySavedBase = []; let deployedTroops = []; let lasers = [];

// ESTADOS DEL COMBATE
let inCombat = false; 
let combatPhase = 'none'; 
let combatSeconds = 0; 
let combatTimerInterval = null;

let pendingBuildingType = null; let pendingBuildingData = null; let pGridX = -1; let pGridY = -1;
let selectedBuildingId = null; let isRelocating = false; let relocatingBuilding = null;

// BASE INICIAL CON AYUNTAMIENTO NIVEL 1
if (buildings.length === 0) {
    buildings.push({ id: 1, gridX: 18, gridY: 18, type: 'townhall', level: 1, ...entityData.townhall, maxHp: 400, hp: 400 });
    buildings.push({ id: 2, gridX: 15, gridY: 18, type: 'builder_hut', ...entityData.builder_hut, maxHp: 100, hp: 100 });
    buildings.push({ id: 3, gridX: 14, gridY: 14, type: 'camp', ...entityData.camp, maxHp: 200, hp: 200 });
    updateCapacity();
}

// GENERACIÓN PASIVA DE RECURSOS (Cero Deterioro)
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


// ==========================================
// MOTOR DE COMBATE (Seguro y Funcional)
// ==========================================

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
                let tw = troop.target.w || 1;
                let th = troop.target.h || 1;
                let tx = troop.target.gridX * TILE_SIZE + (tw * TILE_SIZE) / 2;
                let ty = troop.target.gridY * TILE_SIZE + (th * TILE_SIZE) / 2;
                
                let dx = tx - troop.x;
                let dy = ty - troop.y;
                let dist = Math.hypot(dx, dy);
                
                if (dist === 0 || isNaN(dist)) dist = 1; // ESCUDO ANTI-CONGELAMIENTO
                
                let reach = (Math.min(tw, th) * TILE_SIZE) / 2;
                
                if (dist > (reach + troop.radius)) {
                    troop.x += (dx / dist) * troop.speed;
                    troop.y += (dy / dist) * troop.speed;
                } else if (frameCount % 60 === 0) {
                    troop.target.hp -= troop.damage;
                }
            }
        });

        if (frameCount % 45 === 0) {
            buildings.forEach(b => {
                if (b.type === 'tower' || b.type === 'cannon') {
                    let tw = b.w || 1; let th = b.h || 1;
                    let bx = b.gridX * TILE_SIZE + (tw * TILE_SIZE) / 2;
                    let by = b.gridY * TILE_SIZE + (th * TILE_SIZE) / 2;
                    let target = null, minDist = b.range || 200;
                    
                    deployedTroops.forEach(t => {
                        let dist = Math.hypot(t.x - bx, t.y - by);
                        if (dist < minDist && t.hp > 0) { minDist = dist; target = t; }
                    });
                    
                    if (target) { 
                        target.hp -= (b.damage || 15); 
                        lasers.push({ x1: bx, y1: by, x2: target.x, y2: target.y, life: 10 }); 
                    }
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
        let tw = b.w || 1; let th = b.h || 1;
        let bx = b.gridX * TILE_SIZE + (tw * TILE_SIZE)/2;
        let by = b.gridY * TILE_SIZE + (th * TILE_SIZE)/2;
        let dist = Math.hypot(bx - x, by - y);
        if (dist < minDist) { minDist = dist; nearest = b; }
    });
    return nearest;
}

// ZONA TRANSPARENTE EN COMBATE (Margen de 1 cuadrito alrededor)
function isRestrictedZone(gX, gY) {
    for (let b of buildings) {
        let tw = b.w || 1; let th = b.h || 1;
        if (gX >= b.gridX - 1 && gX < b.gridX + tw + 1 && gY >= b.gridY - 1 && gY < b.gridY + th + 1) return true;
    }
    return false;
}

function isOccupied(gX, gY, w, h, ignoreId = null) {
    for (let b of buildings) {
        if (b.id === ignoreId) continue;
        let tw = b.w || 1; let th = b.h || 1;
        if (gX < b.gridX + tw && gX + w > b.gridX && gY < b.gridY + th && gY + h > b.gridY) return true;
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

    // DIBUJAR ZONA TRANSPARENTE AL ATACAR
    if (inCombat) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let x = 0; x < gridSize; x++) {
            for (let y = 0; y < gridSize; y++) {
                if (isRestrictedZone(x, y)) { ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE); }
            }
        }
    }

    buildings.forEach(b => {
        let tw = b.w || 1; let th = b.h || 1;
        let px = b.gridX * TILE_SIZE, py = b.gridY * TILE_SIZE;
        let bw = tw * TILE_SIZE, bh = th * TILE_SIZE;
        
        if (b.hp <= 0) {
            ctx.fillStyle = '#333'; ctx.fillRect(px, py, bw, bh);
            ctx.strokeStyle = (selectedBuildingId === b.id) ? '#f1c40f' : 'rgba(0,0,0,0.8)'; 
            ctx.lineWidth = (selectedBuildingId === b.id) ? 4 : 2; ctx.strokeRect(px, py, bw, bh);
            ctx.fillStyle = 'white'; ctx.font = `${Math.min(bw, bh) * 0.5}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText('🏚️', px + bw/2, py + bh/2);
            return; 
        }

        ctx.fillStyle = b.color || '#999'; ctx.fillRect(px, py, bw, bh);
        
        let hpRatio = b.hp / (b.maxHp || 1); 
        if(isNaN(hpRatio) || !isFinite(hpRatio)) hpRatio = 1;
        let perimeter = (bw * 2) + (bh * 2);

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
            if(b.type === 'townhall') {
                ctx.fillStyle = 'yellow'; ctx.font = `14px Arial`; ctx.fillText('Lv.' + (b.level || 1), px + bw/2, py + bh - 15);
            }
        }
    });

    if (pendingBuildingData && pGridX >= 0 && pGridY >= 0) {
        let tw = pendingBuildingData.w || 1; let th = pendingBuildingData.h || 1;
        let px = pGridX * TILE_SIZE; let py = pGridY * TILE_SIZE;
        let bw = tw * TILE_SIZE; let bh = th * TILE_SIZE;
        let occupied = isOccupied(pGridX, pGridY, tw, th, relocatingBuilding ? relocatingBuilding.id : null);
        
        ctx.globalAlpha = 0.6; ctx.fillStyle = pendingBuildingData.color || '#999'; ctx.fillRect(px, py, bw, bh);
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

    // TROPAS
    deployedTroops.forEach(t => {
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'white'; ctx.font = `14px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText('🗡️', t.x, t.y);
        
        let thp = t.hp / 100; if(isNaN(thp)) thp = 1;
        ctx.fillStyle = '#e74c3c'; ctx.fillRect(t.x - 10, t.y - 18, 20 * thp, 4);
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
            let tw = pendingBuildingData.w || 1; let th = pendingBuildingData.h || 1;
            pGridX = Math.max(0, Math.min(pGridX, gridSize - tw)); 
            pGridY = Math.max(0, Math.min(pGridY, gridSize - th));
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
            let tw = pendingBuildingData.w || 1; let th = pendingBuildingData.h || 1;
            pGridX = Math.max(0, Math.min(pGridX, gridSize - tw)); 
            pGridY = Math.max(0, Math.min(pGridY, gridSize - th));
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
            if (isRestrictedZone(gX, gY)) {
                showNotification("Área restringida. Despliega en la zona verde.");
            } else {
                deployTroop(worldX, worldY);
            }
        } else if (!pendingBuildingData) {
            let clickedBuilding = buildings.find(b => {
                let tw = b.w || 1; let th = b.h || 1;
                return gX >= b.gridX && gX < b.gridX + tw && gY >= b.gridY && gY < b.gridY + th;
            });
            if (!clickedBuilding && !selectedBuildingId && isBuildMode) exitBuildMode();
            else if (clickedBuilding) { enterBuildMode(); selectExistingBuilding(clickedBuilding.id); } 
            else if (selectedBuildingId) cancelEdit();
        }
    }
    if (pointers.size === 0) isCanvasTouch = false;
});
window.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); if (pointers.size === 0) isCanvasTouch = false; });

// ==========================================
// TEMPORIZADORES Y COMBATE TOTALMENTE REPARADOS
// ==========================================

function startCombatMatch() {
    if (resources.troops <= 0) return showNotification("¡Entrena tropas primero en un Cuartel!");
    
    // Guardamos la base original
    mySavedBase = JSON.parse(JSON.stringify(buildings)); 
    
    // Generar base enemiga de prueba
    buildings = [
        { id: 1, gridX: 18, gridY: 18, type: 'townhall', level: 1, ...entityData.townhall, hp: 400, maxHp: 400 },
        { id: 4, gridX: 18, gridY: 14, type: 'tower', ...entityData.tower, hp: entityData.tower.maxHp },
        { id: 5, gridX: 23, gridY: 18, type: 'goldmine', ...entityData.goldmine, hp: entityData.goldmine.maxHp }
    ];
    
    inCombat = true; combatPhase = 'prep'; combatSeconds = 10; deployedTroops = []; lasers = [];
    document.getElementById('main-hud').classList.add('hidden'); 
    document.getElementById('combat-ui').classList.remove('hidden');
    document.getElementById('combat-status-text').innerText = "El ataque comienza en:";
    camera.x = (gridSize*TILE_SIZE)/2; camera.y = (gridSize*TILE_SIZE)/2; camera.zoom = 1.0;

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

// BUCLE SEGURO DE DESPLIEGUE AUTOMÁTICO
function autoDeployTroops() {
    let boundary = gridSize * TILE_SIZE;
    let tropasAEnviar = resources.troops;
    resources.troops = 0; // Evita bucle infinito en while

    for(let i=0; i<tropasAEnviar; i++) {
        let x, y, attempts = 0;
        do { 
            x = Math.random() * boundary; y = Math.random() * boundary; attempts++;
        } while (isRestrictedZone(Math.floor(x/TILE_SIZE), Math.floor(y/TILE_SIZE)) && attempts < 50);
        deployedTroops.push({ x: x, y: y, hp: 100, damage: 
