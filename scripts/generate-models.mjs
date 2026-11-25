/**
 * Generates clean, stylized low-poly Draco-compressed .glb assets into public/models/
 * strictly matching the 3D Asset Contract:
 *  - 1 unit = 1 meter
 *  - Pivot at bottom center (y = 0, x = 0, z = 0)
 *  - Draco compression (KHR_draco_mesh_compression)
 *  - Skinned chef models with exact animation clips: Idle, Walk, Interact
 *  - Total scene budget << 15 MB
 */
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const MODELS_DIR = path.resolve('public/models');
fs.mkdirSync(MODELS_DIR, { recursive: true });

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [
    Math.pow(((n >> 16) & 255) / 255, 2.2),
    Math.pow(((n >> 8) & 255) / 255, 2.2),
    Math.pow((n & 255) / 255, 2.2),
    1.0,
  ];
}

function eulerXQuat(rad) {
  const h = rad * 0.5;
  return [Math.sin(h), 0, 0, Math.cos(h)];
}

/**
 * Builds a box geometry centered at (cx, cy, cz) with size (sx, sy, sz).
 * Optional jointIndex assigns rigid skin weights to that bone.
 */
function buildBox(sx, sy, sz, cx, cy, cz, jointIndex = null) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;

  const faces = [
    // +Z
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    // -Z
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    // +X
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    // -X
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    // +Y
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    // -Y
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];

  const positions = [];
  const normals = [];
  const indices = [];
  const joints = [];
  const weights = [];

  let base = 0;
  for (const face of faces) {
    for (const [vx, vy, vz] of face.v) {
      positions.push(vx + cx, vy + cy, vz + cz);
      normals.push(face.n[0], face.n[1], face.n[2]);
      if (jointIndex !== null) {
        joints.push(jointIndex, 0, 0, 0);
        weights.push(1, 0, 0, 0);
      }
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return { positions, normals, indices, joints, weights };
}

function buildCylinder(rTop, rBot, height, segments, cx, cy, cz, jointIndex = null) {
  const positions = [];
  const normals = [];
  const indices = [];
  const joints = [];
  const weights = [];
  const hy = height / 2;

  const pushVert = (x, y, z, nx, ny, nz) => {
    positions.push(x + cx, y + cy, z + cz);
    normals.push(nx, ny, nz);
    if (jointIndex !== null) {
      joints.push(jointIndex, 0, 0, 0);
      weights.push(1, 0, 0, 0);
    }
  };

  // Side wall
  const sideStart = 0;
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    pushVert(cos * rBot, -hy, sin * rBot, cos, 0, sin);
    pushVert(cos * rTop, hy, sin * rTop, cos, 0, sin);
  }
  for (let i = 0; i < segments; i += 1) {
    const b = sideStart + i * 2;
    indices.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }

  // Top cap
  const topCenter = positions.length / 3;
  pushVert(0, hy, 0, 0, 1, 0);
  const topRing = positions.length / 3;
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pushVert(Math.cos(a) * rTop, hy, Math.sin(a) * rTop, 0, 1, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    indices.push(topCenter, topRing + i + 1, topRing + i);
  }

  // Bottom cap
  const botCenter = positions.length / 3;
  pushVert(0, -hy, 0, 0, -1, 0);
  const botRing = positions.length / 3;
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    pushVert(Math.cos(a) * rBot, -hy, Math.sin(a) * rBot, 0, -1, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    indices.push(botCenter, botRing + i, botRing + i + 1);
  }

  return { positions, normals, indices, joints, weights };
}

function mergeGeoms(geoms) {
  const positions = [];
  const normals = [];
  const indices = [];
  const joints = [];
  const weights = [];
  let offset = 0;

  for (const g of geoms) {
    for (let i = 0; i < g.positions.length; i += 1) positions.push(g.positions[i]);
    for (let i = 0; i < g.normals.length; i += 1) normals.push(g.normals[i]);
    for (let i = 0; i < g.joints.length; i += 1) joints.push(g.joints[i]);
    for (let i = 0; i < g.weights.length; i += 1) weights.push(g.weights[i]);
    for (let i = 0; i < g.indices.length; i += 1) indices.push(g.indices[i] + offset);
    offset += g.positions.length / 3;
  }

  return { positions, normals, indices, joints, weights };
}

