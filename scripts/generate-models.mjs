/**
 * Generates stylized, recognizable low-poly Draco-compressed .glb assets into public/models/:
 *  - 4 SkinnedMesh characters: char_cat.glb (Kedi), char_dog.glb (Köpek),
 *    char_bubu.glb (Bubu), char_dudu.glb (Dudu) — each with Idle, Walk, Interact clips
 *  - 3 Kitchen stations: station_fridge.glb, station_cutting_board.glb, station_stove.glb
 *  - 9 Distinct sculpted 3D food items: food_*.glb (used in Kitchen & 3D Market!)
 *  - 3 Walkable 3D Market stalls: market_produce.glb, market_dairy.glb, market_pantry.glb
 *
 * Strictly enforces: 1 unit = 1 meter, pivot bottom-center y = 0, Draco compression, < 15 MB total.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const MODELS_DIR = path.resolve('public/models');
fs.mkdirSync(MODELS_DIR, { recursive: true });

// Remove legacy chef_p1/p2 files if present so check-assets stays clean
for (const oldFile of ['chef_p1.glb', 'chef_p2.glb']) {
  const p = path.join(MODELS_DIR, oldFile);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

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

function eulerQuat(rx, ry, rz) {
  const cx = Math.cos(rx * 0.5);
  const sx = Math.sin(rx * 0.5);
  const cy = Math.cos(ry * 0.5);
  const sy = Math.sin(ry * 0.5);
  const cz = Math.cos(rz * 0.5);
  const sz = Math.sin(rz * 0.5);
  return [
    sx * cy * cz - cx * sy * sz,
    cx * sy * cz + sx * cy * sz,
    cx * cy * sz - sx * sy * cz,
    cx * cy * cz + sx * sy * sz,
  ];
}

function transformGeom(geom, rx = 0, ry = 0, rz = 0, tx = 0, ty = 0, tz = 0) {
  const cX = Math.cos(rx), sX = Math.sin(rx);
  const cY = Math.cos(ry), sY = Math.sin(ry);
  const cZ = Math.cos(rz), sZ = Math.sin(rz);

  const rotVec = (x, y, z) => {
    // Z -> X -> Y rotation
    const x1 = x * cZ - y * sZ;
    const y1 = x * sZ + y * cZ;
    const z1 = z;
    const x2 = x1;
    const y2 = y1 * cX - z1 * sX;
    const z2 = y1 * sX + z1 * cX;
    return [
      x2 * cY + z2 * sY,
      y2,
      -x2 * sY + z2 * cY,
    ];
  };

  for (let i = 0; i < geom.positions.length; i += 3) {
    const [px, py, pz] = rotVec(geom.positions[i], geom.positions[i + 1], geom.positions[i + 2]);
    geom.positions[i] = px + tx;
    geom.positions[i + 1] = py + ty;
    geom.positions[i + 2] = pz + tz;
    const [nx, ny, nz] = rotVec(geom.normals[i], geom.normals[i + 1], geom.normals[i + 2]);
    const len = Math.hypot(nx, ny, nz) || 1;
    geom.normals[i] = nx / len;
    geom.normals[i + 1] = ny / len;
    geom.normals[i + 2] = nz / len;
  }
  return geom;
}

function buildBox(sx, sy, sz, cx, cy, cz, jointIndex = null) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;

  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
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

function buildEllipsoid(rx, ry, rz, latSegs, lonSegs, cx, cy, cz, jointIndex = null) {
  const positions = [];
  const normals = [];
  const indices = [];
  const joints = [];
  const weights = [];

  for (let lat = 0; lat <= latSegs; lat += 1) {
    const theta = (lat / latSegs) * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let lon = 0; lon <= lonSegs; lon += 1) {
      const phi = (lon / lonSegs) * Math.PI * 2;
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);

      const ux = sinT * cosP;
      const uy = cosT;
      const uz = sinT * sinP;

      positions.push(ux * rx + cx, uy * ry + cy, uz * rz + cz);
      const nx = ux / (rx || 1);
      const ny = uy / (ry || 1);
      const nz = uz / (rz || 1);
      const len = Math.hypot(nx, ny, nz) || 1;
      normals.push(nx / len, ny / len, nz / len);

      if (jointIndex !== null) {
        joints.push(jointIndex, 0, 0, 0);
        weights.push(1, 0, 0, 0);
      }
    }
  }

  const ring = lonSegs + 1;
  for (let lat = 0; lat < latSegs; lat += 1) {
    for (let lon = 0; lon < lonSegs; lon += 1) {
      const a = lat * ring + lon;
      const b = a + ring;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
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

  const slope = (rBot - rTop) / (height || 1);
  for (let i = 0; i <= segments; i += 1) {
    const a = (i / segments) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const len = Math.hypot(cos, slope, sin) || 1;
    pushVert(cos * rBot, -hy, sin * rBot, cos / len, slope / len, sin / len);
    pushVert(cos * rTop, hy, sin * rTop, cos / len, slope / len, sin / len);
  }
  for (let i = 0; i < segments; i += 1) {
    const b = i * 2;
    indices.push(b, b + 1, b + 3, b, b + 3, b + 2);
  }

  if (rTop > 0.001) {
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
  }

  if (rBot > 0.001) {
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
  }

  return { positions, normals, indices, joints, weights };
}

function buildCone(radius, height, segments, cx, cy, cz, jointIndex = null) {
  return buildCylinder(0.002, radius, height, segments, cx, cy, cz, jointIndex);
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

function createMat(doc, name, hex, roughness = 0.65, metallic = 0.04) {
  return doc
    .createMaterial(name)
    .setBaseColorFactor(hexToRgb(hex))
    .setRoughnessFactor(roughness)
    .setMetallicFactor(metallic);
}

/* ============================================================================
 * 1. FOUR RIGGED CHARACTERS: Kedi (cat), Köpek (dog), Bubu (bubu), Dudu (dudu)
 * Skeleton joints:
 *  0: Root   [0, 0, 0]
 *  1: Spine  [0, 0.36, 0]
 *  2: Head   [0, 0.44, 0] (world y = 0.80)
 *  3: ArmL   [-0.26, 0.30, 0] (world y = 0.66)
 *  4: ArmR   [0.26, 0.30, 0]  (world y = 0.66)
 *  5: LegL   [-0.12, 0.28, 0] (world y = 0.28)
 *  6: LegR   [0.12, 0.28, 0]  (world y = 0.28)
 *  7: Tail   [0, 0.04, -0.22] (world y = 0.40, z = -0.22)
 * ============================================================================ */
