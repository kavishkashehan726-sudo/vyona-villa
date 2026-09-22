# 🎨 Villa Public Site - Modern Visual Effects & 3D Integration Architecture

This document serves as the complete technical and visual specifications guide for building an immersive, luxury, high-engagement storefront for the Villa Booking Engine using **Three.js** and WebGL shaders.

## 1. Visual Effects & 3D Feature Matrix

| Feature / Effect | Technology / Library | UX Purpose & Visual Impact | Performance Considerations | 
 | ----- | ----- | ----- | ----- | 
| **Interactive 3D Villa Model / Map** | Three.js (`@react-three/fiber` + `@react-three/drei`) | Guests can orbit, pan, and click on individual villa zones (Pool, Master Suite, Deck) loaded directly via `.gltf`/`.glb` models. | Draco-compressed GLTF assets; lower polygon counts for mobile GLTF variants. | 
| **Custom WebGL Water/Shader Effects** | Three.js GLSL Shaders | Realistic pool/ocean surface reflection and wave animation around the villa model. | Handled directly on the GPU context via custom vertex/fragment shaders. |
| **Cinematic Video Reveal & Ambient Loop** | HTML5 Video / Next.js Dynamic Import | Immediate high-end luxury vibe on the Hero section with seamless background looping. | Muted playback, compressed `.webm` / `.mp4` format served via CDN edge. | 
| **Deep Parallax 2.0 & Scroll Masking** | GSAP + ScrollTrigger | Layers (Background greenery, Villa structural lines, Foreground content) move at independent speeds during scroll. | Smooth 60 FPS transitions using CSS `transform3d`. | 
| **Liquid / Shader Hover Effects** | React Three Fiber (R3F) Shaders | Hovering over gallery photos or room cards triggers a subtle water-ripple distortion effect. | Offloaded to WebGL GPU context. | 
| **Magnetic Buttons & Dynamic Cursor** | Framer Motion | CTAs ("Book Now", "Select Dates") feature a magnetic spring interaction that pulls towards the user's cursor. | Lightweight React state updates with low frame footprint. | 
| **Blur-Up Asset Loading** | Next/Image + Cloudinary CDN | High-res photography dynamically fades in from ultra-low resolution blurred placeholders. | Eliminates layout shifts (CLS < 0.1). | 

## 2. Interactive 3D Integration Workflow (Three.js / React Three Fiber)

Incorporating a native Three.js scene allows full control over lighting, materials, and interactivity.

```
                      ┌─────────────────────────────────────────┐
                      │     3D Model File (.glb with Draco)     │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │   R3F Canvas & GLTF Loader (`useGLTF`)  │
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │ Mesh Event Listeners (onPointerOver/Click)│
                      └──────────────┬───────────────────┬──────┘
                                     │                   │
                                     ▼                   ▼
        ┌──────────────────────────────────────┐       ┌──────────────────────────────────────┐
        │  Hover: Mesh Emission & Price Tag    │       │ Click: Camera Focus & Calendar Modal │
        └──────────────────────────────────────┘       └──────────────────────────────────────┘

```

## 3. Implementation Code Snippets

### A. Pure Three.js Villa Interactive Viewer Component (`@react-three/fiber`)

`components/3d/VillaThreeViewer.jsx`

