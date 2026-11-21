"use client";

// LAB 4 · la capture « TOKYO NIGHT » fournie par l'utilisateur (public/tokyo_night.glb).
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export default function TokyoLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [info, setInfo] = useState("chargement");
  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current!, antialias: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#05070a");
    const cam = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
    const w = window as unknown as Record<string, unknown>;
    const resize = () => { const c = canvas.current!; renderer.setSize(c.clientWidth, c.clientHeight, false); cam.aspect = c.clientWidth / c.clientHeight; cam.updateProjectionMatrix(); };
    resize();
    const f = new URLSearchParams(location.search).get("f");
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(f ? `/city/tokyo/tokyo-${f}.glb` : "/tokyo_night.glb", (g) => {
      scene.add(g.scene);
      const box = new THREE.Box3().setFromObject(g.scene);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      w.__box = { min: box.min.toArray(), max: box.max.toArray(), size: size.toArray(), c: c.toArray() };
      w.__view = (px: number, py: number, pz: number, tx: number, ty: number, tz: number, fov = 50) => {
        cam.position.set(px, py, pz); cam.fov = fov; cam.updateProjectionMatrix(); cam.lookAt(tx, ty, tz); renderer.render(scene, cam);
      };
      const d = Math.max(size.x, size.y, size.z);
      (w.__view as (...a: number[]) => void)(c.x + d * 0.8, c.y + d * 0.5, c.z + d * 0.8, c.x, c.y, c.z);
      const rc = new THREE.Raycaster();
      w.__pick = (x: number, y: number) => { rc.setFromCamera(new THREE.Vector2(x, y), cam); const h = rc.intersectObject(g.scene, true)[0]; return h ? h.point.toArray() : null; };
      setInfo("ok"); w.__ready = true;
    }, undefined, (e) => setInfo(String(e)));
    return () => renderer.dispose();
  }, []);
  return <main className="fixed inset-0 bg-black"><canvas ref={canvas} className="w-full h-full" /><p className="absolute top-2 left-2 text-white text-xs">{info}</p></main>;
}