function buildRiggedCharacter(kind) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');

  const rootJoint = doc.createNode('Root').setTranslation([0, 0, 0]);
  const spineJoint = doc.createNode('Spine').setTranslation([0, 0.36, 0]);
  const headJoint = doc.createNode('Head').setTranslation([0, 0.44, 0]);
  const armLJoint = doc.createNode('ArmL').setTranslation([-0.26, 0.3, 0]);
  const armRJoint = doc.createNode('ArmR').setTranslation([0.26, 0.3, 0]);
  const legLJoint = doc.createNode('LegL').setTranslation([-0.12, 0.28, 0]);
  const legRJoint = doc.createNode('LegR').setTranslation([0.12, 0.28, 0]);
  const tailJoint = doc.createNode('Tail').setTranslation([0, 0.04, -0.22]);

  rootJoint.addChild(spineJoint);
  rootJoint.addChild(legLJoint);
  rootJoint.addChild(legRJoint);
  spineJoint.addChild(headJoint);
  spineJoint.addChild(armLJoint);
  spineJoint.addChild(armRJoint);
  spineJoint.addChild(tailJoint);

  const worldPos = [
    [0, 0, 0],
    [0, 0.36, 0],
    [0, 0.8, 0],
    [-0.26, 0.66, 0],
    [0.26, 0.66, 0],
    [-0.12, 0.28, 0],
    [0.12, 0.28, 0],
    [0, 0.4, -0.22],
  ];
  const ibmArray = new Float32Array(worldPos.length * 16);
  worldPos.forEach(([wx, wy, wz], idx) => {
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
    .createSkin('CharacterSkin')
    .setSkeleton(rootJoint)
    .addJoint(rootJoint)
    .addJoint(spineJoint)
    .addJoint(headJoint)
    .addJoint(armLJoint)
    .addJoint(armRJoint)
    .addJoint(legLJoint)
    .addJoint(legRJoint)
    .addJoint(tailJoint)
    .setInverseBindMatrices(
      doc.createAccessor().setType('MAT4').setArray(ibmArray).setBuffer(buffer),
    );

  const mesh = doc.createMesh(`Char_${kind}`);

  const eyeMat = createMat(doc, 'Eye', '#231f20', 0.18, 0.15);
  const blushMat = createMat(doc, 'Blush', '#ff9ebb', 0.75, 0.02);
  const whiteMat = createMat(doc, 'White', '#ffffff', 0.65, 0.02);

  if (kind === 'cat') {
    // KEDİ — Warm ginger tabby cat with pointed ears, whiskers, upright curved tail, coral apron
    const furMat = createMat(doc, 'CatFur', '#f4a261', 0.72, 0.02);
    const stripeMat = createMat(doc, 'CatStripe', '#c96a2b', 0.75, 0.02);
    const creamMat = createMat(doc, 'CatCream', '#fff6ea', 0.72, 0.02);
    const pinkMat = createMat(doc, 'CatPink', '#f497a9', 0.6, 0.02);
    const apronMat = createMat(doc, 'CatApron', '#e07a5f', 0.62, 0.03);

    // Legs & paws resting strictly at y = 0.00
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.085, 0.14, 0.095, 8, 10, -0.11, 0.14, 0.01, 5),
      buildEllipsoid(0.085, 0.14, 0.095, 8, 10, 0.11, 0.14, 0.01, 6),
    ]), furMat);
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.075, 0.05, 0.09, 6, 8, -0.11, 0.05, 0.05, 5),
      buildEllipsoid(0.075, 0.05, 0.09, 6, 8, 0.11, 0.05, 0.05, 6),
    ]), creamMat);

    // Chubby body, head, arms, pointed ears, curved tail
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.24, 0.28, 0.21, 10, 12, 0, 0.52, 0, 1),
      buildEllipsoid(0.26, 0.23, 0.24, 10, 14, 0, 0.96, 0.01, 2),
      // Arms
      buildEllipsoid(0.075, 0.16, 0.075, 8, 10, -0.26, 0.56, 0.02, 3),
      buildEllipsoid(0.075, 0.16, 0.075, 8, 10, 0.26, 0.56, 0.02, 4),
      // Pointed Cat Ears
      transformGeom(buildCone(0.09, 0.18, 8, 0, 0, 0, 2), 0, 0, 0.28, -0.16, 1.2, 0),
      transformGeom(buildCone(0.09, 0.18, 8, 0, 0, 0, 2), 0, 0, -0.28, 0.16, 1.2, 0),
      // Cute curved upright cat tail
      transformGeom(buildCylinder(0.04, 0.05, 0.34, 8, 0, 0, 0, 7), -0.65, 0, 0, 0, 0.52, -0.32),
      buildEllipsoid(0.05, 0.05, 0.05, 6, 8, 0, 0.67, -0.42, 7),
    ]), furMat);

    // Tabby stripes on forehead & tail tip
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildBox(0.03, 0.09, 0.04, 0, 1.11, 0.2, 2),
      buildBox(0.025, 0.07, 0.04, -0.06, 1.1, 0.19, 2),
      buildBox(0.025, 0.07, 0.04, 0.06, 1.1, 0.19, 2),
    ]), stripeMat);

    // Cream belly & muzzle
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.16, 0.17, 0.09, 8, 10, 0, 0.5, 0.15, 1),
      buildEllipsoid(0.11, 0.07, 0.07, 8, 10, 0, 0.9, 0.21, 2),
    ]), creamMat);

    // Pink inner ears & tiny nose
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      transformGeom(buildCone(0.048, 0.11, 6, 0, 0, 0, 2), 0.1, 0, 0.28, -0.155, 1.19, 0.045),
      transformGeom(buildCone(0.048, 0.11, 6, 0, 0, 0, 2), 0.1, 0, -0.28, 0.155, 1.19, 0.045),
      buildEllipsoid(0.032, 0.024, 0.024, 6, 8, 0, 0.93, 0.26, 2),
    ]), pinkMat);

    // Eyes & Whiskers & Blush
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.036, 0.042, 0.028, 8, 8, -0.095, 0.98, 0.215, 2),
      buildEllipsoid(0.036, 0.042, 0.028, 8, 8, 0.095, 0.98, 0.215, 2),
      // Whiskers
      buildBox(0.12, 0.01, 0.01, -0.22, 0.91, 0.18, 2),
      buildBox(0.12, 0.01, 0.01, -0.22, 0.88, 0.18, 2),
      buildBox(0.12, 0.01, 0.01, 0.22, 0.91, 0.18, 2),
      buildBox(0.12, 0.01, 0.01, 0.22, 0.88, 0.18, 2),
    ]), eyeMat);

    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.04, 0.024, 0.02, 6, 8, -0.15, 0.92, 0.2, 2),
      buildEllipsoid(0.04, 0.024, 0.02, 6, 8, 0.15, 0.92, 0.2, 2),
    ]), blushMat);

    // Mini Chef Apron & tiny toque between ears
    addPrimitive(doc, buffer, mesh, buildBox(0.24, 0.24, 0.06, 0, 0.48, 0.21, 1), apronMat);
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildCylinder(0.09, 0.08, 0.09, 10, 0, 1.22, 0, 2),
      buildEllipsoid(0.11, 0.085, 0.11, 8, 10, 0, 1.3, 0, 2),
    ]), whiteMat);
  } else if (kind === 'dog') {
    // KÖPEK — Friendly golden puppy with floppy hanging ears, protruding snout, wagging tail
    const furMat = createMat(doc, 'DogFur', '#e2a85c', 0.72, 0.02);
    const earMat = createMat(doc, 'DogEar', '#a96a35', 0.75, 0.02);
    const creamMat = createMat(doc, 'DogCream', '#fff5e4', 0.72, 0.02);
    const apronMat = createMat(doc, 'DogApron', '#3d9970', 0.62, 0.03);
    const tongueMat = createMat(doc, 'DogTongue', '#f2789f', 0.55, 0.02);

    // Legs resting strictly at y = 0.00
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.088, 0.14, 0.1, 8, 10, -0.115, 0.14, 0.01, 5),
      buildEllipsoid(0.088, 0.14, 0.1, 8, 10, 0.115, 0.14, 0.01, 6),
    ]), furMat);

    // Body, Head, Arms, Tail
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.24, 0.28, 0.22, 10, 12, 0, 0.52, 0, 1),
      buildEllipsoid(0.25, 0.24, 0.25, 10, 14, 0, 0.96, 0.01, 2),
      buildEllipsoid(0.08, 0.16, 0.08, 8, 10, -0.26, 0.56, 0.02, 3),
      buildEllipsoid(0.08, 0.16, 0.08, 8, 10, 0.26, 0.56, 0.02, 4),
      transformGeom(buildCylinder(0.035, 0.055, 0.26, 8, 0, 0, 0, 7), -0.8, 0, 0, 0, 0.5, -0.3),
    ]), furMat);

    // Floppy Dog Ears
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      transformGeom(buildEllipsoid(0.07, 0.17, 0.09, 8, 10, 0, 0, 0, 2), 0, 0, 0.22, -0.27, 0.95, 0.01),
      transformGeom(buildEllipsoid(0.07, 0.17, 0.09, 8, 10, 0, 0, 0, 2), 0, 0, -0.22, 0.27, 0.95, 0.01),
    ]), earMat);

    // Cream Snout + Belly
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.13, 0.095, 0.12, 8, 10, 0, 0.9, 0.22, 2),
      buildEllipsoid(0.15, 0.17, 0.09, 8, 10, 0, 0.5, 0.16, 1),
    ]), creamMat);

    // Happy eyes + Big Puppy Button Nose
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.035, 0.04, 0.028, 8, 8, -0.095, 1.0, 0.22, 2),
      buildEllipsoid(0.035, 0.04, 0.028, 8, 8, 0.095, 1.0, 0.22, 2),
      buildEllipsoid(0.05, 0.038, 0.04, 8, 8, 0, 0.94, 0.32, 2),
    ]), eyeMat);

    // Cute tiny tongue + Blush
    addPrimitive(doc, buffer, mesh, buildEllipsoid(0.032, 0.038, 0.02, 6, 8, 0, 0.83, 0.29, 2), tongueMat);
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.038, 0.022, 0.02, 6, 8, -0.15, 0.93, 0.2, 2),
      buildEllipsoid(0.038, 0.022, 0.02, 6, 8, 0.15, 0.93, 0.2, 2),
    ]), blushMat);

    // Apron & Chef Hat
    addPrimitive(doc, buffer, mesh, buildBox(0.24, 0.24, 0.06, 0, 0.48, 0.21, 1), apronMat);
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildCylinder(0.11, 0.1, 0.1, 10, 0, 1.24, 0, 2),
      buildEllipsoid(0.13, 0.095, 0.13, 8, 10, 0, 1.33, 0, 2),
    ]), whiteMat);
  } else if (kind === 'bubu') {
    // BUBU — Chubby adorable white panda bear with dark charcoal ears, eye patches, limbs & blush!
    const pandaWhite = createMat(doc, 'BubuWhite', '#fffbf7', 0.72, 0.02);
    const pandaDark = createMat(doc, 'BubuDark', '#2e2b30', 0.72, 0.03);
    const apronMat = createMat(doc, 'BubuApron', '#f28482', 0.62, 0.03);

    // Stubby dark legs resting at y = 0.00
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.1, 0.13, 0.105, 8, 10, -0.12, 0.13, 0.01, 5),
      buildEllipsoid(0.1, 0.13, 0.105, 8, 10, 0.12, 0.13, 0.01, 6),
      // Dark stubby panda arms
      buildEllipsoid(0.09, 0.155, 0.09, 8, 10, -0.28, 0.54, 0.03, 3),
      buildEllipsoid(0.09, 0.155, 0.09, 8, 10, 0.28, 0.54, 0.03, 4),
      // Round panda ears
      buildEllipsoid(0.095, 0.095, 0.065, 8, 10, -0.22, 1.18, 0, 2),
      buildEllipsoid(0.095, 0.095, 0.065, 8, 10, 0.22, 1.18, 0, 2),
      // Dark eye patches
      transformGeom(buildEllipsoid(0.072, 0.056, 0.03, 8, 10, 0, 0, 0, 2), 0, 0, 0.25, -0.1, 0.99, 0.245),
      transformGeom(buildEllipsoid(0.072, 0.056, 0.03, 8, 10, 0, 0, 0, 2), 0, 0, -0.25, 0.1, 0.99, 0.245),
      // Nose & cute round tail
      buildEllipsoid(0.036, 0.025, 0.028, 6, 8, 0, 0.93, 0.275, 2),
      buildEllipsoid(0.075, 0.075, 0.075, 8, 8, 0, 0.36, -0.25, 7),
    ]), pandaDark);

    // Chubby round white body & oversized kawaii round head
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.28, 0.29, 0.25, 10, 14, 0, 0.49, 0, 1),
      buildEllipsoid(0.31, 0.27, 0.27, 12, 14, 0, 0.96, 0, 2),
    ]), pandaWhite);

    // Bright eye sparkles inside eye patches
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.024, 0.026, 0.018, 6, 8, -0.095, 1.0, 0.27, 2),
      buildEllipsoid(0.024, 0.026, 0.018, 6, 8, 0.095, 1.0, 0.27, 2),
    ]), whiteMat);

    // Rosy Bubu cheeks
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.05, 0.03, 0.022, 6, 8, -0.175, 0.91, 0.23, 2),
      buildEllipsoid(0.05, 0.03, 0.022, 6, 8, 0.175, 0.91, 0.23, 2),
    ]), blushMat);

    // Mini cozy apron
    addPrimitive(doc, buffer, mesh, buildBox(0.25, 0.22, 0.06, 0, 0.45, 0.23, 1), apronMat);
  } else {
    // DUDU — Chubby adorable warm brown bear with round brown ears, cream muzzle & blush!
    const bearBrown = createMat(doc, 'DuduBrown', '#a47148', 0.72, 0.02);
    const bearEar = createMat(doc, 'DuduDarkBrown', '#835330', 0.72, 0.02);
    const muzzleCream = createMat(doc, 'DuduCream', '#f5e1c8', 0.72, 0.02);
    const apronMat = createMat(doc, 'DuduApron', '#52b788', 0.62, 0.03);

    // Stubby brown legs resting at y = 0.00
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.1, 0.13, 0.105, 8, 10, -0.12, 0.13, 0.01, 5),
      buildEllipsoid(0.1, 0.13, 0.105, 8, 10, 0.12, 0.13, 0.01, 6),
      // Chubby round body & oversized round head
      buildEllipsoid(0.28, 0.29, 0.25, 10, 14, 0, 0.49, 0, 1),
      buildEllipsoid(0.31, 0.27, 0.27, 12, 14, 0, 0.96, 0, 2),
      // Arms & cute round bear tail
      buildEllipsoid(0.09, 0.155, 0.09, 8, 10, -0.28, 0.54, 0.03, 3),
      buildEllipsoid(0.09, 0.155, 0.09, 8, 10, 0.28, 0.54, 0.03, 4),
      buildEllipsoid(0.075, 0.075, 0.075, 8, 8, 0, 0.36, -0.25, 7),
    ]), bearBrown);

    // Round brown ears
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.095, 0.095, 0.065, 8, 10, -0.22, 1.18, 0, 2),
      buildEllipsoid(0.095, 0.095, 0.065, 8, 10, 0.22, 1.18, 0, 2),
    ]), bearEar);

    // Soft cream belly, muzzle & inner ears
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.115, 0.08, 0.075, 8, 10, 0, 0.91, 0.24, 2),
      buildEllipsoid(0.052, 0.052, 0.03, 6, 8, -0.22, 1.18, 0.045, 2),
      buildEllipsoid(0.052, 0.052, 0.03, 6, 8, 0.22, 1.18, 0.045, 2),
      buildEllipsoid(0.17, 0.18, 0.09, 8, 10, 0, 0.48, 0.18, 1),
    ]), muzzleCream);

    // Eyes & dark bear nose
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.034, 0.038, 0.025, 8, 8, -0.1, 1.0, 0.245, 2),
      buildEllipsoid(0.034, 0.038, 0.025, 8, 8, 0.1, 1.0, 0.245, 2),
      buildEllipsoid(0.042, 0.03, 0.03, 6, 8, 0, 0.945, 0.3, 2),
    ]), eyeMat);

    // Rosy Dudu cheeks
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.05, 0.03, 0.022, 6, 8, -0.175, 0.91, 0.23, 2),
      buildEllipsoid(0.05, 0.03, 0.022, 6, 8, 0.175, 0.91, 0.23, 2),
    ]), blushMat);

    // Mini cozy apron
    addPrimitive(doc, buffer, mesh, buildBox(0.25, 0.22, 0.06, 0, 0.45, 0.23, 1), apronMat);
  }

  const meshNode = doc.createNode(`Character_${kind}`).setMesh(mesh).setSkin(skin);
  scene.addChild(rootJoint);
  scene.addChild(meshNode);

  // Animation Helpers
  const addRotTrack = (anim, node, times, eulers) => {
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const quatFlat = [];
    for (const [rx, ry, rz] of eulers) quatFlat.push(...eulerQuat(rx, ry, rz));
    const output = doc.createAccessor().setType('VEC4').setArray(new Float32Array(quatFlat)).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(
      doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler),
    );
  };

  const addTransTrack = (anim, node, times, vecs) => {
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
    const flat = [];
    for (const v of vecs) flat.push(v[0], v[1], v[2]);
    const output = doc.createAccessor().setType('VEC3').setArray(new Float32Array(flat)).setBuffer(buffer);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(
      doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler),
    );
  };

  // Clip 1: Idle (gentle cozy bounce + tail wag)
  const idleAnim = doc.createAnimation('Idle');
  addTransTrack(idleAnim, spineJoint, [0, 0.7, 1.4], [
    [0, 0.36, 0],
    [0, 0.385, 0],
    [0, 0.36, 0],
  ]);
  addRotTrack(idleAnim, tailJoint, [0, 0.35, 0.7, 1.05, 1.4], [
    [0, 0, 0],
    [0, 0.35, 0],
    [0, 0, 0],
    [0, -0.35, 0],
    [0, 0, 0],
  ]);

  // Clip 2: Walk (bouncy kawaii waddle)
  const walkAnim = doc.createAnimation('Walk');
  const wt = [0, 0.14, 0.28, 0.42, 0.56];
  addRotTrack(walkAnim, legLJoint, wt, [[0, 0, 0], [0.55, 0, 0], [0, 0, 0], [-0.55, 0, 0], [0, 0, 0]]);
  addRotTrack(walkAnim, legRJoint, wt, [[0, 0, 0], [-0.55, 0, 0], [0, 0, 0], [0.55, 0, 0], [0, 0, 0]]);
  addRotTrack(walkAnim, armLJoint, wt, [[0, 0, 0], [-0.5, 0, 0], [0, 0, 0], [0.5, 0, 0], [0, 0, 0]]);
  addRotTrack(walkAnim, armRJoint, wt, [[0, 0, 0], [0.5, 0, 0], [0, 0, 0], [-0.5, 0, 0], [0, 0, 0]]);
  addRotTrack(walkAnim, tailJoint, wt, [[0, 0, 0], [0, 0.45, 0], [0, 0, 0], [0, -0.45, 0], [0, 0, 0]]);
  addTransTrack(walkAnim, spineJoint, wt, [
    [0, 0.36, 0],
    [0, 0.41, 0],
    [0, 0.36, 0],
    [0, 0.41, 0],
    [0, 0.36, 0],
  ]);

  // Clip 3: Interact (happy chopping / cooking arms!)
  const interactAnim = doc.createAnimation('Interact');
  const it = [0, 0.16, 0.32];
  addRotTrack(interactAnim, armLJoint, it, [[-0.85, 0, 0], [-0.6, 0, 0], [-0.85, 0, 0]]);
  addRotTrack(interactAnim, armRJoint, it, [[-1.15, 0, 0], [-0.45, 0, 0], [-1.15, 0, 0]]);
  addRotTrack(interactAnim, headJoint, it, [[0.1, 0, 0], [0.18, 0, 0], [0.1, 0, 0]]);

  return doc;
}

