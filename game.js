// ==========================================
// ESTADO GLOBAL DEL JUEGO (BETA TEST)
// ==========================================
const GameState = {
    coins: 3922,
    gems: 2414,
    selectedHeroToPlace: null,
    heroesDB: {
        'ametrallador': { id: 'ametrallador', name: 'Ametrallador', unlocked: true, cost: 0, damage: 10, range: 120, fireRate: 400, color: 0xe74c3c, projColor: 0xffaaaa },
        'artilleria':   { id: 'artilleria', name: 'Artillería', unlocked: false, cost: 136900, damage: 50, range: 180, fireRate: 1500, color: 0x27ae60, projColor: 0x55ff55 },
        'electro':      { id: 'electro', name: 'Soldado Electro', unlocked: true, cost: 0, damage: 25, range: 150, fireRate: 800, color: 0x3498db, projColor: 0xaaaaff },
        'bombero':      { id: 'bombero', name: 'Bombero', unlocked: false, gemCost: 200, damage: 40, range: 100, fireRate: 1000, color: 0xe67e22, projColor: 0xffaa00 }
    }
};

// Referencia global a la escena principal para interactuar desde HTML
let mainSceneRef = null;

// ==========================================
// FUNCIONES DE INTERFAZ HTML -> PHASER
// ==========================================
function interactHero(heroId) {
    const heroData = GameState.heroesDB[heroId];
    
    if (!heroData.unlocked) {
        // Lógica de compra
        if (heroData.cost && GameState.coins >= heroData.cost) {
            GameState.coins -= heroData.cost;
            heroData.unlocked = true;
            actualizarUI();
            alert(`${heroData.name} desbloqueado.`);
        } else if (heroData.gemCost && GameState.gems >= heroData.gemCost) {
            GameState.gems -= heroData.gemCost;
            heroData.unlocked = true;
            actualizarUI();
            document.getElementById(`card-${heroId}`).classList.remove('locked');
            alert(`${heroData.name} desbloqueado.`);
        } else {
            alert("Fondos insuficientes.");
        }
        return;
    }

    // Seleccionar para colocar
    GameState.selectedHeroToPlace = heroId;
    
    // Efecto visual en la UI
    document.querySelectorAll('.hero-card').forEach(card => card.classList.remove('selected'));
    document.getElementById(`card-${heroId}`).classList.add('selected');
}

function actualizarUI() {
    document.getElementById('coins-display').innerText = GameState.coins;
    document.getElementById('gems-display').innerText = GameState.gems;
    
    // Actualizar botones según estado
    ['ametrallador', 'artilleria', 'electro', 'bombero'].forEach(id => {
        const btn = document.querySelector(`#card-${id} .action-btn`);
        if (GameState.heroesDB[id].unlocked) {
            btn.className = 'action-btn select-btn';
            btn.innerText = 'Seleccionar';
        }
    });
}

// ==========================================
// CLASES DEL JUEGO
// ==========================================
class HeroEntity extends Phaser.GameObjects.Container {
    constructor(scene, x, y, heroData) {
        super(scene, x, y);
        this.scene = scene;
        this.stats = heroData;

        // SPRITE TEMPORAL (Base + Personaje)
        let baseObj = scene.add.rectangle(0, 0, 60, 60, 0xbdc3c7).setStrokeStyle(4, 0x7f8c8d);
        let charObj = scene.add.circle(0, -10, 20, heroData.color);
        
        this.add([baseObj, charObj]);
        scene.add.existing(this);

        this.lastFired = 0;
    }

    update(time, enemies) {
        let target = this.getClosestEnemy(enemies);
        if (target && time > this.lastFired) {
            this.shoot(target);
            this.lastFired = time + this.stats.fireRate;
        }
    }

