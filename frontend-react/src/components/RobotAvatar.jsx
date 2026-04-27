import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function RobotModel({ onPointerOver, onPointerOut, emotion, isSpeaking }) {
  const group = useRef()
  const head = useRef()
  const rightArm = useRef()
  const leftArm = useRef()

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: '#333333', metalness: 0.7, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2,
  })
  const jointMaterial = new THREE.MeshStandardMaterial({ color: '#111111', metalness: 0.8, roughness: 0.5 })
  const eyeMaterialRef = useRef(new THREE.MeshBasicMaterial({ color: '#00FFFF' }))

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const targetEyeColor = new THREE.Color(
      emotion === 'Depression' ? '#FF9F0A' :
      emotion === 'Suicidal'   ? '#FF453A' :
      emotion === 'Anxiety'    ? '#FFD60A' : '#00FFFF'
    )
    eyeMaterialRef.current.color.lerp(targetEyeColor, 0.05)

    const headTilt = (emotion === 'Depression' || emotion === 'Suicidal') ? 0.35 :
                     emotion === 'Anxiety' ? -0.1 : 0

    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, (state.pointer.x * Math.PI) / 6, 0.05)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, (-state.pointer.y * Math.PI) / 10, 0.05)
    head.current.rotation.y  = THREE.MathUtils.lerp(head.current.rotation.y,  (state.pointer.x * Math.PI) / 4, 0.08)
    head.current.rotation.x  = THREE.MathUtils.lerp(head.current.rotation.x,  (-state.pointer.y * Math.PI) / 6 + headTilt, 0.08)
    group.current.position.y = Math.sin(t * 2) * 0.02

    if (isSpeaking) {
      head.current.position.y = 2.4 + Math.sin(t * 15) * 0.03
      const gesture = Math.sin(t * 8) * 0.15
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 0.6 + gesture, 0.1)
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -0.4, 0.1)
      leftArm.current.rotation.z  = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.3, 0.1)
      leftArm.current.rotation.x  = THREE.MathUtils.lerp(leftArm.current.rotation.x, -0.1, 0.1)
    } else {
      head.current.position.y = THREE.MathUtils.lerp(head.current.position.y, 2.4, 0.1)
      if (emotion === 'Depression' || emotion === 'Suicidal') {
        rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.15, 0.05)
        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0.2, 0.05)
        leftArm.current.rotation.z  = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.15, 0.05)
        leftArm.current.rotation.x  = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0.2, 0.05)
      } else if (emotion === 'Anxiety') {
        const fidget = Math.sin(t * 10) * 0.05
        rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.3 + fidget, 0.1)
        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -0.2, 0.1)
        leftArm.current.rotation.z  = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.3 - fidget, 0.1)
        leftArm.current.rotation.x  = THREE.MathUtils.lerp(leftArm.current.rotation.x, -0.2, 0.1)
      } else {
        const cycle = t % 5
        if (cycle < 1.5) {
          // Waving animation
          const wave = Math.sin(t * 15) * 0.4
          rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, 2.5 + wave, 0.1)
          rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, -0.4, 0.1)
          leftArm.current.rotation.z  = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.2, 0.05)
          leftArm.current.rotation.x  = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 0.05)
        } else {
          // Normal idle
          rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, -0.2, 0.05)
          rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.05)
          leftArm.current.rotation.z  = THREE.MathUtils.lerp(leftArm.current.rotation.z, 0.2, 0.05)
          leftArm.current.rotation.x  = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 0.05)
        }
      }
    }
  })

  return (
    <group ref={group} position={[0, 0, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[0.55, 0.45, 1.4, 32]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.45, 32, 32]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      <group position={[-0.25, 0.3, 0]}>
        <mesh position={[0, -0.6, 0]}><capsuleGeometry args={[0.15, 0.8, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.15, 0]}><sphereGeometry args={[0.16, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.7, 0]}><capsuleGeometry args={[0.12, 0.8, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -2.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.15, 0.3, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      </group>
      <group position={[0.25, 0.3, 0]}>
        <mesh position={[0, -0.6, 0]}><capsuleGeometry args={[0.15, 0.8, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.15, 0]}><sphereGeometry args={[0.16, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.7, 0]}><capsuleGeometry args={[0.12, 0.8, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -2.2, 0.1]} rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[0.15, 0.3, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      </group>
      <group ref={leftArm} position={[-0.7, 1.7, 0]} rotation={[0, 0, 0.2]}>
        <mesh position={[0, 0, 0]}><sphereGeometry args={[0.2, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -0.5, 0]}><capsuleGeometry args={[0.12, 0.7, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.0, 0]}><sphereGeometry args={[0.14, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.4, 0.2]} rotation={[-0.3, 0, 0]}><capsuleGeometry args={[0.1, 0.6, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.8, 0.35]} rotation={[-0.3, 0, 0]}><sphereGeometry args={[0.12, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      </group>
      <group ref={rightArm} position={[0.7, 1.7, 0]} rotation={[0, 0, -0.2]}>
        <mesh position={[0, 0, 0]}><sphereGeometry args={[0.2, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -0.5, 0]}><capsuleGeometry args={[0.12, 0.7, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.0, 0]}><sphereGeometry args={[0.14, 16, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.4, 0.2]} rotation={[-0.3, 0, 0]}><capsuleGeometry args={[0.1, 0.6, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, -1.8, 0.35]} rotation={[-0.3, 0, 0]}><sphereGeometry args={[0.12, 16, 16]} /><primitive object={bodyMaterial} attach="material" /></mesh>
      </group>
      <mesh position={[0, 2.0, 0]}><cylinderGeometry args={[0.15, 0.2, 0.3, 16]} /><primitive object={jointMaterial} attach="material" /></mesh>
      <group ref={head} position={[0, 2.4, 0]}>
        <mesh scale={[1.1, 1.1, 1.1]}><sphereGeometry args={[0.45, 64, 64]} /><primitive object={bodyMaterial} attach="material" /></mesh>
        <mesh position={[0, 0.05, 0.42]} scale={[1, 0.7, 1]} rotation={[-0.1, 0, 0]}>
          <boxGeometry args={[0.65, 0.4, 0.2]} />
          <meshPhysicalMaterial color="#111111" metalness={1} roughness={0} clearcoat={1} />
        </mesh>
        <group position={[0, 0.05, 0.52]} rotation={[-0.1, 0, 0]}>
          <mesh position={[-0.18, 0.03, 0]} rotation={[0, 0, -0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterialRef.current} attach="material" /></mesh>
          <mesh position={[-0.12, 0, 0]}    rotation={[0, 0,  0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterialRef.current} attach="material" /></mesh>
          <mesh position={[0.12, 0, 0]}     rotation={[0, 0, -0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterialRef.current} attach="material" /></mesh>
          <mesh position={[0.18, 0.03, 0]}  rotation={[0, 0,  0.3]}><capsuleGeometry args={[0.02, 0.06, 4, 8]} /><primitive object={eyeMaterialRef.current} attach="material" /></mesh>
        </group>
      </group>
    </group>
  )
}

export default function RobotAvatar({ textToSpeak, emotion, ttsOnly = false }) {
  const [hovered, setHovered]            = useState(false)
  const [isSpeakingState, setIsSpeaking] = useState(false)
  const isSpeaking   = useRef(false)
  const audioCtxRef  = useRef(null)
  const sourceRef    = useRef(null)

  useEffect(() => {
    if (textToSpeak && textToSpeak.trim() !== '') handleSpeak(textToSpeak)
  }, [textToSpeak])

  const stopCurrent = () => {
    try { sourceRef.current?.stop() } catch {}
    sourceRef.current = null
    try { audioCtxRef.current?.close() } catch {}
    audioCtxRef.current = null
    window.speechSynthesis.cancel()
    isSpeaking.current = false
    setIsSpeaking(false)
  }

  const handleSpeak = async (textOverride) => {
    const text = typeof textOverride === 'string' ? textOverride : "Hi there. I am MindSLM, your mental health companion. How are you feeling today?"
    if (isSpeaking.current) return
    stopCurrent()

    isSpeaking.current = true
    setIsSpeaking(true)

    try {
      const response = await fetch(`${API_URL}/api/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) throw new Error(`Backend TTS error ${response.status}`)

      // Download full audio buffer before touching playback — prevents the
      // first-2-seconds glitch caused by MP3 decoding lag on the Audio element
      const arrayBuffer = await response.arrayBuffer()

      const AudioContext = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioContext()
      audioCtxRef.current = ctx

      // Resume if browser suspended the context (autoplay policy)
      if (ctx.state === 'suspended') await ctx.resume()

      // Decode entire buffer first — guarantees clean playback from frame 0
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      sourceRef.current = source

      source.onended = () => { isSpeaking.current = false; setIsSpeaking(false) }
      source.start(0)
    } catch (err) {
      console.error("ElevenLabs proxy error, falling back to native TTS:", err)
      isSpeaking.current = false
      setIsSpeaking(false)
      const utterance = new SpeechSynthesisUtterance(text)
      isSpeaking.current = true
      setIsSpeaking(true)
      utterance.onend  = () => { isSpeaking.current = false; setIsSpeaking(false) }
      utterance.onerror = () => { isSpeaking.current = false; setIsSpeaking(false) }
      window.speechSynthesis.speak(utterance)
    }
  }

  // ttsOnly = hidden instance just for audio (used when Nova/Spline is active)
  if (ttsOnly) return <></>

  return (
    <div
      onClick={handleSpeak}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, cursor: hovered ? 'pointer' : 'default' }}
    >
      <Canvas camera={{ position: [0, 0.5, 7.5], fov: 45 }} onClick={handleSpeak}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 10, 5]} intensity={3.0} color="#ffffff" />
        <pointLight position={[-5, 5, -5]} intensity={2.0} color="#ffffff" />
        <spotLight position={[0, 5, 8]} angle={0.4} penumbra={1} intensity={5.0} color="#ffffff" />
        <Environment preset="city" />
        <RobotModel emotion={emotion} isSpeaking={isSpeakingState} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} />
        <ContactShadows position={[0, -2.4, 0]} opacity={0.6} scale={12} blur={2.5} far={4} color="#000000" />
      </Canvas>
    </div>
  )
}