/* ============================================================================
 * 2. SCULPTED RECOGNIZABLE FOOD GEOMETRY BUILDERS (NO PLAIN CYLINDERS!)
 * ============================================================================ */
function buildTomatoParts(scale = 1, ox = 0, oy = 0, oz = 0) {
  const s = scale;
  const body = buildEllipsoid(0.11 * s, 0.095 * s, 0.11 * s, 10, 12, ox, oy + 0.095 * s, oz);
  const leaves = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    leaves.push(
      transformGeom(
        buildCone(0.022 * s, 0.065 * s, 4, 0, 0, 0),
        Math.PI * 0.44,
        a,
        0,
        ox + Math.sin(a) * 0.03 * s,
        oy + 0.185 * s,
        oz + Math.cos(a) * 0.03 * s,
      ),
    );
  }
  leaves.push(buildCylinder(0.01 * s, 0.014 * s, 0.045 * s, 6, ox, oy + 0.21 * s, oz));
  return { red: body, green: mergeGeoms(leaves) };
}

function buildPepperParts(scale = 1, ox = 0, oy = 0, oz = 0) {
  const s = scale;
  const body = mergeGeoms([
    transformGeom(buildEllipsoid(0.045 * s, 0.12 * s, 0.045 * s, 8, 10, 0, 0, 0), 0.18, 0, 0.1, ox, oy + 0.115 * s, oz),
    transformGeom(buildCone(0.042 * s, 0.11 * s, 8, 0, 0, 0), Math.PI - 0.15, 0, -0.1, ox + 0.012 * s, oy + 0.055 * s, oz - 0.012 * s),
  ]);
  const stem = transformGeom(buildCylinder(0.01 * s, 0.016 * s, 0.055 * s, 6, 0, 0, 0), -0.35, 0, 0.2, ox - 0.01 * s, oy + 0.23 * s, oz + 0.02 * s);
  return { green: body, stem };
}

