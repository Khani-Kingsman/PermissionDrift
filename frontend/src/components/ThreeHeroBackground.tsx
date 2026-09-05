import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeHeroBackgroundProps {
  theme?: 'black' | 'white';
}

export const ThreeHeroBackground: React.FC<ThreeHeroBackgroundProps> = ({ theme = 'white' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const pointLightRef = useRef<THREE.PointLight | null>(null);
  const sparkMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  // Initialize Three.js scene once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const isBlack = theme === 'black';
    scene.fog = new THREE.FogExp2(isBlack ? 0x07080c : 0xffffff, isBlack ? 0.0018 : 0.0015);

    let width = container.clientWidth;
    let height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 32;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(isBlack ? 0x07080c : 0xffffff, 1);
    container.appendChild(renderer.domElement);

    // Main Geometry: Wireframe Torus Knot
    const geometry = new THREE.TorusKnotGeometry(9.5, 2.6, 120, 16);
    const material = new THREE.MeshPhysicalMaterial({
      color: isBlack ? 0x888888 : 0x555555,
      emissive: 0x000000,
      metalness: 0.4,
      roughness: 0.1,
      wireframe: true,
      transparent: true,
      opacity: isBlack ? 0.32 : 0.22,
    });
    materialRef.current = material;
    const torusKnot = new THREE.Mesh(geometry, material);
    scene.add(torusKnot);

    // Particle System: Sparks matching the amber accent node
    const sparkCount = 120;
    const sparkGeo = new THREE.CircleGeometry(0.18, 3);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: isBlack ? 0xf97316 : 0xd4af37, // Amber / Gold
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    sparkMatRef.current = sparkMat;
    const sparks = new THREE.InstancedMesh(sparkGeo, sparkMat, sparkCount);
    torusKnot.add(sparks);

    // Spark Movement Logic
    const dummy = new THREE.Object3D();
    const sparkData: { speed: number; progress: number; pathIndex: number }[] = [];
    const radialSegments = 16;
    const tubularSegments = 120;

    for (let i = 0; i < sparkCount; i++) {
      sparkData.push({
        speed: 0.0008 + Math.random() * 0.0018,
        progress: Math.random(),
        pathIndex: Math.floor(Math.random() * radialSegments),
      });
    }

    const posAttribute = geometry.attributes.position;
    const stride = radialSegments + 1;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();

    function updateSparks() {
      sparkData.forEach((spark, i) => {
        spark.progress += spark.speed;
        if (spark.progress >= 1) spark.progress = 0;

        const exactInd = spark.progress * tubularSegments;
        const u = Math.floor(exactInd);
        const nextU = (u + 1) % tubularSegments;
        const v = spark.pathIndex;

        const idx1 = (u * stride + v) * 3;
        const idx2 = (nextU * stride + v) * 3;

        v1.fromArray(posAttribute.array, idx1);
        v2.fromArray(posAttribute.array, idx2);
        v1.lerp(v2, exactInd - u);

        dummy.position.copy(v1);
        dummy.lookAt(v2);
        dummy.updateMatrix();
        sparks.setMatrixAt(i, dummy.matrix);
      });
      sparks.instanceMatrix.needsUpdate = true;
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(isBlack ? 0x444444 : 0xffffff, isBlack ? 1.0 : 0.9);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const pLight1 = new THREE.PointLight(isBlack ? 0xf97316 : 0xd4af37, isBlack ? 2.2 : 1.2, 70);
    pLight1.position.set(12, 12, 12);
    pointLightRef.current = pLight1;
    scene.add(pLight1);

    // Mouse Interaction
    let mouseX = 0,
      mouseY = 0;
    let targetX = 0,
      targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (e.clientX - windowHalfX) * 0.0004;
      mouseY = (e.clientY - windowHalfY) * 0.0004;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      targetX = mouseX * 0.4;
      targetY = mouseY * 0.4;

      torusKnot.rotation.y += 0.03 * (targetX - torusKnot.rotation.y) + 0.0015;
      torusKnot.rotation.x += 0.03 * (targetY - torusKnot.rotation.x) + 0.0008;

      updateSparks();
      renderer.render(scene, camera);
    };

    animate();

    const onResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', onResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      renderer.dispose();
    };
  }, []);

  // Update theme dynamically without re-creating WebGL renderer
  useEffect(() => {
    const isBlack = theme === 'black';
    if (rendererRef.current && sceneRef.current && materialRef.current) {
      rendererRef.current.setClearColor(isBlack ? 0x07080c : 0xffffff, 1);
      if (sceneRef.current.fog) {
        sceneRef.current.fog.color.setHex(isBlack ? 0x07080c : 0xffffff);
      }
      materialRef.current.color.setHex(isBlack ? 0x888888 : 0x555555);
      materialRef.current.opacity = isBlack ? 0.32 : 0.22;
      if (ambientLightRef.current) {
        ambientLightRef.current.color.setHex(isBlack ? 0x444444 : 0xffffff);
      }
      if (pointLightRef.current) {
        pointLightRef.current.color.setHex(isBlack ? 0xf97316 : 0xd4af37);
        pointLightRef.current.intensity = isBlack ? 2.2 : 1.2;
      }
      if (sparkMatRef.current) {
        sparkMatRef.current.color.setHex(isBlack ? 0xf97316 : 0xd4af37);
      }
    }
  }, [theme]);

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden transition-colors duration-500"
    />
  );
};
