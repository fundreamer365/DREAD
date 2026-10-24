// DREAD - Horror Survival Game
// Main Game Script

class DREADGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        this.gameState = 'menu';
        this.audioContext = null;
        this.soundSystem = null;
        
        this.playerController = null;
        this.monster = null;
        this.monsterAI = null;
        this.level = null;
        
        this.objects = [];
        this.interactables = [];
        this.objectives = [];
        this.currentObjectiveIndex = 0;
        this.inventory = [];
        
        this.settings = {
            masterVolume: 0.8,
            monsterVolume: 0.7,
            environmentVolume: 0.5,
            mouseSensitivity: 0.002,
            graphicsQuality: 'medium'
        };
        
        this.isMouseLocked = false;
        this.soundsConfig = null;
        
        this.init();
    }
    
    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.setupUI();
    }
    
    async loadConfig() {
        try {
            const [gameConfigResponse, soundsConfigResponse] = await Promise.all([
                fetch('./game_config.json'),
                fetch('./monster_sounds.json')
            ]);
            
            if (gameConfigResponse.ok) {
                const gameConfig = await gameConfigResponse.json();
                Object.assign(this.settings, {
                    masterVolume: gameConfig.audio.masterVolume,
                    monsterVolume: gameConfig.audio.monsterVolume,
                    environmentVolume: gameConfig.audio.environmentVolume,
                    mouseSensitivity: gameConfig.player.mouseSensitivity
                });
            }
            
            if (soundsConfigResponse.ok) {
                this.soundsConfig = await soundsConfigResponse.json();
            }
        } catch (error) {
            console.warn('Could not load config files:', error);
        }
    }
    
    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.startGame());
        document.getElementById('settingsButton').addEventListener('click', () => this.showSettings());
        document.getElementById('backButton').addEventListener('click', () => this.hideSettings());
        document.getElementById('resumeButton').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartButton').addEventListener('click', () => this.restartGame());
        document.getElementById('quitButton').addEventListener('click', () => this.quitToMenu());
        document.getElementById('deathQuitButton').addEventListener('click', () => this.quitToMenu());
        document.getElementById('victoryQuitButton').addEventListener('click', () => this.quitToMenu());
        document.getElementById('respawnButton').addEventListener('click', () => this.respawn());
        document.getElementById('playAgainButton').addEventListener('click', () => this.restartGame());
        
        this.setupSettingsControls();
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.canvas) {
                if (this.gameState === 'playing') this.isMouseLocked = true;
            } else {
                this.isMouseLocked = false;
                if (this.gameState === 'playing') this.pauseGame();
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isMouseLocked && this.playerController) {
                this.playerController.handleMouseMove(e.movementX, e.movementY);
            }
        });
    }
    
    setupSettingsControls() {
        const masterVolume = document.getElementById('masterVolume');
        const monsterVolume = document.getElementById('monsterVolume');
        const envVolume = document.getElementById('envVolume');
        const mouseSens = document.getElementById('mouseSensitivity');
        const graphicsQuality = document.getElementById('graphicsQuality');
        
        masterVolume.addEventListener('input', (e) => {
            this.settings.masterVolume = e.target.value / 100;
            document.getElementById('masterVolumeValue').textContent = e.target.value + '%';
            if (this.soundSystem) this.soundSystem.setMasterVolume(this.settings.masterVolume);
        });
        
        monsterVolume.addEventListener('input', (e) => {
            this.settings.monsterVolume = e.target.value / 100;
            document.getElementById('monsterVolumeValue').textContent = e.target.value + '%';
            if (this.soundSystem) this.soundSystem.setMonsterVolume(this.settings.monsterVolume);
        });
        
        envVolume.addEventListener('input', (e) => {
            this.settings.environmentVolume = e.target.value / 100;
            document.getElementById('envVolumeValue').textContent = e.target.value + '%';
            if (this.soundSystem) this.soundSystem.setEnvironmentVolume(this.settings.environmentVolume);
        });
        
        mouseSens.addEventListener('input', (e) => {
            this.settings.mouseSensitivity = e.target.value * 0.0004;
            document.getElementById('mouseSensitivityValue').textContent = e.target.value;
        });
        
        graphicsQuality.addEventListener('change', (e) => {
            this.settings.graphicsQuality = e.target.value;
            this.updateGraphicsQuality();
        });
    }
    
    setupUI() {
        this.screens = {
            start: document.getElementById('startScreen'),
            settings: document.getElementById('settingsScreen'),
            pause: document.getElementById('pauseMenu'),
            death: document.getElementById('deathScreen'),
            victory: document.getElementById('victoryScreen')
        };
        
        this.hud = document.getElementById('hud');
        this.objectiveText = document.getElementById('currentObjective');
        this.interactionPrompt = document.getElementById('interactionPrompt');
    }
    
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        if (screenName && this.screens[screenName]) this.screens[screenName].classList.add('active');
    }
    
    hideAllScreens() {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
    }
    
    async startGame() {
        try {
            await this.initAudio();
            this.hideAllScreens();
            this.hud.classList.add('active');
            
            this.initThreeJS();
            this.createPlayerController();
            this.createLevel();
            this.createMonster();
            this.setupObjectives();
            
            this.gameState = 'playing';
            this.animate();
            
            this.canvas.requestPointerLock();
        } catch (error) {
            console.error('Error starting game:', error);
        }
    }
    
    initThreeJS() {
        this.scene = new THREE.Scene();
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.8, 5);
        
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.08);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);
        
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    createPlayerController() {
        this.playerController = new PlayerController(this.camera, this.settings);
        this.playerController.setPosition(0, 1.8, 5);
    }
    
    createLevel() {
        this.level = new LevelGenerator(this.scene);
        this.level.generateComplex();
        this.objects = this.level.getObjects();
        this.interactables = this.level.getInteractables();
    }
    
    createMonster() {
        this.monster = new Monster(this.scene);
        this.monsterAI = new MonsterAI(this.monster, this.playerController, this.scene);
        this.monster.setPosition(20, 0, -20);
        
        if (this.soundSystem) this.monsterAI.setSoundSystem(this.soundSystem);
    }
    
    setupObjectives() {
        this.objectives = [
            "Find the access card in the laboratory",
            "Restore power in Sector A",
            "Activate the security system",
            "Open the emergency exit",
            "Escape the complex"
        ];
        this.currentObjectiveIndex = 0;
        this.updateObjective();
    }
    
    updateObjective() {
        if (this.currentObjectiveIndex < this.objectives.length) {
            this.objectiveText.textContent = this.objectives[this.currentObjectiveIndex];
        } else {
            this.objectiveText.textContent = "ESCAPE!";
        }
    }
    
    completeObjective() {
        this.currentObjectiveIndex++;
        this.updateObjective();
        if (this.currentObjectiveIndex >= this.objectives.length) this.victory();
    }
    
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.soundSystem = new SoundSystem(this.audioContext, this.soundsConfig, this.settings);
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.warn('Audio initialization failed:', error);
        }
    }
    
    handleKeyDown(event) {
        if (this.gameState !== 'playing') return;
        
        switch (event.code) {
            case 'Escape':
                this.pauseGame();
                break;
            case 'KeyE':
                this.handleInteraction();
                break;
        }
        
        if (this.playerController) this.playerController.handleKeyDown(event.code);
    }
    
    handleKeyUp(event) {
        if (this.playerController) this.playerController.handleKeyUp(event.code);
    }
    
    handleInteraction() {
        const playerPos = this.playerController.getPosition();
        let closestInteractable = null;
        let closestDistance = 3.0;
        
        for (const interactable of this.interactables) {
            const distance = playerPos.distanceTo(interactable.position);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestInteractable = interactable;
            }
        }
        
        if (closestInteractable) this.interactWith(closestInteractable);
    }
    
    interactWith(interactable) {
        switch (interactable.type) {
            case 'door': this.handleDoorInteraction(interactable); break;
            case 'terminal': this.handleTerminalInteraction(interactable); break;
            case 'item': this.handleItemInteraction(interactable); break;
            case 'power_panel': this.handlePowerPanelInteraction(interactable); break;
        }
    }
    
    handleDoorInteraction(door) {
        if (door.locked && !this.hasRequiredItem(door.requiredItem)) {
            this.showInteractionMessage("Locked - Need " + door.requiredItem);
            return;
        }
        door.toggle();
        if (this.soundSystem) this.soundSystem.playDoorSound();
    }
    
    handleTerminalInteraction(terminal) {
        terminal.activate();
        if (terminal.objective) this.completeObjective();
        if (this.soundSystem) this.soundSystem.playTerminalSound();
    }
    
    handleItemInteraction(item) {
        item.collect();
        this.inventory.push(item.id);
        this.interactables = this.interactables.filter(i => i !== item);
        this.scene.remove(item.mesh);
        
        if (item.objective) this.completeObjective();
        if (this.soundSystem) this.soundSystem.playPickupSound();
    }
    
    handlePowerPanelInteraction(panel) {
        panel.activate();
        this.completeObjective();
        if (this.soundSystem) this.soundSystem.playPowerSound();
    }
    
    hasRequiredItem(requiredItem) {
        return this.inventory.includes(requiredItem);
    }
    
    showInteractionMessage(message) {
        this.interactionPrompt.textContent = message;
        this.interactionPrompt.classList.remove('hidden');
        
        setTimeout(() => {
            this.interactionPrompt.classList.add('hidden');
            this.interactionPrompt.textContent = "Press E to interact";
        }, 2000);
    }
    
    pauseGame() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            document.exitPointerLock();
            this.showScreen('pause');
        }
    }
    
    resumeGame() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.hideAllScreens();
            this.canvas.requestPointerLock();
        }
    }
    
    restartGame() {
        this.resetGame();
        this.startGame();
    }
    
    respawn() {
        this.resetGame();
        this.startGame();
    }
    
    quitToMenu() {
        this.resetGame();
        this.hud.classList.remove('active');
        this.showScreen('start');
        this.gameState = 'menu';
    }
    
    resetGame() {
        while (this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
        
        this.gameState = 'menu';
        this.inventory = [];
        this.currentObjectiveIndex = 0;
        this.isMouseLocked = false;
        
        if (this.playerController) {
            this.playerController.dispose();
            this.playerController = null;
        }
        
        if (this.monster) {
            this.monster.dispose();
            this.monster = null;
        }
        
        if (this.monsterAI) this.monsterAI = null;
        if (this.level) {
            this.level.dispose();
            this.level = null;
        }
        
        this.objects = [];
        this.interactables = [];
    }
    
    death() {
        this.gameState = 'dead';
        document.exitPointerLock();
        this.showScreen('death');
        if (this.soundSystem) this.soundSystem.playDeathSound();
    }
    
    victory() {
        this.gameState = 'victory';
        document.exitPointerLock();
        this.showScreen('victory');
        if (this.soundSystem) this.soundSystem.playVictorySound();
    }
    
    updateGraphicsQuality() {
        if (!this.renderer) return;
        
        switch (this.settings.graphicsQuality) {
            case 'low':
                this.renderer.setPixelRatio(1);
                this.renderer.shadowMap.enabled = false;
                break;
            case 'medium':
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.renderer.shadowMap.enabled = true;
                break;
            case 'high':
                this.renderer.setPixelRatio(window.devicePixelRatio);
                this.renderer.shadowMap.enabled = true;
                break;
        }
    }
    
    checkInteractions() {
        if (!this.playerController) return;
        
        const playerPos = this.playerController.getPosition();
        let hasInteractable = false;
        
        for (const interactable of this.interactables) {
            const distance = playerPos.distanceTo(interactable.position);
            if (distance < 3.0) {
                hasInteractable = true;
                break;
            }
        }
        
        if (hasInteractable) {
            this.interactionPrompt.classList.remove('hidden');
        } else {
            this.interactionPrompt.classList.add('hidden');
        }
    }
    
    animate() {
        if (this.gameState !== 'playing') return;
        
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        if (this.playerController) this.playerController.update(deltaTime);
        if (this.monsterAI) this.monsterAI.update(deltaTime);
        
        this.checkInteractions();
        this.checkGameConditions();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    checkGameConditions() {
        if (!this.playerController || !this.monster) return;
        
        const playerPos = this.playerController.getPosition();
        const monsterPos = this.monster.getPosition();
        
        const distance = playerPos.distanceTo(monsterPos);
        if (distance < 2.5) {
            this.death();
            return;
        }
        
        if (this.currentObjectiveIndex >= this.objectives.length - 1) {
            const exitPos = new THREE.Vector3(0, 0, -50);
            if (playerPos.distanceTo(exitPos) < 3.0) this.victory();
        }
    }
}

// Player Controller Class
class PlayerController {
    constructor(camera, settings) {
        this.camera = camera;
        this.settings = settings;
        
        this.moveForward = false;
        this.moveBackward = false;
        this.moveLeft = false;
        this.moveRight = false;
        this.isRunning = false;
        this.isCrouching = false;
        this.canJump = true;
        
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.onGround = false;
        
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.PI_2 = Math.PI / 2;
        
        this.bobTime = 0;
        this.bobAmount = 0.05;
        
        this.position = new THREE.Vector3(0, 1.8, 5);
        this.camera.position.copy(this.position);
    }
    
    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.camera.position.copy(this.position);
    }
    
    getPosition() {
        return this.position.clone();
    }
    
    handleKeyDown(keyCode) {
        switch (keyCode) {
            case 'KeyW': case 'ArrowUp': this.moveForward = true; break;
            case 'KeyS': case 'ArrowDown': this.moveBackward = true; break;
            case 'KeyA': case 'ArrowLeft': this.moveLeft = true; break;
            case 'KeyD': case 'ArrowRight': this.moveRight = true; break;
            case 'ShiftLeft': case 'ShiftRight': this.isRunning = true; break;
            case 'ControlLeft': case 'ControlRight': this.isCrouching = true; break;
            case 'Space':
                if (this.canJump && this.onGround) {
                    this.velocity.y = this.settings.jumpForce || 5.0;
                    this.canJump = false;
                    this.onGround = false;
                }
                break;
        }
    }
    
    handleKeyUp(keyCode) {
        switch (keyCode) {
            case 'KeyW': case 'ArrowUp': this.moveForward = false; break;
            case 'KeyS': case 'ArrowDown': this.moveBackward = false; break;
            case 'KeyA': case 'ArrowLeft': this.moveLeft = false; break;
            case 'KeyD': case 'ArrowRight': this.moveRight = false; break;
            case 'ShiftLeft': case 'ShiftRight': this.isRunning = false; break;
            case 'ControlLeft': case 'ControlRight': this.isCrouching = false; break;
        }
    }
    
    handleMouseMove(movementX, movementY) {
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.euler.y -= movementX * this.settings.mouseSensitivity;
        this.euler.x -= movementY * this.settings.mouseSensitivity;
        this.euler.x = Math.max(-this.PI_2, Math.min(this.PI_2, this.euler.x));
        this.camera.quaternion.setFromEuler(this.euler);
    }
    
    update(deltaTime) {
        let speed = this.settings.walkSpeed || 4.0;
        
        if (this.isRunning) {
            speed = this.settings.runSpeed || 7.0;
            const targetFov = this.settings.runFov || 85;
            this.camera.fov += (targetFov - this.camera.fov) * 0.1;
        } else if (this.isCrouching) {
            speed = this.settings.crouchSpeed || 2.0;
            const targetFov = (this.settings.fov || 75) - 5;
            this.camera.fov += (targetFov - this.camera.fov) * 0.1;
        } else {
            const targetFov = this.settings.fov || 75;
            this.camera.fov += (targetFov - this.camera.fov) * 0.1;
        }
        
        this.camera.updateProjectionMatrix();
        
        this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
        this.direction.x = Number(this.moveRight) - Number(this.moveLeft);
        this.direction.normalize();
        
        if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * speed * deltaTime * 10;
        if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * speed * deltaTime * 10;
        
        this.velocity.x -= this.velocity.x * 10.0 * deltaTime;
        this.velocity.z -= this.velocity.z * 10.0 * deltaTime;
        this.velocity.y -= (this.settings.gravity || 12.0) * deltaTime;
        
        const moveVector = new THREE.Vector3();
        moveVector.copy(this.velocity);
        moveVector.applyQuaternion(this.camera.quaternion);
        moveVector.y = 0;
        
        this.position.x += moveVector.x * deltaTime;
        this.position.z += moveVector.z * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        const groundHeight = this.isCrouching ? (this.settings.crouchHeight || 1.0) : (this.settings.height || 1.8);
        
        if (this.position.y < groundHeight) {
            this.velocity.y = 0;
            this.position.y = groundHeight;
            this.onGround = true;
            this.canJump = true;
        }
        
        this.position.x = Math.max(-45, Math.min(45, this.position.x));
        this.position.z = Math.max(-45, Math.min(45, this.position.z));
        
        if (this.onGround && (this.moveForward || this.moveBackward || this.moveLeft || this.moveRight)) {
            this.bobTime += deltaTime * (this.isRunning ? 15 : 10);
            const bobOffset = Math.sin(this.bobTime) * this.bobAmount * (this.isRunning ? 1.5 : 1);
            this.position.y += bobOffset;
        }
        
        this.camera.position.copy(this.position);
    }
    
    dispose() {}
}

