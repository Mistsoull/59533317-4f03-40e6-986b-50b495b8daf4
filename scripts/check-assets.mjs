/**
 * Verifies all .glb files in public/models/ against the mandatory 3D Asset Contract:
 *  - Total size < 15 MB
 *  - Draco compression present (KHR_draco_mesh_compression)
 *  - Animated characters (char_*.glb) have skins + exact clips: Idle, Walk, Interact
 *  - Bottom-center pivot (minY near 0)
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const MODELS_DIR = path.resolve('public/models');
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const REQUIRED_CHAR_CLIPS = ['Idle', 'Walk', 'Interact'];

async function main() {
  if (!fs.existsSync(MODELS_DIR)) {
    console.error('Missing public/models directory.');
    process.exit(1);
  }

  const files = fs.readdirSync(MODELS_DIR).filter((f) => f.endsWith('.glb'));
  if (files.length === 0) {
    console.error('No .glb files found in public/models/. Run npm run generate:models first.');
    process.exit(1);
  }

  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  let totalBytes = 0;
  let failed = false;

  for (const file of files) {
    const fullPath = path.join(MODELS_DIR, file);
    const bytes = fs.statSync(fullPath).size;
    totalBytes += bytes;

    const doc = await io.read(fullPath);
    const hasDraco = doc
      .getRoot()
      .listExtensionsUsed()
      .some((ext) => ext.extensionName === 'KHR_draco_mesh_compression');

    let minY = Infinity;
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const arr = pos.getArray();
        for (let i = 1; i < arr.length; i += 3) {
          if (arr[i] < minY) minY = arr[i];
        }
      }
    }

    const clips = doc.getRoot().listAnimations().map((a) => a.getName());
    const skins = doc.getRoot().listSkins().length;

    const issues = [];
    if (!hasDraco) issues.push('missing KHR_draco_mesh_compression');
    if (Math.abs(minY) > 0.05) issues.push(`pivot minY=${minY.toFixed(3)} (expected ~0.0)`);

    if (file.startsWith('char_') || file.startsWith('cust_') || file === 'waiter.glb') {
      if (skins === 0) issues.push('missing skin for SkeletonUtils.clone');
      for (const reqClip of REQUIRED_CHAR_CLIPS) {
        if (!clips.includes(reqClip)) issues.push(`missing clip "${reqClip}"`);
      }
    }

    if (issues.length > 0) {
      failed = true;
      console.error(`FAIL ${file}: ${issues.join(', ')}`);
    } else {
      console.log(
        `PASS ${file} — ${(bytes / 1024).toFixed(1)} KB | Draco: yes | minY: ${minY.toFixed(3)} | skins: ${skins} | clips: [${clips.join(', ')}]`,
      );
    }
  }

  const totalMb = totalBytes / (1024 * 1024);
  console.log(`\nTotal 3D scene models size: ${totalMb.toFixed(3)} MB / 15.000 MB budget`);
  if (totalBytes >= MAX_TOTAL_BYTES) {
    console.error('FAIL: Total model size exceeds 15 MB budget!');
    failed = true;
  }

  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
