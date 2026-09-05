import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeHeroBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xffffff, 0.0015);

    let width = container.clientWidth;
    let height = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 32;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0xffffff, 1);
    container.appendChild(renderer.domElement);

    // Main Geometry: Wireframe Torus Knot
    const geometry = new THREE.TorusKnotGeometry(9.5, 2.6, 120, 16);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x666666,
      emissive: 0x000000,
      metalness: 0.4,
      roughness: 0.1,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const torusKnot = new THREE.Mesh(geometry, material);
    scene.add(torusKnot);

    // Particle System: Sparks
    const sparkCount = 120;
    const sparkGeo = new THREE.CircleGeometry(0.18, 3);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xd4af37, // Gold
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pLight1 = new THREE.PointLight(0xd4af37, 1.2, 60);
    pLight1.position.set(12, 12, 12);
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

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      className="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden"
    />
  );
};