function addPrimitive(doc, buffer, mesh, geom, material) {
  const prim = doc
    .createPrimitive()
    .setMaterial(material)
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(geom.positions)).setBuffer(buffer),
    )
    .setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(geom.normals)).setBuffer(buffer),
    )
    .setIndices(
      doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(geom.indices)).setBuffer(buffer),
    );

  if (geom.joints.length > 0) {
    prim
      .setAttribute(
        'JOINTS_0',
        doc.createAccessor().setType('VEC4').setArray(new Uint8Array(geom.joints)).setBuffer(buffer),
      )
      .setAttribute(
        'WEIGHTS_0',
        doc.createAccessor().setType('VEC4').setArray(new Float32Array(geom.weights)).setBuffer(buffer),
      );
  }

  mesh.addPrimitive(prim);
}

function createMat(doc, name, hex, roughness = 0.7, metallic = 0.05) {
  return doc
    .createMaterial(name)
    .setBaseColorFactor(hexToRgb(hex))
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metallic);
}

/**
 * Creates a rigged SkinnedMesh chef GLB with exact clips: Idle, Walk, Interact.
 * Skeleton joints:
 *  0: Root   [0, 0, 0]
 *  1: Spine  [0, 0.42, 0]
 *  2: Head   [0, 0.48, 0] (world y = 0.90)
 *  3: ArmL   [-0.25, 0.36, 0] (world y = 0.78)
 *  4: ArmR   [0.25, 0.36, 0] (world y = 0.78)
 *  5: LegL   [-0.10, 0.38, 0] (world y = 0.38)
 *  6: LegR   [0.10, 0.38, 0] (world y = 0.38)
 */
