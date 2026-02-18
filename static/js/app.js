import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class AvatarViewer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mixer = null;
        this.clock = new THREE.Clock();
        this.currentModel = null;
        this.animations = {};
        this.currentAnimation = null;
        this.idleAnimations = [];
        this.idleTimer = null;
        this.pollInterval = null;
        this.lastAnimationState = 'idle';
        this.lastEmotionState = 'neutral';
        this.lastModelState = 'robot';
        
        this.init();
    }
    
    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.2, 4);
        
        // Renderer
        const canvas = document.getElementById('avatar-canvas');
        this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Controls
        this.controls = new OrbitControls(this.camera, canvas);
        this.controls.target.set(0, 0.9, 0);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 1.5;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 10;
        
        // Lighting
        this.setupLighting();
        
        // Ground plane
        this.setupGround();
        
        // Load default model or create placeholder
        this.loadModel('/static/models/avatar.glb');
        
        // Start polling for state changes
        this.startPolling();
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
        
        // Start render loop
        this.animate();
    }
    
    setupLighting() {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        
        // Main directional light
        const mainLight = new THREE.DirectionalLight(0xffffff, 1);
        mainLight.position.set(5, 10, 5);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 50;
        mainLight.shadow.camera.left = -10;
        mainLight.shadow.camera.right = 10;
        mainLight.shadow.camera.top = 10;
        mainLight.shadow.camera.bottom = -10;
        this.scene.add(mainLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x7b68ee, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);
        
        // Rim light
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
        rimLight.position.set(0, 5, -10);
        this.scene.add(rimLight);
    }
    
    setupGround() {
        const groundGeometry = new THREE.CircleGeometry(5, 64);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a4a,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    async loadModelWithFallback(modelName) {
        // Try .glb first, then .gltf
        try {
            await this.loadModel(`/static/models/${modelName}.glb`);
        } catch (e) {
            console.log(`${modelName}.glb not found, trying .gltf...`);
            try {
                await this.loadModel(`/static/models/${modelName}.gltf`);
            } catch (e2) {
                console.error(`Could not load model ${modelName}:`, e2);
            }
        }
    }
    
    async loadModel(url) {
        const loader = new GLTFLoader();
        
        // Setup DRACO loader for compressed models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
        loader.setDRACOLoader(dracoLoader);
        
        const gltf = await loader.loadAsync(url);
        
        // Remove previous model
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        this.currentModel = gltf.scene;
        this.currentModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
        // Add model to scene first
        this.scene.add(this.currentModel);
        
        // Force scale to 1 and position at origin
        this.currentModel.scale.set(1, 1, 1);
        this.currentModel.position.set(0, 0, 0);
        
        // Set camera to a good default position for humanoid models
        this.camera.position.set(0, 2, 7);
        this.controls.target.set(0, 1.5, 0);
        this.controls.update();
        
        // Setup animations
        if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.currentModel);
            this.animations = {};
            
            gltf.animations.forEach((clip) => {
                this.animations[clip.name.toLowerCase()] = clip;
            });
            
            // Find idle animations
            this.idleAnimations = Object.keys(this.animations).filter(
                name => name.includes('idle')
            );
            
            // Start with idle if available
            if (this.idleAnimations.length > 0) {
                this.playAnimation(this.idleAnimations[0], true);
            } else if (Object.keys(this.animations).length > 0) {
                // Play first available animation as idle
                const firstAnim = Object.keys(this.animations)[0];
                this.playAnimation(firstAnim, true);
            }
            
            console.log('Available animations:', Object.keys(this.animations));
        }
        
        // Hide loading screen
        document.getElementById('loading').classList.add('hidden');
    }
    
    createPlaceholderAvatar() {
        // Create a simple placeholder avatar
        const group = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x7b68ee });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.9;
        body.castShadow = true;
        group.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 32, 32);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffdbac });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.65;
        head.castShadow = true;
        group.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.08, 1.7, 0.2);
        group.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.08, 1.7, 0.2);
        group.add(rightEye);
        
        this.currentModel = group;
        this.scene.add(this.currentModel);
        
        // Create simple idle animation
        this.startPlaceholderIdleAnimation();
    }
    
    startPlaceholderIdleAnimation() {
        // Simple bobbing animation for placeholder
        const animate = () => {
            if (this.currentModel && !this.mixer) {
                const time = this.clock.getElapsedTime();
                this.currentModel.position.y = Math.sin(time * 2) * 0.05;
                this.currentModel.rotation.y = Math.sin(time * 0.5) * 0.1;
            }
        };
        
        this.placeholderAnimation = animate;
    }
    
    playAnimation(name, loop = false) {
        const normalizedName = name.toLowerCase();
        
        if (!this.animations[normalizedName]) {
            console.warn(`Animation "${name}" not found`);
            return false;
        }
        
        // Fade out current animation
        if (this.currentAnimation) {
            this.currentAnimation.fadeOut(0.3);
        }
        
        // Play new animation
        const clip = this.animations[normalizedName];
        const action = this.mixer.clipAction(clip);
        
        action.reset();
        action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce);
        action.clampWhenFinished = !loop;
        action.fadeIn(0.3);
        action.play();
        
        this.currentAnimation = action;
        
        // If not looping, return to idle when done
        if (!loop) {
            const duration = clip.duration * 1000;
            setTimeout(() => {
                if (this.idleAnimations.length > 0) {
                    this.playAnimation(this.idleAnimations[0], true);
                }
            }, duration);
        }
        
        // Update UI
        document.getElementById('current-animation').textContent = name;
        
        return true;
    }
    
    setEmotion(name, intensity = 1.0) {
        // Update UI
        document.getElementById('current-emotion').textContent = name;
        
        // If model has morph targets, apply them here
        if (this.currentModel) {
            this.currentModel.traverse((child) => {
                if (child.isMesh && child.morphTargetInfluences) {
                    // Reset all morph targets
                    for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                        child.morphTargetInfluences[i] = 0;
                    }
                    
                    // Apply emotion morph target if it exists
                    const morphIndex = child.morphTargetDictionary?.[name];
                    if (morphIndex !== undefined) {
                        child.morphTargetInfluences[morphIndex] = intensity;
                    }
                }
            });
        }
    }
    
    async startPolling() {
        // Poll API for state changes every 500ms
        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/state');
                const state = await response.json();
                
                // Check for animation changes
                if (state.current_animation !== this.lastAnimationState) {
                    this.lastAnimationState = state.current_animation;
                    if (state.current_animation !== 'idle') {
                        this.playAnimation(state.current_animation, false);
                    }
                }
                
                // Check for emotion changes
                if (state.current_emotion !== this.lastEmotionState) {
                    this.lastEmotionState = state.current_emotion;
                    this.setEmotion(state.current_emotion);
                }
                
                // Check for model changes
                if (state.current_model !== this.lastModelState) {
                    this.lastModelState = state.current_model;
                    // Try .glb first, then .gltf
                    this.loadModelWithFallback(state.current_model);
                }
                
            } catch (error) {
                console.error('Failed to poll state:', error);
            }
        }, 500);
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        
        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(delta);
        }
        
        // Update placeholder animation
        if (this.placeholderAnimation) {
            this.placeholderAnimation();
        }
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize viewer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.avatarViewer = new AvatarViewer();
});
