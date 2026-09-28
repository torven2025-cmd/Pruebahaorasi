/* =========================================================
   REINOS DE CENIZA
   Juego de estrategia 2D
========================================================= */


/* =========================================================
   DATOS DEL JUGADOR
========================================================= */

let game = {
    wood: 250,
    stone: 150,
    iron: 80,
    gold: 100,

    points: 0,

    castleLevel: 1,
    castleHealth: 100,

    archers: 1,
    wins: 0,

    tools: {
        axe: false,
        pickaxe: false,
        hammer: false
    },

    day: 1
};


/* =========================================================
   DATOS DE BATALLA
========================================================= */

let battle = {
    active: false,

    playerHealth: 1000,
    enemyHealth: 1000,

    enemyMaxHealth: 1000,

    enemyAttack: 90,
    enemyDefense: 50,

    playerDamage: 0,

    timer: 60,

    interval: null,
    enemyInterval: null,

    resultShown: false
};


/* =========================================================
   GUARDAR / CARGAR
========================================================= */

function saveGame() {

    localStorage.setItem(
        "reinosDeCeniza",
        JSON.stringify(game)
    );
}


function loadGame() {

    const saved = localStorage.getItem("reinosDeCeniza");

    if (saved) {

        try {

            game = JSON.parse(saved);

        } catch (error) {

            console.log("No se pudo cargar la partida.");

        }
    }
}


/* =========================================================
   INTERFAZ
========================================================= */

function updateUI() {

    document.getElementById("wood").textContent =
        Math.floor(game.wood);

    document.getElementById("stone").textContent =
        Math.floor(game.stone);

    document.getElementById("iron").textContent =
        Math.floor(game.iron);

    document.getElementById("gold").textContent =
        Math.floor(game.gold);

    document.getElementById("points").textContent =
        Math.floor(game.points);


    document.getElementById("castleLevel").textContent =
        "Nv. " + game.castleLevel;

    document.getElementById("castleStat").textContent =
        game.castleLevel;

    document.getElementById("healthStat").textContent =
        game.castleHealth + "%";

    document.getElementById("archerStat").textContent =
        game.archers;

    document.getElementById("winsStat").textContent =
        game.wins;

    document.getElementById("dayCounter").textContent =
        "Día " + game.day;


    const castleCostWood =
        100 * game.castleLevel;

    const castleCostStone =
        50 * game.castleLevel;

    document.getElementById("castleCost").textContent =
        castleCostWood + " 🌲 / " +
        castleCostStone + " 🪨";
}


/* =========================================================
   NOTIFICACIONES
========================================================= */

let notificationTimeout;

function notify(message) {

    const notification =
        document.getElementById("notification");

    notification.textContent = message;

    notification.classList.add("show");

    clearTimeout(notificationTimeout);

    notificationTimeout = setTimeout(() => {

        notification.classList.remove("show");

    }, 2200);
}


/* =========================================================
   LOG
========================================================= */

function addLog(message) {

    const log =
        document.getElementById("eventLog");

    const entry =
        document.createElement("div");

    entry.className = "log-entry";

    entry.textContent = message;

    log.prepend(entry);

    while (log.children.length > 10) {

        log.removeChild(log.lastChild);

    }
}


/* =========================================================
   RECOLECTAR RECURSOS
========================================================= */

function collectResource(type, amount, element) {

    let bonus = 1;

    /*
       Las herramientas aumentan la cantidad
       obtenida de los recursos.
    */

    if (type === "wood" && game.tools.axe) {

        bonus = 1.5;

    }

    if (type === "stone" && game.tools.pickaxe) {

        bonus = 1.5;

    }

    if (type === "iron" && game.tools.pickaxe) {

        bonus = 1.5;

    }

    const finalAmount =
        Math.floor(amount * bonus);

    game[type] += finalAmount;

    notify(
        "+" + finalAmount +
        " " +
        getResourceName(type)
    );

    addLog(
        "Recolectaste " +
        finalAmount +
        " de " +
        getResourceName(type)
    );

    /*
       Animación de recolección
    */

    element.style.transform = "scale(0)";

    element.style.opacity = "0";

    setTimeout(() => {

        element.style.transform = "";
        element.style.opacity = "";

    }, 1500);

    updateUI();
    saveGame();
}


function getResourceName(type) {

    const names = {

        wood: "madera 🌲",
        stone: "piedra 🪨",
        iron: "hierro ⛓️"

    };

    return names[type];
}


/* =========================================================
   CONSTRUIR HERRAMIENTAS
========================================================= */