function buildMushroomParts(scale = 1, ox = 0, oy = 0, oz = 0) {
  const s = scale;
  const stem = buildCylinder(0.045 * s, 0.058 * s, 0.11 * s, 10, ox, oy + 0.055 * s, oz);
  const cap = buildEllipsoid(0.115 * s, 0.072 * s, 0.115 * s, 10, 12, ox, oy + 0.135 * s, oz);
  return { stem, cap };
}

function buildStrawberryParts(scale = 1, ox = 0, oy = 0, oz = 0) {
  const s = scale;
  // Inverted plump cone + rounded shoulder = unmistakable strawberry shape!
  const body = mergeGeoms([
    transformGeom(buildCone(0.088 * s, 0.145 * s, 10, 0, 0, 0), Math.PI, 0, 0, ox, oy + 0.073 * s, oz),
    buildEllipsoid(0.088 * s, 0.055 * s, 0.088 * s, 8, 10, ox, oy + 0.135 * s, oz),
  ]);
  const leaves = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    leaves.push(
      transformGeom(
        buildCone(0.026 * s, 0.065 * s, 4, 0, 0, 0),
        Math.PI * 0.42,
        a,
        0,
        ox + Math.sin(a) * 0.03 * s,
        oy + 0.18 * s,
        oz + Math.cos(a) * 0.03 * s,
      ),
    );
  }
  return { red: body, green: mergeGeoms(leaves) };
}

