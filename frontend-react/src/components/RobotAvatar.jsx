import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

function RobotModel({ onPointerOver, onPointerOut }) {
  const group = useRef()
  const head = useRef()
  const rightArm = useRef()

  // Sleek Dark Grey/Metallic material
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: '#333333',
    metalness: 0.7,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2,
  })

  // Joint Material (darker)
  const jointMaterial = new THREE.MeshStandardMaterial({
    color: '#111111',
    metalness: 0.8,
    roughness: 0.5
  })

  // Glowing eyes material
  const eyeMaterial = new THREE.MeshBasicMaterial({
    color: '#00FFFF' 
  })

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // Smoothly rotate the entire body slightly based on pointer
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, (state.pointer.x * Math.PI) / 6, 0.05)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, (-state.pointer.y * Math.PI) / 10, 0.05)
    
    // Smoothly rotate the head a bit more for a natural "looking" effect
    head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, (state.pointer.x * Math.PI) / 4, 0.08)
    head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, (-state.pointer.y * Math.PI) / 6, 0.08)

    // Occasional Waving Animation (Every 5 seconds, wave for 2 seconds)
    const cycle = t % 5
    if (cycle < 1.5) {
      // Waving state: Lift arm and oscillate
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, Math.PI / 1.5 + Math.sin(t * 12) * 0.4, 0.1)
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, Math.PI / 8, 0.1)
    } else {
      // Resting state: Arm down by the side
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.2, 0.05)
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.05)
    }
  })

  return (
    <group 
      ref={group} 
      position={[0, 0, 0]} 
      onPointerOver={onPointerOver} 
      onPointerOut={onPointerOut}
    >
      {/* Torso */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.55, 0.45, 1.4, 32]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>

      {/* Pelvis */}
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <primitive object={bodyMaterial} attach="material" />
      </mesh>
      
      {/* --- LEGS --- */}
      <group position={[-0.25, 0.3, 0]}>
        {/* Upper Leg */}
        <mesh position={[0, -0.6, 0]}>
          <capsuleGeometry args={[0.15, 0.8, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -1.15, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <primitive object={jointMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -1.7, 0]}>
          <capsuleGeometry args={[0.12, 0.8, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -2.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.15, 0.3, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
      </group>

      <group position={[0.25, 0.3, 0]}>
        {/* Upper Leg */}
        <mesh position={[0, -0.6, 0]}>
          <capsuleGeometry args={[0.15, 0.8, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -1.15, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <primitive object={jointMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -1.7, 0]}>
          <capsuleGeometry args={[0.12, 0.8, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        <mesh position={[0, -2.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.15, 0.3, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
      </group>
      
      {/* --- ARMS --- */}
      {/* Left Arm (Resting) */}
      <group position={[-0.7, 1.7, 0]} rotation={[0, 0, 0.2]}>
        <mesh position={[0, 0, 0]}><sphereGeometry args={[0.2, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -0.5, 0]}><capsuleGeometry args={[0.12, 0.7, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.0, 0]}><sphereGeometry args={[0.14, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.4, 0.2]} rotation={[-0.3, 0, 0]}><capsuleGeometry args={[0.1, 0.6, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.8, 0.35]} rotation={[-0.3, 0, 0]}><sphereGeometry args={[0.12, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      </group>

      {/* Right Arm (Animated) */}
      <group ref={rightArm} position={[0.7, 1.7, 0]} rotation={[0, 0, -0.2]}>
        <mesh position={[0, 0, 0]}><sphereGeometry args={[0.2, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -0.5, 0]}><capsuleGeometry args={[0.12, 0.7, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.0, 0]}><sphereGeometry args={[0.14, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.4, 0.2]} rotation={[-0.3, 0, 0]}><capsuleGeometry args={[0.1, 0.6, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.8, 0.35]} rotation={[-0.3, 0, 0]}><sphereGeometry args={[0.12, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
        <primitive object={jointMaterial} attach="material" />
      </mesh>

      {/* Head Group */}
      <group ref={head} position={[0, 2.4, 0]}>
        <mesh scale={[1.1, 1.1, 1.1]}>
          <sphereGeometry args={[0.45, 64, 64]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
        
        {/* Visor / Face Plate */}
        <mesh position={[0, 0.05, 0.42]} scale={[1, 0.7, 1]} rotation={[-0.1, 0, 0]}>
          <boxGeometry args={[0.65, 0.4, 0.2]} />
          <meshPhysicalMaterial color="#111111" metalness={1} roughness={0} clearcoat={1} />
        </mesh>

        {/* Friendly "Smiling" Eyes */}
        <group position={[0, 0.05, 0.52]} rotation={[-0.1, 0, 0]}>
          <mesh position={[-0.18, 0.03, 0]} rotation={[0, 0, -0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterial} attach="material" /></mesh>
          <mesh position={[-0.12, 0, 0]} rotation={[0, 0, 0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterial} attach="material" /></mesh>
          <mesh position={[0.12, 0, 0]} rotation={[0, 0, -0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterial} attach="material" /></mesh>
          <mesh position={[0.18, 0.03, 0]} rotation={[0, 0, 0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterial} attach="material" /></mesh>
        </group>
      </group>
    </group>
  )
}

export default function RobotAvatar() {
  const [hovered, setHovered] = useState(false)

  // Ensure voices are loaded
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
  }, [])

  const handleSpeak = () => {
    console.log("Click registered. Attempting to trigger Voice Assistant...");
    if ('speechSynthesis' in window) {
      // KNOWN CHROME BUG: Calling cancel() right before speak() can instantly trigger an error.
      // Instead, we check if it is already speaking and just ignore the click.
      if (window.speechSynthesis.speaking) {
        console.log("Already speaking, ignoring click.");
        return;
      }

      const utterance = new SpeechSynthesisUtterance("How can I help you today?")
      const voices = window.speechSynthesis.getVoices()
      
      // Try to find a friendly voice if they are loaded
      if (voices.length > 0) {
        const preferredVoice = voices.find(v => 
          v.name.includes('Female') || 
          v.name.includes('Samantha') || 
          v.name.includes('Google UK English Female') ||
          v.name.includes('Victoria')
        )
        
        if (preferredVoice) {
          utterance.voice = preferredVoice
        }
      }
      
      utterance.rate = 0.95
      utterance.pitch = 1.1 // Slightly higher pitch for friendliness
      utterance.volume = 1.0 // Ensure volume is maxed
      
      utterance.onstart = () => console.log("Voice started playing!");
      utterance.onerror = (e) => {
        console.error("Voice playback error: ", e);
        console.error("Error reason: ", e.error); // This will tell us specifically why it failed (e.g. 'interrupted', 'not-allowed')
      };
      
      // Give the browser a tiny delay to ensure the event stack clears, which helps with 'not-allowed' errors in React
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 50);

    } else {
      console.warn("Speech Synthesis API is not supported in this browser.");
    }
  }

  return (
    <div 
      onClick={handleSpeak}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      style={{ 
        width: '100%', 
        height: '600px', 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 10,
        cursor: hovered ? 'pointer' : 'default'
      }}
    >
      <Canvas camera={{ position: [0, 0.5, 7.5], fov: 45 }} onClick={handleSpeak}>
        {/* Lighting setup */}
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={3.0} color="#ffffff" />
        <pointLight position={[-5, 5, -5]} intensity={2.0} color="#ffffff" />
        <spotLight position={[0, 5, 8]} angle={0.4} penumbra={1} intensity={5.0} color="#ffffff" />
        
        {/* High quality environment map for reflections */}
        <Environment preset="city" />
        
        <RobotModel />
        
        {/* Ground shadow adjusted for full body */}
        <ContactShadows position={[0, -2.4, 0]} opacity={0.6} scale={12} blur={2.5} far={4} color="#000000" />
      </Canvas>
    </div>
  )
}