```jsx
import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows, Html } from '@react-three/drei';

function VillaModel({ onRoomSelect }) {
  // Load Draco-compressed GLTF model
  const { scene, nodes, materials } = useGLTF('/models/villa-complex.glb');
  const [hoveredZone, setHoveredZone] = useState(null);

  return (
    <primitive object={scene} scale={1.5}>
      {/* Interactive Raycasting Zone over Master Suite Mesh */}
      <mesh
        geometry={nodes.MasterSuiteMesh?.geometry}
        material={materials.SuiteMaterial}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredZone('Master Suite');
        }}
        onPointerOut={() => setHoveredZone(null)}
        onClick={(e) => {
          e.stopPropagation();
          onRoomSelect('Master Suite');
        }}
      >
        {hoveredZone === 'Master Suite' && (
          <Html position={[0, 2, 0]} center distanceFactor={10}>
            <div className="bg-stone-900/90 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/30 text-xs shadow-xl backdrop-blur-md whitespace-nowrap">
              ✨ Master Suite — Tap to Inspect
            </div>
          </Html>
        )}
      </mesh>
    </primitive>
  );
}

export default function VillaThreeViewer({ onRoomSelect }) {
  return (
    <div className="relative w-full h-[500px] md:h-[700px] rounded-3xl overflow-hidden bg-stone-950">
      <Canvas camera={{ position: [10, 8, 15], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[10, 20, 15]} intensity={1.5} castShadow />
        
        <Suspense fallback={
          <Html center>
            <div className="text-amber-500 font-serif animate-pulse">Loading 3D Villa Experience...</div>
          </Html>
        }>
          <VillaModel onRoomSelect={onRoomSelect} />
          <Environment preset="city" />
          <ContactShadows position={[0, -0.5, 0]} opacity={0.6} scale={20} blur={2} far={4} />
        </Suspense>

        <OrbitControls 
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 2.1}
          maxDistance={25}
          minDistance={8}
        />
      </Canvas>
      <div className="absolute bottom-6 left-6 bg-black/50 backdrop-blur-md px-4 py-2 rounded-xl text-white text-xs border border-white/10">
        🖱️ Left Click + Drag to Orbit | Scroll to Zoom | Click Room to Inspect
      </div>
    </div>
  );
}

// Pre-load model for instant rendering
useGLTF.preload('/models/villa-complex.glb');
```

### B. Magnetic CTA Button with Micro-Interaction

`components/ui/MagneticButton.jsx`

```jsx
import { useRef, useState } from "react";
import { motion } from "framer-motion";

export default function MagneticButton({ children, onClick }) {
  const ref = useRef(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e) => {
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    
    // Magnetic pull strength calculations
    setPosition({ x: middleX / 3, y: middleY / 3 });
  };

  const reset = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={reset}
      onClick={onClick}
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }}
      className="px-8 py-4 bg-amber-600 text-white rounded-full font-medium tracking-wide shadow-xl hover:bg-amber-700 transition-colors cursor-pointer"
    >
      {children}
    </motion.button>
  );
}
```

### C. GSAP Deep Parallax & Image Unveil

`components/sections/VillaParallaxSection.jsx`

```jsx
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function VillaParallaxSection() {
  const sectionRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const el = sectionRef.current;
    
    gsap.fromTo(
      imageRef.current,
      { y: "-20%", scale: 1.15 },
      {
        y: "15%",
        scale: 1.0,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  }, []);

  return (
    <section ref={sectionRef} className="relative h-screen overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 z-0">
        <img
          ref={imageRef}
          src="/images/villa-hero-3d-view.webp"
          alt="Villa View"
          className="w-full h-[120%] object-cover"
        />
      </div>
      <div className="relative z-10 text-center text-white p-8 bg-black/40 backdrop-blur-lg rounded-3xl max-w-xl border border-white/10 shadow-2xl">
        <h2 className="text-4xl font-serif font-bold mb-4 tracking-tight">Unmatched Architectural Luxury</h2>
        <p className="text-stone-300 text-sm leading-relaxed">
          Step into a curated sanctuary where modern design seamlessly merges with coastal tranquility.
        </p>
      </div>
    </section>
  );
}
```

## 4. Mobile Performance & Fallback Optimization

To maintain ultra-fast loading speed and high SEO scores on mobile networks:

1. **Conditional 3D Canvas Execution:** Automatically detect GPU/screen capabilities. On lower-end mobile hardware, replace the interactive 3D WebGL model with a high-resolution 360-degree interactive image sequence or CSS fallback slider.

2. **GPU Acceleration Rules:** Restrict continuous CSS animations strictly to `transform` and `opacity` properties to keep frames locked at 60 FPS.

3. **Draco Compression Pipeline:** Convert all 3D `.gltf`/`.glb` models using Draco compression via `gltf-pipeline` to shrink file sizes by up to 80-90%.