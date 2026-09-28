/* =========================================================
   CASTLE KINGDOM
   Juego de estrategia 2D
========================================================= */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let W = 0;
let H = 0;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

/* =========================================================
   CONFIGURACIÓN
========================================================= */

const TILE = 32;
const MAP = 48;

let camera = {
    x: MAP * TILE / 2,
    y: MAP * TILE / 2,
    zoom: 1
};

let frame = 0;

let resources = {
    gold: 1500,
    elixir: 1500,
    gems: 50,
    trophies: 0
};

let buildings = [];
let obstacles = [];
let villagers = [];
let troops = [];

let selectedId = null;

let buildMode = false;
let pendingType = null;
let pendingX = 0;
let pendingY = 0;

let dragging = false;
let moved = false;

let pointerStart = {
    x: 0,
    y: 0
};

let cameraStart = {
    x: 0,
    y: 0
};

let combat = null;

/* =========================================================
   DATOS DE EDIFICIOS
========================================================= */

const BUILDINGS = {

    townhall: {
        name: "Ayuntamiento",
        icon: "🏰",
        w: 4,
        h: 4,
        hp: 1500,
        gold: 0,
        elixir: 0,
        color: "#59636e"
    },

    builder: {
        name: "Choza de constructor",
        icon: "🏠",
        w: 2,
        h: 2,
        hp: 250,
        gold: 250,
        elixir: 0,
        color: "#c58b38"
    },

    camp: {
        name: "Campamento",
        icon: "⛺",
        w: 3,
        h: 3,
        hp: 400,
        capacity: 10,
        gold: 300,
        elixir: 100,
        color: "#8b5a2b"
    },

    barracks: {
        name: "Cuartel",
        icon: "⚔️",
        w: 3,
        h: 3,
        hp: 500,
        gold: 450,
        elixir: 250,
        color: "#a84300"
    },

    goldmine: {
        name: "Mina de oro",
        icon: "⛏️",
        w: 3,
        h: 3,
        hp: 350,
        gold: 250,
        elixir: 0,
        color: "#c99718"
    },

    elixirpump: {
        name: "Extractor de elixir",
        icon: "💧",
        w: 3,
        h: 3,
        hp: 350,
        gold: 300,
        elixir: 0,
        color: "#75429b"
    },

    goldstorage: {
        name: "Almacén de oro",
        icon: "🪙",
        w: 3,
        h: 3,
        hp: 600,
        gold: 500,
        elixir: 0,
        color: "#b7950b"
    },

    elixirstorage: {
        name: "Almacén de elixir",
        icon: "🫙",
        w: 3,
        h: 3,
        hp: 600,
        gold: 600,
        elixir: 0,
        color: "#8e44ad"
    },

    cannon: {
        name: "Cañón",
        icon: "💣",
        w: 2,
        h: 2,
        hp: 650,
        damage: 35,
        range: 7,
        attackSpeed: 900,
        gold: 450,
        elixir: 0,
        color: "#555"
    },

    archerTower: {
        name: "Torre de arqueras",
        icon: "🏹",
        w: 2,
        h: 3,
        hp: 550,
        damage: 25,
        range: 9,
        attackSpeed: 700,
        gold: 600,
        elixir: 100,
        color: "#8e332f"
    },

    wall: {
        name: "Muro",
        icon: "🧱",
        w: 1,
        h: 1,
        hp: 500,
        gold: 50,
        elixir: 0,
        color: "#777"
    }
};

/* =========================================================
   DATOS DE TROPAS
========================================================= */

const TROOPS = {

    barbarian: {
        name: "Bárbaro",
        icon: "🗡️",
        hp: 160,
        damage: 25,
        speed: 48,
        range: 1,
        cost: 30,
        training: 2
    },

    archer: {
        name: "Arquera",
        icon: "🏹",
        hp: 80,
        damage: 35,
        speed: 40,
        range: 5,
        cost: 45,
        training: 3
    },

    giant: {
        name: "Gigante",
        icon: "🧌",
        hp: 600,
        damage: 45,
        speed: 25,
        range: 1,
        cost: 100,
        training: 7
    }
};

/* =========================================================
   GUARDADO
========================================================= */

function saveGame() {

    const data = {
        resources,
        buildings,
        obstacles
    };

    localStorage.setItem(
        "castleKingdomSave",
        JSON.stringify(data)
    );
}

function loadGame() {

    const save = localStorage.getItem("castleKingdomSave");

    if (!save) {
        createNewVillage();
        return;
    }

    try {

        const data = JSON.parse(save);

        resources = data.resources || resources;
        buildings = data.buildings || [];
        obstacles = data.obstacles || [];

        if (!buildings.length) {
            createNewVillage();
        }

    } catch {

        createNewVillage();

    }
}

/* =========================================================
   CREAR ALDEA
========================================================= */