function craftTool(tool) {

    if (game.tools[tool]) {

        notify("Ya tienes esta herramienta.");

        return;
    }


    let cost = {

        axe: {
            wood: 30,
            iron: 10
        },

        pickaxe: {
            wood: 30,
            iron: 20
        },

        hammer: {
            wood: 40,
            iron: 30
        }

    }[tool];


    if (
        game.wood < cost.wood ||
        game.iron < cost.iron
    ) {

        notify("No tienes suficientes materiales.");

        return;
    }


    game.wood -= cost.wood;
    game.iron -= cost.iron;

    game.tools[tool] = true;


    const names = {

        axe: "🪓 Hacha",
        pickaxe: "⛏️ Pico",
        hammer: "🔨 Martillo"

    };

    notify(
        "Has fabricado: " + names[tool]
    );

    addLog(
        "Fabricaste " + names[tool]
    );

    updateUI();
    saveGame();
}


/* =========================================================
   MEJORAR CASTILLO
========================================================= */

function upgradeCastle() {

    const woodCost =
        100 * game.castleLevel;

    const stoneCost =
        50 * game.castleLevel;


    if (
        game.wood < woodCost ||
        game.stone < stoneCost
    ) {

        notify("No tienes suficientes materiales.");

        return;
    }


    game.wood -= woodCost;
    game.stone -= stoneCost;

    game.castleLevel++;

    game.castleHealth = 100;


    notify(
        "🏰 ¡Castillo mejorado a nivel " +
        game.castleLevel + "!"
    );

    addLog(
        "Tu castillo ahora es nivel " +
        game.castleLevel
    );


    updateCastleVisual();

    updateUI();
    saveGame();
}


function updateCastleVisual() {

    const castle =
        document.getElementById("castle");

    const scale =
        1 + ((game.castleLevel - 1) * .05);

    castle.style.transform =
        `scale(${Math.min(scale, 1.35)})`;
}


/* =========================================================
   RECLUTAR ARQUERO
========================================================= */

function buildArcher() {

    const woodCost = 50;
    const ironCost = 20;


    if (
        game.wood < woodCost ||
        game.iron < ironCost
    ) {

        notify("No tienes suficientes materiales.");

        return;
    }


    game.wood -= woodCost;
    game.iron -= ironCost;

    game.archers++;


    notify(
        "🏹 Nuevo arquero reclutado."
    );

    addLog(
        "Reclutaste un arquero."
    );


    updateUI();
    saveGame();
}


/* =========================================================
   REPARAR CASTILLO
========================================================= */

function repairCastle() {

    if (game.castleHealth >= 100) {

        notify("Tu castillo ya está al máximo.");

        return;
    }


    if (
        game.stone < 30 ||
        game.iron < 10
    ) {

        notify("No tienes materiales.");

        return;
    }


    game.stone -= 30;
    game.iron -= 10;

    game.castleHealth =
        Math.min(
            100,
            game.castleHealth + 25
        );


    notify("🔨 Castillo reparado.");

    addLog(
        "Reparaste parte del castillo."
    );

    updateUI();
    saveGame();
}


/* =========================================================
   INFORMACIÓN DE EDIFICIOS
========================================================= */

function showBuildingInfo(building) {

    if (building === "castle") {

        notify(
            "🏰 Castillo nivel " +
            game.castleLevel +
            " — " +
            game.castleHealth +
            "% de vida."
        );

    }

    if (building === "archer") {

        notify(
            "🏹 Tienes " +
            game.archers +
            " arquero(s)."
        );

    }
}


/* =========================================================
   ABRIR BATALLA
========================================================= */

function openBattle() {

    /*
       El jugador debe tener al menos
       un castillo funcional.
    */

    if (game.castleHealth <= 0) {

        notify(
            "Repara tu castillo antes de luchar."
        );

        return;
    }


    document
        .getElementById("villageScreen")
        .classList.remove("active");

    document
        .getElementById("battleScreen")
        .classList.add("active");


    startBattle();
}


/* =========================================================
   GENERAR ENEMIGO
========================================================= */

function generateEnemy() {

    const level =
        Math.max(
            1,
            game.castleLevel +
            Math.floor(Math.random() * 3) - 1
        );


    battle.enemyMaxHealth =
        800 + level * 150;

    battle.enemyHealth =
        battle.enemyMaxHealth;


    battle.enemyAttack =
        60 + level * 15 +
        Math.floor(Math.random() * 25);


    battle.enemyDefense =
        35 + level * 10;


    document.getElementById(
        "enemyAttack"
    ).textContent =
        battle.enemyAttack;


    document.getElementById(
        "enemyDefense"
    ).textContent =
        battle.enemyDefense;


    document.getElementById(
        "enemyHealthText"
    ).textContent =
        battle.enemyHealth +
        " / " +
        battle.enemyMaxHealth;


    updateEnemyHealth();
}


