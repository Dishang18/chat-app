import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

const Bubble = ({ position, scale, speed }) => {
  const meshRef = useRef(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * speed) * 0.005;
      meshRef.current.rotation.x += 0.002;
      meshRef.current.rotation.y += 0.003;
    }
  });

  return (
    <Sphere ref={meshRef} position={position} args={[scale, 32, 32]}>
      <meshPhongMaterial
        color="#8B5CF6"
        transparent
        opacity={0.6}
        shininess={100}
        wireframe
      />
    </Sphere>
  );
};

const Bubbles = () => {
  const bubbles = Array.from({ length: 15 }, () => ({
    position: [
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 5
    ],
    scale: Math.random() * 0.5 + 0.3,
    speed: Math.random() * 2 + 0.5,
  }));

  return (
    <>
      {bubbles.map((bubble, i) => (
        <Bubble key={i} {...bubble} />
      ))}
    </>
  );
};

const ThreeScene = () => {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
      <color attach="background" args={['#030711']} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <Bubbles />
      <fog attach="fog" args={['#030711', 5, 15]} />
    </Canvas>
  );
};

export default ThreeScene;