function createNewVillage() {

    buildings = [];
    obstacles = [];
    villagers = [];

    buildings.push({
        id: 1,
        type: "townhall",
        x: 22,
        y: 22,
        level: 1,
        hp: BUILDINGS.townhall.hp,
        maxHp: BUILDINGS.townhall.hp
    });

    buildings.push({
        id: 2,
        type: "builder",
        x: 16,
        y: 20,
        level: 1,
        hp: 250,
        maxHp: 250
    });

    buildings.push({
        id: 3,
        type: "camp",
        x: 29,
        y: 20,
        level: 1,
        hp: 400,
        maxHp: 400
    });

    buildings.push({
        id: 4,
        type: "barracks",
        x: 29,
        y: 25,
        level: 1,
        hp: 500,
        maxHp: 500
    });

    buildings.push({
        id: 5,
        type: "goldmine",
        x: 16,
        y: 26,
        level: 1,
        hp: 350,
        maxHp: 350
    });

    buildings.push({
        id: 6,
        type: "elixirpump",
        x: 21,
        y: 29,
        level: 1,
        hp: 350,
        maxHp: 350
    });

    buildings.push({
        id: 7,
        type: "cannon",
        x: 26,
        y: 17,
        level: 1,
        hp: 650,
        maxHp: 650
    });

    buildings.push({
        id: 8,
        type: "archerTower",
        x: 20,
        y: 17,
        level: 1,
        hp: 550,
        maxHp: 550
    });

    generateObstacles();

    for (let i = 0; i < 4; i++) {

        villagers.push({
            x: 20 + Math.random() * 8,
            y: 20 + Math.random() * 8,
            targetX: 20 + Math.random() * 8,
            targetY: 20 + Math.random() * 8,
            timer: Math.random() * 3
        });

    }

    saveGame();
}

/* =========================================================
   OBSTÁCULOS
========================================================= */

function generateObstacles() {

    for (let i = 0; i < 75; i++) {

        const type =
            Math.random() < .55
                ? "tree"
                : "rock";

        let x;
        let y;

        do {

            x = Math.floor(Math.random() * MAP);
            y = Math.floor(Math.random() * MAP);

        } while (
            distance(
                x,
                y,
                24,
                24
            ) < 8
        );

        obstacles.push({
            x,
            y,
            type,
            hp: 100
        });
    }
}

/* =========================================================
   UTILIDADES
========================================================= */

function distance(x1,y1,x2,y2) {

    return Math.sqrt(
        Math.pow(x2-x1,2) +
        Math.pow(y2-y1,2)
    );
}

function getBuilding(id) {
    return buildings.find(b => b.id === id);
}

function getCapacity() {

    let camps = buildings.filter(
        b => b.type === "camp"
    ).length;

    return 10 + camps * 10;
}

function occupied(x,y,w,h,ignoreId=null) {

    for (const b of buildings) {

        if (b.id === ignoreId)
            continue;

        const data = BUILDINGS[b.type];

        if (
            x < b.x + data.w &&
            x + w > b.x &&
            y < b.y + data.h &&
            y + h > b.y
        ) {
            return true;
        }
    }

    for (const o of obstacles) {

        if (
            x <= o.x &&
            x + w > o.x &&
            y <= o.y &&
            y + h > o.y
        ) {
            return true;
        }
    }

    return false;
}

/* =========================================================
   UI
========================================================= */

function updateUI() {

    document.getElementById("gold").textContent =
        Math.floor(resources.gold);

    document.getElementById("elixir").textContent =
        Math.floor(resources.elixir);

    document.getElementById("gems").textContent =
        Math.floor(resources.gems);

    document.getElementById("trophies").textContent =
        Math.floor(resources.trophies);

    const th =
        buildings.find(b => b.type === "townhall");

    document.getElementById("player-level").textContent =
        `Ayuntamiento ${th ? th.level : 1}`;
}

function notify(message) {

    const box =
        document.getElementById("notifications");

    const el =
        document.createElement("div");

    el.className = "notification";
    el.textContent = message;

    box.appendChild(el);

    setTimeout(() => {
        el.remove();
    }, 2500);
}

/* =========================================================
   TIENDA
========================================================= */

function openShop() {

    document
        .getElementById("shop")
        .classList.remove("hidden");

    shopTab("buildings");
}

function closeShop() {

    document
        .getElementById("shop")
        .classList.add("hidden");
}

