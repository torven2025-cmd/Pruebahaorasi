/* ============================================================
   CASTLE KINGDOM
   VERSIÓN EXPANDIDA
============================================================ */


/* ============================================================
   CANVAS
============================================================ */

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");


let W =
    window.innerWidth;

let H =
    window.innerHeight;


function resizeCanvas() {

    W =
        window.innerWidth;

    H =
        window.innerHeight;


    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );


    canvas.width =
        W * dpr;

    canvas.height =
        H * dpr;


    canvas.style.width =
        W + "px";

    canvas.style.height =
        H + "px";


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}


window.addEventListener(
    "resize",
    resizeCanvas
);


resizeCanvas();



/* ============================================================
   CONFIGURACIÓN
============================================================ */

const TILE = 48;

const WORLD_W = 2400;

const WORLD_H = 1800;

const MIN_ZOOM = .55;

const MAX_ZOOM = 1.8;


let zoom = 1;


let camera = {

    x:
        WORLD_W / 2,

    y:
        WORLD_H / 2,

    vx: 0,

    vy: 0
};


let mode =
    "home";


let selectedObject =
    null;


let placement =
    null;


let draggingCamera =
    false;


let pointerMoved =
    false;


let touches =
    new Map();


let pinchDistance =
    null;


let lastPointer = {

    x: 0,

    y: 0
};



/* ============================================================
   RECURSOS
============================================================ */

let resources = {

    gold: 1500,

    elixir: 1500,

    gems: 50,

    trophies: 0
};



/* ============================================================
   PRODUCCIÓN
============================================================ */

let productionTimer = 0;


/* ============================================================
   EJÉRCITO
============================================================ */

let army = {

    warrior: 10,

    archer: 5
};


const MAX_ARMY =
    30;



/* ============================================================
   DATOS DE EDIFICIOS
============================================================ */

const BUILDINGS = {

    townhall: {

        name: "Ayuntamiento",

        icon: "🏰",

        width: 3,

        height: 3,

        hp: 3000,

        costGold: 0,

        costElixir: 0,

        damage: 0,

        goldProduction: 0,

        elixirProduction: 0
    },


    goldmine: {

        name: "Mina de oro",

        icon: "🪙",

        width: 2,

        height: 2,

        hp: 700,

        costGold: 250,

        costElixir: 0,

        damage: 0,

        goldProduction: 3,

        elixirProduction: 0
    },


    elixir: {

        name: "Recolector",

        icon: "💧",

        width: 2,

        height: 2,

        hp: 700,

        costGold: 0,

        costElixir: 250,

        damage: 0,

        goldProduction: 0,

        elixirProduction: 3
    },


    barracks: {

        name: "Cuartel",

        icon: "⚔️",

        width: 2,

        height: 2,

        hp: 900,

        costGold: 400,

        costElixir: 200,

        damage: 0,

        goldProduction: 0,

        elixirProduction: 0
    },


    cannon: {

        name: "Cañón",

        icon: "💣",

        width: 2,

        height: 2,

        hp: 850,

        costGold: 500,

        costElixir: 0,

        damage: 45,

        range: 260,

        fireRate: 1000,

        goldProduction: 0,

        elixirProduction: 0
    },


    archerTower: {

        name: "Torre de arqueros",

        icon: "🏹",

        width: 2,

        height: 2,

        hp: 700,

        costGold: 350,

        costElixir: 250,

        damage: 30,

        range: 330,

        fireRate: 750,

        goldProduction: 0,

        elixirProduction: 0
    },


    wall: {

        name: "Muro",

        icon: "🧱",

        width: 1,

        height: 1,

        hp: 500,

        costGold: 80,

        costElixir: 0,

        damage: 0,

        goldProduction: 0,

        elixirProduction: 0
    }
};



/* ============================================================
   ALDEA
============================================================ */

let buildings = [];


let nextId = 1;


/* ============================================================
   ID
============================================================ */

function createId() {

    return nextId++;
}



/* ============================================================
   CREAR EDIFICIO
============================================================ */

function createBuilding(
    type,
    x,
    y,
    level = 1
) {

    const data =
        BUILDINGS[type];


    const maxHp =
        data.hp *
        (
            1 +
            (level - 1) *
            .35
        );


    return {

        id:
            createId(),

        type,

        x,

        y,

        width:
            data.width,

        height:
            data.height,

        level,

        maxHp,

        hp:
            maxHp,

        lastShot:
            0
    };
}



/* ============================================================
   ALDEA INICIAL
============================================================ */

function createInitialVillage() {

    buildings = [];


    const cx =
        WORLD_W / 2;

    const cy =
        WORLD_H / 2;


    buildings.push(
        createBuilding(
            "townhall",
            cx - TILE * 1.5,
            cy - TILE * 1.5
        )
    );


    buildings.push(
        createBuilding(
            "goldmine",
            cx - 220,
            cy - 80
        )
    );


    buildings.push(
        createBuilding(
            "goldmine",
            cx + 130,
            cy - 80
        )
    );


    buildings.push(
        createBuilding(
            "elixir",
            cx - 220,
            cy + 100
        )
    );


    buildings.push(
        createBuilding(
            "barracks",
            cx + 130,
            cy + 100
        )
    );


    buildings.push(
        createBuilding(
            "cannon",
            cx - 300,
            cy - 250
        )
    );


    buildings.push(
        createBuilding(
            "archerTower",
            cx + 220,
            cy - 250
        )
    );


    for (
        let i = -5;
        i <= 5;
        i++
    ) {

        buildings.push(
            createBuilding(
                "wall",
                cx + i * TILE,
                cy - 260
            )
        );


        buildings.push(
            createBuilding(
                "wall",
                cx + i * TILE,
                cy + 250
            )
        );
    }


    for (
        let i = -4;
        i <= 4;
        i++
    ) {

        buildings.push(
            createBuilding(
                "wall",
                cx - 280,
                cy + i * TILE
            )
        );


        buildings.push(
            createBuilding(
                "wall",
                cx + 280,
                cy + i * TILE
            )
        );
    }
}



/* ============================================================
   ENEMIGO
============================================================ */

let enemyBuildings = [];


function createEnemyVillage() {

    enemyBuildings = [];


    const cx =
        WORLD_W / 2;

    const cy =
        WORLD_H / 2;


    enemyBuildings.push(
        createBuilding(
            "townhall",
            cx - 72,
            cy - 72,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "goldmine",
            cx - 250,
            cy - 180,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "goldmine",
            cx + 170,
            cy - 180,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "elixir",
            cx - 250,
            cy + 120,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "elixir",
            cx + 170,
            cy + 120,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "barracks",
            cx - 370,
            cy - 40,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "cannon",
            cx - 330,
            cy - 330,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "cannon",
            cx + 260,
            cy - 330,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "archerTower",
            cx - 330,
            cy + 260,
            2
        )
    );


    enemyBuildings.push(
        createBuilding(
            "archerTower",
            cx + 260,
            cy + 260,
            2
        )
    );


    for (
        let i = -6;
        i <= 6;
        i++
    ) {

        enemyBuildings.push(
            createBuilding(
                "wall",
                cx + i * TILE,
                cy - 310
            )
        );


        enemyBuildings.push(
            createBuilding(
                "wall",
                cx + i * TILE,
                cy + 310
            )
        );
    }


    for (
        let i = -5;
        i <= 5;
        i++
    ) {

        enemyBuildings.push(
            createBuilding(
                "wall",
                cx - 310,
                cy + i * TILE
            )
        );


        enemyBuildings.push(
            createBuilding(
                "wall",
                cx + 310,
                cy + i * TILE
            )
        );
    }
}



