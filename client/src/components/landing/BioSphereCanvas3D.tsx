import React, { useEffect, useRef } from "react";
import { Renderer, Camera, Transform, Mesh, Program, Sphere, Torus } from "ogl";
import { useReducedMotion } from "framer-motion";

interface BioSphereCanvas3DProps {
  className?: string;
}

export function BioSphereCanvas3D({ className = "" }: BioSphereCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || shouldReduceMotion) return;

    let renderer: Renderer | null = null;
    let animationFrameId: number;

    try {
      renderer = new Renderer({
        canvas,
        alpha: true,
        antialias: true,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      // Graceful fallback if WebGL not supported
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const camera = new Camera(gl, { fov: 38 });
    camera.position.set(0, 0, 5.2);

    const scene = new Transform();

    // Responsive resize handler
    function resize() {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height);
      camera.perspective({ aspect: width / height });
    }

    window.addEventListener("resize", resize);
    resize();

    // Shaders for holographic bio-neural mesh
    const vertexShader = /* glsl */ `
      attribute vec3 position;
      attribute vec3 normal;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normal;
        vPosition = position;
        // Organic pulse displacement simulating cellular respiration
        vec3 pos = position + normal * (sin(position.y * 3.5 + uTime * 1.8) * 0.04 + cos(position.x * 3.5 + uTime * 1.2) * 0.04);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = /* glsl */ `
      precision highp float;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        float fresnel = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 2.2);
        
        // Medical tech palette: emerald-500 (#10b981) to cyan-400 (#22d3ee)
        vec3 colorA = vec3(0.063, 0.725, 0.506);
        vec3 colorB = vec3(0.024, 0.714, 0.831);
        vec3 color = mix(colorA, colorB, sin(vPosition.y * 2.5 + uTime * 0.8) * 0.5 + 0.5);
        
        float alpha = clamp(fresnel * 0.95 + 0.08, 0.0, 1.0);
        gl_FragColor = vec4(color * (fresnel * 1.5 + 0.25), alpha);
      }
    `;

    const ringFragmentShader = /* glsl */ `
      precision highp float;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vec3 normal = normalize(vNormal);
        float fresnel = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), 1.8);
        vec3 ringColor = vec3(0.063, 0.825, 0.65);
        gl_FragColor = vec4(ringColor * (fresnel + 0.4), fresnel * 0.7 + 0.15);
      }
    `;

    const sphereGeom = new Sphere(gl, { radius: 1.15, widthSegments: 48, heightSegments: 36 });
    const sphereProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      cullFace: null,
      depthTest: true,
    });
    const sphereMesh = new Mesh(gl, { geometry: sphereGeom, program: sphereProgram });
    sphereMesh.setParent(scene);

    // Orbital ring (biometric diagnostic scan ring)
    const ringGeom = new Torus(gl, { radius: 1.6, tube: 0.022, radialSegments: 16, tubularSegments: 64 });
    const ringProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: ringFragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      cullFace: null,
    });
    const ringMesh1 = new Mesh(gl, { geometry: ringGeom, program: ringProgram });
    ringMesh1.rotation.x = Math.PI / 3;
    ringMesh1.rotation.y = Math.PI / 6;
    ringMesh1.setParent(scene);

    const ringMesh2 = new Mesh(gl, { geometry: ringGeom, program: ringProgram });
    ringMesh2.rotation.x = -Math.PI / 4;
    ringMesh2.rotation.z = Math.PI / 4;
    ringMesh2.scale.set(1.15, 1.15, 1.15);
    ringMesh2.setParent(scene);

    // Mouse interactive tracking with inertia
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.45;
      targetY = y * 0.35;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let lastTime = performance.now();
    let scrollYOffset = 0;

    const handleScroll = () => {
      scrollYOffset = window.scrollY * 0.001;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Render loop
    const update = (now: number) => {
      animationFrameId = requestAnimationFrame(update);
      const delta = (now - lastTime) * 0.001;
      lastTime = now;

      // Smooth mouse lerp
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      const timeVal = now * 0.001;
      sphereProgram.uniforms.uTime.value = timeVal;
      ringProgram.uniforms.uTime.value = timeVal;

      // Base rotations + mouse influence + scroll influence
      sphereMesh.rotation.y = timeVal * 0.35 + mouseX + scrollYOffset * 1.5;
      sphereMesh.rotation.x = Math.sin(timeVal * 0.2) * 0.15 + mouseY;

      ringMesh1.rotation.z = timeVal * 0.45;
      ringMesh1.rotation.y = Math.PI / 6 + mouseX * 0.5;
      ringMesh1.rotation.x = Math.PI / 3 + mouseY * 0.5;

      ringMesh2.rotation.z = -timeVal * 0.35;
      ringMesh2.rotation.y = -Math.PI / 4 + mouseX * 0.3;

      renderer?.render({ scene, camera });
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [shouldReduceMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Ambient background glow behind 3D object */}
      <div className="pointer-events-none absolute h-[22rem] w-[22rem] rounded-full bg-emerald-500/15 blur-[100px] dark:bg-emerald-400/20" />
      <div className="pointer-events-none absolute h-[18rem] w-[18rem] translate-x-12 translate-y-8 rounded-full bg-cyan-500/15 blur-[90px] dark:bg-cyan-400/20" />
      
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="relative z-10 h-full w-full max-h-[30rem] max-w-[30rem] cursor-grab active:cursor-grabbing"
      />

      {/* Floating telemetry pills around 3D sphere */}
      <div className="pointer-events-none absolute top-6 left-2 z-20 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-emerald-600 shadow-lg backdrop-blur-md dark:border-emerald-400/20 dark:bg-zinc-900/80 dark:text-emerald-400 animate-pulse">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Neural Model: Active (RxNorm 2026.4)
      </div>

      <div className="pointer-events-none absolute bottom-8 right-2 z-20 flex items-center gap-2 rounded-full border border-cyan-500/20 bg-background/80 px-3 py-1.5 text-[11px] font-medium text-cyan-600 shadow-lg backdrop-blur-md dark:border-cyan-400/20 dark:bg-zinc-900/80 dark:text-cyan-400">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
        Consilium Consensus: 99.4%
      </div>
    </div>
  );
}
