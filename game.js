/* =========================================================
   CASTLE KINGDOM
   Estrategia 2D
   Cámara + zoom táctil + construcción por cuadrícula
========================================================= */


const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");


/* =========================================================
   CANVAS
========================================================= */

let W = 0;
let H = 0;


function resize() {

    W = canvas.width =
        window.innerWidth;

    H = canvas.height =
        window.innerHeight;

    clampCamera();
}


window.addEventListener(
    "resize",
    resize
);


/* =========================================================
   MAPA
========================================================= */

const TILE = 32;
const MAP = 48;


let camera = {

    x: MAP * TILE / 2,

    y: MAP * TILE / 2,

    zoom: 1
};


/* =========================================================
   ESTADO
========================================================= */

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


/* =========================================================
   CONSTRUCCIÓN
========================================================= */

let buildMode = false;

let pendingType = null;

let pendingX = 0;

let pendingY = 0;


/*
    Si estamos reubicando un edificio,
    guardamos su ID.
*/

let pendingExistingId = null;


/*
    Muros que se están dibujando.
*/

let wallDragging = false;

let wallCells = [];

let lastWallCell = null;


/* =========================================================
   CÁMARA
========================================================= */

let dragging = false;

let moved = false;

let gestureMoved = false;


let pointerStart = {

    x: 0,

    y: 0
};


let cameraStart = {

    x: 0,

    y: 0
};


/*
    Inercia.
*/

let cameraVelocity = {

    x: 0,

    y: 0
};


let lastPointerTime = 0;

let lastMovePoint = {

    x: 0,

    y: 0
};


/* =========================================================
   MULTITOUCH
========================================================= */

const pointers =
    new Map();


let pinch = {

    active: false,

    startDistance: 0,

    startZoom: 1,

    worldX: 0,

    worldY: 0
};


/* =========================================================
   COMBATE
========================================================= */

let combat = null;


/* =========================================================
   EDIFICIOS
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
   TROPAS
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


let army = {

    barbarian: 3,

    archer: 0,

    giant: 0
};


/* =========================================================
   GUARDADO
========================================================= */

function saveGame() {

    localStorage.setItem(

        "castleKingdomSave",

        JSON.stringify({

            resources,

            buildings,

            obstacles,

            army

        })

    );
}