    getClosestEnemy(enemies) {
        let closest = null;
        let minDistance = this.stats.range;
        enemies.getChildren().forEach(enemy => {
            if (enemy.active) {
                let dist = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    closest = enemy;
                }
            }
        });
        return closest;
    }

    shoot(target) {
        // Proyectil
        let bullet = this.scene.add.circle(this.x, this.y - 10, 6, this.stats.projColor);
        this.scene.physics.add.existing(bullet);
        this.scene.physics.moveToObject(bullet, target, 500);

        // Destruir proyectil y aplicar daño al llegar
        this.scene.time.delayedCall(150, () => {
            if (bullet) bullet.destroy();
            if (target && target.active) target.takeDamage(this.stats.damage);
        });
    }
}

class EnemyEntity extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);
        this.scene = scene;
        
        // SPRITE TEMPORAL (Zombie)
        let bodyObj = scene.add.rectangle(0, 0, 30, 40, 0x8e44ad);
        this.add(bodyObj);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.hp = 100;
        this.speed = Phaser.Math.Between(30, 60);
    }

    takeDamage(amount) {
        this.hp -= amount;
        
        // Efecto visual de daño
        let dmgText = this.scene.add.text(this.x, this.y - 20, `-${amount}`, { fontSize: '14px', fill: '#ff0000', fontStyle: 'bold' });
        this.scene.tweens.add({ targets: dmgText, y: this.y - 40, alpha: 0, duration: 500, onComplete: () => dmgText.destroy() });

        if (this.hp <= 0) {
            GameState.coins += 15;
            actualizarUI();
            this.destroy();
        }
    }
}

// ==========================================
// ESCENA PRINCIPAL
// ==========================================
class MainGame extends Phaser.Scene {
    constructor() {
        super('MainGame');
        mainSceneRef = this;
    }

    create() {
        // Fondo (Pasto)
        this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0x8cc460);

        this.heroes = [];
        this.enemies = this.physics.add.group({ classType: EnemyEntity, runChildUpdate: true });

        this.createGrid();

        // Generador de Enemigos
        this.time.addEvent({
            delay: 2000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        actualizarUI();
    }

    createGrid() {
        const startX = this.cameras.main.centerX - 75;
        const startY = this.cameras.main.centerY - 150;
        const tileSize = 75;

        // Matriz 3x3 isométrica/diamante simplificada
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                let cx = startX + (col * tileSize);
                let cy = startY + (row * tileSize);
                
                let tile = this.add.rectangle(cx, cy, tileSize - 4, tileSize - 4, 0xffffff, 0.3)
                    .setInteractive()
                    .setStrokeStyle(2, 0xffffff);
                
                tile.on('pointerdown', () => this.placeHero(tile, cx, cy));
            }
        }
    }

    placeHero(tile, x, y) {
        if (!GameState.selectedHeroToPlace) {
            // Mostrar mensaje flotante en Phaser
            let adv = this.add.text(x, y, "Selecciona héroe abajo", { color: 'white', backgroundColor: 'black' }).setOrigin(0.5);
            this.time.delayedCall(1000, () => adv.destroy());
            return;
        }

        let heroData = GameState.heroesDB[GameState.selectedHeroToPlace];
        
        let newHero = new HeroEntity(this, x, y, heroData);
        this.heroes.push(newHero);
        
        // Bloquear casilla
        tile.disableInteractive();
        tile.fillColor = 0x000000;
        tile.alpha = 0.1;
        
        // Deseleccionar
        GameState.selectedHeroToPlace = null;
        document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
    }

    spawnEnemy() {
        let xPos = Phaser.Math.Between(50, this.scale.width - 50);
        let enemy = new EnemyEntity(this, xPos, -50);
        this.enemies.add(enemy);
        enemy.body.setVelocityY(enemy.speed);
    }

    update(time, delta) {
        this.heroes.forEach(h => h.update(time, this.enemies));

        this.enemies.getChildren().forEach(enemy => {
            if (enemy.y > this.scale.height + 50) {
                // Penalización al dejar pasar zombies
                GameState.coins = Math.max(0, GameState.coins - 50);
                actualizarUI();
                enemy.destroy();
            }
        });
    }
}

// ==========================================
// INICIAR MOTOR
// ==========================================
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#8cc460',
    physics: { default: 'arcade' },
    scene: [MainGame]
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