function shopTab(tab, button) {

    if (button) {

        document
            .querySelectorAll(".tab")
            .forEach(b => b.classList.remove("active"));

        button.classList.add("active");
    }

    const container =
        document.getElementById("shop-content");

    container.innerHTML = "";

    let types = [];

    if (tab === "buildings") {

        types = [
            "builder",
            "camp",
            "barracks",
            "goldmine",
            "elixirpump",
            "goldstorage",
            "elixirstorage"
        ];

    }

    if (tab === "defenses") {

        types = [
            "cannon",
            "archerTower",
            "wall"
        ];

    }

    if (tab === "army") {

        container.innerHTML = `
            <div class="shop-card">
                <div class="icon">🗡️</div>
                <h3>Bárbaro</h3>
                <p>Soldado cuerpo a cuerpo resistente.</p>
                <div class="price">30 💧</div>
            </div>

            <div class="shop-card">
                <div class="icon">🏹</div>
                <h3>Arquera</h3>
                <p>Ataca desde larga distancia.</p>
                <div class="price">45 💧</div>
            </div>

            <div class="shop-card">
                <div class="icon">🧌</div>
                <h3>Gigante</h3>
                <p>Muchísima vida y daño contra edificios.</p>
                <div class="price">100 💧</div>
            </div>
        `;

        return;
    }

    types.forEach(type => {

        const data = BUILDINGS[type];

        const card =
            document.createElement("button");

        card.className = "shop-card";

        card.innerHTML = `
            <div class="icon">${data.icon}</div>
            <h3>${data.name}</h3>
            <p>
                ❤️ ${data.hp}
                ${data.damage ? `<br>⚔️ ${data.damage}` : ""}
            </p>
            <div class="price">
                ${data.gold ? data.gold + " 🪙 " : ""}
                ${data.elixir ? data.elixir + " 💧" : ""}
            </div>
        `;

        card.onclick = () =>
            selectBuilding(type);

        container.appendChild(card);
    });
}

/* =========================================================
   CONSTRUCCIÓN
========================================================= */

function selectBuilding(type) {

    const data = BUILDINGS[type];

    if (resources.gold < data.gold ||
        resources.elixir < data.elixir) {

        notify("❌ No tienes suficientes recursos.");
        return;
    }

    pendingType = type;

    pendingX = Math.floor(camera.x / TILE);
    pendingY = Math.floor(camera.y / TILE);

    buildMode = true;

    closeShop();

    notify(
        `🏗️ Coloca ${data.name}`
    );
}

function confirmConstruction() {

    if (!pendingType)
        return;

    const data = BUILDINGS[pendingType];

    if (
        occupied(
            pendingX,
            pendingY,
            data.w,
            data.h
        )
    ) {

        notify("❌ No puedes construir aquí.");
        return;
    }

    if (
        resources.gold < data.gold ||
        resources.elixir < data.elixir
    ) {

        notify("❌ Recursos insuficientes.");
        cancelConstruction();
        return;
    }

    resources.gold -= data.gold;
    resources.elixir -= data.elixir;

    const id =
        Date.now();

    buildings.push({
        id,
        type: pendingType,
        x: pendingX,
        y: pendingY,
        level: 1,
        hp: data.hp,
        maxHp: data.hp
    });

    notify(`🏗️ ${data.name} construido.`);

    pendingType = null;
    buildMode = false;

    saveGame();
    updateUI();
}

function cancelConstruction() {

    pendingType = null;
    buildMode = false;
}

/* =========================================================
   MENÚ EDIFICIOS
========================================================= */

function openBuildingMenu(id) {

    const b = getBuilding(id);

    if (!b)
        return;

    selectedId = id;

    const data = BUILDINGS[b.type];

    document.getElementById("building-icon").textContent =
        data.icon;

    document.getElementById("building-name").textContent =
        data.name;

    document.getElementById("building-hp").textContent =
        `${Math.floor(b.hp)} / ${b.maxHp}`;

    document.getElementById("building-level").textContent =
        `Nivel ${b.level}`;

    const upgrade =
        document.getElementById("upgrade-button");

    if (b.type === "townhall" && b.level >= 10) {

        upgrade.style.display = "none";

    } else {

        upgrade.style.display = "block";

    }

    document
        .getElementById("building-menu")
        .classList.remove("hidden");
}

function closeBuildingMenu() {

    selectedId = null;

    document
        .getElementById("building-menu")
        .classList.add("hidden");
}

/* =========================================================
   MEJORAS
========================================================= */

function upgradeSelected() {

    const b = getBuilding(selectedId);

    if (!b)
        return;

    const data = BUILDINGS[b.type];

    const level =
        b.level || 1;

    const goldCost =
        Math.floor(data.gold * (level + 1) * .8);

    const elixirCost =
        Math.floor(data.elixir * (level + 1) * .8);

    if (
        resources.gold < goldCost ||
        resources.elixir < elixirCost
    ) {

        notify("❌ Recursos insuficientes.");
        return;
    }

    resources.gold -= goldCost;
    resources.elixir -= elixirCost;

    b.level++;

    b.maxHp =
        Math.floor(
            data.hp *
            (1 + (b.level - 1) * .35)
        );

    b.hp = b.maxHp;

    notify(
        `⬆️ ${data.name} ahora es nivel ${b.level}.`
    );

    closeBuildingMenu();

    saveGame();
    updateUI();
}

/* =========================================================
   REUBICAR
========================================================= */

