// game.js

// Referencias del DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const uiLog = document.getElementById('notification-area');

// Ajustar tamaño del canvas a la pantalla
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Estado del Juego ---
let resources = {
    wood: 50,
    stone: 50,
    points: 0
};

// Estadísticas de poder
let power = {
    attack: 5,   // Ataque base
    defense: 50, // HP extra del castillo basado en muros
};

// Entidades en el mapa 2D
let buildings = [];
let currentSelection = null;

// Costos de construcción
const buildCosts = {
    wall: { wood: 10, stone: 5, color: '#808080', size: 30, def: 20, atk: 0 },
    tower: { wood: 20, stone: 15, color: '#A0522D', size: 40, def: 30, atk: 5 },
    archer: { wood: 10, stone: 0, color: '#FFD700', size: 20, def: 0, atk: 15 }
};

// --- Bucle principal 2D ---
function drawWorld() {
    // Limpiar fondo (Pasto)
    ctx.fillStyle = '#557a2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar Castillo Central (Tu base)
    ctx.fillStyle = '#4a4a4a';
    let centerX = canvas.width / 2 - 40;
    let centerY = canvas.height / 2 - 40;
    ctx.fillRect(centerX, centerY, 80, 80);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText("🏰", centerX + 25, centerY + 45);

    // Dibujar construcciones
    buildings.forEach(b => {
        ctx.fillStyle = b.color;
        if(b.type === 'archer') {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.fillText("🏹", b.x - 10, b.y + 5);
        } else {
            ctx.fillRect(b.x - b.size/2, b.y - b.size/2, b.size, b.size);
        }
    });

    requestAnimationFrame(drawWorld);
}
drawWorld();

// --- Lógica de Recolección y UI ---
function updateUI() {
    document.getElementById('res-wood').innerText = resources.wood;
    document.getElementById('res-stone').innerText = resources.stone;
    document.getElementById('res-points').innerText = resources.points;
}
updateUI();

function gatherResources() {
    // Simula talar/picar obteniendo cantidades aleatorias
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

// --- Lógica de Construcción ---
function selectBuilding(type) {
    currentSelection = type;
    
    // Feedback visual en botones
    document.querySelectorAll('.build-btn').forEach(btn => btn.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    showNotification(`Modo construcción: Toque en el mapa para colocar.`);
}

// Colocar construcción al tocar el canvas
canvas.addEventListener('mousedown', (e) => handlePlacement(e.clientX, e.clientY));
canvas.addEventListener('touchstart', (e) => handlePlacement(e.touches[0].clientX, e.touches[0].clientY));

function handlePlacement(x, y) {
    if (!currentSelection) return;

    let cost = buildCosts[currentSelection];
    if (resources.wood >= cost.wood && resources.stone >= cost.stone) {
        // Restar recursos
        resources.wood -= cost.wood;
        resources.stone -= cost.stone;
        
        // Sumar estadísticas a tu poder de combate
        power.attack += cost.atk;
        power.defense += cost.def;

        // Añadir al mundo
        buildings.push({
            x: x,
            y: y,
            type: currentSelection,
            color: cost.color,
            size: cost.size
        });

        currentSelection = null;
        document.querySelectorAll('.build-btn').forEach(btn => btn.classList.remove('selected'));
        updateUI();
        showNotification("¡Construcción completada!");
    } else {
        showNotification("No tienes suficientes recursos.");
    }
}

// --- Lógica de Combate 1C1 ---
let combatState = { active: false, playerHp: 100, enemyHp: 100 };

function openCombat() {
    document.getElementById('combat-overlay').classList.remove('hidden');
    
    // La HP del jugador escala con sus defensas (muros/torres)
    let maxPlayerHp = 100 + power.defense;
    // Generar un enemigo basado en tus puntos actuales para que sea equilibrado
    let maxEnemyHp = 80 + (resources.points * 5) + Math.floor(Math.random() * 50);
    
    combatState = {
        active: true,
        playerHp: maxPlayerHp,
        enemyHp: maxEnemyHp,
        maxPlayerHp: maxPlayerHp,
        maxEnemyHp: maxEnemyHp
    };
    
    updateCombatUI();
    logCombat("¡Combate encontrado! Prepara tus tropas.");
}

function performAttack() {
    if (!combatState.active) return;

    // Tu ataque (Daño base + daño por arqueros/torres + factor aleatorio)
    let myDamage = power.attack + Math.floor(Math.random() * 10);
    // Ataque del enemigo (Escala con tus puntos)
    let enemyBaseAtk = 5 + (resources.points * 2);
    let enemyDamage = enemyBaseAtk + Math.floor(Math.random() * 10);

    // Ambos reciben daño simultáneamente (Estilo choque)
    combatState.enemyHp -= myDamage;
    combatState.playerHp -= enemyDamage;

    logCombat(`Causaste ${myDamage} de daño. El enemigo te devolvió ${enemyDamage} de daño.`);

    checkCombatEnd();
    updateCombatUI();
}

function checkCombatEnd() {
    if (combatState.enemyHp <= 0 && combatState.playerHp <= 0) {
        combatState.enemyHp = 0; combatState.playerHp = 0;
        logCombat("¡Empate! Ambos castillos fueron destruidos.");
        combatState.active = false;
        setTimeout(fleeCombat, 2500);
    } else if (combatState.enemyHp <= 0) {
        combatState.enemyHp = 0;
        // Recompensa en puntos y materiales
        let rewardPoints = 10;
        let rewardWood = 30;
        let rewardStone = 20;
        
        resources.points += rewardPoints;
        resources.wood += rewardWood;
        resources.stone += rewardStone;
        
        logCombat(`¡VICTORIA! Castillo enemigo destruido. Ganaste ${rewardPoints}🏆.`);
        updateUI();
        combatState.active = false;
        setTimeout(fleeCombat, 3000);
    } else if (combatState.playerHp <= 0) {
        combatState.playerHp = 0;
        logCombat("DERROTA. Tu castillo fue arrasado. Pierdes recursos.");
        resources.wood = Math.max(0, resources.wood - 10);
        resources.stone = Math.max(0, resources.stone - 10);
        updateUI();
        combatState.active = false;
        setTimeout(fleeCombat, 3000);
    }
}

function updateCombatUI() {
    let pBar = document.getElementById('hp-player');
    let eBar = document.getElementById('hp-enemy');
    
    pBar.max = combatState.maxPlayerHp;
    pBar.value = combatState.playerHp;
    document.getElementById('hp-player-text').innerText = `${combatState.playerHp}/${combatState.maxPlayerHp}`;
    
    eBar.max = combatState.maxEnemyHp;
    eBar.value = combatState.enemyHp;
    document.getElementById('hp-enemy-text').innerText = `${combatState.enemyHp}/${combatState.maxEnemyHp}`;
}

function logCombat(msg) {
    document.getElementById('combat-log').innerText = msg;
}

function fleeCombat() {
    document.getElementById('combat-overlay').classList.add('hidden');
    combatState.active = false;
}