function buildFoodDocument(foodId) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh(`Food_${foodId}`);

  if (foodId === 'domates') {
    const p = buildTomatoParts(1.15);
    addPrimitive(doc, buffer, mesh, p.red, createMat(doc, 'TomatoRed', '#e63946', 0.35, 0.05));
    addPrimitive(doc, buffer, mesh, p.green, createMat(doc, 'LeafGreen', '#2d6a4f', 0.6, 0.02));
  } else if (foodId === 'biber') {
    const p = buildPepperParts(1.15);
    addPrimitive(doc, buffer, mesh, p.green, createMat(doc, 'PepperGreen', '#40916c', 0.35, 0.05));
    addPrimitive(doc, buffer, mesh, p.stem, createMat(doc, 'StemDark', '#2d5a3c', 0.65, 0.02));
  } else if (foodId === 'mantar') {
    const p = buildMushroomParts(1.15);
    addPrimitive(doc, buffer, mesh, p.stem, createMat(doc, 'MushStem', '#f5ebe0', 0.78, 0.02));
    addPrimitive(doc, buffer, mesh, p.cap, createMat(doc, 'MushCap', '#c9a684', 0.68, 0.02));
  } else if (foodId === 'cilek') {
    const p = buildStrawberryParts(1.15);
    addPrimitive(doc, buffer, mesh, p.red, createMat(doc, 'BerryRed', '#d62828', 0.38, 0.05));
    addPrimitive(doc, buffer, mesh, p.green, createMat(doc, 'BerryLeaf', '#40916c', 0.6, 0.02));
  } else if (foodId === 'yumurta') {
    // 6-egg molded carton tray!
    addPrimitive(doc, buffer, mesh, buildBox(0.28, 0.06, 0.19, 0, 0.03, 0), createMat(doc, 'Carton', '#d4b895', 0.85, 0.02));
    const eggs = [];
    for (const ex of [-0.085, 0, 0.085]) {
      for (const ez of [-0.045, 0.045]) {
        eggs.push(buildEllipsoid(0.034, 0.046, 0.034, 8, 10, ex, 0.082, ez));
      }
    }
    addPrimitive(doc, buffer, mesh, mergeGeoms(eggs), createMat(doc, 'EggShell', '#fff8ee', 0.45, 0.04));
  } else if (foodId === 'makarna') {
    // Pasta box with golden spaghetti sticks peeking out!
    addPrimitive(doc, buffer, mesh, buildBox(0.16, 0.24, 0.09, 0, 0.12, 0), createMat(doc, 'PastaBox', '#2b50aa', 0.55, 0.04));
    addPrimitive(doc, buffer, mesh, buildBox(0.11, 0.1, 0.094, 0, 0.13, 0), createMat(doc, 'PastaWindow', '#f4d35e', 0.45, 0.05));
    const strands = [];
    for (let i = -3; i <= 3; i += 1) {
      strands.push(transformGeom(buildCylinder(0.008, 0.008, 0.12, 6, 0, 0, 0), 0, 0, i * 0.06, i * 0.015, 0.27, 0));
    }
    addPrimitive(doc, buffer, mesh, mergeGeoms(strands), createMat(doc, 'Spaghetti', '#f2c14e', 0.6, 0.02));
  } else if (foodId === 'krema') {
    // Gable-top dairy cream carton!
    addPrimitive(doc, buffer, mesh, buildBox(0.13, 0.2, 0.13, 0, 0.1, 0), createMat(doc, 'CreamBox', '#fffdf8', 0.45, 0.04));
    addPrimitive(doc, buffer, mesh, buildBox(0.134, 0.06, 0.134, 0, 0.11, 0), createMat(doc, 'CreamBand', '#f2cc8f', 0.5, 0.04));
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      transformGeom(buildBox(0.13, 0.075, 0.09, 0, 0, 0), 0.65, 0, 0, 0, 0.225, -0.026),
      transformGeom(buildBox(0.13, 0.075, 0.09, 0, 0, 0), -0.65, 0, 0, 0, 0.225, 0.026),
      buildBox(0.13, 0.024, 0.018, 0, 0.265, 0),
    ]), createMat(doc, 'CreamTop', '#fffdf8', 0.45, 0.04));
    addPrimitive(doc, buffer, mesh, buildCylinder(0.018, 0.018, 0.024, 8, 0.025, 0.24, 0.036), createMat(doc, 'CreamCap', '#e07a5f', 0.4, 0.05));
  } else if (foodId === 'un') {
    // Plump rustic flour sack with tied top!
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildEllipsoid(0.115, 0.12, 0.095, 8, 10, 0, 0.12, 0),
      buildCylinder(0.085, 0.05, 0.075, 8, 0, 0.255, 0),
    ]), createMat(doc, 'FlourSack', '#f3e5d0', 0.85, 0.02));
    addPrimitive(doc, buffer, mesh, buildCylinder(0.058, 0.058, 0.022, 8, 0, 0.225, 0), createMat(doc, 'SackTie', '#d4a373', 0.8, 0.02));
    addPrimitive(doc, buffer, mesh, buildBox(0.09, 0.07, 0.02, 0, 0.12, 0.092), createMat(doc, 'WheatLabel', '#e9c46a', 0.7, 0.02));
  } else if (foodId === 'sut') {
    // Classic glass milk bottle with sky-blue label & cap!
    addPrimitive(doc, buffer, mesh, mergeGeoms([
      buildCylinder(0.068, 0.072, 0.16, 12, 0, 0.08, 0),
      buildCylinder(0.034, 0.068, 0.07, 12, 0, 0.195, 0),
      buildCylinder(0.036, 0.034, 0.05, 12, 0, 0.255, 0),
    ]), createMat(doc, 'MilkGlass', '#f8fdff', 0.25, 0.08));
    addPrimitive(doc, buffer, mesh, buildCylinder(0.072, 0.072, 0.07, 12, 0, 0.09, 0), createMat(doc, 'MilkLabel', '#5aa9e6', 0.45, 0.04));
    addPrimitive(doc, buffer, mesh, buildCylinder(0.04, 0.04, 0.024, 12, 0, 0.29, 0), createMat(doc, 'MilkCap', '#3a86ff', 0.35, 0.1));
  }

  scene.addChild(doc.createNode(`FoodNode_${foodId}`).setMesh(mesh));
  return doc;
}