// Level Generator Class
class LevelGenerator {
    constructor(scene) {
        this.scene = scene;
        this.objects = [];
        this.interactables = [];
        this.wallMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8, metalness: 0.2 });
        this.floorMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9, metalness: 0.1 });
        this.ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7, metalness: 0.3 });
    }
    
    generateComplex() {
        this.createStartingArea();
        this.createLaboratory();
        this.createTechnicalArea();
        this.createStorageRoom();
        this.createServerRoom();
        this.createCorridors();
        this.createEmergencyExit();
        this.addLighting();
        this.addAtmosphericEffects();
    }
    
    createStartingArea() {
        const roomGeometry = new THREE.BoxGeometry(6, 3.5, 6);
        const room = new THREE.Mesh(roomGeometry, this.wallMaterial);
        room.position.set(0, 1.75, 5);
        this.scene.add(room);
        this.objects.push(room);
        
        const floorGeometry = new THREE.PlaneGeometry(6, 6);
        const floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(0, 0, 5);
        this.scene.add(floor);
        this.objects.push(floor);
        
        const ceilingGeometry = new THREE.PlaneGeometry(6, 6);
        const ceiling = new THREE.Mesh(ceilingGeometry, this.ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(0, 3.5, 5);
        this.scene.add(ceiling);
        this.objects.push(ceiling);
        
        const doorFrame = this.createDoorFrame(0, 1.75, 2);
        this.scene.add(doorFrame);
        this.objects.push(doorFrame);
    }
    
    createLaboratory() {
        const labGeometry = new THREE.BoxGeometry(8, 3.5, 8);
        const lab = new THREE.Mesh(labGeometry, this.wallMaterial);
        lab.position.set(-15, 1.75, 0);
        this.scene.add(lab);
        this.objects.push(lab);
        
        const labFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), this.floorMaterial);
        labFloor.rotation.x = -Math.PI / 2;
        labFloor.position.set(-15, 0, 0);
        this.scene.add(labFloor);
        this.objects.push(labFloor);
        
        const accessCard = this.createAccessCard(-15, 0.5, 0);
        this.scene.add(accessCard.mesh);
        this.interactables.push(accessCard);
        this.objects.push(accessCard.mesh);
        
        this.createLabEquipment(-15, 0, 0);
    }
    
    createTechnicalArea() {
        const techGeometry = new THREE.BoxGeometry(6, 3.5, 10);
        const techArea = new THREE.Mesh(techGeometry, this.wallMaterial);
        techArea.position.set(15, 1.75, -10);
        this.scene.add(techArea);
        this.objects.push(techArea);
        
        const powerPanel = this.createPowerPanel(15, 1, -10);
        this.scene.add(powerPanel.mesh);
        this.interactables.push(powerPanel);
        this.objects.push(powerPanel.mesh);
    }
    
    createStorageRoom() {
        const storageGeometry = new THREE.BoxGeometry(6, 3.5, 6);
        const storage = new THREE.Mesh(storageGeometry, this.wallMaterial);
        storage.position.set(-15, 1.75, -15);
        this.scene.add(storage);
        this.objects.push(storage);
        
        this.createStorageItems(-15, 0, -15);
    }
    
    createServerRoom() {
        const serverGeometry = new THREE.BoxGeometry(8, 3.5, 6);
        const serverRoom = new THREE.Mesh(serverGeometry, this.wallMaterial);
        serverRoom.position.set(15, 1.75, 5);
        this.scene.add(serverRoom);
        this.objects.push(serverRoom);
        
        const terminal = this.createServerTerminal(15, 1, 5);
        this.scene.add(terminal.mesh);
        this.interactables.push(terminal);
        this.objects.push(terminal.mesh);
    }
    
    createCorridors() {
        const corridor1 = this.createCorridor(0, 1.75, 0, 3, 3.5, 20);
        this.scene.add(corridor1);
        this.objects.push(corridor1);
        
        const corridor2 = this.createCorridor(-8, 1.75, 0, 14, 3.5, 3);
        this.scene.add(corridor2);
        this.objects.push(corridor2);
        
        const corridor3 = this.createCorridor(8, 1.75, 0, 14, 3.5, 3);
        this.scene.add(corridor3);
        this.objects.push(corridor3);
        
        const corridor4 = this.createCorridor(0, 1.75, -10, 3, 3.5, 10);
        this.scene.add(corridor4);
        this.objects.push(corridor4);
    }
    
    createEmergencyExit() {
        const exitGeometry = new THREE.BoxGeometry(4, 3.5, 4);
        const exitArea = new THREE.Mesh(exitGeometry, this.wallMaterial);
        exitArea.position.set(0, 1.75, -25);
        this.scene.add(exitArea);
        this.objects.push(exitArea);
        
        const exitDoor = this.createExitDoor(0, 1.75, -23);
        this.scene.add(exitDoor.mesh);
        this.interactables.push(exitDoor);
        this.objects.push(exitDoor.mesh);
        
        const exitLight = new THREE.PointLight(0x00ff00, 1, 10);
        exitLight.position.set(0, 3, -23);
        this.scene.add(exitLight);
        this.objects.push(exitLight);
    }
    
    createCorridor(x, y, z, width, height, length) {
        const geometry = new THREE.BoxGeometry(width, height, length);
        const corridor = new THREE.Mesh(geometry, this.wallMaterial);
        corridor.position.set(x, y, z);
        return corridor;
    }
    
    createDoorFrame(x, y, z) {
        const frameGroup = new THREE.Group();
        const frameGeometry = new THREE.BoxGeometry(2.2, 2.5, 0.2);
        const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.set(x, y, z);
        frameGroup.add(frame);
        return frameGroup;
    }
    
    createAccessCard(x, y, z) {
        const cardGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.2);
        const cardMaterial = new THREE.MeshStandardMaterial({ color: 0x0066ff, emissive: 0x003366, emissiveIntensity: 0.5 });
        const card = new THREE.Mesh(cardGeometry, cardMaterial);
        card.position.set(x, y, z);
        
        return {
            mesh: card,
            type: 'item',
            id: 'access_card',
            position: card.position.clone(),
            objective: true,
            collect: function() { console.log('Access card collected'); }
        };
    }
    
    createPowerPanel(x, y, z) {
        const panelGeometry = new THREE.BoxGeometry(0.8, 1.2, 0.1);
        const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x661111, emissiveIntensity: 0.3 });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.set(x, y, z);
        
        return {
            mesh: panel,
            type: 'power_panel',
            position: panel.position.clone(),
            objective: true,
            activate: function() {
                console.log('Power restored');
                this.mesh.material.emissive.setHex(0x00ff00);
                this.mesh.material.emissiveIntensity = 0.8;
            }
        };
    }
    
    createServerTerminal(x, y, z) {
        const terminalGeometry = new THREE.BoxGeometry(1, 0.8, 0.3);
        const terminalMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x003300, emissiveIntensity: 0.2 });
        const terminal = new THREE.Mesh(terminalGeometry, terminalMaterial);
        terminal.position.set(x, y, z);
        
        return {
            mesh: terminal,
            type: 'terminal',
            position: terminal.position.clone(),
            objective: true,
            activate: function() {
                console.log('Security system activated');
                this.mesh.material.emissive.setHex(0x006600);
                this.mesh.material.emissiveIntensity = 0.6;
            }
        };
    }
    
    createExitDoor(x, y, z) {
        const doorGeometry = new THREE.BoxGeometry(2, 2.5, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0x003300, emissiveIntensity: 0.3 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(x, y, z);
        
        return {
            mesh: door,
            type: 'door',
            position: door.position.clone(),
            locked: false,
            requiredItem: null,
            toggle: function() {
                console.log('Exit door opened');
                this.mesh.rotation.y = Math.PI / 2;
            }
        };
    }
    
    createLabEquipment(x, y, z) {
        const tableGeometry = new THREE.BoxGeometry(2, 0.8, 1);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
        
        for (let i = 0; i < 3; i++) {
            const table = new THREE.Mesh(tableGeometry, tableMaterial);
            table.position.set(x + (i - 1) * 2.5, y + 0.4, z + 2);
            this.scene.add(table);
            this.objects.push(table);
        }
    }
    
    createStorageItems(x, y, z) {
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x664422 });
        
        for (let i = 0; i < 4; i++) {
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            box.position.set(x + (Math.random() - 0.5) * 4, y + 0.5, z + (Math.random() - 0.5) * 4);
            box.rotation.y = Math.random() * Math.PI;
            this.scene.add(box);
            this.objects.push(box);
        }
    }
    
    addLighting() {
        const startLight = new THREE.PointLight(0xffaa44, 1, 15);
        startLight.position.set(0, 3, 5);
        this.scene.add(startLight);
        this.objects.push(startLight);
        
        for (let i = -8; i <= 8; i += 4) {
            const corridorLight = new THREE.PointLight(0xff6644, 0.7, 12);
            corridorLight.position.set(i, 3, 0);
            this.scene.add(corridorLight);
            this.objects.push(corridorLight);
            
            if (Math.random() > 0.7) this.addFlickerEffect(corridorLight);
        }
        
        const labLight1 = new THREE.PointLight(0x44aaff, 0.8, 15);
        labLight1.position.set(-15, 3, 0);
        this.scene.add(labLight1);
        this.objects.push(labLight1);
        
        const labLight2 = new THREE.PointLight(0x44aaff, 0.6, 12);
        labLight2.position.set(-15, 3, 3);
        this.scene.add(labLight2);
        this.objects.push(labLight2);
        
        const emergencyLight1 = new THREE.PointLight(0xff0000, 0.5, 10);
        emergencyLight1.position.set(15, 3, -10);
        this.scene.add(emergencyLight1);
        this.objects.push(emergencyLight1);
        
        const emergencyLight2 = new THREE.PointLight(0xff0000, 0.5, 10);
        emergencyLight2.position.set(0, 3, -25);
        this.scene.add(emergencyLight2);
        this.objects.push(emergencyLight2);
        
        const serverLight = new THREE.PointLight(0x00ff44, 0.6, 12);
        serverLight.position.set(15, 3, 5);
        this.scene.add(serverLight);
        this.objects.push(serverLight);
    }
    
    addFlickerEffect(light) {
        const originalIntensity = light.intensity;
        
        setInterval(() => {
            if (Math.random() > 0.8) {
                light.intensity = originalIntensity * (0.3 + Math.random() * 0.7);
                setTimeout(() => { light.intensity = originalIntensity; }, 100 + Math.random() * 200);
            }
        }, 2000 + Math.random() * 3000);
    }
    
    addAtmosphericEffects() {
        const particleCount = 100;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 50;
            positions[i + 1] = Math.random() * 4;
            positions[i + 2] = (Math.random() - 0.5) * 50;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xaaaaaa,
            size: 0.05,
            transparent: true,
            opacity: 0.3
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(particles);
        this.objects.push(particles);
        
        this.animateParticles(particles);
    }
    
    animateParticles(particles) {
        const positions = particles.geometry.attributes.position.array;
        
        const animate = () => {
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] += 0.001;
                if (positions[i + 1] > 4) positions[i + 1] = 0;
            }
            
            particles.geometry.attributes.position.needsUpdate = true;
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    getObjects() { return this.objects; }
    getInteractables() { return this.interactables; }
    
    dispose() {
        this.objects.forEach(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(mat => mat.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
    }
}

// Monster Class
class Monster {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.position = new THREE.Vector3(20, 0, -20);
        this.rotation = 0;
        
        this.createMonsterModel();
    }
    
    createMonsterModel() {
        this.mesh = new THREE.Group();
        
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
        
        const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.6, 3, 8);
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5;
        this.mesh.add(body);
        
        const headGeometry = new THREE.ConeGeometry(0.5, 1.2, 6);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 3.2;
        this.mesh.add(head);
        
        const eyeGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.2, 3.3, 0.3);
        this.mesh.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.2, 3.3, 0.3);
        this.mesh.add(rightEye);
        
        const armGeometry = new THREE.CylinderGeometry(0.15, 0.1, 2, 6);
        
        const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
        leftArm.position.set(-0.8, 2, 0);
        leftArm.rotation.z = 0.3;
        this.mesh.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
        rightArm.position.set(0.8, 2, 0);
        rightArm.rotation.z = -0.3;
        this.mesh.add(rightArm);
        
        const legGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1.5, 6);
        
        const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        leftLeg.position.set(-0.3, 0.75, 0);
        this.mesh.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        rightLeg.position.set(0.3, 0.75, 0);
        this.mesh.add(rightLeg);
        
        this.mesh.position.copy(this.position);
        this.scene.add(this.mesh);
        
        this.bodyParts = { body, head, leftArm, rightArm, leftLeg, rightLeg };
        
        this.animationTime = 0;
        this.isMoving = false;
    }
    
    setPosition(x, y, z) {
        this.position.set(x, y, z);
        this.mesh.position.copy(this.position);
    }
    
    getPosition() { return this.position.clone(); }
    
    setRotation(rotation) {
        this.rotation = rotation;
        this.mesh.rotation.y = rotation;
    }
    
    update(deltaTime, targetPosition = null) {
        this.animationTime += deltaTime;
        
        if (this.isMoving && targetPosition) {
            const walkSpeed = 8;
            const armSwing = Math.sin(this.animationTime * walkSpeed) * 0.3;
            const legSwing = Math.sin(this.animationTime * walkSpeed) * 0.4;
            
            this.bodyParts.leftArm.rotation.x = armSwing;
            this.bodyParts.rightArm.rotation.x = -armSwing;
            this.bodyParts.leftLeg.rotation.x = legSwing;
            this.bodyParts.rightLeg.rotation.x = -legSwing;
            
            this.mesh.position.y = this.position.y + Math.abs(Math.sin(this.animationTime * walkSpeed * 2)) * 0.1;
        } else {
            const breatheSpeed = 2;
            const breatheAmount = 0.05;
            
            this.bodyParts.body.scale.y = 1 + Math.sin(this.animationTime * breatheSpeed) * breatheAmount;
            this.bodyParts.head.position.y = 3.2 + Math.sin(this.animationTime * breatheSpeed) * breatheAmount * 0.5;
        }
        
        if (targetPosition) {
            const direction = new THREE.Vector3().subVectors(targetPosition, this.position);
            direction.y = 0;
            if (direction.length() > 0.1) {
                const targetRotation = Math.atan2(direction.x, direction.z);
                this.setRotation(targetRotation);
            }
        }
    }
    
    dispose() {
        if (this.mesh) this.scene.remove(this.mesh);
    }
}