/* ============================================================
   TROPAS
============================================================ */

const TROOPS = {

    warrior: {

        name:
            "Guerrero",

        icon:
            "🪖",

        hp:
            100,

        damage:
            20,

        speed:
            1.4,

        range:
            30,

        attackSpeed:
            700,

        costElixir:
            50
    },


    archer: {

        name:
            "Arquero",

        icon:
            "🏹",

        hp:
            65,

        damage:
            15,

        speed:
            1.1,

        range:
            180,

        attackSpeed:
            800,

        costElixir:
            70
    }
};


let troops = [];


let battle = {

    selectedUnit:
        "warrior",

    stars:
        0,

    goldLoot:
        0,

    elixirLoot:
        0,

    ended:
        false,

    startTime:
        0,

    duration:
        180000
};



/* ============================================================
   UTILIDADES
============================================================ */

function clamp(
    value,
    min,
    max
) {

    return Math.max(
        min,
        Math.min(
            max,
            value
        )
    );
}


function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );
}


function centerOf(obj) {

    return {

        x:
            obj.x +
            obj.width *
            TILE /
            2,

        y:
            obj.y +
            obj.height *
            TILE /
            2
    };
}



/* ============================================================
   COORDENADAS
============================================================ */

function screenToWorld(
    screenX,
    screenY
) {

    return {

        x:
            camera.x +
            (
                screenX -
                W / 2
            ) /
            zoom,

        y:
            camera.y +
            (
                screenY -
                H / 2
            ) /
            zoom
    };
}


function worldToScreen(
    worldX,
    worldY
) {

    return {

        x:
            W / 2 +
            (
                worldX -
                camera.x
            ) *
            zoom,

        y:
            H / 2 +
            (
                worldY -
                camera.y
            ) *
            zoom
    };
}



/* ============================================================
   CÁMARA
============================================================ */

function moveCamera(
    dx,
    dy
) {

    camera.x -=
        dx / zoom;

    camera.y -=
        dy / zoom;


    clampCamera();
}


function clampCamera() {

    camera.x =
        clamp(
            camera.x,
            W / 2 / zoom,
            WORLD_W -
            W / 2 / zoom
        );


    camera.y =
        clamp(
            camera.y,
            H / 2 / zoom,
            WORLD_H -
            H / 2 / zoom
        );
}



/* ============================================================
   ZOOM
============================================================ */

function setZoom(
    newZoom,
    centerX = W / 2,
    centerY = H / 2
) {

    const before =
        screenToWorld(
            centerX,
            centerY
        );


    zoom =
        clamp(
            newZoom,
            MIN_ZOOM,
            MAX_ZOOM
        );


    const after =
        screenToWorld(
            centerX,
            centerY
        );


    camera.x +=
        before.x -
        after.x;


    camera.y +=
        before.y -
        after.y;


    clampCamera();
}


canvas.addEventListener(
    "wheel",
    function(e) {

        e.preventDefault();


        const amount =
            e.deltaY > 0
                ? -.1
                : .1;


        setZoom(
            zoom + amount,
            e.clientX,
            e.clientY
        );

    },
    {
        passive: false
    }
);



/* ============================================================
   FONDO
============================================================ */

function drawWorldBackground() {

    ctx.fillStyle =
        "#79b84a";


    ctx.fillRect(
        0,
        0,
        W,
        H
    );


    const startX =
        Math.floor(
            (
                camera.x -
                W / 2 / zoom
            ) /
            TILE
        ) - 1;


    const endX =
        Math.ceil(
            (
                camera.x +
                W / 2 / zoom
            ) /
            TILE
        ) + 1;


    const startY =
        Math.floor(
            (
                camera.y -
                H / 2 / zoom
            ) /
            TILE
        ) - 1;


    const endY =
        Math.ceil(
            (
                camera.y +
                H / 2 / zoom
            ) /
            TILE
        ) + 1;


    ctx.save();


    ctx.globalAlpha =
        .15;


    ctx.strokeStyle =
        "#315b2b";


    ctx.lineWidth =
        1 / zoom;


    for (
        let x = startX;
        x <= endX;
        x++
    ) {

        const sx =
            worldToScreen(
                x * TILE,
                0
            ).x;


        ctx.beginPath();

        ctx.moveTo(
            sx,
            0
        );

        ctx.lineTo(
            sx,
            H
        );

        ctx.stroke();
    }


    for (
        let y = startY;
        y <= endY;
        y++
    ) {

        const sy =
            worldToScreen(
                0,
                y * TILE
            ).y;


        ctx.beginPath();

        ctx.moveTo(
            0,
            sy
        );

        ctx.lineTo(
            W,
            sy
        );

        ctx.stroke();
    }


    ctx.restore();
}



/* ============================================================
   PREVISUALIZACIÓN
============================================================ */

function drawPlacementPreview() {

    if (!placement) {
        return;
    }


    const data =
        BUILDINGS[
            placement.type
        ];


    const p =
        worldToScreen(
            placement.x,
            placement.y
        );


    const width =
        data.width *
        TILE *
        zoom;


    const height =
        data.height *
        TILE *
        zoom;


    const valid =
        isValidPlacement(
            placement.x,
            placement.y,
            placement.type,
            placement.existing
                ? placement.existing.id
                : null
        );


    ctx.save();


    ctx.globalAlpha =
        .55;


    ctx.fillStyle =
        valid
            ? "#22c55e"
            : "#ef4444";


    ctx.fillRect(
        p.x,
        p.y,
        width,
        height
    );


    ctx.strokeStyle =
        valid
            ? "#86efac"
            : "#fecaca";


    ctx.lineWidth =
        3;


    ctx.strokeRect(
        p.x,
        p.y,
        width,
        height
    );


    ctx.globalAlpha =
        1;


    ctx.font =
        `${Math.max(
            16,
            30 * zoom
        )}px Arial`;


    ctx.textAlign =
        "center";

    ctx.textBaseline =
        "middle";


    ctx.fillText(
        data.icon,
        p.x + width / 2,
        p.y + height / 2
    );


    ctx.restore();
}



/* ============================================================
   DIBUJAR EDIFICIO
============================================================ */