function loadGame() {

    const save =
        localStorage.getItem(
            "castleKingdomSave"
        );


    if (!save) {

        createNewVillage();

        return;
    }


    try {

        const data =
            JSON.parse(save);


        resources =
            data.resources || resources;


        buildings =
            data.buildings || [];


        obstacles =
            data.obstacles || [];


        army =
            data.army || army;


        if (!buildings.length) {

            createNewVillage();
        }

    }

    catch {

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

        hp: 1500,

        maxHp: 1500
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

            targetX:
                20 + Math.random() * 8,

            targetY:
                20 + Math.random() * 8,

            timer:
                Math.random() * 3

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

            x =
                Math.floor(
                    Math.random() * MAP
                );

            y =
                Math.floor(
                    Math.random() * MAP
                );

        }

        while (

            distance(
                x,
                y,
                24,
                24
            ) < 8

            ||

            occupied(
                x,
                y,
                1,
                1
            )

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

function distance(
    x1,
    y1,
    x2,
    y2
) {

    return Math.hypot(
        x2 - x1,
        y2 - y1
    );
}


function getBuilding(id) {

    return buildings.find(
        b => b.id === id
    );
}


function getCapacity() {

    return (

        10 +

        buildings.filter(
            b =>
                b.type === "camp"
        ).length * 10

    );
}


/* =========================================================
   COLISIONES / CUADRÍCULA
========================================================= */

function occupied(
    x,
    y,
    w,
    h,
    ignoreId = null
) {

    /*
       No salir del mapa.
    */

    if (

        x < 0 ||

        y < 0 ||

        x + w > MAP ||

        y + h > MAP

    ) {

        return true;
    }


    /*
       Edificios.
    */

    for (const b of buildings) {

        if (
            b.id === ignoreId
        ) {

            continue;
        }


        const data =
            BUILDINGS[b.type];


        if (

            x < b.x + data.w &&

            x + w > b.x &&

            y < b.y + data.h &&

            y + h > b.y

        ) {

            return true;
        }

    }


    /*
       Obstáculos.
    */

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
   CÁMARA
========================================================= */

function clampCamera() {

    const viewW =
        W /
        Math.max(
            camera.zoom,
            .01
        );


    const viewH =
        H /
        Math.max(
            camera.zoom,
            .01
        );


    const halfW =
        viewW / 2;


    const halfH =
        viewH / 2;


    const worldW =
        MAP * TILE;


    const worldH =
        MAP * TILE;


    camera.x =
        worldW < viewW

            ? worldW / 2

            : Math.max(

                halfW,

                Math.min(
                    worldW - halfW,
                    camera.x
                )

            );


    camera.y =
        worldH < viewH

            ? worldH / 2

            : Math.max(

                halfH,

                Math.min(
                    worldH - halfH,
                    camera.y
                )

            );
}


/*
    Zoom manteniendo
    el punto bajo el dedo.
*/

function setZoom(
    newZoom,
    screenX = W / 2,
    screenY = H / 2,
    keepWorld = null
) {

    newZoom =
        Math.max(
            .55,
            Math.min(
                2.2,
                newZoom
            )
        );


    if (
        keepWorld === null
    ) {

        keepWorld =
            screenToWorld(
                screenX,
                screenY
            );
    }


    camera.zoom =
        newZoom;


    camera.x =
        keepWorld.x -
        (
            screenX - W / 2
        ) /
        camera.zoom;


    camera.y =
        keepWorld.y -
        (
            screenY - H / 2
        ) /
        camera.zoom;


    clampCamera();
}


/* =========================================================
   CONVERSIÓN PANTALLA / MUNDO
========================================================= */

function screenToWorld(
    px,
    py
) {

    return {

        x:
            (
                (px - W / 2) /
                camera.zoom
            ) +
            camera.x,


        y:
            (
                (py - H / 2) /
                camera.zoom
            ) +
            camera.y

    };
}


function pointerToGrid(
    px,
    py
) {

    const world =
        screenToWorld(
            px,
            py
        );


    return {

        x:
            Math.floor(
                world.x / TILE
            ),

        y:
            Math.floor(
                world.y / TILE
            )

    };
}


/* =========================================================
   UI
========================================================= */

function updateUI() {

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


    const th =
        buildings.find(
            b =>
                b.type === "townhall"
        );


    document.getElementById(
        "player-level"
    ).textContent =

        `Ayuntamiento ${
            th ? th.level : 1
        }`;
}


function notify(message) {

    const box =
        document.getElementById(
            "notifications"
        );


    const el =
        document.createElement(
            "div"
        );


    el.className =
        "notification";


    el.textContent =
        message;


    box.appendChild(el);


    setTimeout(
        () => el.remove(),
        2500
    );
}


/* =========================================================
   MENÚ EDIFICIO
========================================================= */

function openBuildingMenu(id) {

    const b =
        getBuilding(id);


    if (!b)
        return;


    selectedId =
        id;


    const data =
        BUILDINGS[b.type];


    document.getElementById(
        "building-icon"
    ).textContent =
        data.icon;


    document.getElementById(
        "building-name"
    ).textContent =
        data.name;


    document.getElementById(
        "building-hp"
    ).textContent =

        `${Math.floor(b.hp)}
        / ${Math.floor(b.maxHp)}`;


    document.getElementById(
        "building-level"
    ).textContent =

        `Nivel ${b.level}`;


    const upgrade =
        document.getElementById(
            "upgrade-button"
        );


    upgrade.style.display =

        (
            b.type === "townhall" &&
            b.level >= 10
        )

            ? "none"

            : "block";


    const level =
        b.level || 1;


    const goldCost =
        Math.floor(
            data.gold *
            (level + 1) *
            .8
        );


    const elixirCost =
        Math.floor(
            data.elixir *
            (level + 1) *
            .8
        );


    document.getElementById(
        "upgrade-cost"
    ).textContent =

        (
            goldCost ||
            elixirCost
        )

            ? `Coste: ${
                goldCost
                    ? goldCost + " 🪙 "
                    : ""
            }${
                elixirCost
                    ? elixirCost + " 💧"
                    : ""
            }`

            : "";
    

    document.getElementById(
        "building-menu"
    ).classList.remove(
        "hidden"
    );
}


function closeBuildingMenu() {

    selectedId = null;


    document.getElementById(
        "building-menu"
    ).classList.add(
        "hidden"
    );
}


/* =========================================================
   MEJORAR
========================================================= */

function upgradeSelected() {

    const b =
        getBuilding(
            selectedId
        );


    if (!b)
        return;


    const data =
        BUILDINGS[b.type];


    const level =
        b.level || 1;


    const goldCost =
        Math.floor(
            data.gold *
            (level + 1) *
            .8
        );


    const elixirCost =
        Math.floor(
            data.elixir *
            (level + 1) *
            .8
        );


    if (

        resources.gold <
            goldCost ||

        resources.elixir <
            elixirCost

    ) {

        notify(
            "❌ Recursos insuficientes."
        );

        return;
    }


    resources.gold -=
        goldCost;


    resources.elixir -=
        elixirCost;


    b.level++;


    b.maxHp =
        Math.floor(

            data.hp *

            (
                1 +
                (
                    b.level - 1
                ) * .35
            )

        );


    b.hp =
        b.maxHp;


    notify(

        `⬆️ ${data.name}
        ahora es nivel ${b.level}.`

    );


    closeBuildingMenu();


    saveGame();

    updateUI();
}


/* =========================================================
   REUBICAR
========================================================= */

function relocateSelected() {

    const b =
        getBuilding(
            selectedId
        );


    if (!b)
        return;


    pendingType =
        b.type;


    pendingX =
        b.x;


    pendingY =
        b.y;


    pendingExistingId =
        b.id;


    buildMode = true;


    closeBuildingMenu();


    showBuildControls();


    notify(
        "🔄 Coloca el edificio y pulsa CONFIRMAR."
    );
}


/* =========================================================
   ELIMINAR
========================================================= */

function destroySelected() {

    const b =
        getBuilding(
            selectedId
        );


    if (!b)
        return;


    if (
        b.type === "townhall"
    ) {

        notify(
            "🏰 No puedes destruir tu Ayuntamiento."
        );

        return;
    }


    const data =
        BUILDINGS[b.type];


    resources.gold +=
        Math.floor(
            data.gold * .4
        );


    resources.elixir +=
        Math.floor(
            data.elixir * .4
        );


    buildings =
        buildings.filter(
            item =>
                item.id !== b.id
        );


    notify(
        "🗑️ Edificio eliminado."
    );


    closeBuildingMenu();


    saveGame();

    updateUI();
}


/* =========================================================
   TIENDA
========================================================= */

function openShop() {

    document.getElementById(
        "shop"
    ).classList.remove(
        "hidden"
    );


    shopTab(
        "buildings"
    );
}


function closeShop() {

    document.getElementById(
        "shop"
    ).classList.add(
        "hidden"
    );
}


function shopTab(
    tab,
    button
) {

    if (button) {

        document
            .querySelectorAll(".tab")
            .forEach(
                b =>
                    b.classList.remove(
                        "active"
                    )
            );


        button.classList.add(
            "active"
        );
    }


    const container =
        document.getElementById(
            "shop-content"
        );


    container.innerHTML = "";


    let types = [];


    if (
        tab === "buildings"
    ) {

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


    if (
        tab === "defenses"
    ) {

        types = [

            "cannon",

            "archerTower",

            "wall"

        ];
    }


    if (
        tab === "army"
    ) {

        container.innerHTML = `

            <div class="shop-card">

                <div class="icon">
                    🗡️
                </div>

                <h3>
                    Bárbaro
                </h3>

                <p>
                    Soldado cuerpo
                    a cuerpo resistente.
                </p>

                <div class="price">
                    30 💧
                </div>

            </div>


            <div class="shop-card">

                <div class="icon">
                    🏹
                </div>

                <h3>
                    Arquera
                </h3>

                <p>
                    Ataca desde
                    larga distancia.
                </p>

                <div class="price">
                    45 💧
                </div>

            </div>


            <div class="shop-card">

                <div class="icon">
                    🧌
                </div>

                <h3>
                    Gigante
                </h3>

                <p>
                    Muchísima vida
                    y daño contra edificios.
                </p>

                <div class="price">
                    100 💧
                </div>

            </div>

        `;


        return;
    }


    types.forEach(
        type => {

            const data =
                BUILDINGS[type];


            const card =
                document.createElement(
                    "button"
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

                    ${
                        data.damage

                            ? `<br>
                               ⚔️ ${data.damage}`

                            : ""
                    }

                </p>

                <div class="price">

                    ${
                        data.gold
                            ? data.gold +
                              " 🪙 "
                            : ""
                    }

                    ${
                        data.elixir
                            ? data.elixir +
                              " 💧"
                            : ""
                    }

                </div>

            `;


            card.onclick =
                () =>
                    selectBuilding(
                        type
                    );


            container.appendChild(
                card
            );

        }
    );
}


/* =========================================================
   CONSTRUCCIÓN
========================================================= */

function selectBuilding(type) {

    const data =
        BUILDINGS[type];


    if (

        resources.gold <
            data.gold ||

        resources.elixir <
            data.elixir

    ) {

        notify(
            "❌ No tienes suficientes recursos."
        );

        return;
    }


    pendingType =
        type;


    pendingExistingId =
        null;


    /*
        Comenzar en el centro
        de la pantalla.
    */

    const center =
        screenToWorld(
            W / 2,
            H / 2
        );


    pendingX =
        Math.floor(
            center.x / TILE
        );


    pendingY =
        Math.floor(
            center.y / TILE
        );


    buildMode = true;


    wallCells = [];

    wallDragging = false;

    lastWallCell = null;


    closeShop();


    showBuildControls();


    notify(

        `🏗️ Coloca ${data.name}
        y pulsa CONFIRMAR.`

    );
}


/* =========================================================
   CONTROLES CONSTRUCCIÓN
========================================================= */

function showBuildControls() {

    document.getElementById(
        "build-controls"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "build-hint"
    ).textContent =

        pendingType === "wall"

            ? "Arrastra para formar una línea de muros"

            : "Mueve la estructura y confirma su posición";
}


function hideBuildControls() {

    document.getElementById(
        "build-controls"
    ).classList.add(
        "hidden"
    );
}


/* =========================================================
   MUROS
========================================================= */

function addWallCell(
    x,
    y
) {

    if (

        x < 0 ||

        y < 0 ||

        x >= MAP ||

        y >= MAP

    ) {

        return;
    }


    const key =
        `${x},${y}`;


    if (

        wallCells.some(
            c =>
                c.key === key
        )

    ) {

        return;
    }


    /*
       No colocar encima
       de otra cosa.
    */

    if (
        occupied(
            x,
            y,
            1,
            1
        )
    ) {

        return;
    }


    wallCells.push({

        x,

        y,

        key

    });
}


/*
    Une dos casillas con una línea.
*/

function addWallLine(
    x1,
    y1,
    x2,
    y2
) {

    const dx =
        x2 - x1;


    const dy =
        y2 - y1;


    const steps =
        Math.max(
            Math.abs(dx),
            Math.abs(dy)
        );


    for (
        let i = 0;
        i <= steps;
        i++
    ) {

        const t =
            steps
                ? i / steps
                : 0;


        addWallCell(

            Math.round(
                x1 +
                dx * t
            ),

            Math.round(
                y1 +
                dy * t
            )

        );
    }
}


/* =========================================================
   CONFIRMAR MUROS
========================================================= */

function confirmWallConstruction() {

    if (
        !wallCells.length
    ) {

        notify(
            "🧱 Arrastra para colocar muros."
        );

        return;
    }


    const data =
        BUILDINGS.wall;


    const cost =
        wallCells.length *
        data.gold;


    if (
        resources.gold <
        cost
    ) {

        notify(
            `❌ Necesitas ${cost} 🪙.`
        );

        return;
    }


    let placed = 0;


    wallCells.forEach(
        cell => {

            if (

                !occupied(
                    cell.x,
                    cell.y,
                    1,
                    1
                )

            ) {

                buildings.push({

                    id:
                        Date.now() +
                        Math.random(),

                    type:
                        "wall",

                    x:
                        cell.x,

                    y:
                        cell.y,

                    level:
                        1,

                    hp:
                        data.hp,

                    maxHp:
                        data.hp

                });


                placed++;
            }

        }
    );


    resources.gold -=
        placed *
        data.gold;


    notify(

        `🧱 ${placed}
        muro${placed === 1 ? "" : "s"}
        colocado${placed === 1 ? "" : "s"}.`

    );


    pendingType = null;

    pendingExistingId = null;

    buildMode = false;

    wallDragging = false;

    wallCells = [];

    lastWallCell = null;


    hideBuildControls();


    saveGame();

    updateUI();
}


/* =========================================================
   CONFIRMAR CONSTRUCCIÓN
========================================================= */

function confirmConstruction() {

    if (!pendingType)
        return;


    /*
       Si es muro,
       usamos el sistema especial.
    */

    if (

        pendingType === "wall" &&

        pendingExistingId === null

    ) {

        confirmWallConstruction();

        return;
    }


    const data =
        BUILDINGS[pendingType];


    /*
       Comprobar posición.
    */

    if (

        occupied(

            pendingX,

            pendingY,

            data.w,

            data.h,

            pendingExistingId

        )

    ) {

        notify(
            "❌ No puedes construir aquí."
        );

        return;
    }


    /*
       REUBICACIÓN
    */

    if (
        pendingExistingId !== null
    ) {

        const b =
            getBuilding(
                pendingExistingId
            );


        if (!b) {

            cancelConstruction();

            return;
        }


        b.x =
            pendingX;


        b.y =
            pendingY;


        notify(

            `🔄 ${data.name}
            reubicado.`

        );

    }


    /*
       CONSTRUCCIÓN NUEVA
    */

    else {

        if (

            resources.gold <
                data.gold ||

            resources.elixir <
                data.elixir

        ) {

            notify(
                "❌ Recursos insuficientes."
            );

            cancelConstruction();

            return;
        }


        resources.gold -=
            data.gold;


        resources.elixir -=
            data.elixir;


        buildings.push({

            id:
                Date.now() +
                Math.random(),

            type:
                pendingType,

            x:
                pendingX,

            y:
                pendingY,

            level:
                1,

            hp:
                data.hp,

            maxHp:
                data.hp

        });


        notify(

            `🏗️ ${data.name}
            construido.`

        );
    }


    pendingType = null;

    pendingExistingId = null;

    buildMode = false;

    wallCells = [];

    wallDragging = false;

    lastWallCell = null;


    hideBuildControls();


    saveGame();

    updateUI();
}


/* =========================================================
   CANCELAR
========================================================= */

function cancelConstruction() {

    pendingType = null;

    pendingExistingId = null;

    buildMode = false;

    wallDragging = false;

    wallCells = [];

    lastWallCell = null;


    hideBuildControls();


    notify(
        "Construcción cancelada."
    );
}


/* =========================================================
   EJÉRCITO
========================================================= */

function armyCount() {

    return Object.values(
        army
    ).reduce(
        (a,b) =>
            a + b,
        0
    );
}


function openArmy() {

    document.getElementById(
        "army"
    ).classList.remove(
        "hidden"
    );


    renderArmy();
}


function closeArmy() {

    document.getElementById(
        "army"
    ).classList.add(
        "hidden"
    );
}


function renderArmy() {

    document.getElementById(
        "army-count"
    ).textContent =

        `${armyCount()}
        / ${getCapacity()}`;


    const container =
        document.getElementById(
            "army-content"
        );


    container.innerHTML = "";


    Object.entries(
        TROOPS
    ).forEach(
        ([type,data]) => {

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
                    <br>
                    ⚔️ ${data.damage}
                    <br>
                    💧 ${data.cost}
                </p>

                <button class="train-button">
                    ENTRENAR
                </button>

            `;


            card
                .querySelector("button")
                .onclick =
                    () =>
                        trainTroop(
                            type
                        );


            container.appendChild(
                card
            );

        }
    );
}


function trainTroop(type) {

    const data =
        TROOPS[type];


    if (
        armyCount() >=
        getCapacity()
    ) {

        notify(
            "🪖 Campamentos llenos."
        );

        return;
    }


    if (
        resources.elixir <
        data.cost
    ) {

        notify(
            "💧 Falta elixir."
        );

        return;
    }


    resources.elixir -=
        data.cost;


    army[type]++;


    notify(

        `${data.icon}
        ${data.name}
        entrenado.`

    );


    renderArmy();

    updateUI();

    saveGame();
}


/* =========================================================
   ATAQUE
========================================================= */

function openAttackMenu() {

    if (
        armyCount() <= 0
    ) {

        notify(
            "⚔️ Necesitas tropas para atacar."
        );

        openArmy();

        return;
    }


    document.getElementById(
        "attack-menu"
    ).classList.remove(
        "hidden"
    );
}


function closeAttackMenu() {

    document.getElementById(
        "attack-menu"
    ).classList.add(
        "hidden"
    );
}


function startCombat() {

    closeAttackMenu();

    createCombat();


    document.getElementById(
        "combat-ui"
    ).classList.remove(
        "hidden"
    );


    notify(
        "⚔️ ¡Comienza el ataque!"
    );
}


/* =========================================================
   CREAR COMBATE
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


    defenses.forEach(
        (d,i) => {

            const data =
                BUILDINGS[d[2]];


            enemyBuildings.push({

                id: i + 2,

                type: d[2],

                x: d[0],

                y: d[1],

                level: 2,

                hp:
                    data.hp * 1.3,

                maxHp:
                    data.hp * 1.3,

                cooldown: 0

            });

        }
    );


    for (
        let i = 0;
        i < 14;
        i++
    ) {

        enemyBuildings.push({

            id:
                20 + i,

            type:
                "wall",

            x:
                17 + (i % 7),

            y:
                i < 7
                    ? 17
                    : 29,

            level:
                2,

            hp:
                800,

            maxHp:
                800

        });
    }


    const combatTroops = [];


    Object.entries(
        army
    ).forEach(
        ([type,count]) => {

            for (
                let i = 0;
                i < count;
                i++
            ) {

                combatTroops.push({

                    id:
                        Date.now() +
                        Math.random(),

                    type,

                    x:
                        8 +
                        Math.random() * 3,

                    y:
                        20 +
                        Math.random() * 10,

                    hp:
                        TROOPS[type].hp,

                    maxHp:
                        TROOPS[type].hp,

                    target:
                        null,

                    attackCooldown:
                        0

                });

            }

        }
    );


    combat = {

        time: 180,

        enemyBuildings,

        troops:
            combatTroops,

        damage: 0,

        enemyDamage: 0,

        ended: false

    };


    troops =
        combatTroops;


    camera.x =
        24 * TILE;


    camera.y =
        24 * TILE;


    camera.zoom =
        .9;


    clampCamera();
}


/* =========================================================
   LÓGICA COMBATE
========================================================= */

function updateCombat(dt) {

    if (
        !combat ||
        combat.ended
    ) {

        return;
    }


    combat.time -=
        dt;


    if (
        combat.time <= 0
    ) {

        finishCombat();

        return;
    }


    /*
       TROPAS
    */

    combat.troops.forEach(
        troop => {

            if (
                troop.hp <= 0
            ) {

                return;
            }


            const data =
                TROOPS[
                    troop.type
                ];


            const target =
                findClosestEnemyBuilding(
                    troop
                );


            if (!target)
                return;


            const targetData =
                BUILDINGS[
                    target.type
                ];


            const centerX =
                target.x +
                targetData.w / 2;


            const centerY =
                target.y +
                targetData.h / 2;


            const dx =
                centerX -
                troop.x;


            const dy =
                centerY -
                troop.y;


            const dist =
                Math.hypot(
                    dx,
                    dy
                );


            if (
                dist >
                data.range
            ) {

                troop.x +=
                    (
                        dx / dist
                    ) *
                    data.speed *
                    dt;


                troop.y +=
                    (
                        dy / dist
                    ) *
                    data.speed *
                    dt;

            }

            else {

                troop.attackCooldown -=
                    dt;


                if (
                    troop.attackCooldown <= 0
                ) {

                    target.hp -=
                        data.damage;


                    troop.attackCooldown =
                        .8;


                    combat.damage +=
                        data.damage;


                    if (
                        target.hp <= 0
                    ) {

                        target.hp = 0;


                        notify(

                            `${data.icon}
                            ¡Edificio destruido!`

                        );
                    }

                }

            }

        }
    );


    /*
       DEFENSAS
    */

    combat.enemyBuildings
        .forEach(
            building => {

                if (

                    building.hp <= 0 ||

                    !BUILDINGS[
                        building.type
                    ].damage

                ) {

                    return;
                }


                building.cooldown =
                    (
                        building.cooldown ||
                        0
                    ) - dt;


                if (
                    building.cooldown > 0
                ) {

                    return;
                }


                const data =
                    BUILDINGS[
                        building.type
                    ];


                let closest =
                    null;


                let closestDistance =
                    Infinity;


                combat.troops.forEach(
                    troop => {

                        if (
                            troop.hp <= 0
                        )
                            return;


                        const d =
                            distance(

                                building.x,

                                building.y,

                                troop.x,

                                troop.y

                            );


                        if (

                            d <
                            data.range &&

                            d <
                            closestDistance

                        ) {

                            closestDistance =
                                d;

                            closest =
                                troop;
                        }

                    }
                );


                if (closest) {

                    closest.hp -=
                        data.damage;


                    combat.enemyDamage +=
                        data.damage;


                    building.cooldown =
                        data.attackSpeed /
                        1000;
                }

            }
        );


    /*
       DESTRUCCIÓN
    */

    let totalHp = 0;

    let destroyedHp = 0;


    combat.enemyBuildings
        .forEach(
            b => {

                totalHp +=
                    b.maxHp;


                destroyedHp +=

                    b.maxHp -

                    Math.max(
                        0,
                        b.hp
                    );

            }
        );


    combat.damage =

        Math.floor(

            destroyedHp /
            totalHp *
            100

        );


    document.getElementById(
        "combat-my-percent"
    ).textContent =

        Math.min(
            100,
            combat.damage
        ) + "%";


    document.getElementById(
        "combat-enemy-percent"
    ).textContent =
        "0%";


    const remaining =
        combat.troops.filter(
            t =>
                t.hp > 0
        ).length;


    /*
       Ayuntamiento destruido.
    */

    if (

        combat.enemyBuildings.some(
            b =>
                b.type === "townhall" &&
                b.hp <= 0
        )

    ) {

        finishCombat(true);

    }

    else if (
        remaining === 0
    ) {

        finishCombat(false);

    }
}


/* =========================================================
   ENCONTRAR OBJETIVO
========================================================= */

function findClosestEnemyBuilding(
    troop
) {

    let best = null;

    let bestDistance =
        Infinity;


    combat.enemyBuildings
        .forEach(
            b => {

                if (
                    b.hp <= 0
                )
                    return;


                const d =
                    distance(

                        troop.x,

                        troop.y,

                        b.x,

                        b.y

                    );


                if (
                    d < bestDistance
                ) {

                    bestDistance =
                        d;

                    best =
                        b;
                }

            }
        );


    return best;
}


/* =========================================================
   FINAL COMBATE
========================================================= */

function finishCombat(
    forceWin = null
) {

    if (
        !combat ||
        combat.ended
    ) {

        return;
    }


    combat.ended =
        true;


    const destruction =
        combat.damage;


    const victory =

        forceWin !== null

            ? forceWin

            : destruction >= 50;


    let trophies;


    if (victory) {

        trophies =

            10 +
            Math.floor(
                destruction / 5
            );


        resources.trophies +=
            trophies;


        resources.gold +=
            500 +
            destruction * 10;


        resources.elixir +=
            500 +
            destruction * 10;

    }

    else {

        trophies =

            -Math.floor(

                Math.max(
                    1,
                    20 -
                    destruction / 5
                )

            );


        resources.trophies =

            Math.max(

                0,

                resources.trophies +
                trophies

            );
    }


    /*
       Se pierden tropas
       después de atacar.
    */

    army = {

        barbarian: 0,

        archer: 0,

        giant: 0

    };


    document.getElementById(
        "combat-ui"
    ).classList.add(
        "hidden"
    );


    document.getElementById(
        "combat-result"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "result-title"
    ).textContent =

        victory

            ? "¡VICTORIA!"

            : "DERROTA";


    document.getElementById(
        "result-icon"
    ).textContent =

        victory
            ? "🏆"
            : "💀";


    document.getElementById(
        "result-damage"
    ).textContent =

        destruction + "%";


    document.getElementById(
        "result-trophies"
    ).textContent =

        (
            trophies >= 0
                ? "+"
                : ""
        ) +
        trophies;


    document.getElementById(
        "result-gold"
    ).textContent =

        victory

            ? "+" +
              (
                500 +
                destruction * 10
              )

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

    document.getElementById(
        "combat-result"
    ).classList.add(
        "hidden"
    );


    combat = null;

    troops = [];


    camera.x =
        24 * TILE;


    camera.y =
        24 * TILE;


    camera.zoom =
        1;


    clampCamera();


    renderArmy();
}


function surrenderCombat() {

    finishCombat(
        false
    );
}


/* =========================================================
   DIBUJAR MAPA
========================================================= */

function drawMap() {

    const size =
        MAP * TILE;


    ctx.fillStyle =
        "#487d2c";


    ctx.fillRect(

        0,

        0,

        size,

        size

    );


    for (
        let y = 0;
        y < MAP;
        y++
    ) {

        for (
            let x = 0;
            x < MAP;
            x++
        ) {

            const variation =
                (
                    x * 17 +
                    y * 31
                ) % 20;


            ctx.fillStyle =

                variation < 4

                    ? "#4e8430"

                    : "#4a7f2d";


            ctx.fillRect(

                x * TILE,

                y * TILE,

                TILE,

                TILE

            );
        }

    }


    ctx.strokeStyle =
        "#294719";


    ctx.lineWidth =
        8;


    ctx.strokeRect(

        0,

        0,

        size,

        size

    );
}


/* =========================================================
   OBSTÁCULOS
========================================================= */

function drawObstacles() {

    obstacles.forEach(
        o => {

            const x =
                o.x * TILE +
                TILE / 2;


            const y =
                o.y * TILE +
                TILE / 2;


            ctx.textAlign =
                "center";


            ctx.textBaseline =
                "middle";


            ctx.font =
                "30px Arial";


            ctx.fillText(

                o.type === "tree"
                    ? "🌳"
                    : "🪨",

                x,

                y

            );

        }
    );
}


/* =========================================================
   EDIFICIOS
========================================================= */

function drawBuildings(
    list = buildings
) {

    list.forEach(
        b => {

            if (
                b.hp <= 0
            )
                return;


            const data =
                BUILDINGS[
                    b.type
                ];


            const x =
                b.x * TILE;


            const y =
                b.y * TILE;


            const w =
                data.w * TILE;


            const h =
                data.h * TILE;


            /*
               Sombra
            */

            ctx.fillStyle =
                "rgba(0,0,0,.3)";


            ctx.fillRect(

                x + 5,

                y + 6,

                w,

                h

            );


            /*
               Edificio
            */

            ctx.fillStyle =
                data.color;


            ctx.fillRect(

                x,

                y,

                w,

                h

            );


            /*
               Borde
            */

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


            /*
               Icono
            */

            ctx.font =
                `${Math.min(w,h)*.65}px Arial`;


            ctx.textAlign =
                "center";


            ctx.textBaseline =
                "middle";


            ctx.fillText(

                data.icon,

                x + w / 2,

                y + h / 2

            );


            /*
               Nivel
            */

            if (
                b.level
            ) {

                ctx.fillStyle =
                    "#ffe600";


                ctx.font =
                    "11px Arial";


                ctx.fillText(

                    "Nv." + b.level,

                    x + w / 2,

                    y + h - 8

                );

            }


            /*
               Vida
            */

            if (
                b.hp <
                b.maxHp
            ) {

                const ratio =

                    Math.max(

                        0,

                        b.hp /
                        b.maxHp

                    );


                ctx.fillStyle =
                    "#111";


                ctx.fillRect(

                    x,

                    y - 7,

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

                    y - 7,

                    w * ratio,

                    5

                );
            }

        }
    );
}


/* =========================================================
   SELECCIÓN ESTILO CLASH
========================================================= */

function drawSelection(b) {

    if (!b)
        return;


    const data =
        BUILDINGS[b.type];


    const x =
        b.x * TILE;


    const y =
        b.y * TILE;


    const w =
        data.w * TILE;


    const h =
        data.h * TILE;


    ctx.save();


    /*
       Área amarilla
    */

    ctx.fillStyle =
        "rgba(255,230,0,.10)";


    ctx.fillRect(

        x,

        y,

        w,

        h

    );


    /*
       Cuadrícula resaltada
    */

    ctx.strokeStyle =
        "#ffe600";


    ctx.lineWidth =
        3;


    ctx.setLineDash([
        7,
        5
    ]);


    ctx.strokeRect(

        x - 3,

        y - 3,

        w + 6,

        h + 6

    );


    ctx.setLineDash([]);


    /*
       Círculo de selección
    */

    const radius =
        Math.max(
            w,
            h
        ) * .7;


    ctx.strokeStyle =
        "rgba(255,230,0,.38)";


    ctx.lineWidth =
        2;


    ctx.beginPath();


    ctx.arc(

        x + w / 2,

        y + h / 2,

        radius,

        0,

        Math.PI * 2

    );


    ctx.stroke();


    ctx.restore();
}


/* =========================================================
   VILLAGERS
========================================================= */

function updateVillagers(dt) {

    villagers.forEach(
        v => {

            v.timer -=
                dt;


            if (
                v.timer <= 0
            ) {

                v.targetX =
                    16 +
                    Math.random() * 15;


                v.targetY =
                    16 +
                    Math.random() * 15;


                v.timer =
                    2 +
                    Math.random() * 4;
            }


            const dx =
                v.targetX -
                v.x;


            const dy =
                v.targetY -
                v.y;


            const d =
                Math.hypot(
                    dx,
                    dy
                );


            if (
                d > .1
            ) {

                v.x +=
                    dx / d *
                    .4 *
                    dt;


                v.y +=
                    dy / d *
                    .4 *
                    dt;
            }

        }
    );
}


function drawVillagers() {

    villagers.forEach(
        v => {

            ctx.font =
                "20px Arial";


            ctx.textAlign =
                "center";


            ctx.textBaseline =
                "middle";


            ctx.fillText(

                "👷",

                v.x * TILE,

                v.y * TILE

            );

        }
    );
}


/* =========================================================
   TROPAS COMBATE
========================================================= */

function drawCombatTroops() {

    if (!combat)
        return;


    combat.troops.forEach(
        t => {

            if (
                t.hp <= 0
            )
                return;


            const data =
                TROOPS[t.type];


            ctx.font =
                "24px Arial";


            ctx.textAlign =
                "center";


            ctx.textBaseline =
                "middle";


            ctx.fillText(

                data.icon,

                t.x * TILE,

                t.y * TILE

            );


            /*
               Barra vida
            */

            ctx.fillStyle =
                "#222";


            ctx.fillRect(

                t.x * TILE - 12,

                t.y * TILE - 20,

                24,

                3

            );


            ctx.fillStyle =
                "#2ecc71";


            ctx.fillRect(

                t.x * TILE - 12,

                t.y * TILE - 20,

                24 *
                Math.max(
                    0,
                    t.hp /
                    t.maxHp
                ),

                3

            );

        }
    );
}


/* =========================================================
   PREVISUALIZACIÓN CONSTRUCCIÓN
========================================================= */

function drawBuildingPreview() {

    if (
        !buildMode ||
        !pendingType
    ) {

        return;
    }


    const data =
        BUILDINGS[
            pendingType
        ];


    /*
       MUROS
    */

    if (
        pendingType === "wall"
    ) {

        wallCells.forEach(
            cell => {

                const valid =
                    !occupied(
                        cell.x,
                        cell.y,
                        1,
                        1
                    );


                const x =
                    cell.x * TILE;


                const y =
                    cell.y * TILE;


                ctx.globalAlpha =
                    .55;


                ctx.fillStyle =

                    valid
                        ? "#2ecc71"
                        : "#e74c3c";


                ctx.fillRect(

                    x,

                    y,

                    TILE,

                    TILE

                );


                ctx.globalAlpha =
                    1;


                ctx.strokeStyle =

                    valid
                        ? "#2ecc71"
                        : "#e74c3c";


                ctx.lineWidth =
                    3;


                ctx.strokeRect(

                    x,

                    y,

                    TILE,

                    TILE

                );


                ctx.font =
                    "22px Arial";


                ctx.textAlign =
                    "center";


                ctx.textBaseline =
                    "middle";


                ctx.fillText(

                    data.icon,

                    x + TILE / 2,

                    y + TILE / 2

                );

            }
        );


        return;
    }


    /*
       EDIFICIO NORMAL
    */

    const x =
        pendingX * TILE;


    const y =
        pendingY * TILE;


    const w =
        data.w * TILE;


    const h =
        data.h * TILE;


    const valid =

        !occupied(

            pendingX,

            pendingY,

            data.w,

            data.h,

            pendingExistingId

        );


    ctx.globalAlpha =
        .55;


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


    ctx.globalAlpha =
        1;


    ctx.font =
        `${Math.min(w,h)*.65}px Arial`;


    ctx.textAlign =
        "center";


    ctx.textBaseline =
        "middle";


    ctx.fillText(

        data.icon,

        x + w / 2,

        y + h / 2

    );


    ctx.strokeStyle =

        valid
            ? "#2ecc71"
            : "#e74c3c";


    ctx.lineWidth =
        4;


    ctx.strokeRect(

        x,

        y,

        w,

        h

    );
}


/* =========================================================
   MAPA COMBATE
========================================================= */

function drawCombatMap() {

    ctx.fillStyle =
        "#486f31";


    ctx.fillRect(

        0,

        0,

        MAP * TILE,

        MAP * TILE

    );


    for (
        let i = 0;
        i < 30;
        i++
    ) {

        const x =
            (i * 17) % MAP;


        const y =
            (i * 29) % MAP;


        ctx.font =
            "22px Arial";


        ctx.fillText(

            i % 2
                ? "🌲"
                : "🌿",

            x * TILE,

            y * TILE

        );

    }


    /*
       Muros
    */

    combat.enemyBuildings
        .filter(
            b =>
                b.type === "wall" &&
                b.hp > 0
        )
        .forEach(
            b => {

                ctx.fillStyle =
                    "#777";


                ctx.fillRect(

                    b.x * TILE,

                    b.y * TILE,

                    TILE,

                    TILE

                );


                ctx.strokeStyle =
                    "#333";


                ctx.strokeRect(

                    b.x * TILE,

                    b.y * TILE,

                    TILE,

                    TILE

                );

            }
        );


    drawBuildings(
        combat.enemyBuildings
    );


    drawCombatTroops();
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

        W / 2,

        H / 2

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

    }

    else {

        drawObstacles();

        drawBuildings();


        const selected =
            getBuilding(
                selectedId
            );


        if (selected) {

            drawSelection(
                selected
            );
        }


        drawVillagers();

        drawBuildingPreview();
    }


    ctx.restore();
}


/* =========================================================
   POINTERS + PINCH ZOOM
========================================================= */

function pointerPos(e) {

    return {

        x: e.clientX,

        y: e.clientY

    };
}


function getTwoPointers() {

    return [
        ...pointers.values()
    ].slice(
        0,
        2
    );
}


/* =========================================================
   INICIO DEL PINCH
========================================================= */

function startPinch() {

    const [
        a,
        b
    ] =
        getTwoPointers();


    if (
        !a ||
        !b
    )
        return;


    const midX =
        (
            a.x +
            b.x
        ) / 2;


    const midY =
        (
            a.y +
            b.y
        ) / 2;


    pinch.active =
        true;


    pinch.startDistance =

        Math.max(

            1,

            Math.hypot(

                b.x - a.x,

                b.y - a.y

            )

        );


    pinch.startZoom =
        camera.zoom;


    const world =
        screenToWorld(

            midX,

            midY

        );


    pinch.worldX =
        world.x;


    pinch.worldY =
        world.y;


    gestureMoved =
        true;


    dragging =
        false;


    cameraVelocity.x =
        0;


    cameraVelocity.y =
        0;
}


/* =========================================================
   ACTUALIZAR PINCH
========================================================= */

function updatePinch() {

    const [
        a,
        b
    ] =
        getTwoPointers();


    if (
        !a ||
        !b
    )
        return;


    const midX =
        (
            a.x +
            b.x
        ) / 2;


    const midY =
        (
            a.y +
            b.y
        ) / 2;


    const dist =
        Math.max(

            1,

            Math.hypot(

                b.x - a.x,

                b.y - a.y

            )

        );


    const newZoom =

        pinch.startZoom *
        (
            dist /
            pinch.startDistance
        );


    camera.zoom =

        Math.max(

            .55,

            Math.min(
                2.2,
                newZoom
            )

        );


    /*
       Mantener el punto
       del mapa debajo
       de los dedos.
    */

    camera.x =

        pinch.worldX -

        (
            midX -
            W / 2
        ) /
        camera.zoom;


    camera.y =

        pinch.worldY -

        (
            midY -
            H / 2
        ) /
        camera.zoom;


    clampCamera();
}


/* =========================================================
   POINTER DOWN
========================================================= */

canvas.addEventListener(
    "pointerdown",
    e => {

        canvas.setPointerCapture?.(
            e.pointerId
        );


        pointers.set(

            e.pointerId,

            pointerPos(e)

        );


        /*
           Dos dedos =
           pinch.
        */

        if (
            pointers.size === 2
        ) {

            startPinch();

            return;
        }


        dragging =
            true;


        moved =
            false;


        gestureMoved =
            false;


        cameraVelocity.x =
            0;


        cameraVelocity.y =
            0;


        pointerStart = {

            x:
                e.clientX,

            y:
                e.clientY

        };


        cameraStart = {

            x:
                camera.x,

            y:
                camera.y

        };


        lastMovePoint = {

            x:
                e.clientX,

            y:
                e.clientY

        };


        lastPointerTime =
            performance.now();


        /*
           Construcción.
        */

        if (
            buildMode
        ) {

            const g =
                pointerToGrid(

                    e.clientX,

                    e.clientY

                );


            /*
               MURO:
               iniciar arrastre.
            */

            if (

                pendingType === "wall" &&

                pendingExistingId === null

            ) {

                wallDragging =
                    true;


                wallCells = [];


                lastWallCell = {

                    x: g.x,

                    y: g.y

                };


                addWallCell(
                    g.x,
                    g.y
                );

            }

            else {

                pendingX =
                    g.x;


                pendingY =
                    g.y;
            }

        }

    }
);


/* =========================================================
   POINTER MOVE
========================================================= */

canvas.addEventListener(
    "pointermove",
    e => {

        if (
            !pointers.has(
                e.pointerId
            )
        ) {

            return;
        }


        pointers.set(

            e.pointerId,

            pointerPos(e)

        );


        /*
           PINCH
        */

        if (
            pointers.size >= 2
        ) {

            updatePinch();

            return;
        }


        if (
            !dragging
        ) {

            return;
        }


        const now =
            performance.now();


        const elapsed =

            Math.max(

                1,

                now -
                lastPointerTime

            ) / 1000;


        const dx =
            e.clientX -
            pointerStart.x;


        const dy =
            e.clientY -
            pointerStart.y;


        if (

            Math.abs(dx) > 6 ||

            Math.abs(dy) > 6

        ) {

            moved =
                true;

            gestureMoved =
                true;
        }


        /*
           MODO CONSTRUCCIÓN
        */

        if (
            buildMode
        ) {

            const g =
                pointerToGrid(

                    e.clientX,

                    e.clientY

                );


            /*
               Muros arrastrables.
            */

            if (

                pendingType === "wall" &&

                pendingExistingId === null &&

                wallDragging

            ) {

                if (

                    !lastWallCell ||

                    lastWallCell.x !== g.x ||

                    lastWallCell.y !== g.y

                ) {

                    addWallLine(

                        lastWallCell.x,

                        lastWallCell.y,

                        g.x,

                        g.y

                    );


                    lastWallCell = {

                        x:
                            g.x,

                        y:
                            g.y

                    };

                }

            }

            else {

                pendingX =
                    g.x;


                pendingY =
                    g.y;
            }

        }


        /*
           CÁMARA
        */

        else {

            const mx =
                e.clientX -
                lastMovePoint.x;


            const my =
                e.clientY -
                lastMovePoint.y;


            camera.x -=
                dx /
                camera.zoom;


            camera.y -=
                dy /
                camera.zoom;


            pointerStart.x =
                e.clientX;


            pointerStart.y =
                e.clientY;


            /*
               Velocidad para
               la inercia.
            */

            if (
                elapsed > 0
            ) {

                cameraVelocity.x =

                    -mx /
                    camera.zoom /
                    elapsed;


                cameraVelocity.y =

                    -my /
                    camera.zoom /
                    elapsed;

            }


            clampCamera();

        }


        lastMovePoint = {

            x:
                e.clientX,

            y:
                e.clientY

        };


        lastPointerTime =
            now;

    }
);


/* =========================================================
   POINTER UP
========================================================= */

function finishPointer(e) {

    pointers.delete(
        e.pointerId
    );


    if (
        pointers.size < 2
    ) {

        pinch.active =
            false;
    }


    /*
       Finalizar arrastre
       de muros.
    */

    if (

        wallDragging &&

        pointers.size === 0

    ) {

        dragging =
            false;


        wallDragging =
            false;


        return;
    }


    if (
        !dragging
    ) {

        return;
    }


    dragging =
        false;


    /*
       Si se movió,
       no es un click.
    */

    if (
        moved ||
        gestureMoved
    ) {

        return;
    }


    /*
       CONSTRUCCIÓN
    */

    if (
        buildMode
    ) {

        const g =
            pointerToGrid(

                e.clientX,

                e.clientY

            );


        if (

            pendingType === "wall" &&

            pendingExistingId === null

        ) {

            addWallCell(
                g.x,
                g.y
            );

        }

        else {

            pendingX =
                g.x;


            pendingY =
                g.y;
        }


        /*
           IMPORTANTE:
           aquí NO se construye.

           Hay que pulsar
           CONFIRMAR.
        */

        return;
    }


    /*
       Click en edificio.
    */

    const g =
        pointerToGrid(

            e.clientX,

            e.clientY

        );


    const clicked =
        buildings.find(
            b => {

                const data =
                    BUILDINGS[
                        b.type
                    ];


                return (

                    g.x >= b.x &&

                    g.x <
                        b.x + data.w &&

                    g.y >= b.y &&

                    g.y <
                        b.y + data.h

                );

            }
        );


    if (
        clicked
    ) {

        selectedId =
            clicked.id;


        openBuildingMenu(
            clicked.id
        );


        return;
    }


    /*
       Si se toca el suelo,
       quitar selección.
    */

    selectedId =
        null;


    /*
       Obstáculo.
    */

    const obstacleIndex =
        obstacles.findIndex(
            o =>

                o.x === g.x &&

                o.y === g.y

        );


    if (
        obstacleIndex >= 0
    ) {

        const o =
            obstacles[
                obstacleIndex
            ];


        const reward =

            o.type === "tree"

                ? 30

                : 50;


        resources.gold +=
            reward;


        obstacles.splice(

            obstacleIndex,

            1

        );


        notify(

            `🌳 Obstáculo eliminado.
            +${reward} 🪙`

        );


        saveGame();

        updateUI();
    }
}


canvas.addEventListener(
    "pointerup",
    finishPointer
);


canvas.addEventListener(
    "pointercancel",
    finishPointer
);


/* =========================================================
   RUEDA / ZOOM PC
========================================================= */

canvas.addEventListener(

    "wheel",

    e => {

        e.preventDefault();


        const newZoom =

            camera.zoom *

            (
                e.deltaY < 0

                    ? 1.1

                    : .9
            );


        setZoom(

            newZoom,

            e.clientX,

            e.clientY

        );

    },

    {
        passive: false
    }

);


/* =========================================================
   TIEMPO
========================================================= */

function formatTime(
    seconds
) {

    const m =
        Math.floor(
            seconds / 60
        );


    const s =
        seconds % 60;


    return (

        String(m)
            .padStart(2,"0")

        +

        ":"

        +

        String(s)
            .padStart(2,"0")

    );
}


/* =========================================================
   GAME LOOP
========================================================= */

let lastTime =
    performance.now();


function update(time) {

    const dt =

        Math.min(

            .1,

            (
                time -
                lastTime
            ) / 1000

        );


    lastTime =
        time;


    frame++;


    /*
       PRODUCCIÓN
    */

    if (

        frame % 60 === 0 &&

        !combat

    ) {

        buildings.forEach(
            b => {

                if (
                    b.type ===
                    "goldmine"
                ) {

                    resources.gold =

                        Math.min(

                            resources.gold +
                            15,

                            999999

                        );

                }


                if (
                    b.type ===
                    "elixirpump"
                ) {

                    resources.elixir =

                        Math.min(

                            resources.elixir +
                            15,

                            999999

                        );

                }

            }
        );


        saveGame();

        updateUI();
    }


    /*
       INERCIA DE CÁMARA
    */

    if (

        !dragging &&

        !pinch.active &&

        !buildMode &&

        (
            Math.abs(
                cameraVelocity.x
            )

            +

            Math.abs(
                cameraVelocity.y
            )

        ) > 1

    ) {

        camera.x +=
            cameraVelocity.x *
            dt;


        camera.y +=
            cameraVelocity.y *
            dt;


        /*
           Fricción.
        */

        const friction =
            Math.pow(
                .001,
                dt
            );


        cameraVelocity.x *=
            friction;


        cameraVelocity.y *=
            friction;


        clampCamera();
    }


    updateVillagers(
        dt
    );


    if (
        combat
    ) {

        updateCombat(
            dt
        );


        document.getElementById(
            "combat-time"
        ).textContent =

            formatTime(

                Math.ceil(
                    combat.time
                )

            );
    }


    draw();


    requestAnimationFrame(
        update
    );
}


/* =========================================================
   FULLSCREEN
========================================================= */

async function toggleFullscreen() {

    try {

        if (
            !document.fullscreenElement
        ) {

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

                }

                catch {}

            }

        }

        else {

            await document.exitFullscreen();
        }

    }

    catch {

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

        if (
            e.key === "Escape"
        ) {

            if (
                buildMode
            ) {

                cancelConstruction();

                return;
            }


            closeBuildingMenu();

            closeShop();

            closeArmy();

            closeAttackMenu();
        }


        if (

            e.key === "+" ||

            e.key === "="

        ) {

            setZoom(
                camera.zoom * 1.1
            );
        }


        if (
            e.key === "-"
        ) {

            setZoom(
                camera.zoom * .9
            );
        }

    }
);


/* =========================================================
   INICIO
========================================================= */

resize();

loadGame();

updateUI();

requestAnimationFrame(
    update
);


/* =========================================================
   AUTOGUARDADO
========================================================= */

setInterval(
    saveGame,
    10000
);