// Monster AI Class
class MonsterAI {
    constructor(monster, playerController, scene) {
        this.monster = monster;
        this.playerController = playerController;
        this.scene = scene;
        
        this.state = 'PATROL';
        this.stateTimer = 0;
        this.lastKnownPlayerPosition = null;
        this.detectionCooldown = 0;
        
        this.patrolPoints = [
            new THREE.Vector3(10, 0, -5),
            new THREE.Vector3(-10, 0, -5),
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(15, 0, 0),
            new THREE.Vector3(-15, 0, 0)
        ];
        this.currentPatrolIndex = 0;
        
        this.detectionDistance = 15;
        this.hearingDistance = 20;
        this.fieldOfView = Math.PI * 2/3;
        
        this.moveSpeed = 3.5;
        this.chaseSpeed = 6.5;
        this.searchTime = 15;
        this.lostPlayerTime = 10;
        
        this.soundSystem = null;
    }
    
    setSoundSystem(soundSystem) { this.soundSystem = soundSystem; }
    
    update(deltaTime) {
        if (!this.monster || !this.playerController) return;
        
        const playerPos = this.playerController.getPosition();
        const monsterPos = this.monster.getPosition();
        const distanceToPlayer = playerPos.distanceTo(monsterPos);
        
        this.stateTimer += deltaTime;
        
        if (this.detectionCooldown > 0) this.detectionCooldown -= deltaTime;
        
        switch (this.state) {
            case 'IDLE': this.updateIdle(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
            case 'PATROL': this.updatePatrol(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
            case 'INVESTIGATE': this.updateInvestigate(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
            case 'SEARCH': this.updateSearch(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
            case 'CHASE': this.updateChase(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
            case 'ATTACK': this.updateAttack(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
            case 'LOST_PLAYER': this.updateLostPlayer(deltaTime, monsterPos, playerPos, distanceToPlayer); break;
        }
        
        this.monster.update(deltaTime, this.getTargetPosition());
    }
    
    updateIdle(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        if (this.stateTimer > 3 + Math.random() * 5) {
            this.state = 'PATROL';
            this.stateTimer = 0;
        }
        
        if (this.canDetectPlayer(monsterPos, playerPos, distanceToPlayer)) this.detectPlayer(playerPos);
    }
    
    updatePatrol(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        const targetPoint = this.patrolPoints[this.currentPatrolIndex];
        const distanceToTarget = monsterPos.distanceTo(targetPoint);
        
        if (distanceToTarget < 2) {
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;
            this.stateTimer = 0;
        } else {
            this.moveToPosition(targetPoint, this.moveSpeed * deltaTime);
        }
        
        if (this.canDetectPlayer(monsterPos, playerPos, distanceToPlayer)) this.detectPlayer(playerPos);
        
        if (this.canHearPlayer(playerPos, monsterPos, distanceToPlayer)) {
            this.lastKnownPlayerPosition = playerPos.clone();
            this.state = 'INVESTIGATE';
            this.stateTimer = 0;
        }
    }
    
    updateInvestigate(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        if (!this.lastKnownPlayerPosition) {
            this.state = 'PATROL';
            this.stateTimer = 0;
            return;
        }
        
        const distanceToLastKnown = monsterPos.distanceTo(this.lastKnownPlayerPosition);
        
        if (distanceToLastKnown < 2) {
            this.state = 'SEARCH';
            this.stateTimer = 0;
        } else {
            this.moveToPosition(this.lastKnownPlayerPosition, this.moveSpeed * deltaTime);
        }
        
        if (this.canDetectPlayer(monsterPos, playerPos, distanceToPlayer)) this.detectPlayer(playerPos);
    }
    
    updateSearch(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        if (this.stateTimer > this.searchTime) {
            this.state = 'PATROL';
            this.stateTimer = 0;
            this.lastKnownPlayerPosition = null;
        }
        
        if (this.stateTimer % 3 < 0.1) {
            const randomOffset = new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10);
            const searchPos = this.lastKnownPlayerPosition.clone().add(randomOffset);
            this.moveToPosition(searchPos, this.moveSpeed * deltaTime * 0.5);
        }
        
        if (this.canDetectPlayer(monsterPos, playerPos, distanceToPlayer)) this.detectPlayer(playerPos);
    }
    
    updateChase(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        this.moveToPosition(playerPos, this.chaseSpeed * deltaTime);
        
        if (distanceToPlayer < 2.5) {
            this.state = 'ATTACK';
            this.stateTimer = 0;
        }
        
        if (!this.canDetectPlayer(monsterPos, playerPos, distanceToPlayer)) {
            this.lastKnownPlayerPosition = playerPos.clone();
            this.state = 'LOST_PLAYER';
            this.stateTimer = 0;
        }
    }
    
    updateAttack(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        if (this.stateTimer > 1.5) {
            if (distanceToPlayer < 2.5) {
                // Player died
            } else {
                this.state = 'SEARCH';
                this.stateTimer = 0;
            }
        }
    }
    
    updateLostPlayer(deltaTime, monsterPos, playerPos, distanceToPlayer) {
        if (this.stateTimer > this.lostPlayerTime) {
            this.state = 'PATROL';
            this.stateTimer = 0;
            this.lastKnownPlayerPosition = null;
        } else {
            if (this.lastKnownPlayerPosition) {
                const searchRadius = 5;
                const angle = this.stateTimer * 0.5;
                const searchPos = new THREE.Vector3(
                    this.lastKnownPlayerPosition.x + Math.cos(angle) * searchRadius,
                    0,
                    this.lastKnownPlayerPosition.z + Math.sin(angle) * searchRadius
                );
                this.moveToPosition(searchPos, this.moveSpeed * deltaTime * 0.7);
            }
        }
        
        if (this.canDetectPlayer(monsterPos, playerPos, distanceToPlayer)) this.detectPlayer(playerPos);
    }
    
    canDetectPlayer(monsterPos, playerPos, distance) {
        if (distance > this.detectionDistance) return false;
        
        const direction = new THREE.Vector3().subVectors(playerPos, monsterPos);
        direction.y = 0;
        direction.normalize();
        
        const monsterDirection = new THREE.Vector3(Math.sin(this.monster.rotation), 0, Math.cos(this.monster.rotation));
        
        const angle = direction.angleTo(monsterDirection);
        if (angle > this.fieldOfView / 2) return false;
        
        return true;
    }
    
    canHearPlayer(playerPos, monsterPos, distance) {
        if (distance > this.hearingDistance) return false;
        if (!this.playerController.isRunning) return false;
        return true;
    }
    
    detectPlayer(playerPos) {
        if (this.detectionCooldown > 0) return;
        
        this.lastKnownPlayerPosition = playerPos.clone();
        this.state = 'CHASE';
        this.stateTimer = 0;
        this.detectionCooldown = 8;
        
        if (this.soundSystem) this.soundSystem.playDetectionSound();
        
        console.log('Monster detected player!');
    }
    
    moveToPosition(targetPos, speed) {
        const currentPos = this.monster.getPosition();
        const direction = new THREE.Vector3().subVectors(targetPos, currentPos);
        direction.y = 0;
        
        if (direction.length() > 0.1) {
            direction.normalize();
            
            const movement = direction.multiplyScalar(speed);
            const newPos = currentPos.add(movement);
            
            newPos.x = Math.max(-45, Math.min(45, newPos.x));
            newPos.z = Math.max(-45, Math.min(45, newPos.z));
            
            this.monster.setPosition(newPos.x, newPos.y, newPos.z);
            this.monster.isMoving = true;
        } else {
            this.monster.isMoving = false;
        }
    }
    
    getTargetPosition() {
        switch (this.state) {
            case 'CHASE': case 'ATTACK': return this.playerController.getPosition();
            case 'INVESTIGATE': case 'SEARCH': case 'LOST_PLAYER': return this.lastKnownPlayerPosition;
            case 'PATROL': return this.patrolPoints[this.currentPatrolIndex];
            default: return null;
        }
    }
}

// Sound System Class
class SoundSystem {
    constructor(audioContext, soundsConfig, settings) {
        this.audioContext = audioContext;
        this.soundsConfig = soundsConfig;
        this.settings = settings;
        
        this.masterVolume = settings.masterVolume;
        this.monsterVolume = settings.monsterVolume;
        this.environmentVolume = settings.environmentVolume;
        
        this.cooldowns = {};
        
        this.initProceduralSounds();
    }
    
    initProceduralSounds() {
        this.proceduralSounds = {
            detection: this.generateDetectionSounds(),
            breathing: null,
            footsteps: null
        };
    }
    
    generateDetectionSounds() {
        const variants = [];
        const variantCount = this.soundsConfig?.monster?.sounds?.detection?.variants || 3;
        
        for (let i = 0; i < variantCount; i++) {
            variants.push(this.createDetectionSound(i));
        }
        
        return variants;
    }
    
    createDetectionSound(variant = 0) {
        const duration = 1.5;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        const baseFreq = 80 + variant * 20;
        const modulationFreq = 5 + variant * 2;
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            
            const layer1 = Math.sin(2 * Math.PI * baseFreq * t) * 0.3;
            const layer2 = Math.sin(2 * Math.PI * (baseFreq * 2 + Math.sin(2 * Math.PI * modulationFreq * t) * 50) * t) * 0.2;
            const layer3 = t < 0.3 ? Math.sin(2 * Math.PI * (baseFreq * 4 + Math.random() * 200) * t) * (0.3 - t) * 0.4 : 0;
            const noise = (Math.random() - 0.5) * 0.1 * Math.exp(-t * 3);
            
            const envelope = Math.exp(-t * 2) * (1 - Math.exp(-t * 20));
            data[i] = (layer1 + layer2 + layer3 + noise) * envelope;
        }
        
        return buffer;
    }
    
    playDetectionSound() {
        if (this.cooldowns.detection && this.cooldowns.detection > Date.now()) return;
        
        const cooldownTime = this.soundsConfig?.monster?.sounds?.detection?.cooldown || 8;
        this.cooldowns.detection = Date.now() + cooldownTime * 1000;
        
        const variant = Math.floor(Math.random() * this.proceduralSounds.detection.length);
        const buffer = this.proceduralSounds.detection[variant];
        
        this.playBuffer(buffer, this.monsterVolume * this.masterVolume);
    }
    
    playBuffer(buffer, volume = 1.0) {
        if (!buffer || !this.audioContext) return;
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        gainNode.gain.value = volume;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start();
        
        source.onended = () => {
            source.disconnect();
            gainNode.disconnect();
        };
    }
    
    playBreathingSound() {
        const duration = 2;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const breathCycle = Math.sin(2 * Math.PI * 0.5 * t);
            const noise = (Math.random() - 0.5) * 0.1;
            data[i] = (breathCycle * 0.3 + noise) * Math.exp(-t * 0.5);
        }
        
        this.playBuffer(buffer, this.monsterVolume * this.masterVolume * 0.4);
    }
    
    playFootstepSound(isHeavy = false) {
        const duration = 0.2;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        const baseFreq = isHeavy ? 60 : 100;
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const impact = Math.exp(-t * 30) * Math.sin(2 * Math.PI * baseFreq * t);
            const noise = (Math.random() - 0.5) * 0.2 * Math.exp(-t * 20);
            data[i] = (impact + noise) * 0.3;
        }
        
        this.playBuffer(buffer, this.masterVolume * 0.3);
    }
    
    playDoorSound() {
        const duration = 0.5;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const creak = Math.sin(2 * Math.PI * 200 * t * (1 - t)) * Math.exp(-t * 5);
            const metal = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 10) * 0.3;
            data[i] = (creak + metal) * 0.4;
        }
        
        this.playBuffer(buffer, this.environmentVolume * this.masterVolume);
    }
    
