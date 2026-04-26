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

  const isSpeaking = useRef(false)

  const handleSpeak = async (e) => {
    if (e) e.stopPropagation() // Prevent double firing from bubbling events
    if (isSpeaking.current) return // Prevent overlapping audio
    
    isSpeaking.current = true
    console.log("Connecting to ElevenLabs API to generate realistic human voice...");
    
    try {
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
      
      if (!apiKey || apiKey === 'your_elevenlabs_api_key_here') {
        console.error("ElevenLabs API Key is missing. Please add it to your .env file.");
        isSpeaking.current = false;
        return;
      }

      // Rachel - a calm, professional, and empathetic female voice perfect for mental health AI
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; 
      const textToSpeak = "Hi there. I am Mind S L M. How are you feeling today?";

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: textToSpeak,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      // Convert the response stream into a playable audio blob
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      
      // Unlock the click state only when the audio finishes playing naturally
      audio.onended = () => { 
        isSpeaking.current = false;
      }
      audio.onerror = () => { 
        console.error("Failed to play the generated audio.");
        isSpeaking.current = false;
      }

      console.log("Playing highly realistic voice...");
      await audio.play();

    } catch (error) {
      console.error("Voice generation failed:", error);
      isSpeaking.current = false;
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
