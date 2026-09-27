// ==========================================
// 1. CONFIGURACIÓN DE SUPABASE
// ==========================================
const supabaseUrl = 'TU_URL_DE_SUPABASE'; // Reemplazar luego
const supabaseAnonKey = 'TU_CLAVE_ANON_DE_SUPABASE'; // Reemplazar luego
// const supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// ==========================================
// 2. CLASES DEL JUEGO (Héroes/Torres y Enemigos)
// ==========================================

class Heroe extends Phaser.GameObjects.Container {
    constructor(scene, x, y, type) {
        super(scene, x, y);
        this.scene = scene;
        this.type = type;
        
        // --- AQUÍ IRÁN LOS SPRITES ---
        // Por ahora, dibujamos un cuadrado azul para simular la base del héroe
        let baseSprite = scene.add.rectangle(0, 0, 64, 64, 0x3498db).setOrigin(0.5);
        // Un círculo arriba para simular el personaje
        let charSprite = scene.add.circle(0, -10, 20, 0xf1c40f).setOrigin(0.5);
        
        this.add([baseSprite, charSprite]);
        scene.add.existing(this);

        // Atributos lógicos
        this.damage = 15;
        this.range = 150;
        this.fireRate = 1000; // Dispara cada 1 segundo
        this.lastFired = 0;
        
        // Círculo invisible para visualizar el rango
        this.rangeCircle = scene.add.circle(x, y, this.range, 0xffffff, 0.1).setVisible(false);
    }

    update(time, enemies) {
        // Buscar el enemigo más cercano
        let target = this.getClosestEnemy(enemies);
        
        if (target && time > this.lastFired) {
            this.shoot(target);
            this.lastFired = time + this.fireRate;
        }
    }

    getClosestEnemy(enemies) {
        let closest = null;
        let minDistance = this.range;
        
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
        // Crear un proyectil (luego será un sprite de bala o fuego)
        let bullet = this.scene.add.circle(this.x, this.y, 5, 0xff0000);
        this.scene.physics.add.existing(bullet);
        
        this.scene.physics.moveToObject(bullet, target, 400);
        
        // Simular impacto después de un tiempo corto
        this.scene.time.delayedCall(100, () => {
            bullet.destroy();
            target.takeDamage(this.damage);
        });
    }
}

class Enemigo extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);
        this.scene = scene;
        
        // --- AQUÍ IRÁN LOS SPRITES DE LOS ZOMBIES ---
        // Cuadrado verde simulando un zombie
        let sprite = scene.add.rectangle(0, 0, 30, 40, 0x2ecc71);
        this.add(sprite);
        
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        this.hp = 50;
        this.speed = 50;
    }

    takeDamage(amount) {
        this.hp -= amount;
        // Efecto de parpadeo al recibir daño
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true
        });

        if (this.hp <= 0) {
            this.scene.addCoins(10); // Recompensa
            this.destroy();
        }
    }
}

// ==========================================
// 3. ESCENA PRINCIPAL
// ==========================================

class MainScene extends Phaser.Scene {
    constructor() {
        super('MainScene');
        this.coins = 3922; // Saldo inicial simulando la imagen
        this.gems = 2414;
    }

    preload() {
        // ========================================================
        // AQUÍ SE CARGARÁN TUS IMÁGENES EN EL FUTURO
        // ========================================================
        /*
        this.load.image('fondo', 'assets/fondo_pasto.png');
        this.load.image('base_artilleria', 'assets/base_nivel1.png');
        this.load.image('zombie_basico', 'assets/zombie_1.png');
        this.load.image('boton_menu', 'assets/ui_button.png');
        */
    }

    create() {
        // Fondo verde temporal
        this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, 1000, 1000, 0x7cb342);

        // Crear un grupo para los enemigos
        this.enemies = this.physics.add.group({
            classType: Enemigo,
            runChildUpdate: true
        });

        // Crear una cuadrícula visual (Grid) para colocar héroes
        this.createGrid();

        // Lista de héroes en el mapa
        this.heroes = [];

        // Generar enemigos cada 3 segundos
        this.time.addEvent({
            delay: 3000,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.updateUI();
    }

    createGrid() {
        // Dibuja una cuadrícula simple en el centro de la pantalla
        const startX = this.cameras.main.centerX - 100;
        const startY = this.cameras.main.centerY - 100;
        const tileSize = 70;

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                let cx = startX + (col * tileSize);
                let cy = startY + (row * tileSize);
                
                // Casilla de la cuadrícula
                let tile = this.add.rectangle(cx, cy, tileSize - 5, tileSize - 5, 0xffffff, 0.2).setInteractive();
                
                // Evento al tocar la casilla: Colocar un héroe
                tile.on('pointerdown', () => {
                    if (this.coins >= 100) {
                        this.coins -= 100;
                        this.updateUI();
                        
                        let nuevoHeroe = new Heroe(this, cx, cy, 'artilleria');
                        this.heroes.push(nuevoHeroe);
                        
                        // Ocultar la casilla para no poner dos en el mismo lugar
                        tile.disableInteractive();
                        tile.fillColor = 0x000000;
                        tile.alpha = 0.1;
                    } else {
                        console.log("No tienes monedas suficientes");
                    }
                });
            }
        }
    }

    spawnEnemy() {
        // Los enemigos aparecen arriba y caminan hacia abajo
        let xPos = Phaser.Math.Between(50, this.sys.game.config.width - 50);
        let enemy = new Enemigo(this, xPos, -50);
        this.enemies.add(enemy);
        enemy.body.setVelocityY(enemy.speed);
    }

    update(time, delta) {
        // Actualizar la lógica de todos los héroes (buscar objetivos y disparar)
        this.heroes.forEach(heroe => heroe.update(time, this.enemies));

        // Limpiar enemigos que se salgan de la pantalla por abajo
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.y > this.sys.game.config.height + 50) {
                enemy.destroy();
            }
        });
    }

    addCoins(amount) {
        this.coins += amount;
        this.updateUI();
        // Aquí llamaríamos a Supabase para guardar el nuevo saldo:
        // this.saveProgressToSupabase();
    }

    updateUI() {
        document.getElementById('coins-count').innerText = this.coins;
        document.getElementById('gems-count').innerText = this.gems;
    }

    async saveProgressToSupabase() {
        /*
        const { data, error } = await supabase
            .from('jugadores')
            .update({ monedas: this.coins, gemas: this.gems })
            .eq('id_telegram', userId);
        */
    }
}

// ==========================================
// 4. INICIALIZACIÓN DE PHASER
// ==========================================
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth, // Se adapta al tamaño del celular
    height: window.innerHeight,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [MainScene]
};

const game = new Phaser.Game(config);

// Ajustar el tamaño si se rota la pantalla del móvil
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