function relocateSelected() {

    const b = getBuilding(selectedId);

    if (!b)
        return;

    pendingType = b.type;
    pendingX = b.x;
    pendingY = b.y;

    buildings =
        buildings.filter(
            item => item.id !== b.id
        );

    buildMode = true;

    closeBuildingMenu();

    notify("🔄 Selecciona la nueva posición.");
}

function destroySelected() {

    const b = getBuilding(selectedId);

    if (!b)
        return;

    if (b.type === "townhall") {

        notify("🏰 No puedes destruir tu Ayuntamiento.");
        return;
    }

    const data = BUILDINGS[b.type];

    resources.gold +=
        Math.floor(data.gold * .4);

    resources.elixir +=
        Math.floor(data.elixir * .4);

    buildings =
        buildings.filter(
            item => item.id !== b.id
        );

    notify("🗑️ Edificio eliminado.");

    closeBuildingMenu();

    saveGame();
    updateUI();
}

/* =========================================================
   EJÉRCITO
========================================================= */

let army = {
    barbarian: 3,
    archer: 0,
    giant: 0
};

function armyCount() {

    return Object.values(army)
        .reduce((a,b) => a+b,0);
}

function openArmy() {

    document
        .getElementById("army")
        .classList.remove("hidden");

    renderArmy();
}

function closeArmy() {

    document
        .getElementById("army")
        .classList.add("hidden");
}

function renderArmy() {

    document.getElementById("army-count")
        .textContent =
        `${armyCount()} / ${getCapacity()}`;

    const container =
        document.getElementById("army-content");

    container.innerHTML = "";

    Object.entries(TROOPS)
        .forEach(([type,data]) => {

            const card =
                document.createElement("div");

            card.className = "troop-card";

            card.innerHTML = `
                <div class="troop-icon">
                    ${data.icon}
                </div>

                <h3>${data.name}</h3>

                <p>
                    ❤️ ${data.hp}<br>
                    ⚔️ ${data.damage}<br>
                    💧 ${data.cost}
                </p>

                <button class="train-button">
                    ENTRENAR
                </button>
            `;

            card
                .querySelector("button")
                .onclick = () =>
                    trainTroop(type);

            container.appendChild(card);
        });
}

function trainTroop(type) {

    const data = TROOPS[type];

    if (armyCount() >= getCapacity()) {

        notify("🪖 Campamentos llenos.");
        return;
    }

    if (resources.elixir < data.cost) {

        notify("💧 Falta elixir.");
        return;
    }

    resources.elixir -= data.cost;

    army[type]++;

    notify(
        `${data.icon} ${data.name} entrenado.`
    );

    renderArmy();
    updateUI();
}

/* =========================================================
   ATAQUE
========================================================= */

function openAttackMenu() {

    if (armyCount() <= 0) {

        notify("⚔️ Necesitas tropas para atacar.");
        openArmy();
        return;
    }

    document
        .getElementById("attack-menu")
        .classList.remove("hidden");
}

function startCombat() {

    document
        .getElementById("attack-menu")
        .classList.add("hidden");

    createCombat();

    document
        .getElementById("combat-ui")
        .classList.remove("hidden");

    notify("⚔️ ¡Comienza el ataque!");
}

/* =========================================================
   CREACIÓN DEL COMBATE
========================================================= */

function createCombat() {

    const enemyBuildings = [];

    enemyBuildings.push({
        id: 1,
        type: "townhall",
        x: 22,
        y: 22,
        level: 2,
        hp: 2200,
        maxHp: 2200
    });

    const defenses = [
        [18,19,"cannon"],
        [28,19,"cannon"],
        [19,27,"archerTower"],
        [28,28,"archerTower"],
        [22,17,"cannon"]
    ];

    defenses.forEach((d,i) => {

        const data = BUILDINGS[d[2]];

        enemyBuildings.push({
            id: i+2,
            type: d[2],
            x: d[0],
            y: d[1],
            level: 2,
            hp: data.hp * 1.3,
            maxHp: data.hp * 1.3,
            cooldown: 0
        });
    });

    for (let i = 0; i < 14; i++) {

        enemyBuildings.push({
            id: 20+i,
            type: "wall",
            x: 17 + (i % 7),
            y: i < 7 ? 17 : 29,
            level: 2,
            hp: 800,
            maxHp: 800
        });
    }

    const combatTroops = [];

    Object.entries(army)
        .forEach(([type,count]) => {

            for (let i=0;i<count;i++) {

                combatTroops.push({
                    id: Date.now()+Math.random(),
                    type,
                    x: 8 + Math.random()*3,
                    y: 20 + Math.random()*10,
                    hp: TROOPS[type].hp,
                    maxHp: TROOPS[type].hp,
                    target: null,
                    attackCooldown: 0
                });

            }

        });

    combat = {

        time: 180,

        enemyBuildings,

        troops: combatTroops,

        damage: 0,

        enemyDamage: 0,

        ended: false

    };

    troops = combatTroops;

    camera.x = 24 * TILE;
    camera.y = 24 * TILE;
    camera.zoom = .9;
}