function drawBuilding(
    building,
    enemy = false
) {

    const data =
        BUILDINGS[
            building.type
        ];


    const p =
        worldToScreen(
            building.x,
            building.y
        );


    const width =
        building.width *
        TILE *
        zoom;


    const height =
        building.height *
        TILE *
        zoom;


    if (
        p.x + width < 0 ||
        p.y + height < 0 ||
        p.x > W ||
        p.y > H
    ) {

        return;
    }


    ctx.save();


    ctx.fillStyle =
        "rgba(0,0,0,.22)";


    ctx.fillRect(
        p.x + 5 * zoom,
        p.y + 7 * zoom,
        width,
        height
    );


    if (
        building.type ===
        "wall"
    ) {

        ctx.fillStyle =
            enemy
                ? "#7f1d1d"
                : "#64748b";


        ctx.fillRect(
            p.x,
            p.y,
            width,
            height
        );


        ctx.strokeStyle =
            "#1e293b";


        ctx.lineWidth =
            2 * zoom;


        ctx.strokeRect(
            p.x,
            p.y,
            width,
            height
        );

    } else {

        ctx.fillStyle =
            enemy
                ? "#7f1d1d"
                : "#475569";


        ctx.fillRect(
            p.x,
            p.y,
            width,
            height
        );


        ctx.strokeStyle =
            enemy
                ? "#fecaca"
                : "#cbd5e1";


        ctx.lineWidth =
            2 * zoom;


        ctx.strokeRect(
            p.x,
            p.y,
            width,
            height
        );


        const fontSize =
            Math.max(
                16,
                Math.min(
                    42,
                    30 * zoom
                )
            );


        ctx.font =
            `${fontSize}px Arial`;


        ctx.textAlign =
            "center";


        ctx.textBaseline =
            "middle";


        ctx.fillText(
            data.icon,
            p.x + width / 2,
            p.y + height / 2
        );


        /* NIVEL */

        if (
            zoom > .65
        ) {

            ctx.font =
                `bold ${
                    Math.max(
                        10,
                        13 * zoom
                    )
                }px Arial`;


            ctx.fillStyle =
                "#ffffff";


            ctx.fillText(
                `Nv.${building.level}`,
                p.x + width / 2,
                p.y + height - 8 * zoom
            );
        }
    }


    /* VIDA */

    if (
        mode === "battle" ||
        selectedObject === building
    ) {

        const hpPercent =
            clamp(
                building.hp /
                building.maxHp,
                0,
                1
            );


        const barWidth =
            width * .8;


        const barX =
            p.x +
            (
                width -
                barWidth
            ) /
            2;


        const barY =
            p.y -
            7 * zoom;


        ctx.fillStyle =
            "#111827";


        ctx.fillRect(
            barX,
            barY,
            barWidth,
            5 * zoom
        );


        ctx.fillStyle =
            hpPercent > .5
                ? "#22c55e"
                : hpPercent > .25
                    ? "#eab308"
                    : "#ef4444";


        ctx.fillRect(
            barX,
            barY,
            barWidth *
            hpPercent,
            5 * zoom
        );
    }


    /* SELECCIÓN */

    if (
        selectedObject === building
    ) {

        ctx.strokeStyle =
            "#facc15";


        ctx.lineWidth =
            3 * zoom;


        ctx.setLineDash([
            7 * zoom,
            5 * zoom
        ]);


        ctx.strokeRect(
            p.x - 4 * zoom,
            p.y - 4 * zoom,
            width + 8 * zoom,
            height + 8 * zoom
        );


        ctx.setLineDash([]);
    }


    ctx.restore();
}



/* ============================================================
   TROPA
============================================================ */