/* ============================================================================
 * 3. KITCHEN STATIONS & 3D MARKET STALLS (ALL DRACO, y = 0 BOTTOM PIVOT)
 * ============================================================================ */
function buildFridgeDocument() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('FridgeMesh');

  const bodyMat = createMat(doc, 'FridgeBody', '#c7ece0', 0.34, 0.1);
  const doorMat = createMat(doc, 'FridgeDoor', '#dff6ee', 0.28, 0.08);
  const chromeMat = createMat(doc, 'Chrome', '#d0d9de', 0.2, 0.85);
  const accentMat = createMat(doc, 'MagnetCoral', '#e07a5f', 0.5, 0.05);
  const noteMat = createMat(doc, 'StickyNote', '#fde49c', 0.8, 0.02);

  addPrimitive(doc, buffer, mesh, buildBox(0.96, 1.96, 0.84, 0, 0.98, 0), bodyMat);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(0.88, 0.66, 0.06, 0, 1.57, 0.44),
    buildBox(0.88, 1.12, 0.06, 0, 0.62, 0.44),
  ]), doorMat);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildCylinder(0.024, 0.024, 0.28, 8, -0.32, 1.52, 0.5),
    buildCylinder(0.024, 0.024, 0.38, 8, -0.32, 0.84, 0.5),
  ]), chromeMat);
  addPrimitive(doc, buffer, mesh, buildEllipsoid(0.04, 0.04, 0.02, 6, 8, 0.18, 1.66, 0.48), accentMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.16, 0.16, 0.02, 0.06, 1.52, 0.48), noteMat);

  scene.addChild(doc.createNode('Fridge').setMesh(mesh));
  return doc;
}