/* =========================================================
   LÓGICA DEL COMBATE
========================================================= */

function updateCombat(dt) {

    if (!combat || combat.ended)
        return;

    combat.time -= dt;

    if (combat.time <= 0) {

        finishCombat();

        return;
    }

    /* TROOP AI */

    combat.troops.forEach(troop => {

        if (troop.hp <= 0)
            return;

        const data = TROOPS[troop.type];

        let target =
            findClosestEnemyBuilding(troop);

        if (!target)
            return;

        const targetData =
            BUILDINGS[target.type];

        const centerX =
            target.x + targetData.w/2;

        const centerY =
            target.y + targetData.h/2;

        const dx =
            centerX - troop.x;

        const dy =
            centerY - troop.y;

        const dist =
            Math.sqrt(dx*dx+dy*dy);

        if (
            dist >
            data.range
        ) {

            troop.x +=
                (dx/dist) *
                data.speed *
                dt;

            troop.y +=
                (dy/dist) *
                data.speed *
                dt;

        } else {

            troop.attackCooldown -= dt;

            if (troop.attackCooldown <= 0) {

                target.hp -= data.damage;

                troop.attackCooldown = .8;

                combat.damage +=
                    data.damage;

                if (target.hp <= 0) {

                    target.hp = 0;

                    notify(
                        `${data.icon} ¡Edificio destruido!`
                    );
                }
            }
        }
    });

    /* DEFENSAS */

    combat.enemyBuildings
        .forEach(building => {

            if (
                building.hp <= 0 ||
                !BUILDINGS[building.type].damage
            )
                return;

            building.cooldown =
                (building.cooldown || 0) - dt;

            if (building.cooldown > 0)
                return;

            const data =
                BUILDINGS[building.type];

            let closest = null;
            let closestDistance = Infinity;

            combat.troops.forEach(troop => {

                if (troop.hp <= 0)
                    return;

                const d =
                    distance(
                        building.x,
                        building.y,
                        troop.x,
                        troop.y
                    );

                if (
                    d < data.range &&
                    d < closestDistance
                ) {

                    closestDistance = d;
                    closest = troop;
                }
            });

            if (closest) {

                closest.hp -= data.damage;

                combat.enemyDamage +=
                    data.damage;

                building.cooldown =
                    data.attackSpeed / 1000;
            }
        });

    const destroyed =
        combat.enemyBuildings
            .filter(b => b.hp <= 0)
            .length;

    combat.damage =
        Math.max(
            combat.damage,
            destroyed * 100
        );

    /* PORCENTAJE REAL */

    let totalHp = 0;
    let destroyedHp = 0;

    combat.enemyBuildings
        .forEach(b => {

            totalHp += b.maxHp;

            destroyedHp +=
                b.maxHp -
                Math.max(0,b.hp);

        });

    combat.damage =
        Math.floor(
            destroyedHp / totalHp * 100
        );

    document.getElementById(
        "combat-my-percent"
    ).textContent =
        Math.min(100,combat.damage) + "%";

    const remainingTroops =
        combat.troops.filter(
            t => t.hp > 0
        ).length;

    const enemyPercent =
        Math.floor(
            Math.random() * 8
        );

    document.getElementById(
        "combat-enemy-percent"
    ).textContent =
        enemyPercent + "%";

    if (
        combat.enemyBuildings
            .find(b =>
                b.type === "townhall" &&
                b.hp <= 0
            )
    ) {

        finishCombat(true);
    }

    if (
        remainingTroops === 0
    ) {

        finishCombat(false);
    }
}

function findClosestEnemyBuilding(troop) {

    let best = null;
    let bestDistance = Infinity;

    combat.enemyBuildings
        .forEach(b => {

            if (b.hp <= 0)
                return;

            const d =
                distance(
                    troop.x,
                    troop.y,
                    b.x,
                    b.y
                );

            if (d < bestDistance) {

                bestDistance = d;
                best = b;
            }

        });

    return best;
}

/* =========================================================
   FINAL COMBATE
========================================================= */