function drawTroop(troop) {

    const p =
        worldToScreen(
            troop.x,
            troop.y
        );


    const radius =
        13 * zoom;


    ctx.save();


    ctx.beginPath();


    ctx.arc(
        p.x,
        p.y,
        radius,
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        troop.type ===
        "warrior"
            ? "#2563eb"
            : "#9333ea";


    ctx.fill();


    ctx.strokeStyle =
        "#fff";


    ctx.lineWidth =
        2;


    ctx.stroke();


    ctx.font =
        `${Math.max(
            12,
            22 * zoom
        )}px Arial`;


    ctx.textAlign =
        "center";


    ctx.textBaseline =
        "middle";


    ctx.fillText(
        TROOPS[
            troop.type
        ].icon,
        p.x,
        p.y
    );


    const hpPercent =
        clamp(
            troop.hp /
            troop.maxHp,
            0,
            1
        );


    ctx.fillStyle =
        "#111827";


    ctx.fillRect(
        p.x -
        15 * zoom,
        p.y -
        22 * zoom,
        30 * zoom,
        4 * zoom
    );


    ctx.fillStyle =
        "#22c55e";


    ctx.fillRect(
        p.x -
        15 * zoom,
        p.y -
        22 * zoom,
        30 *
        zoom *
        hpPercent,
        4 * zoom
    );


    ctx.restore();
}



/* ============================================================
   EFECTOS
============================================================ */

let effects = [];


function createDamageEffect(
    x,
    y
) {

    effects.push({

        x,

        y,

        life:
            400,

        maxLife:
            400
    });
}


function updateEffects(dt) {

    for (
        const effect of effects
    ) {

        effect.life -= dt;
    }


    effects =
        effects.filter(
            e =>
                e.life > 0
        );
}


function drawEffects() {

    for (
        const effect of effects
    ) {

        const p =
            worldToScreen(
                effect.x,
                effect.y
            );


        const alpha =
            effect.life /
            effect.maxLife;


        ctx.save();


        ctx.globalAlpha =
            alpha;


        ctx.fillStyle =
            "#facc15";


        ctx.font =
            `bold ${
                18 + (1 - alpha) * 10
            }px Arial`;


        ctx.textAlign =
            "center";


        ctx.fillText(
            "💥",
            p.x,
            p.y -
            (1 - alpha) * 20
        );


        ctx.restore();
    }
}



/* ============================================================
   ZONA DE BATALLA
============================================================ */

function drawDeploymentArea() {

    if (
        mode !==
        "battle"
    ) {

        return;
    }


    ctx.save();


    ctx.fillStyle =
        "rgba(34,197,94,.06)";


    ctx.fillRect(
        0,
        0,
        W,
        H
    );


    ctx.fillStyle =
        "rgba(34,197,94,.7)";


    ctx.font =
        "bold 12px Arial";


    ctx.textAlign =
        "center";


    ctx.fillText(
        "ZONA DE DESPLIEGUE",
        W / 2,
        H - 145
    );


    ctx.restore();
}



/* ============================================================
   RENDER
============================================================ */

function render() {

    ctx.clearRect(
        0,
        0,
        W,
        H
    );


    drawWorldBackground();


    drawDeploymentArea();


    const list =
        mode === "battle"
            ? enemyBuildings
            : buildings;


    for (
        const building of list
    ) {

        drawBuilding(
            building,
            mode === "battle"
        );
    }


    for (
        const troop of troops
    ) {

        drawTroop(
            troop
        );
    }


    drawEffects();


    drawPlacementPreview();
}



/* ============================================================
   LOOP
============================================================ */

let lastTime =
    performance.now();


function gameLoop(now) {

    const dt =
        Math.min(
            now -
            lastTime,
            50
        );


    lastTime =
        now;


    update(dt);


    render();


    requestAnimationFrame(
        gameLoop
    );
}


requestAnimationFrame(
    gameLoop
);



/* ============================================================
   UPDATE
============================================================ */

function update(dt) {

    if (
        mode === "battle"
    ) {

        updateTroops(dt);

        updateDefenses(dt);

        updateBattleTimer();

        checkBattleState();
    }


    updateEffects(dt);


    /* INERCIA */

    if (
        !draggingCamera &&
        Math.abs(
            camera.vx
        ) > .01
    ) {

        camera.x +=
            camera.vx /
            zoom;


        camera.vx *=
            .90;
    }


    if (
        !draggingCamera &&
        Math.abs(
            camera.vy
        ) > .01
    ) {

        camera.y +=
            camera.vy /
            zoom;


        camera.vy *=
            .90;
    }


    clampCamera();
}



/* ============================================================
   PRODUCCIÓN DE RECURSOS
============================================================ */

function updateProduction(
    dt
) {

    if (
        mode !== "home"
    ) {

        return;
    }


    productionTimer += dt;


    if (
        productionTimer <
        1000
    ) {

        return;
    }


    productionTimer = 0;


    let goldPerSecond = 0;

    let elixirPerSecond = 0;


    for (
        const building of buildings
    ) {

        if (
            building.hp <= 0
        ) {

            continue;
        }


        const data =
            BUILDINGS[
                building.type
            ];


        goldPerSecond +=
            (
                data.goldProduction ||
                0
            ) *
            building.level;


        elixirPerSecond +=
            (
                data.elixirProduction ||
                0
            ) *
            building.level;
    }


    resources.gold +=
        goldPerSecond;


    resources.elixir +=
        elixirPerSecond;


    updateResourcesUI();
}


const originalUpdate =
    update;


function update(dt) {

    originalUpdate(dt);

    updateProduction(dt);
}



/* ============================================================
   BUSCAR OBJETIVO
============================================================ */

function findNearestEnemyBuilding(
    troop
) {

    let nearest =
        null;


    let nearestDistance =
        Infinity;


    for (
        const building of enemyBuildings
    ) {

        if (
            building.hp <= 0
        ) {

            continue;
        }


        const center =
            centerOf(
                building
            );


        const d =
            Math.hypot(
                troop.x -
                center.x,
                troop.y -
                center.y
            );


        if (
            d <
            nearestDistance
        ) {

            nearestDistance =
                d;

            nearest =
                building;
        }
    }


    return nearest;
}



/* ============================================================
   TROPAS
============================================================ */

function updateTroops(dt) {

    for (
        const troop of troops
    ) {

        if (
            troop.hp <= 0
        ) {

            continue;
        }


        const data =
            TROOPS[
                troop.type
            ];


        let target =
            enemyBuildings.find(
                b =>
                    b.id ===
                    troop.targetId &&
                    b.hp > 0
            );


        if (!target) {

            target =
                findNearestEnemyBuilding(
                    troop
                );


            troop.targetId =
                target
                    ? target.id
                    : null;
        }


        if (!target) {

            continue;
        }


        const targetCenter =
            centerOf(
                target
            );


        const d =
            Math.hypot(
                troop.x -
                targetCenter.x,
                troop.y -
                targetCenter.y
            );


        const reach =
            data.range +
            Math.max(
                target.width,
                target.height
            ) *
            TILE /
            2;


        if (
            d >
            reach
        ) {

            const dx =
                targetCenter.x -
                troop.x;


            const dy =
                targetCenter.y -
                troop.y;


            const length =
                Math.hypot(
                    dx,
                    dy
                ) ||
                1;


            troop.x +=
                dx /
                length *
                data.speed *
                dt /
                16;


            troop.y +=
                dy /
                length *
                data.speed *
                dt /
                16;

        } else {

            if (
                performance.now() -
                troop.lastAttack >
                data.attackSpeed
            ) {

                target.hp -=
                    data.damage;


                troop.lastAttack =
                    performance.now();


                createDamageEffect(
                    targetCenter.x,
                    targetCenter.y
                );
            }
        }
    }


    troops =
        troops.filter(
            troop =>
                troop.hp > 0
        );
}



/* ============================================================
   DEFENSAS
============================================================ */

function updateDefenses() {

    const now =
        performance.now();


    for (
        const building of enemyBuildings
    ) {

        if (
            building.hp <= 0 ||
            ![
                "cannon",
                "archerTower"
            ].includes(
                building.type
            )
        ) {

            continue;
        }


        const data =
            BUILDINGS[
                building.type
            ];


        if (
            now -
            building.lastShot <
            data.fireRate
        ) {

            continue;
        }


        const center =
            centerOf(
                building
            );


        let target =
            null;


        let bestDistance =
            Infinity;


        for (
            const troop of troops
        ) {

            const d =
                Math.hypot(
                    troop.x -
                    center.x,
                    troop.y -
                    center.y
                );


            if (
                d <=
                data.range &&
                d <
                bestDistance
            ) {

                bestDistance =
                    d;

                target =
                    troop;
            }
        }


        if (!target) {

            continue;
        }


        target.hp -=
            data.damage;


        building.lastShot =
            now;


        createDamageEffect(
            target.x,
            target.y
        );
    }
}



/* ============================================================
   BATALLA
============================================================ */

function startBattle() {

    if (
        army.warrior +
        army.archer <=
        0
    ) {

        showToast(
            "Necesitas tropas para atacar."
        );

        return;
    }


    document
        .getElementById(
            "attack-menu"
        )
        .classList.add(
            "hidden"
        );


    mode =
        "battle";


    selectedObject =
        null;


    placement =
        null;


    createEnemyVillage();


    troops = [];


    battle = {

        selectedUnit:
            "warrior",

        stars:
            0,

        goldLoot:
            0,

        elixirLoot:
            0,

        ended:
            false,

        startTime:
            performance.now(),

        duration:
            180000
    };


    camera.x =
        WORLD_W / 2;


    camera.y =
        WORLD_H / 2;


    document
        .getElementById(
            "battlePanel"
        )
        .classList.remove(
            "hidden"
        );


    document
        .getElementById(
            "modeText"
        )
        .textContent =
        "Batalla";


    updateBattleUI();


    showToast(
        "¡Despliega tus tropas!"
    );
}



/* ============================================================
   DESPLEGAR TROPA
============================================================ */

function deployTroop(
    worldX,
    worldY
) {

    if (
        mode !==
        "battle"
    ) {

        return;
    }


    const type =
        battle.selectedUnit;


    if (
        army[type] <=
        0
    ) {

        showToast(
            "No tienes tropas de este tipo."
        );

        return;
    }


    const enemyCenter = {

        x:
            WORLD_W / 2,

        y:
            WORLD_H / 2
    };


    const d =
        Math.hypot(
            worldX -
            enemyCenter.x,
            worldY -
            enemyCenter.y
        );


    if (
        d <
        380
    ) {

        showToast(
            "Debes desplegar fuera de la aldea."
        );

        return;
    }


    const data =
        TROOPS[
            type
        ];


    troops.push({

        id:
            createId(),

        type,

        x:
            worldX,

        y:
            worldY,

        hp:
            data.hp,

        maxHp:
            data.hp,

        targetId:
            null,

        lastAttack:
            0
    });


    army[type]--;


    updateBattleUI();


    saveGame(false);
}



/* ============================================================
   TIMER
============================================================ */

function updateBattleTimer() {

    if (
        battle.ended
    ) {

        return;
    }


    const elapsed =
        performance.now() -
        battle.startTime;


    const remaining =
        Math.max(
            0,
            battle.duration -
            elapsed
        );


    const seconds =
        Math.ceil(
            remaining /
            1000
        );


    const minutes =
        Math.floor(
            seconds /
            60
        );


    const sec =
        seconds %
        60;


    document.getElementById(
        "combat-time"
    ).textContent =
        `${String(minutes).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;


    if (
        remaining <=
        0
    ) {

        finishBattle(
            battle.stars > 0
        );
    }
}



/* ============================================================
   ESTADO BATALLA
============================================================ */

function checkBattleState() {

    if (
        battle.ended
    ) {

        return;
    }


    const total =
        enemyBuildings.length;


    const alive =
        enemyBuildings.filter(
            b =>
                b.hp > 0
        );


    const destroyed =
        total -
        alive.length;


    const percentage =
        destroyed /
        total;


    const townhall =
        enemyBuildings.find(
            b =>
                b.type ===
                "townhall"
        );


    if (
        townhall &&
        townhall.hp <=
        0
    ) {

        battle.stars =
            Math.max(
                battle.stars,
                1
            );
    }


    if (
        percentage >=
        .5
    ) {

        battle.stars =
            Math.max(
                battle.stars,
                2
            );
    }


    if (
        alive.length ===
        0
    ) {

        battle.stars =
            3;


        finishBattle(
            true
        );


        return;
    }


    if (
        troops.length ===
        0 &&
        army.warrior ===
        0 &&
        army.archer ===
        0
    ) {

        finishBattle(
            battle.stars >
            0
        );
    }


    const destruction =
        Math.floor(
            percentage *
            100
        );


    document.getElementById(
        "combat-my-percent"
    ).textContent =
        destruction +
        "%";
}



/* ============================================================
   FINALIZAR BATALLA
============================================================ */

function finishBattle(
    victory
) {

    if (
        battle.ended
    ) {

        return;
    }


    battle.ended =
        true;


    if (
        victory
    ) {

        battle.goldLoot =
            Math.floor(
                300 +
                Math.random() *
                800
            );


        battle.elixirLoot =
            Math.floor(
                250 +
                Math.random() *
                700
            );


        resources.gold +=
            battle.goldLoot;


        resources.elixir +=
            battle.elixirLoot;


        resources.trophies +=
            battle.stars *
            5;

    } else {

        battle.goldLoot =
            0;

        battle.elixirLoot =
            0;
    }


    updateResourcesUI();


    showResult(
        victory
    );


    saveGame(false);
}



/* ============================================================
   RESULTADO
============================================================ */

function showResult(
    victory
) {

    const overlay =
        document.getElementById(
            "resultOverlay"
        );


    overlay.classList.remove(
        "hidden"
    );


    document.getElementById(
        "resultIcon"
    ).textContent =
        victory
            ? "🏆"
            : "💀";


    document.getElementById(
        "resultTitle"
    ).textContent =
        victory
            ? "¡VICTORIA!"
            : "DERROTA";


    document.getElementById(
        "resultDescription"
    ).textContent =
        victory
            ? "Has conseguido saquear parte de la aldea enemiga."
            : "Tus tropas no consiguieron destruir la aldea.";


    document.getElementById(
        "resultStars"
    ).textContent =
        battle.stars;


    document.getElementById(
        "resultGold"
    ).textContent =
        battle.goldLoot;


    document.getElementById(
        "resultElixir"
    ).textContent =
        battle.elixirLoot;
}



/* ============================================================
   VOLVER A CASA
============================================================ */

function returnHome() {

    mode =
        "home";


    troops =
        [];


    selectedObject =
        null;


    placement =
        null;


    document
        .getElementById(
            "resultOverlay"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "battlePanel"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "modeText"
        )
        .textContent =
        "Tu aldea";


    camera.x =
        WORLD_W / 2;


    camera.y =
        WORLD_H / 2;


    updateResourcesUI();


    saveGame(false);


    showToast(
        "Has vuelto a tu aldea."
    );
}



/* ============================================================
   SELECCIÓN
============================================================ */

function findBuildingAt(
    worldX,
    worldY,
    list
) {

    for (
        let i =
            list.length - 1;
        i >= 0;
        i--
    ) {

        const b =
            list[i];


        if (
            worldX >=
            b.x &&

            worldX <=
            b.x +
            b.width *
            TILE &&

            worldY >=
            b.y &&

            worldY <=
            b.y +
            b.height *
            TILE
        ) {

            return b;
        }
    }


    return null;
}



function selectBuilding(
    building
) {

    selectedObject =
        building;


    if (!building) {

        document
            .getElementById(
                "selectionPanel"
            )
            .classList.add(
                "hidden"
            );

        return;
    }


    const data =
        BUILDINGS[
            building.type
        ];


    document.getElementById(
        "selectionIcon"
    ).textContent =
        data.icon;


    document.getElementById(
        "selectionName"
    ).textContent =
        data.name;


    document.getElementById(
        "selectionLevel"
    ).textContent =
        `Nivel ${building.level}`;


    const hpPercent =
        clamp(
            building.hp /
            building.maxHp,
            0,
            1
        );


    document.getElementById(
        "selectionHealth"
    ).style.width =
        `${hpPercent * 100}%`;


    document.getElementById(
        "selectionInfo"
    ).textContent =
        `❤️ ${Math.ceil(building.hp)} / ${Math.ceil(building.maxHp)}`;


    document
        .getElementById(
            "selectionPanel"
        )
        .classList.remove(
            "hidden"
        );


    document.getElementById(
        "deleteButton"
    ).style.display =
        building.type ===
        "townhall"
            ? "none"
            : "block";
}



/* ============================================================
   COLOCACIÓN
============================================================ */

function beginPlacement(
    type
) {

    const data =
        BUILDINGS[
            type
        ];


    if (
        resources.gold <
        data.costGold
    ) {

        showToast(
            "No tienes suficiente oro."
        );

        return;
    }


    if (
        resources.elixir <
        data.costElixir
    ) {

        showToast(
            "No tienes suficiente elixir."
        );

        return;
    }


    placement = {

        type,

        x:
            Math.floor(
                camera.x /
                TILE
            ) *
            TILE,

        y:
            Math.floor(
                camera.y /
                TILE
            ) *
            TILE,

        existing:
            null
    };


    document
        .getElementById(
            "placementControls"
        )
        .classList.remove(
            "hidden"
        );


    document
        .getElementById(
            "buildPanel"
        )
        .classList.add(
            "hidden"
        );


    showToast(
        "Toca el mapa para moverlo."
    );
}



/* ============================================================
   VALIDAR COLOCACIÓN
============================================================ */

function isValidPlacement(
    x,
    y,
    type,
    ignoreId = null
) {

    const data =
        BUILDINGS[
            type
        ];


    if (
        x < 50 ||
        y < 50 ||
        x +
            data.width *
            TILE >
            WORLD_W -
            50 ||
        y +
            data.height *
            TILE >
            WORLD_H -
            50
    ) {

        return false;
    }


    for (
        const b of buildings
    ) {

        if (
            ignoreId !==
            null &&
            b.id ===
            ignoreId
        ) {

            continue;
        }


        const overlap =
            x <
                b.x +
                b.width *
                TILE &&

            x +
                data.width *
                TILE >
                b.x &&

            y <
                b.y +
                b.height *
                TILE &&

            y +
                data.height *
                TILE >
                b.y;


        if (
            overlap
        ) {

            return false;
        }
    }


    return true;
}



/* ============================================================
   CONFIRMAR
============================================================ */

function confirmPlacement() {

    if (
        !placement
    ) {

        return;
    }


    const valid =
        isValidPlacement(
            placement.x,
            placement.y,
            placement.type,
            placement.existing
                ? placement.existing.id
                : null
        );


    if (!valid) {

        showToast(
            "No puedes colocar aquí."
        );

        return;
    }


    const data =
        BUILDINGS[
            placement.type
        ];


    if (
        placement.existing
    ) {

        placement.existing.x =
            placement.x;


        placement.existing.y =
            placement.y;


        showToast(
            "Edificio movido."
        );

    } else {

        resources.gold -=
            data.costGold;


        resources.elixir -=
            data.costElixir;


        buildings.push(
            createBuilding(
                placement.type,
                placement.x,
                placement.y
            )
        );


        showToast(
            `${data.name} construido.`
        );
    }


    placement =
        null;


    document
        .getElementById(
            "placementControls"
        )
        .classList.add(
            "hidden"
        );


    selectedObject =
        null;


    updateResourcesUI();


    saveGame(false);
}



/* ============================================================
   CANCELAR
============================================================ */

function cancelPlacement() {

    placement =
        null;


    document
        .getElementById(
            "placementControls"
        )
        .classList.add(
            "hidden"
        );
}



/* ============================================================
   REUBICAR
============================================================ */

function moveSelectedBuilding() {

    if (
        !selectedObject
    ) {

        return;
    }


    placement = {

        type:
            selectedObject.type,

        x:
            selectedObject.x,

        y:
            selectedObject.y,

        existing:
            selectedObject
    };


    document
        .getElementById(
            "selectionPanel"
        )
        .classList.add(
            "hidden"
        );


    document
        .getElementById(
            "placementControls"
        )
        .classList.remove(
            "hidden"
        );


    showToast(
        "Reubica el edificio."
    );
}



/* ============================================================
   ELIMINAR
============================================================ */

function deleteSelectedBuilding() {

    if (
        !selectedObject ||
        selectedObject.type ===
        "townhall"
    ) {

        return;
    }


    const index =
        buildings.indexOf(
            selectedObject
        );


    if (
        index >= 0
    ) {

        buildings.splice(
            index,
            1
        );


        showToast(
            "Edificio eliminado."
        );
    }


    selectedObject =
        null;


    document
        .getElementById(
            "selectionPanel"
        )
        .classList.add(
            "hidden"
        );


    saveGame(false);
}



/* ============================================================
   MEJORAR
============================================================ */

function upgradeSelectedBuilding() {

    if (
        !selectedObject
    ) {

        return;
    }


    if (
        selectedObject.type ===
        "townhall"
    ) {

        const townhallLevel =
            selectedObject.level;


        const cost =
            townhallLevel *
            1500;


        if (
            resources.gold <
            cost
        ) {

            showToast(
                `Necesitas ${cost} de oro.`
            );

            return;
        }


        resources.gold -=
            cost;


        selectedObject.level++;


        selectedObject.maxHp *=
            1.5;


        selectedObject.hp =
            selectedObject.maxHp;


        updateTownhallUI();


        selectBuilding(
            selectedObject
        );


        updateResourcesUI();


        saveGame(false);


        showToast(
            "¡Ayuntamiento mejorado!"
        );


        return;
    }


    const cost =
        selectedObject.level *
        500;


    if (
        resources.gold <
        cost
    ) {

        showToast(
            `Necesitas ${cost} de oro.`
        );

        return;
    }


    resources.gold -=
        cost;


    selectedObject.level++;


    selectedObject.maxHp *=
        1.35;


    selectedObject.hp =
        selectedObject.maxHp;


    selectBuilding(
        selectedObject
    );


    updateResourcesUI();


    saveGame(false);


    showToast(
        "¡Edificio mejorado!"
    );
}



/* ============================================================
   NIVEL AYUNTAMIENTO
============================================================ */

function getTownhallLevel() {

    const townhall =
        buildings.find(
            b =>
                b.type ===
                "townhall"
        );


    return townhall
        ? townhall.level
        : 1;
}


function updateTownhallUI() {

    const level =
        getTownhallLevel();


    document.getElementById(
        "player-level"
    ).textContent =
        `Ayuntamiento ${level}`;
}



/* ============================================================
   LÍMITES DE EDIFICIOS
============================================================ */

const BUILDING_LIMITS = {

    goldmine: 4,

    elixir: 4,

    barracks: 2,

    cannon: 4,

    archerTower: 4,

    wall: 80
};


function countBuilding(
    type
) {

    return buildings.filter(
        b =>
            b.type ===
            type
    ).length;
}


function canBuildMore(
    type
) {

    if (
        !BUILDING_LIMITS[type]
    ) {

        return true;
    }


    return (
        countBuilding(type) <
        BUILDING_LIMITS[type]
    );
}



/* ============================================================
   MENÚ CONSTRUIR
============================================================ */

function createBuildMenu() {

    const container =
        document.getElementById(
            "buildingList"
        );


    container.innerHTML =
        "";


    const order = [

        "goldmine",

        "elixir",

        "barracks",

        "cannon",

        "archerTower",

        "wall"
    ];


    for (
        const type of order
    ) {

        const data =
            BUILDINGS[
                type
            ];


        const button =
            document.createElement(
                "button"
            );


        button.className =
            "buildItem";


        button.innerHTML = `

            <div class="buildIcon">
                ${data.icon}
            </div>

            <div class="buildInfo">

                <strong>
                    ${data.name}
                </strong>

                <small>
                    🪙 ${data.costGold}
                    &nbsp;
                    💧 ${data.costElixir}
                </small>

                <small>
                    ${countBuilding(type)}
                    /
                    ${BUILDING_LIMITS[type] || "∞"}
                </small>

            </div>
        `;


        button.addEventListener(
            "click",
            () => {

                if (
                    !canBuildMore(
                        type
                    )
                ) {

                    showToast(
                        "Has alcanzado el límite."
                    );

                    return;
                }


                beginPlacement(
                    type
                );
            }
        );


        container.appendChild(
            button
        );
    }
}



/* ============================================================
   TIENDA
============================================================ */

function openShop() {

    document
        .getElementById(
            "shopOverlay"
        )
        .classList.remove(
            "hidden"
        );


    renderShop(
        "buildings"
    );
}


function closeShop() {

    document
        .getElementById(
            "shopOverlay"
        )
        .classList.add(
            "hidden"
        );
}


function renderShop(
    category
) {

    const container =
        document.getElementById(
            "shop-content"
        );


    container.innerHTML =
        "";


    let types;


    if (
        category ===
        "buildings"
    ) {

        types = [
            "goldmine",
            "elixir",
            "barracks"
        ];

    } else if (
        category ===
        "defenses"
    ) {

        types = [
            "cannon",
            "archerTower",
            "wall"
        ];

    } else {

        renderArmy();
        return;
    }


    for (
        const type of types
    ) {

        const data =
            BUILDINGS[
                type
            ];


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "shop-card";


        card.innerHTML = `

            <div class="icon">
                ${data.icon}
            </div>

            <h3>
                ${data.name}
            </h3>

            <p>
                ❤️ ${data.hp}
            </p>

            <div class="price">
                🪙 ${data.costGold}
                &nbsp;
                💧 ${data.costElixir}
            </div>

            <button
                class="shop-buy">

                CONSTRUIR

            </button>
        `;


        card
            .querySelector(
                ".shop-buy"
            )
            .onclick = () => {

                closeShop();

                beginPlacement(
                    type
                );
            };


        container.appendChild(
            card
        );
    }
}



/* ============================================================
   EJÉRCITO
============================================================ */

function renderArmy() {

    const container =
        document.getElementById(
            "army-content"
        );


    container.innerHTML =
        "";


    for (
        const type of
        Object.keys(TROOPS)
    ) {

        const data =
            TROOPS[type];


        const card =
            document.createElement(
                "div"
            );


        card.className =
            "troop-card";


        card.innerHTML = `

            <div class="troop-icon">
                ${data.icon}
            </div>

            <h3>
                ${data.name}
            </h3>

            <p>
                ❤️ ${data.hp}
            </p>

            <p>
                ⚔️ ${data.damage}
            </p>

            <p>
                💧 ${data.costElixir}
            </p>

            <button
                class="train-button">

                ENTRENAR

            </button>

        `;


        card
            .querySelector(
                ".train-button"
            )
            .onclick = () =>
                trainTroop(
                    type
                );


        container.appendChild(
            card
        );
    }


    updateBattleUI();
}


function openArmy() {

    renderArmy();


    document
        .getElementById(
            "armyPanel"
        )
        .classList.remove(
            "hidden"
        );
}


function closeArmy() {

    document
        .getElementById(
            "armyPanel"
        )
        .classList.add(
            "hidden"
        );
}



/* ============================================================
   ENTRENAR
============================================================ */

function trainTroop(
    type
) {

    const data =
        TROOPS[type];


    const total =
        army.warrior +
        army.archer;


    if (
        total >=
        MAX_ARMY
    ) {

        showToast(
            "El ejército está lleno."
        );

        return;
    }


    if (
        resources.elixir <
        data.costElixir
    ) {

        showToast(
            "No tienes suficiente elixir."
        );

        return;
    }


    resources.elixir -=
        data.costElixir;


    army[type]++;


    updateResourcesUI();


    renderArmy();


    saveGame(false);


    showToast(
        `${data.name} entrenado.`
    );
}



/* ============================================================
   UI RECURSOS
============================================================ */

function updateResourcesUI() {

    document.getElementById(
        "gold"
    ).textContent =
        Math.floor(
            resources.gold
        );


    document.getElementById(
        "elixir"
    ).textContent =
        Math.floor(
            resources.elixir
        );


    document.getElementById(
        "gems"
    ).textContent =
        Math.floor(
            resources.gems
        );


    document.getElementById(
        "trophies"
    ).textContent =
        Math.floor(
            resources.trophies
        );


    updateBattleUI();

    updateTownhallUI();
}



/* ============================================================
   BATTLE UI
============================================================ */

function updateBattleUI() {

    const warrior =
        document.getElementById(
            "battleWarriorCount"
        );


    const archer =
        document.getElementById(
            "battleArcherCount"
        );


    const total =
        document.getElementById(
            "armyTotal"
        );


    const stars =
        document.getElementById(
            "battleStars"
        );


    const loot =
        document.getElementById(
            "battleLoot"
        );


    if (warrior) {

        warrior.textContent =
            army.warrior;
    }


    if (archer) {

        archer.textContent =
            army.archer;
    }


    if (total) {

        total.textContent =
            army.warrior +
            army.archer;
    }


    if (stars) {

        stars.textContent =
            battle.stars;
    }


    if (loot) {

        loot.textContent =
            battle.goldLoot;
    }
}



/* ============================================================
   TOAST
============================================================ */

let toastTimer =
    null;


function showToast(
    message
) {

    const toast =
        document.getElementById(
            "toast"
        );


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.classList.remove(
                    "show"
                );

            },
            1800
        );
}



/* ============================================================
   NOTIFICACIÓN
============================================================ */

function showNotification(
    message
) {

    const container =
        document.getElementById(
            "notifications"
        );


    const notification =
        document.createElement(
            "div"
        );


    notification.className =
        "notification";


    notification.textContent =
        message;


    container.appendChild(
        notification
    );


    setTimeout(
        () => {

            notification.remove();

        },
        2200
    );
}



/* ============================================================
   GUARDAR
============================================================ */

function saveGame(
    notify = true
) {

    const data = {

        version:
            3,

        resources,

        army,

        buildings,

        nextId
    };


    localStorage.setItem(
        "castleKingdomSave",
        JSON.stringify(
            data
        )
    );


    if (
        notify
    ) {

        showToast(
            "Partida guardada."
        );
    }
}



/* ============================================================
   CARGAR
============================================================ */

function loadGame() {

    const raw =
        localStorage.getItem(
            "castleKingdomSave"
        );


    if (!raw) {

        createInitialVillage();

        return;
    }


    try {

        const data =
            JSON.parse(
                raw
            );


        resources =
            data.resources ||
            resources;


        army =
            data.army ||
            army;


        buildings =
            data.buildings ||
            [];


        nextId =
            data.nextId ||
            1;


        /* reparar edificios antiguos */

        buildings =
            buildings.map(
                b => {

                    const data =
                        BUILDINGS[
                            b.type
                        ];


                    if (!data) {

                        return null;
                    }


                    const level =
                        b.level ||
                        1;


                    const maxHp =
                        b.maxHp ||
                        data.hp *
                        (
                            1 +
                            (level - 1) *
                            .35
                        );


                    return {

                        ...b,

                        width:
                            data.width,

                        height:
                            data.height,

                        level,

                        maxHp,

                        hp:
                            Math.min(
                                b.hp ||
                                maxHp,
                                maxHp
                            ),

                        lastShot:
                            b.lastShot ||
                            0
                    };
                }
            )
            .filter(Boolean);


        if (
            buildings.length ===
            0
        ) {

            createInitialVillage();
        }

    } catch (
        error
    ) {

        console.error(
            error
        );


        createInitialVillage();
    }
}



/* ============================================================
   CONTROLES POINTER
============================================================ */

canvas.addEventListener(
    "pointerdown",
    e => {

        canvas.setPointerCapture(
            e.pointerId
        );


        touches.set(
            e.pointerId,
            {

                x:
                    e.clientX,

                y:
                    e.clientY
            }
        );


        lastPointer.x =
            e.clientX;


        lastPointer.y =
            e.clientY;


        pointerMoved =
            false;


        draggingCamera =
            true;
    }
);



canvas.addEventListener(
    "pointermove",
    e => {

        if (
            !touches.has(
                e.pointerId
            )
        ) {

            return;
        }


        const previous =
            touches.get(
                e.pointerId
            );


        const dx =
            e.clientX -
            previous.x;


        const dy =
            e.clientY -
            previous.y;


        if (
            Math.abs(dx) >
            2 ||
            Math.abs(dy) >
            2
        ) {

            pointerMoved =
                true;
        }


        if (
            touches.size ===
            1 &&
            !placement
        ) {

            moveCamera(
                dx,
                dy
            );


            camera.vx =
                -dx;


            camera.vy =
                -dy;
        }


        touches.set(
            e.pointerId,
            {

                x:
                    e.clientX,

                y:
                    e.clientY
            }
        );
    }
);



canvas.addEventListener(
    "pointerup",
    e => {

        touches.delete(
            e.pointerId
        );


        draggingCamera =
            false;


        if (
            pointerMoved
        ) {

            return;
        }


        handleCanvasTap(
            e.clientX,
            e.clientY
        );
    }
);



canvas.addEventListener(
    "pointercancel",
    e => {

        touches.delete(
            e.pointerId
        );


        draggingCamera =
            false;
    }
);



/* ============================================================
   PINCH
============================================================ */

canvas.addEventListener(
    "touchmove",
    e => {

        if (
            e.touches.length !==
            2
        ) {

            return;
        }


        const a =
            e.touches[0];


        const b =
            e.touches[1];


        const d =
            Math.hypot(
                a.clientX -
                b.clientX,

                a.clientY -
                b.clientY
            );


        if (
            pinchDistance !==
            null
        ) {

            const delta =
                d -
                pinchDistance;


            setZoom(
                zoom +
                delta *
                .002,

                (
                    a.clientX +
                    b.clientX
                ) / 2,

                (
                    a.clientY +
                    b.clientY
                ) / 2
            );


            pointerMoved =
                true;
        }


        pinchDistance =
            d;

    },
    {
        passive: true
    }
);



canvas.addEventListener(
    "touchend",
    () => {

        if (
            touches.size <
            2
        ) {

            pinchDistance =
                null;
        }
    }
);



/* ============================================================
   TAP
============================================================ */

function handleCanvasTap(
    screenX,
    screenY
) {

    const world =
        screenToWorld(
            screenX,
            screenY
        );


    /* BATALLA */

    if (
        mode ===
        "battle"
    ) {

        deployTroop(
            world.x,
            world.y
        );


        return;
    }


    /* COLOCACIÓN */

    if (
        placement
    ) {

        placement.x =
            Math.floor(
                world.x /
                TILE
            ) *
            TILE;


        placement.y =
            Math.floor(
                world.y /
                TILE
            ) *
            TILE;


        return;
    }


    /* SELECCIÓN */

    const building =
        findBuildingAt(
            world.x,
            world.y,
            buildings
        );


    selectBuilding(
        building
    );
}



/* ============================================================
   ABRIR CONSTRUIR
============================================================ */

function openBuildPanel() {

    createBuildMenu();


    document
        .getElementById(
            "buildPanel"
        )
        .classList.remove(
            "hidden"
        );
}


function closeBuildPanel() {

    document
        .getElementById(
            "buildPanel"
        )
        .classList.add(
            "hidden"
        );
}



/* ============================================================
   ATAQUE
============================================================ */

function openAttackMenu() {

    document
        .getElementById(
            "attack-menu"
        )
        .classList.remove(
            "hidden"
        );
}


function closeAttackMenu() {

    document
        .getElementById(
            "attack-menu"
        )
        .classList.add(
            "hidden"
        );
}



/* ============================================================
   EVENTOS MENÚ
============================================================ */

document.querySelectorAll(
    ".menuButton"
).forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const action =
                    button.dataset.action;


                if (
                    action ===
                    "build"
                ) {

                    openBuildPanel();
                }


                if (
                    action ===
                    "army"
                ) {

                    openArmy();
                }


                if (
                    action ===
                    "attack"
                ) {

                    openAttackMenu();
                }


                if (
                    action ===
                    "save"
                ) {

                    saveGame();
                }


                if (
                    action ===
                    "shop"
                ) {

                    openShop();
                }
            }
        );
    }
);



/* ============================================================
   CERRAR SELECCIÓN
============================================================ */

document.getElementById(
    "closeSelection"
).onclick = () => {

    selectBuilding(
        null
    );
};



/* ============================================================
   CERRAR CONSTRUCCIÓN
============================================================ */

document.getElementById(
    "closeBuild"
).onclick =
    closeBuildPanel;



/* ============================================================
   PLACEMENT
============================================================ */

document.getElementById(
    "confirmPlacement"
).onclick =
    confirmPlacement;


document.getElementById(
    "cancelPlacement"
).onclick =
    cancelPlacement;



/* ============================================================
   SELECCIÓN
============================================================ */

document.getElementById(
    "moveButton"
).onclick =
    moveSelectedBuilding;


document.getElementById(
    "upgradeButton"
).onclick =
    upgradeSelectedBuilding;


document.getElementById(
    "deleteButton"
).onclick =
    deleteSelectedBuilding;



/* ============================================================
   EJÉRCITO
============================================================ */

document.getElementById(
    "closeArmy"
).onclick =
    closeArmy;



/* ============================================================
   ATAQUE
============================================================ */

document.getElementById(
    "closeAttack"
).onclick =
    closeAttackMenu;


document.getElementById(
    "findOpponent"
).onclick =
    startBattle;



/* ============================================================
   RESULTADO
============================================================ */

document.getElementById(
    "returnHome"
).onclick =
    returnHome;



/* ============================================================
   TROPAS DE BATALLA
============================================================ */

document.getElementById(
    "deployWarrior"
).onclick =
    () => {

        battle.selectedUnit =
            "warrior";


        document
            .getElementById(
                "deployWarrior"
            )
            .classList.add(
                "active"
            );


        document
            .getElementById(
                "deployArcher"
            )
            .classList.remove(
                "active"
            );
    };



document.getElementById(
    "deployArcher"
).onclick =
    () => {

        battle.selectedUnit =
            "archer";


        document
            .getElementById(
                "deployArcher"
            )
            .classList.add(
                "active"
            );


        document
            .getElementById(
                "deployWarrior"
            )
            .classList.remove(
                "active"
            );
    };



/* ============================================================
   TIENDA TABS
============================================================ */

document.querySelectorAll(
    ".tab"
).forEach(
    tab => {

        tab.addEventListener(
            "click",
            () => {

                document
                    .querySelectorAll(
                        ".tab"
                    )
                    .forEach(
                        t =>
                            t.classList.remove(
                                "active"
                            )
                    );


                tab.classList.add(
                    "active"
                );


                renderShop(
                    tab.dataset.shopTab
                );
            }
        );
    }
);



/* ============================================================
   FULLSCREEN
============================================================ */

function toggleFullscreen() {

    if (
        !document.fullscreenElement
    ) {

        if (
            document.documentElement
                .requestFullscreen
        ) {

            document.documentElement
                .requestFullscreen();
        }

    } else {

        if (
            document.exitFullscreen
        ) {

            document.exitFullscreen();
        }
    }
}


document.getElementById(
    "fullscreen-btn"
).onclick =
    toggleFullscreen;



/* ============================================================
   TECLA ESC
============================================================ */

window.addEventListener(
    "keydown",
    e => {

        if (
            e.key !==
            "Escape"
        ) {

            return;
        }


        cancelPlacement();


        closeBuildPanel();


        closeArmy();


        closeAttackMenu();


        closeShop();


        selectBuilding(
            null
        );


        document
            .getElementById(
                "resultOverlay"
            )
            .classList.add(
                "hidden"
            );
    }
);



/* ============================================================
   AUTOGUARDADO
============================================================ */

setInterval(
    () => {

        if (
            mode ===
            "home"
        ) {

            saveGame(
                false
            );
        }

    },
    30000
);



/* ============================================================
   INICIALIZACIÓN
============================================================ */

createBuildMenu();

loadGame();

updateResourcesUI();

updateTownhallUI();

camera.x =
    WORLD_W / 2;

camera.y =
    WORLD_H / 2;



/* ============================================================
   MENSAJE INICIAL
============================================================ */

setTimeout(
    () => {

        showNotification(
            "¡Bienvenido a Castle Kingdom!"
        );


        setTimeout(
            () => {

                showNotification(
                    "Tus minas producen recursos automáticamente."
                );

            },
            1800
        );

    },
    600
);
