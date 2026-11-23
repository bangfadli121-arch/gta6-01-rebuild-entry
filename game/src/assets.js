// assets.js — loads the vendored Kenney GLB assets (CC0) via GLTFLoader.
// Every model is cached after first load; loadGLB returns the CACHED
// original (callers must clone it via cloneModel before mutating, so the
// cache is never corrupted). Returns null on failure so the caller can
// fall back to a procedural model.
import * as THREE from "three";
import { GLTFLoader } from "../vendor/loaders/GLTFLoader.min.js";

const loader = new GLTFLoader();
const cache = new Map();

// Warm the cache for a list of paths in parallel (loading screen).
export async function preload(paths) {
  await Promise.all(paths.map((p) => loadGLB(p)));
  return cache.size;
}

export async function loadGLB(path) {
  if (cache.has(path)) return cache.get(path);
  try {
    const gltf = await loader.loadAsync(path);
    cache.set(path, gltf.scene);
    return gltf.scene;
  } catch (e) {
    console.warn("asset failed:", path, e);
    return null;
  }
}

// Clone a cached model (deep clone, shares geometry/material).
export function cloneModel(model) {
  return model ? model.clone(true) : null;
}

// Fit a model into a target box (w,h,d) by uniform scaling, centred on the
// ground (min.y = 0). Returns the scale used.
export function fitToBox(obj, w, h, d) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const s = Math.min(w / (size.x || 1), h / (size.y || 1), d / (size.z || 1));
  obj.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  return s;
}

// Repaint every mesh of a model with one material (used for the hero car:
// Kenney body becomes Skyline blue; details are added on top).
export function repaint(obj, material, onlyName) {
  obj.traverse((o) => {
    if (o.isMesh && (!onlyName || o.name === onlyName)) o.material = material;
  });
}

export const CARS = {
  race: "assets/cars/race.glb",
  sedanSports: "assets/cars/sedan-sports.glb",
  sedan: "assets/cars/sedan.glb",
  hatchSports: "assets/cars/hatchback-sports.glb",
  suv: "assets/cars/suv.glb",
  van: "assets/cars/van.glb",
  taxi: "assets/cars/taxi.glb",
  police: "assets/cars/police.glb",
  truck: "assets/cars/truck.glb",
};

export const BUILDINGS = {
  mid: ["assets/buildings/commercial/building-a.glb", "assets/buildings/commercial/building-b.glb", "assets/buildings/commercial/building-c.glb", "assets/buildings/commercial/building-d.glb", "assets/buildings/commercial/building-e.glb", "assets/buildings/commercial/building-f.glb", "assets/buildings/commercial/building-g.glb", "assets/buildings/commercial/building-h.glb"],
  tall: ["assets/buildings/commercial/building-skyscraper-a.glb", "assets/buildings/commercial/building-skyscraper-b.glb", "assets/buildings/commercial/building-skyscraper-c.glb"],
  low: ["assets/buildings/commercial/low-detail-building-a.glb", "assets/buildings/commercial/low-detail-building-b.glb", "assets/buildings/commercial/low-detail-building-c.glb", "assets/buildings/commercial/low-detail-building-d.glb"],
  house: ["assets/buildings/suburban/building-type-a.glb", "assets/buildings/suburban/building-type-b.glb", "assets/buildings/suburban/building-type-c.glb", "assets/buildings/suburban/building-type-d.glb", "assets/buildings/suburban/building-type-e.glb", "assets/buildings/suburban/building-type-f.glb"],
  industrial: ["assets/buildings/industrial/industrial-a.glb", "assets/buildings/industrial/industrial-b.glb", "assets/buildings/industrial/industrial-c.glb", "assets/buildings/industrial/industrial-d.glb"],
};

export const PROPS = {
  awning: "assets/props/commercial/detail-awning.glb",
  awningWide: "assets/props/commercial/detail-awning-wide.glb",
  lampCurved: "assets/props/roads/light-curved.glb",
  lampSquare: "assets/props/roads/light-square.glb",
  containerA: "assets/props/industrial/shipping-container-a.glb",
  containerB: "assets/props/industrial/shipping-container-b.glb",
  containerC: "assets/props/industrial/shipping-container-c.glb",
  tank: "assets/props/industrial/detail-tank.glb",
  chimney: "assets/props/industrial/chimney-medium.glb",
};