function finishCombat(forceWin=null) {

    if (!combat || combat.ended)
        return;

    combat.ended = true;

    const townhall =
        combat.enemyBuildings.find(
            b => b.type === "townhall"
        );

    const destruction =
        combat.damage;

    let victory;

    if (forceWin !== null)
        victory = forceWin;
    else
        victory =
            destruction >= 50;

    let trophies;

    if (victory) {

        trophies =
            10 +
            Math.floor(destruction / 5);

        resources.trophies += trophies;

        resources.gold += 500 + destruction * 10;
        resources.elixir += 500 + destruction * 10;

    } else {

        trophies =
            -Math.floor(
                Math.max(1,20-destruction/5)
            );

        resources.trophies =
            Math.max(
                0,
                resources.trophies + trophies
            );
    }

    /* LAS TROPAS SUPERVIVIENTES SE PIERDEN */

    army = {
        barbarian: 0,
        archer: 0,
        giant: 0
    };

    document
        .getElementById("combat-ui")
        .classList.add("hidden");

    document
        .getElementById("combat-result")
        .classList.remove("hidden");

    document.getElementById(
        "result-title"
    ).textContent =
        victory
            ? "¡VICTORIA!"
            : "DERROTA";

    document.getElementById(
        "result-icon"
    ).textContent =
        victory ? "🏆" : "💀";

    document.getElementById(
        "result-damage"
    ).textContent =
        destruction + "%";

    document.getElementById(
        "result-trophies"
    ).textContent =
        (trophies >= 0 ? "+" : "") +
        trophies;

    document.getElementById(
        "result-gold"
    ).textContent =
        victory
            ? "+" + (500 + destruction * 10)
            : "0";

    document.getElementById(
        "result-stars"
    ).textContent =
        destruction >= 100
            ? "⭐ ⭐ ⭐"
            : destruction >= 67
                ? "⭐ ⭐"
                : destruction >= 33
                    ? "⭐"
                    : "—";

    saveGame();
    updateUI();
}

function closeCombatResult() {

    document
        .getElementById("combat-result")
        .classList.add("hidden");

    combat = null;
    troops = [];

    camera.x = 24 * TILE;
    camera.y = 24 * TILE;
    camera.zoom = 1;

    renderArmy();
}

function surrenderCombat() {

    finishCombat(false);
}

/* =========================================================
   DIBUJAR MAPA
========================================================= */

function drawMap() {

    const size =
        MAP * TILE;

    ctx.fillStyle = "#487d2c";

    ctx.fillRect(
        0,
        0,
        size,
        size
    );

    /* BALDOSAS */

    for (let y=0;y<MAP;y++) {

        for (let x=0;x<MAP;x++) {

            const variation =
                ((x*17+y*31)%20);

            ctx.fillStyle =
                variation < 4
                    ? "#4e8430"
                    : "#4a7f2d";

            ctx.fillRect(
                x*TILE,
                y*TILE,
                TILE,
                TILE
            );
        }
    }

    /* BORDES */

    ctx.strokeStyle = "#294719";
    ctx.lineWidth = 8;

    ctx.strokeRect(
        0,
        0,
        size,
        size
    );
}

/* =========================================================
   DIBUJAR OBSTÁCULOS
========================================================= */

function drawObstacles() {

    obstacles.forEach(o => {

        const x =
            o.x*TILE + TILE/2;

        const y =
            o.y*TILE + TILE/2;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.font = "30px Arial";

        ctx.fillText(
            o.type === "tree"
                ? "🌳"
                : "🪨",
            x,
            y
        );
    });
}

/* =========================================================
   DIBUJAR EDIFICIOS
========================================================= */

function drawBuildings(list=buildings) {

    list.forEach(b => {

        if (b.hp <= 0)
            return;

        const data =
            BUILDINGS[b.type];

        const x =
            b.x*TILE;

        const y =
            b.y*TILE;

        const w =
            data.w*TILE;

        const h =
            data.h*TILE;

        /* SOMBRA */

        ctx.fillStyle =
            "rgba(0,0,0,.3)";

        ctx.fillRect(
            x+5,
            y+6,
            w,
            h
        );

        /* EDIFICIO */

        ctx.fillStyle =
            data.color;

        ctx.fillRect(
            x,
            y,
            w,
            h
        );

        /* BORDE */

        ctx.strokeStyle =
            b.id === selectedId
                ? "#ffe600"
                : "#292929";

        ctx.lineWidth =
            b.id === selectedId
                ? 4
                : 2;

        ctx.strokeRect(
            x,
            y,
            w,
            h
        );

        /* ICONO */

        ctx.font =
            `${Math.min(w,h)*.65}px Arial`;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            data.icon,
            x+w/2,
            y+h/2
        );

        /* NIVEL */

        if (b.level) {

            ctx.fillStyle = "#ffe600";

            ctx.font = "11px Arial";

            ctx.fillText(
                "Nv." + b.level,
                x+w/2,
                y+h-8
            );
        }

        /* BARRA DE VIDA */

        if (
            b.hp < b.maxHp
        ) {

            const ratio =
                Math.max(
                    0,
                    b.hp / b.maxHp
                );

            ctx.fillStyle = "#111";

            ctx.fillRect(
                x,
                y-7,
                w,
                5
            );

            ctx.fillStyle =
                ratio > .5
                    ? "#2ecc71"
                    : ratio > .25
                        ? "#f1c40f"
                        : "#e74c3c";

            ctx.fillRect(
                x,
                y-7,
                w*ratio,
                5
            );
        }
    });
}

/* =========================================================
   VILLAGERS
========================================================= */