function buildChefDocument(apronHex) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');

  const rootJoint = doc.createNode('Root').setTranslation([0, 0, 0]);
  const spineJoint = doc.createNode('Spine').setTranslation([0, 0.42, 0]);
  const headJoint = doc.createNode('Head').setTranslation([0, 0.48, 0]);
  const armLJoint = doc.createNode('ArmL').setTranslation([-0.25, 0.36, 0]);
  const armRJoint = doc.createNode('ArmR').setTranslation([0.25, 0.36, 0]);
  const legLJoint = doc.createNode('LegL').setTranslation([-0.1, 0.38, 0]);
  const legRJoint = doc.createNode('LegR').setTranslation([0.1, 0.38, 0]);

  rootJoint.addChild(spineJoint);
  rootJoint.addChild(legLJoint);
  rootJoint.addChild(legRJoint);
  spineJoint.addChild(headJoint);
  spineJoint.addChild(armLJoint);
  spineJoint.addChild(armRJoint);

  // Inverse bind matrices (column-major 4x4 translating negative world joint position)
  const worldPositions = [
    [0, 0, 0],
    [0, 0.42, 0],
    [0, 0.9, 0],
    [-0.25, 0.78, 0],
    [0.25, 0.78, 0],
    [-0.1, 0.38, 0],
    [0.1, 0.38, 0],
  ];
  const ibmArray = new Float32Array(worldPositions.length * 16);
  worldPositions.forEach(([wx, wy, wz], idx) => {
    const o = idx * 16;
    ibmArray[o + 0] = 1;
    ibmArray[o + 5] = 1;
    ibmArray[o + 10] = 1;
    ibmArray[o + 12] = -wx;
    ibmArray[o + 13] = -wy;
    ibmArray[o + 14] = -wz;
    ibmArray[o + 15] = 1;
  });

  const skin = doc
    .createSkin('ChefSkin')
    .setSkeleton(rootJoint)
    .addJoint(rootJoint)
    .addJoint(spineJoint)
    .addJoint(headJoint)
    .addJoint(armLJoint)
    .addJoint(armRJoint)
    .addJoint(legLJoint)
    .addJoint(legRJoint)
    .setInverseBindMatrices(
      doc.createAccessor().setType('MAT4').setArray(ibmArray).setBuffer(buffer),
    );

  // Materials
  const jacketMat = createMat(doc, 'Jacket', '#faf5ef', 0.75, 0.02);
  const apronMat = createMat(doc, 'Apron', apronHex, 0.62, 0.04);
  const pantsMat = createMat(doc, 'Pants', '#3b332c', 0.85, 0.02);
  const skinMat = createMat(doc, 'Skin', '#f5cba7', 0.68, 0.02);
  const eyeMat = createMat(doc, 'Eyes', '#231f20', 0.3, 0.1);
  const hatMat = createMat(doc, 'Toque', '#ffffff', 0.65, 0.02);

  const mesh = doc.createMesh('ChefMesh');

  // Pants + Shoes (Legs 5 & 6; feet sit strictly at y = 0.00!)
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.14, 0.34, 0.15, -0.1, 0.21, 0, 5),
      buildBox(0.15, 0.08, 0.21, -0.1, 0.04, 0.03, 5),
      buildBox(0.14, 0.34, 0.15, 0.1, 0.21, 0, 6),
      buildBox(0.15, 0.08, 0.21, 0.1, 0.04, 0.03, 6),
    ]),
    pantsMat,
  );

  // White chef jacket torso (joint 1) + sleeves (joints 3 & 4)
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.38, 0.48, 0.26, 0, 0.64, 0, 1),
      buildBox(0.12, 0.3, 0.12, -0.26, 0.66, 0, 3),
      buildBox(0.12, 0.3, 0.12, 0.26, 0.66, 0, 4),
    ]),
    jacketMat,
  );

  // Colored apron (joint 1) + hat ribbon (joint 2)
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.32, 0.42, 0.06, 0, 0.58, 0.13, 1),
      buildCylinder(0.165, 0.165, 0.045, 12, 0, 1.24, 0, 2),
    ]),
    apronMat,
  );

  // Head + hands (skin)
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.32, 0.32, 0.32, 0, 1.06, 0, 2),
      buildBox(0.1, 0.1, 0.1, -0.26, 0.48, 0, 3),
      buildBox(0.1, 0.1, 0.1, 0.26, 0.48, 0, 4),
    ]),
    skinMat,
  );

  // Eyes facing +Z
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.045, 0.045, 0.03, -0.07, 1.09, 0.165, 2),
      buildBox(0.045, 0.045, 0.03, 0.07, 1.09, 0.165, 2),
    ]),
    eyeMat,
  );

  // Chef Toque Hat (joint 2)
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildCylinder(0.16, 0.15, 0.16, 12, 0, 1.32, 0, 2),
      buildCylinder(0.2, 0.18, 0.18, 12, 0, 1.46, 0, 2),
    ]),
    hatMat,
  );

  const meshNode = doc.createNode('ChefCharacter').setMesh(mesh).setSkin(skin);
  scene.addChild(rootJoint);
  scene.addChild(meshNode);

  // Helper to attach animation tracks
  const addRotTrack = (anim, node, times, angles) => {
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const quatFlat = [];
    for (const a of angles) quatFlat.push(...eulerXQuat(a));
    const output = doc.createAccessor().setType('VEC4').setArray(new Float32Array(quatFlat)).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler);
    anim.addSampler(sampler).addChannel(channel);
  };

  const addTransTrack = (anim, node, times, vecs) => {
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const flat = [];
    for (const v of vecs) flat.push(v[0], v[1], v[2]);
    const output = doc.createAccessor().setType('VEC3').setArray(new Float32Array(flat)).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler);
    anim.addSampler(sampler).addChannel(channel);
  };

  // Clip 1: Idle (gentle breathing)
  const idleAnim = doc.createAnimation('Idle');
  addTransTrack(idleAnim, spineJoint, [0, 0.8, 1.6], [
    [0, 0.42, 0],
    [0, 0.44, 0],
    [0, 0.42, 0],
  ]);
  addRotTrack(idleAnim, armLJoint, [0, 0.8, 1.6], [0.05, -0.03, 0.05]);
  addRotTrack(idleAnim, armRJoint, [0, 0.8, 1.6], [-0.03, 0.05, -0.03]);

  // Clip 2: Walk (lively stride)
  const walkAnim = doc.createAnimation('Walk');
  const wt = [0, 0.15, 0.3, 0.45, 0.6];
  addRotTrack(walkAnim, legLJoint, wt, [0, 0.6, 0, -0.6, 0]);
  addRotTrack(walkAnim, legRJoint, wt, [0, -0.6, 0, 0.6, 0]);
  addRotTrack(walkAnim, armLJoint, wt, [0, -0.55, 0, 0.55, 0]);
  addRotTrack(walkAnim, armRJoint, wt, [0, 0.55, 0, -0.55, 0]);
  addTransTrack(walkAnim, spineJoint, wt, [
    [0, 0.42, 0],
    [0, 0.46, 0],
    [0, 0.42, 0],
    [0, 0.46, 0],
    [0, 0.42, 0],
  ]);

  // Clip 3: Interact (chopping / cooking arms)
  const interactAnim = doc.createAnimation('Interact');
  const it = [0, 0.18, 0.36];
  addRotTrack(interactAnim, armLJoint, it, [-0.75, -0.65, -0.75]);
  addRotTrack(interactAnim, armRJoint, it, [-1.15, -0.55, -1.15]);
  addRotTrack(interactAnim, headJoint, it, [0.12, 0.18, 0.12]);

  return doc;
}

