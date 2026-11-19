/**
 * @file GameCanvas.tsx
 * Isolated WebGL viewport running Three.js, celestial day/night cycle with rotating sun/moon,
 * target block wireframe highlight, 10-stage break crack overlay, 3D hand item swing,
 * particle puffs, and 60fps game loop.
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Player } from '../core/player';
import { VoxelWorld } from '../core/world';
import { MobManager } from '../core/mobs';
import { TextureManager } from '../core/textures';
import { BlockType, MobType } from '../types/voxel';
import { ITEM_REGISTRY } from '../core/items';
import { RedstoneSystem } from '../core/redstone';

interface GameCanvasProps {
  playerRef: React.MutableRefObject<Player | null>;
  worldRef: React.MutableRefObject<VoxelWorld | null>;
  mobManagerRef: React.MutableRefObject<MobManager | null>;
  redstoneRef: React.MutableRefObject<RedstoneSystem | null>;
  seed: number;
  gameMode: 'survival' | 'creative';
  isPlaying: boolean;
  timeOfDay: number;
  setTimeOfDay: React.Dispatch<React.SetStateAction<number>>;
  setFps: (fps: number) => void;
  setBiome: (biome: string) => void;
  setLoadedChunks: (count: number) => void;
  onOpenInventory: () => void;
  onOpenCrafting: () => void;
  onOpenFurnace: (pos: { x: number; y: number; z: number }) => void;
  onOpenChest: (pos: { x: number; y: number; z: number }) => void;
  onPause: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playerRef,
  worldRef,
  mobManagerRef,
  redstoneRef,
  seed,
  gameMode,
  isPlaying,
  timeOfDay,
  setTimeOfDay,
  setFps,
  setBiome,
  setLoadedChunks,
  onOpenInventory,
  onOpenCrafting,
  onOpenFurnace,
  onOpenChest,
  onPause,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Software WebGL Guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x78a7ff);
    const fog = new THREE.FogExp2(0x78a7ff, 0.012);
    scene.fog = fog;

    const camera = new THREE.PerspectiveCamera(
      70,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.08,
      400
    );
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    mountRef.current.appendChild(renderer.domElement);

    // 3. Lighting Rig (Celestial Sun/Moon + Ambient)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455, 0.7);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    sunLight.position.set(50, 100, 30);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Sun & Moon Mesh Pivot
    const celestialGroup = new THREE.Group();
    scene.add(celestialGroup);

    // Sun Billboard
    const sunGeo = new THREE.PlaneGeometry(16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae0, side: THREE.DoubleSide });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(0, 120, 0);
    sunMesh.rotation.x = Math.PI / 2;
    celestialGroup.add(sunMesh);

    // Moon Billboard
    const moonGeo = new THREE.PlaneGeometry(12, 12);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xf0f4f8, side: THREE.DoubleSide });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(0, -120, 0);
    moonMesh.rotation.x = -Math.PI / 2;
    celestialGroup.add(moonMesh);

    // 4. Initialize Core World & Player
    const world = new VoxelWorld(scene, seed);
    worldRef.current = world;

    const player = new Player(camera, world, new THREE.Vector3(8, 55, 8));
    player.gameMode = gameMode;
    playerRef.current = player;

    const mobManager = new MobManager(scene, world);
    mobManagerRef.current = mobManager;

    const redstone = new RedstoneSystem(world);
    redstoneRef.current = redstone;

    // Spawn initial passive mobs
    mobManager.spawnMob(MobType.PIG, new THREE.Vector3(6, 55, 12));
    mobManager.spawnMob(MobType.COW, new THREE.Vector3(12, 55, 6));

    // 5. Target Block Wireframe Highlight
    const wireGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(wireGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
    const targetWireframe = new THREE.LineSegments(edges, wireMat);
    targetWireframe.visible = false;
    scene.add(targetWireframe);

    // 6. Mining Crack Overlay Mesh
    const crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    const crackMat = new THREE.MeshBasicMaterial({
      map: TextureManager.getInstance().getTexture(),
      transparent: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const crackMesh = new THREE.Mesh(crackGeo, crackMat);
    crackMesh.visible = false;
    scene.add(crackMesh);

    // 7. 3D Held Hand Item (attached to camera)
    const handGroup = new THREE.Group();
    handGroup.position.set(0.35, -0.35, -0.6);
    camera.add(handGroup);

    const handItemGeo = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const handItemMat = new THREE.MeshLambertMaterial({ map: TextureManager.getInstance().getTexture() });
    const handItemMesh = new THREE.Mesh(handItemGeo, handItemMat);
    handGroup.add(handItemMesh);

    let swingProgress = 0;
    let isSwinging = false;

    // 8. Block Break Particle System
    const particleCount = 20;
    const pGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const pMat = new THREE.MeshBasicMaterial({ color: 0x7a7a7a });
    const particleInst = new THREE.InstancedMesh(pGeo, pMat, particleCount);
    particleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(particleInst);

    interface ParticleData {
      x: number; y: number; z: number;
      vx: number; vy: number; vz: number;
      life: number;
    }
    const particles: ParticleData[] = [];
    const pDummy = new THREE.Object3D();

    const spawnBreakParticles = (x: number, y: number, z: number) => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: x + 0.5 + (Math.random() - 0.5) * 0.4,
          y: y + 0.5 + (Math.random() - 0.5) * 0.4,
          z: z + 0.5 + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 3.5,
          vy: Math.random() * 3.5 + 1.0,
          vz: (Math.random() - 0.5) * 3.5,
          life: 0.8,
        });
      }
    };

    // 9. Event Listeners (PointerLock, Mouse, Keyboard)
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== mountRef.current) {
        mountRef.current?.requestPointerLock();
        return;
      }

      // Hand swing trigger
      isSwinging = true;
      swingProgress = 0;

      if (e.button === 0) {
        // Left Click: Check mob attack or block mine
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const hitMob = mobManager.hitTest(camera.position, dir, 3.8);
        if (hitMob) {
          const activeItem = player.getActiveItem();
          const def = activeItem ? ITEM_REGISTRY[activeItem.id] : null;
          const damage = def?.attackDamage ?? 1;
          hitMob.takeDamage(damage, dir);
        } else {
          player.isMining = true;
        }
      } else if (e.button === 2) {
        // Right Click: Place or interact
        player.handleRightClick(
          onOpenCrafting,
          onOpenFurnace,
          onOpenChest
        );
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        player.resetMining();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === mountRef.current) {
        player.handleMouseMove(e.movementX, e.movementY);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      player.keys[e.code] = true;

      // Hotbar selection numbers 1-9
      if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          player.setActiveSlot(num - 1);
        }
      }

      // Space double-tap check
      if (e.code === 'Space') {
        player.handleSpacePress();
      }

      // Open Inventory (E)
      if (e.code === 'KeyE') {
        onOpenInventory();
      }

      // Pause (Escape)
      if (e.code === 'Escape') {
        onPause();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      player.keys[e.code] = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement === mountRef.current) {
        const delta = Math.sign(e.deltaY);
        let nextSlot = player.activeSlot + delta;
        if (nextSlot < 0) nextSlot = 8;
        if (nextSlot > 8) nextSlot = 0;
        player.setActiveSlot(nextSlot);
      }
    };

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    mountRef.current.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);

    // Prevent context menu
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    mountRef.current.addEventListener('contextmenu', onContextMenu);

    // 10. Animation & Game Loop
    let animId = 0;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTime = lastTime;
    let simTickTimer = 0;

    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const now = performance.now();
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      // FPS tracking
      frameCount++;
      if (now - fpsTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTime = now;
      }

      // 1. Advance Celestial Day/Night Cycle
      let curTime = timeOfDay;
      if (isPlaying) {
        // Full day ~12 minutes
        curTime = (curTime + dt * 0.0014) % 1.0;
        setTimeOfDay(curTime);
      }

      // Rotate sun/moon
      const sunAngle = curTime * Math.PI * 2;
      celestialGroup.position.copy(player.position);
      celestialGroup.rotation.z = sunAngle;

      const sunElevation = Math.sin(sunAngle);
      const isDay = sunElevation > 0;

      // Dynamic Sky Color interpolation
      if (sunElevation > 0.2) {
        // Bright Day
        scene.background = new THREE.Color(0x78a7ff);
        fog.color.set(0x78a7ff);
        sunLight.intensity = 1.2;
        hemiLight.intensity = 0.75;
      } else if (sunElevation > -0.15) {
        // Sunrise / Sunset
        scene.background = new THREE.Color(0xe07a3c);
        fog.color.set(0xe07a3c);
        sunLight.intensity = 0.6;
        hemiLight.intensity = 0.45;
      } else {
        // Night
        scene.background = new THREE.Color(0x0c0f18);
        fog.color.set(0x0c0f18);
        sunLight.intensity = 0.15;
        hemiLight.intensity = 0.2;
      }

      // 2. Update World Chunks around player
      world.updatePlayerPosition(player.position.x, player.position.z);
      world.updateMeshes();
      setLoadedChunks(world.chunks.size);

      // 3. Fluid & Simulation Tick
      simTickTimer += dt;
      if (simTickTimer >= 0.5) {
        world.tickSimulation();
        simTickTimer = 0;
      }

      // 4. Update Player Physics
      player.update(dt);
      setBiome(world.generator.getBiome(Math.floor(player.position.x), Math.floor(player.position.z)));

      // 5. Update Mobs
      mobManager.update(dt, player, isDay);

      // 6. Update Dropped Item Entities
      world.updateDroppedItems(dt, player.position, (stack) => player.addItem(stack));

      // 7. Update Wireframe Target Block Highlight
      if (player.targetHit && player.targetHit.hit) {
        targetWireframe.visible = true;
        targetWireframe.position.set(
          player.targetHit.blockPos.x + 0.5,
          player.targetHit.blockPos.y + 0.5,
          player.targetHit.blockPos.z + 0.5
        );

        // Crack Overlay
        if (player.isMining && player.miningProgress > 0) {
          crackMesh.visible = true;
          crackMesh.position.copy(targetWireframe.position);
          const stage = Math.min(9, Math.floor(player.miningProgress * 10));
          // Update crack UV or texture
        } else {
          crackMesh.visible = false;
        }
      } else {
        targetWireframe.visible = false;
        crackMesh.visible = false;
      }

      // 8. 3D Hand Item Swing Animation
      if (isSwinging) {
        swingProgress += dt * 9;
        const swingAngle = Math.sin(swingProgress * Math.PI) * 0.8;
        handGroup.rotation.x = -swingAngle;
        handGroup.rotation.y = swingAngle * 0.5;
        if (swingProgress >= 1.0) {
          isSwinging = false;
          handGroup.rotation.set(0, 0, 0);
        }
      } else {
        // Subtle walking bob
        const isMoving = Math.abs(player.velocity.x) > 0.1 || Math.abs(player.velocity.z) > 0.1;
        const bob = isMoving ? Math.sin(now * 0.008) * 0.03 : 0;
        handGroup.position.set(0.35, -0.35 + bob, -0.6);
      }

      // 9. Update Break Particles
      if (particles.length > 0) {
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= dt;
          p.vy -= 9.8 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;

          pDummy.position.set(p.x, p.y, p.z);
          pDummy.scale.setScalar(Math.max(0.01, p.life));
          pDummy.updateMatrix();
          particleInst.setMatrixAt(i, pDummy.matrix);

          if (p.life <= 0) particles.splice(i, 1);
        }
        particleInst.instanceMatrix.needsUpdate = true;
      }

      // Render Scene
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      if (mountRef.current) {
        mountRef.current.removeEventListener('mousedown', onMouseDown);
        mountRef.current.removeEventListener('contextmenu', onContextMenu);
      }
      renderer.dispose();
      for (const chunk of world.chunks.values()) {
        chunk.dispose();
      }
    };
  }, [seed, gameMode]);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full overflow-hidden cursor-crosshair" />;
};