function updateVillagers(dt) {

    villagers.forEach(v => {

        v.timer -= dt;

        if (v.timer <= 0) {

            v.targetX =
                16 + Math.random()*15;

            v.targetY =
                16 + Math.random()*15;

            v.timer =
                2 + Math.random()*4;
        }

        const dx =
            v.targetX-v.x;

        const dy =
            v.targetY-v.y;

        const d =
            Math.sqrt(dx*dx+dy*dy);

        if (d>.1) {

            v.x +=
                dx/d*.4*dt;

            v.y +=
                dy/d*.4*dt;
        }
    });
}

function drawVillagers() {

    villagers.forEach(v => {

        ctx.font = "20px Arial";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            "👷",
            v.x*TILE,
            v.y*TILE
        );
    });
}

/* =========================================================
   DIBUJAR TROPAS DE COMBATE
========================================================= */

function drawCombatTroops() {

    if (!combat)
        return;

    combat.troops.forEach(t => {

        if (t.hp <= 0)
            return;

        const data =
            TROOPS[t.type];

        ctx.font = "24px Arial";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            data.icon,
            t.x*TILE,
            t.y*TILE
        );

        /* VIDA */

        ctx.fillStyle = "#222";

        ctx.fillRect(
            t.x*TILE-12,
            t.y*TILE-20,
            24,
            3
        );

        ctx.fillStyle = "#2ecc71";

        ctx.fillRect(
            t.x*TILE-12,
            t.y*TILE-20,
            24*
            Math.max(
                0,
                t.hp/t.maxHp
            ),
            3
        );
    });
}

/* =========================================================
   PREVISUALIZACIÓN CONSTRUCCIÓN
========================================================= */

function drawBuildingPreview() {

    if (!buildMode ||
        !pendingType)
        return;

    const data =
        BUILDINGS[pendingType];

    const x =
        pendingX*TILE;

    const y =
        pendingY*TILE;

    const w =
        data.w*TILE;

    const h =
        data.h*TILE;

    const valid =
        !occupied(
            pendingX,
            pendingY,
            data.w,
            data.h
        );

    ctx.globalAlpha = .55;

    ctx.fillStyle =
        valid
            ? "#2ecc71"
            : "#e74c3c";

    ctx.fillRect(
        x,
        y,
        w,
        h
    );

    ctx.globalAlpha = 1;

    ctx.font =
        `${Math.min(w,h)*.65}px Arial`;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        data.icon,
        x+w/2,
        y+h/2
    );

    ctx.strokeStyle =
        valid
            ? "#2ecc71"
            : "#e74c3c";

    ctx.lineWidth = 4;

    ctx.strokeRect(
        x,
        y,
        w,
        h
    );
}

/* =========================================================
   CLICK MAPA
========================================================= */

function screenToWorld(px,py) {

    return {

        x:
            ((px-W/2)/camera.zoom)
            + camera.x,

        y:
            ((py-H/2)/camera.zoom)
            + camera.y
    };
}

function pointerToGrid(px,py) {

    const world =
        screenToWorld(px,py);

    return {

        x:
            Math.floor(world.x/TILE),

        y:
            Math.floor(world.y/TILE)
    };
}

canvas.addEventListener(
    "pointerdown",
    e => {

        dragging = true;
        moved = false;

        pointerStart.x = e.clientX;
        pointerStart.y = e.clientY;

        cameraStart.x = camera.x;
        cameraStart.y = camera.y;
    }
);

canvas.addEventListener(
    "pointermove",
    e => {

        if (!dragging)
            return;

        const dx =
            e.clientX -
            pointerStart.x;

        const dy =
            e.clientY -
            pointerStart.y;

        if (
            Math.abs(dx)>6 ||
            Math.abs(dy)>6
        )
            moved = true;

        if (!buildMode) {

            camera.x =
                cameraStart.x -
                dx/camera.zoom;

            camera.y =
                cameraStart.y -
                dy/camera.zoom;

        } else {

            const g =
                pointerToGrid(
                    e.clientX,
                    e.clientY
                );

            pendingX = g.x;
            pendingY = g.y;
        }
    }
);

canvas.addEventListener(
    "pointerup",
    e => {

        if (!dragging)
            return;

        dragging = false;

        if (moved)
            return;

        const g =
            pointerToGrid(
                e.clientX,
                e.clientY
            );

        if (buildMode) {

            pendingX = g.x;
            pendingY = g.y;

            confirmConstruction();

            return;
        }

        /* EDIFICIOS */

        const clicked =
            buildings.find(b => {

                const data =
                    BUILDINGS[b.type];

                return (
                    g.x >= b.x &&
                    g.x < b.x+data.w &&
                    g.y >= b.y &&
                    g.y < b.y+data.h
                );
            });

        if (clicked) {

            openBuildingMenu(
                clicked.id
            );

            return;
        }

        /* OBSTÁCULOS */

        const obstacleIndex =
            obstacles.findIndex(
                o =>
                    o.x === g.x &&
                    o.y === g.y
            );

        if (obstacleIndex >= 0) {

            const o =
                obstacles[obstacleIndex];

            const reward =
                o.type === "tree"
                    ? 30
                    : 50;

            resources.gold += reward;

            obstacles.splice(
                obstacleIndex,
                1
            );

            notify(
                `🌳 Obstáculo eliminado. +${reward} 🪙`
            );

            saveGame();
            updateUI();
        }
    }
);