function buildCuttingBoardDocument() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('CuttingBoardMesh');

  const cabMat = createMat(doc, 'Cabinet', '#e8d9c5', 0.75, 0.02);
  const drawerPull = createMat(doc, 'BrassPull', '#d4a373', 0.35, 0.6);
  const topMat = createMat(doc, 'Countertop', '#fff9f0', 0.45, 0.04);
  const woodMat = createMat(doc, 'ButcherWood', '#ba824b', 0.62, 0.02);
  const steelMat = createMat(doc, 'KnifeSteel', '#e2e8f0', 0.18, 0.9);
  const handleMat = createMat(doc, 'KnifeHandle', '#3b2f2f', 0.72, 0.05);

  addPrimitive(doc, buffer, mesh, buildBox(1.24, 0.86, 0.86, 0, 0.43, 0), cabMat);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(0.28, 0.03, 0.04, 0, 0.66, 0.44),
    buildBox(0.28, 0.03, 0.04, 0, 0.36, 0.44),
  ]), drawerPull);
  addPrimitive(doc, buffer, mesh, buildBox(1.3, 0.07, 0.92, 0, 0.895, 0), topMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.78, 0.055, 0.56, -0.05, 0.957, 0.04), woodMat);

  // Tapered chef knife
  addPrimitive(doc, buffer, mesh, transformGeom(buildBox(0.075, 0.012, 0.27, 0, 0, 0), 0, -0.35, 0, 0.21, 0.995, -0.03), steelMat);
  addPrimitive(doc, buffer, mesh, transformGeom(buildBox(0.042, 0.03, 0.14, 0, 0, 0), 0, -0.35, 0, 0.27, 1.003, 0.14), handleMat);

  // Sculpted real tomato, pepper & mushroom on the board (NO plain cylinders!)
  const tom = buildTomatoParts(0.68, -0.25, 0.985, -0.05);
  const pep = buildPepperParts(0.62, -0.07, 0.985, -0.09);
  const mush = buildMushroomParts(0.62, -0.14, 0.985, 0.12);

  addPrimitive(doc, buffer, mesh, tom.red, createMat(doc, 'TomatoRed', '#e63946', 0.35, 0.05));
  addPrimitive(doc, buffer, mesh, mergeGeoms([tom.green, pep.green]), createMat(doc, 'VegGreen', '#40916c', 0.45, 0.03));
  addPrimitive(doc, buffer, mesh, pep.stem, createMat(doc, 'StemDark', '#2d5a3c', 0.65, 0.02));
  addPrimitive(doc, buffer, mesh, mush.stem, createMat(doc, 'MushStem', '#f5ebe0', 0.78, 0.02));
  addPrimitive(doc, buffer, mesh, mush.cap, createMat(doc, 'MushCap', '#c9a684', 0.68, 0.02));

  scene.addChild(doc.createNode('CuttingBoard').setMesh(mesh));
  return doc;
}

function buildStoveDocument() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('StoveMesh');

  const bodyMat = createMat(doc, 'StoveBody', '#575d68', 0.42, 0.35);
  const glassMat = createMat(doc, 'OvenGlass', '#222730', 0.18, 0.55);
  const topMat = createMat(doc, 'Cooktop', '#2c3038', 0.35, 0.42);
  const grateMat = createMat(doc, 'Burner', '#1a1d22', 0.72, 0.25);
  const chromeMat = createMat(doc, 'HandleSteel', '#dce4ec', 0.2, 0.85);
  const copperMat = createMat(doc, 'CopperPot', '#d4845a', 0.28, 0.72);
  const woodMat = createMat(doc, 'PanWood', '#8d5b3a', 0.7, 0.02);

  addPrimitive(doc, buffer, mesh, buildBox(1.18, 0.9, 0.88, 0, 0.45, 0), bodyMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.88, 0.5, 0.04, 0, 0.36, 0.45), glassMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.22, 0.05, 0.92, 0, 0.925, 0), topMat);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(0.68, 0.04, 0.04, 0, 0.67, 0.49),
    buildCylinder(0.03, 0.03, 0.03, 8, -0.34, 0.83, 0.46),
    buildCylinder(0.03, 0.03, 0.03, 8, -0.12, 0.83, 0.46),
    buildCylinder(0.03, 0.03, 0.03, 8, 0.12, 0.83, 0.46),
    buildCylinder(0.03, 0.03, 0.03, 8, 0.34, 0.83, 0.46),
  ]), chromeMat);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildCylinder(0.14, 0.15, 0.03, 12, -0.28, 0.965, -0.18),
    buildCylinder(0.14, 0.15, 0.03, 12, 0.28, 0.965, -0.18),
    buildCylinder(0.14, 0.15, 0.03, 12, -0.28, 0.965, 0.2),
    buildCylinder(0.14, 0.15, 0.03, 12, 0.28, 0.965, 0.2),
    buildCylinder(0.22, 0.19, 0.08, 16, -0.24, 1.02, 0.18),
  ]), grateMat);
  addPrimitive(doc, buffer, mesh, buildBox(0.26, 0.035, 0.045, 0.07, 1.04, 0.22), woodMat);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildCylinder(0.16, 0.15, 0.2, 14, 0.28, 1.08, -0.18),
    buildEllipsoid(0.155, 0.035, 0.155, 8, 12, 0.28, 1.18, -0.18),
  ]), copperMat);

  scene.addChild(doc.createNode('Stove').setMesh(mesh));
  return doc;
}