    playTerminalSound() {
        const duration = 0.3;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const beep = Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-t * 15);
            const click = Math.random() > 0.7 ? (Math.random() - 0.5) * 0.2 : 0;
            data[i] = (beep + click) * 0.3;
        }
        
        this.playBuffer(buffer, this.environmentVolume * this.masterVolume);
    }
    
    playPickupSound() {
        const duration = 0.2;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const chime = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 20);
            data[i] = chime * 0.3;
        }
        
        this.playBuffer(buffer, this.environmentVolume * this.masterVolume);
    }
    
    playPowerSound() {
        const duration = 1.0;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const hum = Math.sin(2 * Math.PI * 60 * t) * 0.2;
            const surge = t < 0.2 ? Math.sin(2 * Math.PI * 200 * t) * (0.2 - t) * 0.5 : 0;
            const spark = Math.random() > 0.9 ? (Math.random() - 0.5) * 0.3 : 0;
            data[i] = (hum + surge + spark) * Math.exp(-t * 2);
        }
        
        this.playBuffer(buffer, this.environmentVolume * this.masterVolume);
    }
    
    playDeathSound() {
        const duration = 2.0;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const scream = Math.sin(2 * Math.PI * (400 + Math.sin(2 * Math.PI * 10 * t) * 200) * t) * Math.exp(-t * 1.5);
            const growl = Math.sin(2 * Math.PI * 80 * t) * 0.3;
            const noise = (Math.random() - 0.5) * 0.2 * Math.exp(-t * 2);
            data[i] = (scream + growl + noise) * 0.5;
        }
        
        this.playBuffer(buffer, this.masterVolume);
    }
    
    playVictorySound() {
        const duration = 3.0;
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            const t = i / sampleRate;
            const melody = Math.sin(2 * Math.PI * 440 * t) * 0.2 + 
                          Math.sin(2 * Math.PI * 554 * t) * 0.15 + 
                          Math.sin(2 * Math.PI * 659 * t) * 0.1;
            const pad = Math.sin(2 * Math.PI * 220 * t) * 0.1;
            data[i] = (melody + pad) * Math.min(t * 2, 1) * Math.exp(-t * 0.5);
        }
        
        this.playBuffer(buffer, this.masterVolume * 0.7);
    }
    
    setMasterVolume(volume) { this.masterVolume = volume; }
    setMonsterVolume(volume) { this.monsterVolume = volume; }
    setEnvironmentVolume(volume) { this.environmentVolume = volume; }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    window.game = new DREADGame();
});