/* =========================================================
   ZOOM
========================================================= */

canvas.addEventListener(
    "wheel",
    e => {

        e.preventDefault();

        camera.zoom *=
            e.deltaY < 0
                ? 1.1
                : .9;

        camera.zoom =
            Math.max(
                .55,
                Math.min(
                    1.8,
                    camera.zoom
                )
            );
    },
    {passive:false}
);

/* =========================================================
   ACTUALIZACIÓN
========================================================= */

let lastTime =
    performance.now();

function update(time) {

    const dt =
        Math.min(
            .1,
            (time-lastTime)/1000
        );

    lastTime = time;

    frame++;

    /* PRODUCCIÓN */

    if (frame % 60 === 0 &&
        !combat) {

        buildings.forEach(b => {

            if (b.type === "goldmine") {

                resources.gold =
                    Math.min(
                        resources.gold+15,
                        999999
                    );
            }

            if (b.type === "elixirpump") {

                resources.elixir =
                    Math.min(
                        resources.elixir+15,
                        999999
                    );
            }
        });

        saveGame();
        updateUI();
    }

    updateVillagers(dt);

    if (combat) {

        updateCombat(dt);

        document.getElementById(
            "combat-time"
        ).textContent =
            formatTime(
                Math.ceil(combat.time)
            );
    }

    draw();

    requestAnimationFrame(update);
}

/* =========================================================
   DIBUJADO PRINCIPAL
========================================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        W,
        H
    );

    ctx.save();

    ctx.translate(
        W/2,
        H/2
    );

    ctx.scale(
        camera.zoom,
        camera.zoom
    );

    ctx.translate(
        -camera.x,
        -camera.y
    );

    drawMap();

    if (combat) {

        drawCombatMap();

    } else {

        drawObstacles();
        drawBuildings();
        drawVillagers();
        drawBuildingPreview();
    }

    ctx.restore();
}

/* =========================================================
   MAPA DE COMBATE
========================================================= */

function drawCombatMap() {

    /* Arena */

    ctx.fillStyle = "#486f31";

    ctx.fillRect(
        0,
        0,
        MAP*TILE,
        MAP*TILE
    );

    /* Obstáculos decorativos */

    for (let i=0;i<30;i++) {

        const x =
            (i*17)%MAP;

        const y =
            (i*29)%MAP;

        ctx.font = "22px Arial";

        ctx.fillText(
            i%2
                ? "🌲"
                : "🌿",
            x*TILE,
            y*TILE
        );
    }

    /* Murallas enemigas */

    combat.enemyBuildings
        .filter(b => b.type === "wall")
        .forEach(b => {

            if (b.hp <= 0)
                return;

            ctx.fillStyle =
                "#777";

            ctx.fillRect(
                b.x*TILE,
                b.y*TILE,
                TILE,
                TILE
            );

            ctx.strokeStyle =
                "#333";

            ctx.strokeRect(
                b.x*TILE,
                b.y*TILE,
                TILE,
                TILE
            );
        });

    drawBuildings(
        combat.enemyBuildings
    );

    drawCombatTroops();
}

/* =========================================================
   TIEMPO
========================================================= */

function formatTime(seconds) {

    const m =
        Math.floor(seconds/60);

    const s =
        seconds%60;

    return (
        String(m).padStart(2,"0") +
        ":" +
        String(s).padStart(2,"0")
    );
}

/* =========================================================
   FULLSCREEN
========================================================= */

async function toggleFullscreen() {

    try {

        if (!document.fullscreenElement) {

            await document
                .documentElement
                .requestFullscreen();

            if (
                screen.orientation &&
                screen.orientation.lock
            ) {

                try {

                    await screen.orientation.lock(
                        "landscape"
                    );

                } catch {}

            }

        } else {

            await document.exitFullscreen();
        }

    } catch {

        notify(
            "Tu navegador no permite pantalla completa."
        );
    }
}

/* =========================================================
   TECLADO
========================================================= */

window.addEventListener(
    "keydown",
    e => {

        if (e.key === "Escape") {

            if (buildMode) {

                cancelConstruction();
                return;
            }

            closeBuildingMenu();
            closeShop();
            closeArmy();

        }

        if (e.key === "+" ||
            e.key === "=") {

            camera.zoom =
                Math.min(
                    1.8,
                    camera.zoom*1.1
                );
        }

        if (e.key === "-") {

            camera.zoom =
                Math.max(
                    .55,
                    camera.zoom*.9
                );
        }
    }
);

/* =========================================================
   INICIO
========================================================= */

loadGame();

updateUI();

requestAnimationFrame(update);

/* AUTOGUARDADO */

setInterval(
    saveGame,
    10000
);