/* =========================================================
   COMENZAR BATALLA
========================================================= */

function startBattle() {

    clearBattleTimers();


    battle.active = true;

    battle.resultShown = false;

    battle.playerHealth =
        1000 +
        (game.castleLevel - 1) * 150;

    battle.playerDamage = 0;

    battle.timer = 60;


    generateEnemy();


    document.getElementById(
        "battleTimer"
    ).textContent = battle.timer;


    document.getElementById(
        "battleLog"
    ).innerHTML = "";


    document.getElementById(
        "battleMessage"
    ).textContent =
        "¡La batalla comienza!";


    updatePlayerHealth();


    /*
       Temporizador principal
    */

    battle.interval = setInterval(() => {

        battle.timer--;

        document.getElementById(
            "battleTimer"
        ).textContent =
            battle.timer;


        if (battle.timer <= 0) {

            finishBattleByTime();

        }

    }, 1000);


    /*
       El enemigo ataca automáticamente.
       Ambos lados pueden atacar al mismo tiempo.
    */

    battle.enemyInterval =
        setInterval(() => {

            enemyAttackPlayer();

        }, 1800);
}


/* =========================================================
   ATAQUE DEL JUGADOR
========================================================= */

function attackEnemy(type) {

    if (!battle.active) {
        return;
    }


    let damage = 0;


    /*
       Cada unidad tiene daño diferente.
    */

    if (type === "warrior") {

        damage = 25;

    }

    if (type === "archer") {

        damage = 18 +
            game.archers * 5;

    }

    if (type === "giant") {

        damage = 50;

    }


    /*
       El castillo enemigo reduce el daño.
    */

    damage = Math.max(
        5,
        damage - battle.enemyDefense * .15
    );


    /*
       Pequeña variación aleatoria.
    */

    damage *=
        .85 +
        Math.random() * .3;


    damage = Math.floor(damage);


    battle.enemyHealth =
        Math.max(
            0,
            battle.enemyHealth - damage
        );


    battle.playerDamage += damage;


    addBattleLog(
        "⚔️ Has causado " +
        damage +
        " de daño."
    );


    document.getElementById(
        "battleMessage"
    ).textContent =
        "¡Ataque exitoso! -" +
        damage +
        " PV";


    updateEnemyHealth();


    /*
       Victoria
    */

    if (battle.enemyHealth <= 0) {

        finishBattle(true);

    }
}


/* =========================================================
   ATAQUE ENEMIGO
========================================================= */

function enemyAttackPlayer() {

    if (!battle.active) {
        return;
    }


    /*
       Ataque base
    */

    let damage =
        battle.enemyAttack *
        (.75 + Math.random() * .5);


    /*
       Los arqueros defienden.
    */

    const defenseBonus =
        game.archers * 7;


    damage -= defenseBonus;


    damage = Math.max(
        5,
        Math.floor(damage)
    );


    battle.playerHealth =
        Math.max(
            0,
            battle.playerHealth - damage
        );


    /*
       El castillo recibe daño proporcional
       a la batalla.
    */

    const healthPercent =
        battle.playerHealth /
        (
            1000 +
            (game.castleLevel - 1) * 150
        );


    game.castleHealth =
        Math.max(
            0,
            Math.floor(healthPercent * 100)
        );


    addBattleLog(
        "👹 El enemigo causó " +
        damage +
        " de daño."
    );


    updatePlayerHealth();
    updateUI();


    if (battle.playerHealth <= 0) {

        finishBattle(false);

    }
}


/* =========================================================
   BARRAS DE VIDA
========================================================= */

function updatePlayerHealth() {

    const maxHealth =
        1000 +
        (game.castleLevel - 1) * 150;


    const percent =
        Math.max(
            0,
            battle.playerHealth /
            maxHealth * 100
        );


    document.getElementById(
        "playerHealthBar"
    ).style.width =
        percent + "%";


    document.getElementById(
        "playerHealthText"
    ).textContent =
        Math.floor(battle.playerHealth) +
        " / " +
        maxHealth;
}


function updateEnemyHealth() {

    const percent =
        Math.max(
            0,
            battle.enemyHealth /
            battle.enemyMaxHealth * 100
        );


    document.getElementById(
        "enemyHealthBar"
    ).style.width =
        percent + "%";


    document.getElementById(
        "enemyHealthText"
    ).textContent =
        Math.floor(battle.enemyHealth) +
        " / " +
        battle.enemyMaxHealth;
}


/* =========================================================
   LOG DE BATALLA
========================================================= */

