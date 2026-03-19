// Copied and adapted from frontend/src/experience/initExperience.js
// Adaptation: all static assets are loaded from `assetBase` (default: "/dapp-assets/")

import * as THREE from "three";
import * as dat from "dat.gui";
import gsap from "gsap";
import Stats from "three/addons/libs/stats.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

let initialized = false;

export function initExperience(options = {}) {
  const { onSelectCandidate, onSelectBallotBox, onVoteComplete, assetBase = "/dapp-assets/" } = options;
  const A = (p) => `${assetBase}${p}`;

  const emitSelectCandidate = (id) => {
    onSelectCandidate?.(id);
    // backwards compatibility with earlier callback name
    onSelectBallotBox?.(id);
  };

  if (initialized) {
    return { dispose: () => {}, vote: async () => {} };
  }
  initialized = true;

  // VARIABLES
  let theme = "light";
  let bookCover = null;
  let lightSwitch = null;
  let titleText = null;
  let subtitleText = null;
  let mixer;
  let rafId = null;
  let isMobile = window.matchMedia("(max-width: 992px)").matches;
  const canvas = document.querySelector(".experience-canvas");
  const loaderWrapper = document.getElementById("loader-wrapper");
  let loadedRoomScene = null;
  let videoEl = null;
  let candidateCards = [];
  let hoveredCandidateId = null;
  let voteTarget = null;
  let ballotBoxGroup = null;
  let ballotBoxGlassMat = null;
  let ballotBoxFrameMat = null;
  let ballotBoxSlotTarget = null;
  let ballotBoxDropTarget = null;
  let ballotBoxBallotsGroup = null;
  let ballotBoxSpotLight = null;
  let ballotBoxHovered = false;
  let ballotBoxSize = 0.4;
  let roomFloorY = 0;
  let candidateWallX = null;
  let candidateCenterZ = null;
  let voteInFlight = false;

  if (!canvas) {
    initialized = false;
    return { dispose: () => {}, vote: async () => {} };
  }

  const clipNames = [
    "fan_rotation",
    "fan_rotation.001",
    "fan_rotation.002",
    "fan_rotation.003",
    "fan_rotation.004",
  ];

  const projects = [
    { image: A("textures/project-spaze.webp"), url: "https://www.spaze.social/" },
    { image: A("textures/project-myteachers.jpg"), url: "https://myteachers.com.au/" },
    { image: A("textures/project-wholesale.jpg"), url: "https://wholesale.com.np/" },
    { image: A("textures/project-pelotero.jpg"), url: "https://www.peloterosenlaweb.com/" },
  ];

  let aboutCameraPos = { x: 0.12, y: 0.2, z: 0.55 };
  let aboutCameraRot = { x: -1.54, y: 0.13, z: 1.41 };
  let projectsCameraPos = { x: 1, y: 0.45, z: 0.01 };
  let projectsCameraRot = { x: 0.05, y: 0.05, z: 0 };

  // SCENE & CAMERA
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
  const defaultCameraPos = {
    x: 1.009028643133046,
    y: 0.5463638814987481,
    z: 0.4983449671971262,
  };
  const defaultCamerRot = {
    x: -0.8313297556598935,
    y: 0.9383399492446749,
    z: 0.7240714481613063,
  };
  camera.position.set(defaultCameraPos.x, defaultCameraPos.y, defaultCameraPos.z);

  // RENDERER
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // CONTROLS
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 0.9;
  controls.maxDistance = 1.6;
  controls.minAzimuthAngle = 0.2;
  controls.maxAzimuthAngle = Math.PI * 0.78;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI / 2;
  controls.update();

  // LOAD MODEL & ASSET
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(A("draco/"));
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  // ADD LIGHT
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const roomLight = new THREE.PointLight(0xffffff, 2.5, 10);
  roomLight.position.set(0.3, 2, 0.5);
  roomLight.castShadow = true;
  roomLight.shadow.radius = 5;
  roomLight.shadow.mapSize.width = 2048;
  roomLight.shadow.mapSize.height = 2048;
  roomLight.shadow.camera.far = 2.5;
  roomLight.shadow.bias = -0.002;
  scene.add(roomLight);

  // add light for pc fans
  const fanLight1 = new THREE.PointLight(0xff0000, 30, 0.2);
  const fanLight2 = new THREE.PointLight(0x00ff00, 30, 0.12);
  const fanLight3 = new THREE.PointLight(0x00ff00, 30, 0.2);
  const fanLight4 = new THREE.PointLight(0x00ff00, 30, 0.2);
  const fanLight5 = new THREE.PointLight(0x00ff00, 30, 0.05);
  fanLight1.position.set(0, 0.29, -0.29);
  fanLight2.position.set(-0.15, 0.29, -0.29);
  fanLight3.position.set(0.21, 0.29, -0.29);
  fanLight4.position.set(0.21, 0.19, -0.29);
  fanLight5.position.set(0.21, 0.08, -0.29);
  scene.add(fanLight1, fanLight2, fanLight3, fanLight4, fanLight5);

  // add point light for text on wall
  const pointLight1 = new THREE.PointLight(0xff0000, 0, 1.1);
  const pointLight2 = new THREE.PointLight(0xff0000, 0, 1.1);
  const pointLight3 = new THREE.PointLight(0xff0000, 0, 1.1);
  const pointLight4 = new THREE.PointLight(0xff0000, 0, 1.1);
  pointLight1.position.set(-0.2, 0.6, 0.24);
  pointLight2.position.set(-0.2, 0.6, 0.42);
  pointLight3.position.set(-0.2, 0.6, 0.01);
  pointLight4.position.set(-0.2, 0.6, -0.14);
  scene.add(pointLight1, pointLight2, pointLight3, pointLight4);

  const clock = new THREE.Clock();
  function animate() {
    rafId = requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta());

    const t = clock.getElapsedTime();
    candidateCards.forEach((card, i) => {
      const base = card.userData._basePos;
      if (!base) return;
      if (card.userData._baseQuat) card.quaternion.copy(card.userData._baseQuat);
      card.position.y = base.y + Math.sin(t * 1.1 + i * 0.8) * 0.004;
    });

    renderer.render(scene, camera);
  }

  function getCandidateIdFromObject(obj) {
    let cur = obj;
    while (cur) {
      if (cur.userData?.candidateId) return cur.userData.candidateId;
      cur = cur.parent;
    }
    return null;
  }

  function createCandidateCardTexture({ name, subtitle, colorHex }) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const drawRoundRect = (x, y, w, h, r) => {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    };

    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "rgba(0, 255, 255, 0.18)");
    g.addColorStop(0.5, "rgba(0, 160, 255, 0.10)");
    g.addColorStop(1, "rgba(140, 0, 255, 0.14)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = `rgba(${(colorHex >> 16) & 255}, ${(colorHex >> 8) & 255}, ${colorHex & 255}, 0.85)`;
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    drawRoundRect(110, 140, canvas.width - 220, 420, 28);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "700 68px Poppins, system-ui, -apple-system, Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText(name, canvas.width / 2, 650);

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "500 34px Poppins, system-ui, -apple-system, Segoe UI, Arial";
    ctx.fillText(subtitle, canvas.width / 2, 712);

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#ffffff";
    for (let y = 0; y < canvas.height; y += 6) ctx.fillRect(0, y, canvas.width, 1);
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  function createNameTagTexture({ name, colorHex }) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = `rgba(${(colorHex >> 16) & 255}, ${(colorHex >> 8) & 255}, ${colorHex & 255}, 0.95)`;
    ctx.fillRect(0, 0, canvas.width, 10);

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "700 72px Poppins, system-ui, -apple-system, Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, canvas.width / 2, canvas.height / 2 + 8);

    const texture = new THREE.CanvasTexture(canvas);
    if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.needsUpdate = true;
    return texture;
  }

  const textureLoader = new THREE.TextureLoader();

  // Ballot box
  function createBallotBox(sceneArg) {
    const group = new THREE.Group();
    group.name = "ballotBoxGroup";

    const size = ballotBoxSize;
    const innerSize = size * 0.88;

    const wallX = candidateWallX ?? titleText?.position?.x ?? -0.27;
    const zCenter = candidateCenterZ ?? titleText?.position?.z ?? 0.5;
    group.position.set(wallX + 0.35, roomFloorY + size / 2, zCenter);

    const glassGeo = new THREE.BoxGeometry(size, size, size);
    ballotBoxGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      metalness: 0,
      transmission: 1,
      thickness: 0.5,
      ior: 1.45,
      transparent: true,
      opacity: 0.22,
      emissive: new THREE.Color(0x67e8f9),
      emissiveIntensity: 0.06,
      depthWrite: false,
    });
    const glass = new THREE.Mesh(glassGeo, ballotBoxGlassMat);
    glass.receiveShadow = true;
    group.add(glass);

    const lidGeo = new THREE.BoxGeometry(size * 1.02, size * 0.08, size * 1.02);
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.6,
      metalness: 0.15,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0,
    });
    const lid = new THREE.Mesh(lidGeo, lidMat);
    lid.position.y = size / 2 + (size * 0.08) / 2;
    lid.castShadow = true;
    lid.receiveShadow = true;
    group.add(lid);

    const slotGeo = new THREE.BoxGeometry(size * 0.35, size * 0.01, size * 0.08);
    const slotMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false });
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.position.set(0, size / 2 + size * 0.04 + 0.002, size * 0.08);
    group.add(slot);

    const frameGeo = new THREE.BoxGeometry(size * 1.01, size * 1.01, size * 1.01);
    ballotBoxFrameMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const frame = new THREE.Mesh(frameGeo, ballotBoxFrameMat);
    group.add(frame);

    ballotBoxBallotsGroup = new THREE.Group();
    ballotBoxBallotsGroup.name = "ballotBoxBallots";
    group.add(ballotBoxBallotsGroup);

    const ballotGeo = new THREE.PlaneGeometry(innerSize * 0.28, innerSize * 0.18);
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ballotGeo, mat);
      mesh.position.set((Math.random() - 0.5) * innerSize * 0.55, (Math.random() - 0.5) * innerSize * 0.55, (Math.random() - 0.5) * innerSize * 0.55);
      mesh.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.8);
      ballotBoxBallotsGroup.add(mesh);
    }

    ballotBoxSpotLight = new THREE.SpotLight(0xffffff, 2, 5, Math.PI / 7, 0.35, 1);
    ballotBoxSpotLight.position.set(group.position.x, group.position.y + 1.2, group.position.z);
    ballotBoxSpotLight.target = group;
    ballotBoxSpotLight.castShadow = false;
    sceneArg.add(ballotBoxSpotLight);
    sceneArg.add(ballotBoxSpotLight.target);

    group.userData.isBallotBox = true;
    sceneArg.add(group);
    return group;
  }

  function setBallotBoxHover(nextHovered) {
    if (!ballotBoxGroup || ballotBoxHovered === nextHovered) return;
    ballotBoxHovered = nextHovered;
    gsap.to(ballotBoxGroup.scale, { x: nextHovered ? 1.04 : 1, y: nextHovered ? 1.04 : 1, z: nextHovered ? 1.04 : 1, duration: 0.18, ease: "power2.out" });
    if (ballotBoxGlassMat) {
      const base = theme === "dark" ? 0.18 : 0.06;
      ballotBoxGlassMat.emissiveIntensity = nextHovered ? base + 0.08 : base;
    }
    if (ballotBoxFrameMat) {
      const base = theme === "dark" ? 0.32 : 0.22;
      ballotBoxFrameMat.opacity = nextHovered ? base + 0.08 : base;
    }
  }

  function spawnBallotInsideBox(color = 0xffffff) {
    if (!ballotBoxBallotsGroup) return;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.11, 0.07),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: theme === "dark" ? 0.35 : 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    mesh.position.set((Math.random() - 0.5) * 0.16, -0.12 + Math.random() * 0.14, (Math.random() - 0.5) * 0.16);
    mesh.rotation.set(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.8);
    ballotBoxBallotsGroup.add(mesh);
  }

  function createCandidateCard({ id, name, subtitle, color, image, position }) {
    const group = new THREE.Group();
    group.name = "candidateCard";
    group.userData.candidateId = id;
    group.position.copy(position);

    group.userData._baseStyle = { glowOpacity: 0.07, frameOpacity: 0.18, cardOpacity: 0.72, emissiveIntensity: 0.06, portraitOpacity: 0.9 };

    const glowGeo = new THREE.PlaneGeometry(0.52, 0.74);
    const glowMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.z = -0.002;
    glow.renderOrder = 0;
    glow.userData.candidateId = id;
    group.add(glow);

    if (image) {
      const portraitTex = textureLoader.load(image, (tex) => {
        const img = tex.image;
        if (!img?.width || !img?.height) return;

        const frameAspect = 1;
        const imgAspect = img.width / img.height;

        let repeatX = 1;
        let repeatY = 1;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > frameAspect) {
          repeatX = frameAspect / imgAspect;
          offsetX = (1 - repeatX) / 2;
        } else if (imgAspect < frameAspect) {
          repeatY = imgAspect / frameAspect;
          offsetY = (1 - repeatY) / 2;
        }

        tex.repeat.set(repeatX, repeatY);
        tex.offset.set(offsetX, offsetY);
        tex.needsUpdate = true;

        const cropped = repeatX < 0.999 || repeatY < 0.999;
        if (cropped && !group.userData._nameTag) {
          const tagTex = createNameTagTexture({ name, colorHex: color });
          if (tagTex) {
            const tagGeo = new THREE.PlaneGeometry(0.34, 0.07);
            const tagMat = new THREE.MeshBasicMaterial({ map: tagTex, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false });
            const tag = new THREE.Mesh(tagGeo, tagMat);
            tag.position.set(0, -0.04, 0.0016);
            tag.renderOrder = 4;
            tag.userData.candidateId = id;
            group.add(tag);
            group.userData._nameTag = tag;
          }
        }
      });
      if ("colorSpace" in portraitTex && THREE.SRGBColorSpace) portraitTex.colorSpace = THREE.SRGBColorSpace;
      portraitTex.anisotropy = 4;

      const portraitGeo = new THREE.PlaneGeometry(0.30, 0.24);
      const portraitMat = new THREE.MeshBasicMaterial({ map: portraitTex, transparent: true, opacity: group.userData._baseStyle.portraitOpacity, depthWrite: false, depthTest: false });
      const portrait = new THREE.Mesh(portraitGeo, portraitMat);
      portrait.position.set(0, 0.15, 0.002);
      portrait.renderOrder = 2;
      portrait.userData.candidateId = id;
      group.add(portrait);
      group.userData._portrait = portrait;
    }

    const tex = createCandidateCardTexture({ name, subtitle, colorHex: color });
    const cardGeo = new THREE.PlaneGeometry(0.44, 0.62);
    const cardMat = new THREE.MeshStandardMaterial({
      map: tex ?? null,
      emissiveMap: tex ?? null,
      color: 0xffffff,
      transparent: true,
      opacity: group.userData._baseStyle.cardOpacity,
      emissive: new THREE.Color(color),
      emissiveIntensity: group.userData._baseStyle.emissiveIntensity,
      roughness: 0.15,
      metalness: 0.0,
      blending: THREE.NormalBlending,
      depthWrite: true,
      alphaTest: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.renderOrder = 1;
    card.userData.candidateId = id;
    group.add(card);

    const frameGeo = new THREE.PlaneGeometry(0.46, 0.64);
    const frameMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: group.userData._baseStyle.frameOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.z = 0.0015;
    frame.renderOrder = 3;
    frame.userData.candidateId = id;
    group.add(frame);

    group.userData._glow = glow;
    group.userData._card = card;
    group.userData._frame = frame;
    group.userData._color = color;
    group.userData._name = name;
    group.userData._subtitle = subtitle;
    return group;
  }

  function createCandidateCards() {
    const wallX = titleText?.position?.x ?? -0.27;
    const zCenter = titleText?.position?.z ?? 0.5;
    const yRow = (titleText?.position?.y ?? 0.55) - 0.34;
    const xOffset = 0.03;
    const zSpacing = 0.56;

    const positions = {
      a: new THREE.Vector3(wallX + xOffset, yRow, zCenter + zSpacing),
      b: new THREE.Vector3(wallX + xOffset, yRow, zCenter),
      c: new THREE.Vector3(wallX + xOffset, yRow, zCenter - zSpacing),
    };

    candidateWallX = wallX;
    candidateCenterZ = (positions.a.z + positions.b.z + positions.c.z) / 3;

    const defs = [
      { id: "candidate-1", name: "Ứng viên A", subtitle: "Minh bạch • Chuyển đổi số", color: 0xff0000, image: A("images/candidate-1.jpg"), position: positions.a },
      { id: "candidate-2", name: "Ứng viên B", subtitle: "An sinh • Giáo dục", color: 0x00ff00, image: A("images/candidate-1.jpg"), position: positions.b },
      { id: "candidate-3", name: "Ứng viên C", subtitle: "Hạ tầng • Kinh tế địa phương", color: 0x0066ff, image: A("images/candidate-1.jpg"), position: positions.c },
    ];

    candidateCards = defs.map((d) => {
      const card = createCandidateCard(d);
      card.userData._basePos = card.position.clone();
      card.rotation.set(0, Math.PI * 0.5, 0);
      card.userData._baseQuat = card.quaternion.clone();
      return card;
    });
    candidateCards.forEach((c) => scene.add(c));

    voteTarget = new THREE.Vector3(wallX + 0.28, yRow + 0.10, zCenter);
  }

  // Hide non-essential meshes (desk/clutter) to focus on voting scene.
  // Kept consistent with the original `frontend` implementation.
  function hideDeskAndClutter(roomScene, anchorWorldPos) {
    if (!roomScene) return;
    const anchor = anchorWorldPos?.clone?.() ?? new THREE.Vector3(0.3, 0.8, 0.2);
    const keepName = (name) => /wall|floor|ceiling|window|door/i.test(name);
    const keepInteractive = (name) => /switchboard|switch/i.test(name);
    const hideByName = (name) => /desk|table|chair|book|cpu|stand|monitor|keyboard|mouse|lamp|plant/i.test(name);

    const tmp = new THREE.Vector3();
    roomScene.traverse((obj) => {
      if (!obj.isMesh) return;
      const name = obj.name ?? "";
      if (keepName(name)) return;
      if (keepInteractive(name)) return;

      obj.getWorldPosition(tmp);
      const nearAnchor = tmp.distanceTo(anchor) < 0.7 && tmp.y < anchor.y + 0.35;
      if (nearAnchor || hideByName(name)) {
        obj.visible = false;
      }
    });
  }

  async function vote(candidateId) {
    if (voteInFlight) return;
    const target = candidateCards.find((c) => c.userData.candidateId === candidateId);
    if (!target) return;
    voteInFlight = true;

    const start = new THREE.Vector3();
    target.getWorldPosition(start);
    start.y += 0.12;
    start.x += 0.06;

    const slotWorld = new THREE.Vector3();
    const insideWorld = new THREE.Vector3();
    if (ballotBoxGroup) {
      const slotLocal = new THREE.Vector3(0, ballotBoxSize / 2 + 0.05, ballotBoxSize * 0.08);
      slotWorld.copy(slotLocal);
      ballotBoxGroup.localToWorld(slotWorld);

      const dropLocal = new THREE.Vector3(0, -ballotBoxSize * 0.18, 0);
      insideWorld.copy(dropLocal);
      ballotBoxGroup.localToWorld(insideWorld);
    } else {
      slotWorld.copy(voteTarget ?? start.clone().add(new THREE.Vector3(0.3, 0.1, 0)));
      insideWorld.copy(slotWorld).add(new THREE.Vector3(0, -0.22, 0));
    }

    const color = target.userData._color ?? 0x00ffff;

    const ballot = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })
    );
    ballot.position.copy(start);
    ballot.rotation.set(0, Math.PI / 2, 0);
    ballot.renderOrder = 50;
    scene.add(ballot);

    const p = { t: 0 };
    const lift = start.clone().add(new THREE.Vector3(0, 0.10, 0));
    const control = lift.clone().add(slotWorld).multiplyScalar(0.5).add(new THREE.Vector3(0.0, 0.18, 0.0));
    const tl = gsap.timeline({
      onComplete: () => {
        scene.remove(ballot);
        ballot.geometry.dispose();
        ballot.material.dispose();

        const flash = new THREE.PointLight(color, 1.2, 1.0);
        flash.position.copy(slotWorld);
        scene.add(flash);
        gsap.to(flash, { intensity: 0, duration: 0.35, ease: "power2.out", onComplete: () => scene.remove(flash) });

        spawnBallotInsideBox(color);
        voteInFlight = false;
        onVoteComplete?.(candidateId);
      },
    });

    tl.to(target.scale, { x: 1.04, y: 1.04, z: 1.04, duration: 0.12 }, 0).to(target.scale, { x: 1, y: 1, z: 1, duration: 0.18 }, 0.12);
    tl.to(ballot.position, { y: lift.y, duration: 0.22, ease: "power2.out" }, 0);
    tl.to(ballot.rotation, { z: 0.25, duration: 0.22, ease: "power2.out" }, 0);
    tl.to(
      p,
      {
        t: 1,
        duration: 0.75,
        ease: "power2.inOut",
        onUpdate: () => {
          const t = p.t;
          const a = lift.clone().multiplyScalar((1 - t) * (1 - t));
          const b = control.clone().multiplyScalar(2 * (1 - t) * t);
          const c = slotWorld.clone().multiplyScalar(t * t);
          const pos = a.add(b).add(c);
          ballot.position.copy(pos);
          ballot.rotation.z = 0.25 + t * 0.35;
          ballot.rotation.x = t * 0.15;
        },
      },
      0.18
    );

    tl.to(ballot.position, { x: slotWorld.x, y: slotWorld.y - 0.05, z: slotWorld.z, duration: 0.18, ease: "power2.in" }, 0.95);
    tl.to(ballot.position, { x: insideWorld.x, y: insideWorld.y, z: insideWorld.z, duration: 0.28, ease: "power2.in" }, 1.13);
    tl.to(ballot.material, { opacity: 0, duration: 0.18, ease: "power2.out" }, 1.20);

    return new Promise((resolve) => tl.eventCallback("onComplete", resolve));
  }

  function loadIntroText() {
    const loader = new FontLoader();
    loader.load(A("fonts/unione.json"), function (font) {
      const textMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const textMaterials = [textMat, textMat];
      const titleGeo = new TextGeometry("Voting for the best candidate", { font, size: 0.08, height: 0.01 });
      titleText = new THREE.Mesh(titleGeo, textMaterials);
      titleText.rotation.y = Math.PI * 0.5;
      titleText.position.set(-0.27, 0.7, 1.3);
      scene.add(titleText);
    });
  }

  function switchTheme(themeType) {
    if (!lightSwitch) return;

    const applyCardTheme = (isDark) => {
      candidateCards.forEach((cardGroup) => {
        const base = cardGroup.userData._baseStyle;
        if (!base) return;

        const glow = cardGroup.userData._glow;
        const frame = cardGroup.userData._frame;
        const main = cardGroup.userData._card;
        const portrait = cardGroup.userData._portrait;

        const target = isDark
          ? {
              glowOpacity: 0.14,
              frameOpacity: 0.26,
              cardOpacity: 0.82,
              emissiveIntensity: 1.5,
              portraitOpacity: 0.95,
            }
          : {
              glowOpacity: 0.07,
              frameOpacity: 0.18,
              cardOpacity: 0.72,
              emissiveIntensity: 0.06,
              portraitOpacity: 0.9,
            };

        base.glowOpacity = target.glowOpacity;
        base.frameOpacity = target.frameOpacity;
        base.cardOpacity = target.cardOpacity;
        base.emissiveIntensity = target.emissiveIntensity;
        base.portraitOpacity = target.portraitOpacity;

        if (glow?.material) glow.material.opacity = base.glowOpacity;
        if (frame?.material) frame.material.opacity = base.frameOpacity;
        if (main?.material) {
          main.material.opacity = base.cardOpacity;
          main.material.emissiveIntensity = base.emissiveIntensity;
        }
        if (portrait?.material) portrait.material.opacity = base.portraitOpacity;
      });
    };

    if (themeType === "dark") {
      lightSwitch.rotation.z = Math.PI / 7;
      document.body.classList.remove("light-theme");
      document.body.classList.add("dark-theme");
      applyCardTheme(true);
      if (ballotBoxGlassMat) ballotBoxGlassMat.emissiveIntensity = 0.18;
      if (ballotBoxFrameMat) ballotBoxFrameMat.opacity = 0.32;

      // main lights
      gsap.to(roomLight.color, { r: 0.27254901960784313, g: 0.23137254901960785, b: 0.6862745098039216 });
      gsap.to(ambientLight.color, { r: 0.17254901960784313, g: 0.23137254901960785, b: 0.6862745098039216 });
      gsap.to(roomLight, { intensity: 1.5 });
      gsap.to(ambientLight, { intensity: 0.3 });

      // fan lights
      gsap.to(fanLight5, { distance: 0.07 });

      // text light
      gsap.to(pointLight1, { intensity: 0.6 });
      gsap.to(pointLight2, { intensity: 0.6 });
      gsap.to(pointLight3, { intensity: 0.6 });
      gsap.to(pointLight4, { intensity: 0.6 });
    } else {
      lightSwitch.rotation.z = 0;
      document.body.classList.remove("dark-theme");
      document.body.classList.add("light-theme");
      applyCardTheme(false);
      if (ballotBoxGlassMat) ballotBoxGlassMat.emissiveIntensity = 0.06;
      if (ballotBoxFrameMat) ballotBoxFrameMat.opacity = 0.22;

      // main light
      gsap.to(roomLight.color, { r: 1, g: 1, b: 1 });
      gsap.to(ambientLight.color, { r: 1, g: 1, b: 1 });
      gsap.to(roomLight, { intensity: 2.5 });
      gsap.to(ambientLight, { intensity: 0.6 });

      // fan light
      gsap.to(fanLight5, { distance: 0.05 });

      // text light
      gsap.to(pointLight1, { intensity: 0 });
      gsap.to(pointLight2, { intensity: 0 });
      gsap.to(pointLight3, { intensity: 0 });
      gsap.to(pointLight4, { intensity: 0 });
    }
  }

  // CLICK LISTENERS
  const mousePosition = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  const setHoveredCandidate = (nextId) => {
    if (hoveredCandidateId === nextId) return;
    const prevId = hoveredCandidateId;
    hoveredCandidateId = nextId;

    const setState = (id, hovered) => {
      if (!id) return;
      const card = candidateCards.find((c) => c.userData.candidateId === id);
      if (!card) return;
      const glow = card.userData._glow;
      const main = card.userData._card;
      const frame = card.userData._frame;
      const base = card.userData._baseStyle ?? { glowOpacity: 0.07, frameOpacity: 0.18, cardOpacity: 0.72, emissiveIntensity: 0.06 };

      gsap.to(card.scale, { x: hovered ? 1.06 : 1, y: hovered ? 1.06 : 1, z: hovered ? 1.06 : 1, duration: 0.18, ease: "power2.out" });
      if (glow?.material) gsap.to(glow.material, { opacity: hovered ? Math.min(0.35, base.glowOpacity * 1.8) : base.glowOpacity, duration: 0.18, ease: "power2.out" });
      if (frame?.material) gsap.to(frame.material, { opacity: hovered ? Math.min(0.45, base.frameOpacity * 1.35) : base.frameOpacity, duration: 0.18, ease: "power2.out" });
      if (main?.material)
        gsap.to(main.material, {
          opacity: hovered ? Math.min(0.92, base.cardOpacity + 0.08) : base.cardOpacity,
          emissiveIntensity: hovered ? Math.min(0.28, base.emissiveIntensity * 2.0) : base.emissiveIntensity,
          duration: 0.18,
          ease: "power2.out",
        });
    };

    setState(prevId, false);
    setState(nextId, true);
    canvas.style.cursor = nextId ? "pointer" : "";
  };

  const onPointerMove = (e) => {
    mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mousePosition, camera);

    if (candidateCards.length === 0) {
      setHoveredCandidate(null);
    } else {
      const intersects = raycaster.intersectObjects(candidateCards, true);
      const id = intersects.length ? getCandidateIdFromObject(intersects[0].object) : null;
      setHoveredCandidate(id);
    }

    if (ballotBoxGroup) {
      const hit = raycaster.intersectObject(ballotBoxGroup, true);
      setBallotBoxHover(hit.length > 0);
    } else {
      setBallotBoxHover(false);
    }
  };

  const onWindowClick = (e) => {
    const newTheme = theme === "light" ? "dark" : "light";
    const closeBtn = document.getElementById("close-btn");
    const projectsBtn = document.getElementById("projects-menu");
    if ((closeBtn && (e.target === closeBtn || closeBtn.contains(e.target))) || (projectsBtn && (e.target === projectsBtn || projectsBtn.contains(e.target)))) return;

    mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mousePosition, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    intersects.forEach((intersect) => {
      const candidateId = getCandidateIdFromObject(intersect.object);
      if (candidateId) {
        emitSelectCandidate(candidateId);
        return;
      }

      // Toggle lights via switch on the wall
      if (intersect.object.name === "SwitchBoard" || intersect.object.name === "Switch") {
        theme = newTheme;
        switchTheme(theme);
      }
    });
  };

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  // DOM LISTENERS
  const onLogoClick = (e) => {
    // In the original Vite app, logo href is "#" and we prevent navigation.
    // In the Next.js integration, you may set href="/" to go back home.
    const el = e?.currentTarget;
    const href = el?.getAttribute?.("href");
    if (href && href !== "#" && !href.startsWith("#")) {
      return; // allow normal navigation
    }
    e.preventDefault();
  };
  document.getElementById("logo")?.addEventListener("click", onLogoClick);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("click", onWindowClick);
  window.addEventListener("resize", onResize);

  gltfLoader.load(
    A("models/room.glb"),
    function (room) {
      loadedRoomScene = room.scene;
      if (loaderWrapper) loaderWrapper.style.display = "none";

      const video = document.createElement("video");
      video.src = A("textures/arcane.mp4");
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      video.loop = true;
      videoEl = video;

      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.NearestFilter;
      videoTexture.magFilter = THREE.NearestFilter;
      videoTexture.generateMipmaps = false;

      room.scene.children.forEach((child) => {
        if (child.name !== "Wall") child.castShadow = true;
        child.receiveShadow = true;
        if (child.children) {
          child.children.forEach((innerChild) => {
            if (innerChild.name !== "Book001" && innerChild.name !== "Switch") innerChild.castShadow = true;
            if (innerChild.name === "Book001") {
              const bookCoverTexture = new THREE.TextureLoader().load(A("textures/book-cover.png"));
              bookCoverTexture.flipY = false;
              innerChild.material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: 0xffffff, map: bookCoverTexture });
            }
            innerChild.receiveShadow = true;
          });
        }
        if (child.name === "Stand") {
          child.children[0].material = new THREE.MeshBasicMaterial({ map: videoTexture });
          video.play();
        }
        if (child.name === "Book") {
          bookCover = child.children[0];
          const bookTexture = new THREE.TextureLoader().load(A("textures/book-inner.jpg"));
          bookTexture.flipY = false;
          child.material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: bookTexture });
        }
        if (child.name === "SwitchBoard") {
          lightSwitch = child.children[0];
        }
      });

      scene.add(room.scene);
      const roomBounds = new THREE.Box3().setFromObject(room.scene);
      roomFloorY = roomBounds.min.y;

      mixer = new THREE.AnimationMixer(room.scene);
      const clips = room.animations;
      clipNames.forEach((clipName) => {
        const clip = THREE.AnimationClip.findByName(clips, clipName);
        if (clip) mixer.clipAction(clip).play();
      });

      loadIntroText();
      // Remove desk + clutter to match the original frontend experience.
      const anchor = new THREE.Vector3();
      const bookObj = room.scene.getObjectByName("Book");
      if (bookObj) bookObj.getWorldPosition(anchor);
      else anchor.set(0.35, 0.78, 0.22);
      hideDeskAndClutter(room.scene, anchor);
      createCandidateCards();
      ballotBoxGroup = createBallotBox(scene);
      animate();
    },
    undefined,
    function (error) {
      console.error(error);
    }
  );

  const dispose = () => {
    initialized = false;
    if (rafId != null) cancelAnimationFrame(rafId);

    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("click", onWindowClick);
    document.getElementById("logo")?.removeEventListener("click", onLogoClick);

    if (videoEl) {
      try {
        videoEl.pause();
        videoEl.removeAttribute("src");
        videoEl.load();
      } catch {}
      videoEl = null;
    }

    controls.dispose?.();
    renderer.dispose?.();
    dracoLoader.dispose?.();
  };

  return { dispose, vote };
}