function buildFridgeDocument() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('FridgeMesh');

  const bodyMat = createMat(doc, 'FridgeBody', '#d7e8e2', 0.36, 0.12);
  const doorMat = createMat(doc, 'FridgeDoor', '#e8f3ef', 0.28, 0.1);
  const chromeMat = createMat(doc, 'Chrome', '#c2ccd1', 0.22, 0.85);
  const accentMat = createMat(doc, 'MagnetRed', '#e07a5f', 0.5, 0.05);
  const noteMat = createMat(doc, 'StickyNote', '#f2cc8f', 0.8, 0.02);

  // Body rests strictly at y = 0 (height 1.96 -> center y = 0.98)
  addPrimitive(doc, buffer, mesh, buildBox(0.96, 1.96, 0.84, 0, 0.98, 0), bodyMat);
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.88, 0.66, 0.06, 0, 1.57, 0.44),
      buildBox(0.88, 1.12, 0.06, 0, 0.62, 0.44),
    ]),
    doorMat,
  );
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildCylinder(0.024, 0.024, 0.28, 8, 0.32, 1.52, 0.5),
      buildCylinder(0.024, 0.024, 0.38, 8, 0.32, 0.84, 0.5),
    ]),
    chromeMat,
  );
  addPrimitive(doc, buffer, mesh, buildBox(0.08, 0.08, 0.03, -0.22, 1.64, 0.48), accentMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.16, 0.16, 0.02, -0.06, 1.52, 0.48), noteMat);

  scene.addChild(doc.createNode('Fridge').setMesh(mesh));
  return doc;
}

function buildCuttingBoardDocument() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('CuttingBoardMesh');

  const cabMat = createMat(doc, 'Cabinet', '#d7c5b2', 0.78, 0.02);
  const topMat = createMat(doc, 'Countertop', '#f3ebe1', 0.5, 0.04);
  const woodMat = createMat(doc, 'ButcherWood', '#b07d4f', 0.65, 0.02);
  const steelMat = createMat(doc, 'KnifeSteel', '#dce2ea', 0.2, 0.88);
  const handleMat = createMat(doc, 'KnifeHandle', '#3b2f2f', 0.75, 0.05);
  const tomatoMat = createMat(doc, 'Tomato', '#e63946', 0.42, 0.04);
  const pepperMat = createMat(doc, 'Pepper', '#40916c', 0.48, 0.04);

  addPrimitive(doc, buffer, mesh, buildBox(1.24, 0.86, 0.86, 0, 0.43, 0), cabMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.3, 0.07, 0.92, 0, 0.895, 0), topMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.76, 0.06, 0.54, -0.06, 0.96, 0.04), woodMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.07, 0.014, 0.26, 0.22, 1.0, -0.04), steelMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.045, 0.03, 0.14, 0.22, 1.005, 0.15), handleMat);
  addPrimitive(doc, buffer, mesh, buildCylinder(0.065, 0.065, 0.09, 10, -0.22, 1.035, -0.04), tomatoMat);
  addPrimitive(doc, buffer, mesh, buildCylinder(0.036, 0.042, 0.14, 10, -0.06, 1.06, -0.08), pepperMat);

  scene.addChild(doc.createNode('CuttingBoard').setMesh(mesh));
  return doc;
}