function buildMarketProduceStall() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('MarketProduceMesh');

  const woodMat = createMat(doc, 'CrateWood', '#c68b59', 0.78, 0.02);
  const darkWood = createMat(doc, 'DarkWood', '#8c5a34', 0.8, 0.02);
  const awningCoral = createMat(doc, 'AwningCoral', '#e07a5f', 0.65, 0.02);
  const awningCream = createMat(doc, 'AwningCream', '#fff8ee', 0.65, 0.02);

  // Wooden base stand + 2 slanted produce bins (y = 0 bottom)
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(2.05, 0.72, 0.92, 0, 0.36, 0),
    buildBox(2.12, 0.06, 0.98, 0, 0.75, 0),
    // Crate dividers
    buildBox(0.05, 0.18, 0.82, -0.52, 0.87, 0),
    buildBox(0.05, 0.18, 0.82, 0.0, 0.87, 0),
    buildBox(0.05, 0.18, 0.82, 0.52, 0.87, 0),
    buildBox(2.06, 0.18, 0.05, 0, 0.87, 0.42),
    buildBox(2.06, 0.18, 0.05, 0, 0.87, -0.42),
  ]), woodMat);

  // Canopy posts
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(0.08, 1.25, 0.08, -0.96, 1.38, -0.4),
    buildBox(0.08, 1.25, 0.08, 0.96, 1.38, -0.4),
  ]), darkWood);

  // Striped market awning roof
  const coralStripes = [];
  const creamStripes = [];
  for (let i = 0; i < 6; i += 1) {
    const sx = -0.875 + i * 0.35;
    const panel = transformGeom(buildBox(0.35, 0.06, 1.05, 0, 0, 0), 0.24, 0, 0, sx, 1.92, 0.04);
    if (i % 2 === 0) coralStripes.push(panel);
    else creamStripes.push(panel);
  }
  addPrimitive(doc, buffer, mesh, mergeGeoms(coralStripes), awningCoral);
  addPrimitive(doc, buffer, mesh, mergeGeoms(creamStripes), awningCream);

  scene.addChild(doc.createNode('MarketProduce').setMesh(mesh));
  return doc;
}

function buildMarketDairyChiller() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('MarketDairyMesh');

  const frameMat = createMat(doc, 'ChillerFrame', '#eaf4f4', 0.35, 0.1);
  const coolBack = createMat(doc, 'CoolInterior', '#cae9ff', 0.4, 0.08);
  const shelfMat = createMat(doc, 'GlassShelf', '#ffffff', 0.2, 0.25);
  const headerMat = createMat(doc, 'DairyHeader', '#3a86ff', 0.45, 0.05);

  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(1.55, 0.56, 0.88, 0, 0.28, 0),
    buildBox(0.1, 1.45, 0.88, -0.725, 1.25, 0),
    buildBox(0.1, 1.45, 0.88, 0.725, 1.25, 0),
    buildBox(1.55, 0.14, 0.88, 0, 1.93, 0),
  ]), frameMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.36, 1.32, 0.12, 0, 1.22, -0.36), coolBack);
  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(1.35, 0.04, 0.7, 0, 0.58, 0.04),
    buildBox(1.35, 0.04, 0.62, 0, 1.08, 0),
    buildBox(1.35, 0.04, 0.54, 0, 1.5, -0.04),
  ]), shelfMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.42, 0.16, 0.06, 0, 1.92, 0.44), headerMat);

  scene.addChild(doc.createNode('MarketDairy').setMesh(mesh));
  return doc;
}

function buildMarketPantryShelf() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Scene');
  const mesh = doc.createMesh('MarketPantryMesh');

  const oakMat = createMat(doc, 'ShelfOak', '#b07d4f', 0.72, 0.02);
  const backMat = createMat(doc, 'ShelfBack', '#e6ccb2', 0.82, 0.02);
  const signMat = createMat(doc, 'PantrySign', '#40916c', 0.55, 0.03);

  addPrimitive(doc, buffer, mesh, mergeGeoms([
    buildBox(0.08, 1.9, 0.74, -0.66, 0.95, 0),
    buildBox(0.08, 1.9, 0.74, 0.66, 0.95, 0),
    buildBox(1.36, 0.06, 0.74, 0, 0.03, 0),
    buildBox(1.32, 0.05, 0.68, 0, 0.58, 0.02),
    buildBox(1.32, 0.05, 0.64, 0, 1.15, 0),
    buildBox(1.36, 0.08, 0.74, 0, 1.88, 0),
  ]), oakMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.26, 1.84, 0.06, 0, 0.95, -0.34), backMat);
  addPrimitive(doc, buffer, mesh, buildBox(1.2, 0.18, 0.05, 0, 1.86, 0.36), signMat);

  scene.addChild(doc.createNode('MarketPantry').setMesh(mesh));
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
    // 4 Selectable Rigged Characters
    { file: 'char_cat.glb', build: () => buildRiggedCharacter('cat') },
    { file: 'char_dog.glb', build: () => buildRiggedCharacter('dog') },
    { file: 'char_bubu.glb', build: () => buildRiggedCharacter('bubu') },
    { file: 'char_dudu.glb', build: () => buildRiggedCharacter('dudu') },
    // 3 Kitchen Stations
    { file: 'station_fridge.glb', build: buildFridgeDocument },
    { file: 'station_cutting_board.glb', build: buildCuttingBoardDocument },
    { file: 'station_stove.glb', build: buildStoveDocument },
    // 9 Sculpted Food Ingredients
    { file: 'food_domates.glb', build: () => buildFoodDocument('domates') },
    { file: 'food_biber.glb', build: () => buildFoodDocument('biber') },
    { file: 'food_yumurta.glb', build: () => buildFoodDocument('yumurta') },
    { file: 'food_mantar.glb', build: () => buildFoodDocument('mantar') },
    { file: 'food_makarna.glb', build: () => buildFoodDocument('makarna') },
    { file: 'food_krema.glb', build: () => buildFoodDocument('krema') },
    { file: 'food_cilek.glb', build: () => buildFoodDocument('cilek') },
    { file: 'food_un.glb', build: () => buildFoodDocument('un') },
    { file: 'food_sut.glb', build: () => buildFoodDocument('sut') },
    // 3 Walkable 3D Market Stalls
    { file: 'market_produce.glb', build: buildMarketProduceStall },
    { file: 'market_dairy.glb', build: buildMarketDairyChiller },
    { file: 'market_pantry.glb', build: buildMarketPantryShelf },
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
