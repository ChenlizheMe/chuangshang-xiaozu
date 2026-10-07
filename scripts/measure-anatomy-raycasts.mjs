// CPU-only comparison of the baseline BVH and the actual anatomy raycast helper.
// Place in scripts/. TRAUMA_REPO is only needed when running from another directory.
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
const repo = process.env.TRAUMA_REPO || fileURLToPath(new URL("../", import.meta.url));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
let sourceCommit = null;
try {
  sourceCommit = execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
}
const helper = { file: "src/anatomyRaycast.js", sha256: sha256(fs.readFileSync(path.join(repo, "src/anatomyRaycast.js"))) };
const packageVersion = (name) => JSON.parse(fs.readFileSync(path.join(repo, "node_modules", name, "package.json"), "utf8")).version;
const packages = Object.fromEntries(["three", "three-mesh-bvh", "@gltf-transform/core", "draco3dgltf"].map((name) => [name, packageVersion(name)]));
const require2 = createRequire(repo + "/package.json");
const { NodeIO } = await import(require2.resolve("@gltf-transform/core"));
const { KHRDracoMeshCompression } = await import(require2.resolve("@gltf-transform/extensions"));
const draco3d = require2("draco3dgltf");
const THREE = require2("three");
const { anatomyRaycast } = await import(pathToFileURL(path.join(repo, "src/anatomyRaycast.js")).href);
const { MeshBVH, acceleratedRaycast, estimateMemoryInBytes } = require2("three-mesh-bvh");
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["skeletal_male.glb", "skeleton-mobile.glb", "muscle-optimized.glb", "muscle-mobile.glb", "organs-optimized.glb", "organs-mobile.glb"];
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const results = [];
for (const file of files) {
  const loadStart = performance.now();
  const doc = await io.read(repo + "/public/anatomy/" + file);
  const bytes = fs.readFileSync(repo + "/public/anatomy/" + file);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  const decodedMs = performance.now() - loadStart;
  const primitive = new THREE.Group();
  primitive.position.set(0, -0.857, -5e-3);
  const group = new THREE.Group();
  group.add(primitive);
  let meshCount = 0, triangles = 0, bvhAndGeometryEstimatedBytes = 0, bvhMs = 0, raycasts = 0, acceleratedCalls = 0, broadPhase = false;
  for (const node of doc.getRoot().listNodes().filter((n) => n.getMesh())) for (const p of node.getMesh().listPrimitives()) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(p.getAttribute("POSITION").getArray(), 3));
    geometry.setIndex(new THREE.BufferAttribute(p.getIndices().getArray(), 1));
    const start = performance.now();
    geometry.boundsTree = new MeshBVH(geometry, { maxLeafTris: 10 });
    bvhMs += performance.now() - start;
    bvhAndGeometryEstimatedBytes += estimateMemoryInBytes(geometry.boundsTree);
    const def = json.nodes.find((n) => n.name === node.getName() && n.mesh !== void 0);
    if (!def) throw Error("Missing source node " + node.getName());
    const primitiveIndex = node.getMesh().listPrimitives().indexOf(p);
    const accessor = json.accessors[json.meshes[def.mesh].primitives[primitiveIndex].attributes.POSITION];
    if (!accessor.min || !accessor.max) throw Error("Missing source bounds " + node.getName());
    geometry.boundingSphere = new THREE.Box3(new THREE.Vector3(...accessor.min), new THREE.Vector3(...accessor.max)).getBoundingSphere(new THREE.Sphere());
    const bvhRaycast = geometry.boundsTree.raycastFirst;
    geometry.boundsTree.raycastFirst = function(...args) {
      acceleratedCalls++;
      return bvhRaycast.apply(this, args);
    };
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.name = node.getName();
    mesh.matrixAutoUpdate = false;
    mesh.matrix.fromArray(node.getWorldMatrix());
    mesh.raycast = function(ray2, intersections) {
      raycasts++;
      return (broadPhase ? anatomyRaycast : acceleratedRaycast).call(this, ray2, intersections);
    };
    primitive.add(mesh);
    meshCount++;
    triangles += p.getIndices().getCount() / 3;
  }
  group.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(38, 390 / 844, 0.1, 1e3);
  camera.position.set(0, 0, 3.8);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;
  const views = [];
  for (const position of [[0, 0, 3.8], [3.8, 0, 0], [0, 0, 0.602]]) {
    camera.position.fromArray(position);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const points = [];
    for (let y = -0.9; y <= 0.9; y += 0.075) for (let x = -0.9; x <= 0.9; x += 0.1125) points.push(new THREE.Vector2(x, y));
    for (const mesh of primitive.children) {
      const projected = mesh.geometry.boundingSphere.center.clone().applyMatrix4(mesh.matrixWorld).project(camera);
      if (projected.z >= -1 && projected.z <= 1 && Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1) points.push(new THREE.Vector2(projected.x, projected.y));
    }
    views.push({ position, points });
  }
  const cast = (roots) => {
    const hits = [];
    for (const view of views) {
      camera.position.fromArray(view.position);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      for (const point of view.points) {
        ray.setFromCamera(point, camera);
        const raw = roots.flatMap((root) => ray.intersectObject(root, true)).sort((a, b) => a.distance - b.distance);
        const seen = /* @__PURE__ */ new Set();
        const unique = raw.filter((item) => {
          const key = item.object.uuid + "/" + item.index + "/" + item.instanceId;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        hits.push(unique.map((item) => item.object.name + "@" + item.distance.toFixed(9)).join("|"));
      }
    }
    return hits;
  };
  broadPhase = false;
  cast([group]);
  broadPhase = true;
  cast([group]);
  broadPhase = false;
  raycasts = 0;
  acceleratedCalls = 0;
  const beforeHits = cast([group]), beforeCalls = raycasts, beforeAcceleratedCalls = acceleratedCalls;
  broadPhase = true;
  raycasts = 0;
  acceleratedCalls = 0;
  const afterHits = cast([group]), afterCalls = raycasts, afterAcceleratedCalls = acceleratedCalls;
  if (JSON.stringify(beforeHits) !== JSON.stringify(afterHits)) throw Error("Ray result changed: " + file);
  const before = [], after = [];
  for (let i = 0; i < 5; i++) for (const variant of i % 2 ? ["after", "before"] : ["before", "after"]) {
    broadPhase = variant === "after";
    const start = performance.now();
    cast([group]);
    (variant === "before" ? before : after).push(performance.now() - start);
  }
  const result = { file, sha256: sha256(bytes), bytes: fs.statSync(repo + "/public/anatomy/" + file).size, meshCount, triangles, decodeAndParseMs: decodedMs, bvhBuildMs: bvhMs, bvhAndGeometryEstimatedBytes, events: views.reduce((sum, v) => sum + v.points.length, 0), views: views.map((v) => ({ position: v.position, events: v.points.length })), hitEvents: beforeHits.filter(Boolean).length, beforeRaycasts: beforeCalls, afterRaycasts: afterCalls, beforeAcceleratedCalls, afterAcceleratedCalls, identicalSortedHits: true, beforeMedianMs: median(before), afterMedianMs: median(after), beforeRunsMs: before, afterRunsMs: after };
  results.push(result);
  primitive.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
}
console.log(JSON.stringify({ method: "Node CPU benchmark, real decoded atlas geometry and world transforms, Three raycaster with BVH. Compares one-root BVH raycasting with and without the actual current src/anatomyRaycast.js production helper including shear/degenerate guards and conservative radius padding, followed by sort and dedup. Bounding sphere from original GLB accessor min/max, matching GLTFLoader, prepared outside timed query work; front/side/close-up views plus all in-frustum part centers; geometry and leaf10 unchanged. No rendering, network, browser or true-device FPS claim. 5 alternating rounds after warmup; all sorted hits identical.", commit: sourceCommit, node: process.version, platform: process.platform, architecture: process.arch, packages, helper, configuration: { maxLeafTris: 10, firstHitOnly: true, rounds: 5, aspect: 390 / 844, fov: 38, cameraNear: 0.1, cameraFar: 1e3, rootTranslation: [0, -0.857, -5e-3] }, results }, null, 2));