function buildStoveDocument() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('StoveMesh');

  const bodyMat = createMat(doc, 'StoveBody', '#4a4e57', 0.45, 0.38);
  const glassMat = createMat(doc, 'OvenGlass', '#1e2228', 0.18, 0.55);
  const topMat = createMat(doc, 'Cooktop', '#272a30', 0.35, 0.42);
  const grateMat = createMat(doc, 'Burner', '#16181c', 0.72, 0.25);
  const chromeMat = createMat(doc, 'HandleSteel', '#cbd5e1', 0.22, 0.85);
  const copperMat = createMat(doc, 'CopperPot', '#c87d55', 0.3, 0.7);

  addPrimitive(doc, buffer, mesh, buildBox(1.18, 0.9, 0.88, 0, 0.45, 0), bodyMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.88, 0.5, 0.04, 0, 0.36, 0.45), glassMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.22, 0.05, 0.92, 0, 0.925, 0), topMat);
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildBox(0.68, 0.04, 0.04, 0, 0.67, 0.49),
      buildCylinder(0.03, 0.03, 0.03, 8, -0.34, 0.83, 0.46),
      buildCylinder(0.03, 0.03, 0.03, 8, -0.12, 0.83, 0.46),
      buildCylinder(0.03, 0.03, 0.03, 8, 0.12, 0.83, 0.46),
      buildCylinder(0.03, 0.03, 0.03, 8, 0.34, 0.83, 0.46),
    ]),
    chromeMat,
  );
  addPrimitive(
    doc,
    buffer,
    mesh,
    mergeGeoms([
      buildCylinder(0.14, 0.15, 0.03, 12, -0.28, 0.965, -0.18),
      buildCylinder(0.14, 0.15, 0.03, 12, 0.28, 0.965, -0.18),
      buildCylinder(0.14, 0.15, 0.03, 12, -0.28, 0.965, 0.2),
      buildCylinder(0.14, 0.15, 0.03, 12, 0.28, 0.965, 0.2),
      // Cast-iron skillet on front-left burner
      buildCylinder(0.22, 0.19, 0.08, 16, -0.24, 1.02, 0.18),
      buildBox(0.26, 0.03, 0.045, 0.07, 1.04, 0.22),
    ]),
    grateMat,
  );
  // Warm copper stockpot on back-right burner
  addPrimitive(doc, buffer, mesh, buildCylinder(0.16, 0.15, 0.2, 14, 0.28, 1.08, -0.18), copperMat);

  scene.addChild(doc.createNode('Stove').setMesh(mesh));
  return doc;
}

async function main() {
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  const jobs = [
    { file: 'chef_p1.glb', build: () => buildChefDocument('#e07a5f') },
    { file: 'chef_p2.glb', build: () => buildChefDocument('#3d9970') },
    { file: 'station_fridge.glb', build: buildFridgeDocument },
    { file: 'station_cutting_board.glb', build: buildCuttingBoardDocument },
    { file: 'station_stove.glb', build: buildStoveDocument },
  ];

  for (const job of jobs) {
    const doc = job.build();
    doc
      .createExtension(KHRDracoMeshCompression)
      .setRequired(true)
      .setEncoderOptions({
        method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
        encodeSpeed: 5,
        decodeSpeed: 5,
      });

    const outPath = path.join(MODELS_DIR, job.file);
    await io.write(outPath, doc);
    const bytes = fs.statSync(outPath).size;
    console.log(`Generated ${job.file} (${(bytes / 1024).toFixed(1)} KB, Draco)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