function addBattleLog(message) {

    const log =
        document.getElementById("battleLog");

    const entry =
        document.createElement("div");

    entry.textContent = message;

    log.prepend(entry);

    while (log.children.length > 15) {

        log.removeChild(log.lastChild);

    }
}


/* =========================================================
   FINALIZAR BATALLA
========================================================= */

function finishBattle(victory) {

    if (!battle.active) {
        return;
    }


    battle.active = false;

    clearBattleTimers();


    if (victory) {

        /*
           Los puntos dependen del daño
           que hayas causado.
        */

        const damagePercent =
            battle.playerDamage /
            battle.enemyMaxHealth;


        const points =
            Math.max(
                50,
                Math.floor(
                    damagePercent * 500
                )
            );


        const gold =
            50 +
            Math.floor(points * .4);


        game.points += points;
        game.gold += gold;

        game.wins++;


        /*
           Recompensa de materiales.
        */

        game.wood += 60;
        game.stone += 40;
        game.iron += 20;


        showResult(
            true,
            points,
            gold
        );


        addLog(
            "🏆 Victoria. Ganaste " +
            points +
            " puntos."
        );

    } else {

        /*
           Incluso al perder se obtiene
           una pequeña cantidad por el daño.
        */

        const points =
            Math.floor(
                battle.playerDamage / 5
            );


        const gold =
            Math.floor(
                battle.playerDamage / 10
            );


        game.points += points;
        game.gold += gold;


        showResult(
            false,
            points,
            gold
        );


        addLog(
            "💀 Has perdido la batalla."
        );
    }


    updateUI();
    saveGame();
}


/* =========================================================
   TIEMPO AGOTADO
========================================================= */

function finishBattleByTime() {

    if (!battle.active) {
        return;
    }


    /*
       Se determina ganador por porcentaje
       de destrucción.
    */

    if (battle.enemyHealth <= battle.playerHealth) {

        finishBattle(true);

    } else {

        finishBattle(false);

    }
}


/* =========================================================
   LIMPIAR TEMPORIZADORES
========================================================= */

function clearBattleTimers() {

    if (battle.interval) {

        clearInterval(
            battle.interval
        );

        battle.interval = null;
    }


    if (battle.enemyInterval) {

        clearInterval(
            battle.enemyInterval
        );

        battle.enemyInterval = null;
    }
}


/* =========================================================
   RESULTADO
========================================================= */

function showResult(
    victory,
    points,
    gold
) {

    const modal =
        document.getElementById(
            "resultModal"
        );


    const icon =
        document.getElementById(
            "resultIcon"
        );


    const title =
        document.getElementById(
            "resultTitle"
        );


    const description =
        document.getElementById(
            "resultDescription"
        );


    if (victory) {

        icon.textContent = "🏆";

        title.textContent =
            "¡VICTORIA!";

        title.style.color =
            "#f5c542";

        description.textContent =
            "Has destruido el castillo enemigo.";

    } else {

        icon.textContent = "💀";

        title.textContent =
            "DERROTA";

        title.style.color =
            "#e74c3c";

        description.textContent =
            "Tu castillo ha caído, pero has conseguido recompensas por el daño realizado.";

    }


    document.getElementById(
        "rewardPoints"
    ).textContent =
        points;


    document.getElementById(
        "rewardGold"
    ).textContent =
        gold;


    modal.classList.add("show");
}


/* =========================================================
   CERRAR RESULTADO
========================================================= */

function closeResult() {

    document
        .getElementById("resultModal")
        .classList.remove("show");

    returnVillage();
}


/* =========================================================
   VOLVER AL POBLADO
========================================================= */

function returnVillage() {

    clearBattleTimers();

    battle.active = false;


    document
        .getElementById("battleScreen")
        .classList.remove("active");


    document
        .getElementById("villageScreen")
        .classList.add("active");


    /*
       El día avanza después de una batalla.
    */

    game.day++;


    updateUI();

    saveGame();
}


/* =========================================================
   CANJEAR PUNTOS
========================================================= */

function exchangePoints() {

    if (game.points < 100) {

        notify(
            "Necesitas al menos 100 puntos."
        );

        return;
    }


    game.points -= 100;

    game.wood += 100;
    game.stone += 70;
    game.iron += 40;


    notify(
        "💰 100 puntos convertidos en materiales."
    );

    updateUI();
    saveGame();
}


/* =========================================================
   INICIO
========================================================= */

function init() {

    loadGame();

    updateUI();

    updateCastleVisual();

    addLog(
        "🌅 Bienvenido a tu nuevo reino."
    );

    addLog(
        "🌲 Recolecta madera haciendo clic en los árboles."
    );

    addLog(
        "⛏️ Consigue piedra y hierro para construir."
    );
}


init();
