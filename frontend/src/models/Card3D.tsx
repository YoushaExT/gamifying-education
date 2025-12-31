import { Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo, useRef, useState } from "react"
import type { Group } from "three"
import * as THREE from "three"

import { COLORS, GAME_FONT } from "@/constants"

interface Card3DProps {
  name: string
  cardType: "basic_damage" | "basic_shield" | "basic_heal" | string
  effectData: { min_value?: number; max_value?: number }
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
  onClick?: () => void
  isHovered?: boolean
  isSelected?: boolean
  isPlayable?: boolean
}

// Color mapping for card types
const cardColors: Record<string, string> = {
  basic_damage: COLORS.CARD_COLOR_DAMAGE, // Red
  basic_shield: COLORS.CARD_COLOR_SHIELD, // Blue
  basic_heal: COLORS.CARD_COLOR_HEAL, // Green
}

const cardTypeLabels: Record<string, string> = {
  basic_damage: "DAMAGE",
  basic_shield: "SHIELD",
  basic_heal: "HEAL",
}

export function Card3D({
  name,
  cardType,
  effectData,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onClick,
  isHovered = false,
  isSelected = false,
  isPlayable = true,
}: Card3DProps) {
  const groupRef = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)

  const baseColor = cardColors[cardType] || "#6b7280"
  const actuallyHovered = hovered || isHovered

  // Create gradient shader material
  const gradientMaterial = useMemo(() => {
    const topColor =
      actuallyHovered && isPlayable
        ? new THREE.Color(COLORS.CARD_BACKGROUND_PLAYABLE_TOP_GRADIENT)
        : new THREE.Color(COLORS.CARD_BACKGROUND_UNPLAYABLE_TOP_GRADIENT)
    const bottomColor =
      actuallyHovered && isPlayable
        ? new THREE.Color(COLORS.CARD_BACKGROUND_PLAYABLE_BOTTOM_GRADIENT)
        : new THREE.Color(COLORS.CARD_BACKGROUND_UNPLAYABLE_BOTTOM_GRADIENT)

    return new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: topColor },
        bottomColor: { value: bottomColor },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(mix(bottomColor, topColor, vUv.y), 1.0);
        }
      `,
    })
  }, [actuallyHovered, isPlayable])

  // Animate card on hover
  useFrame(() => {
    if (groupRef.current) {
      const targetY = actuallyHovered ? 0.2 : 0
      groupRef.current.position.y +=
        (targetY + position[1] - groupRef.current.position.y) * 0.1

      // Scale animation
      const targetScale = isSelected ? 1.1 : actuallyHovered ? 1.05 : 1
      groupRef.current.scale.x +=
        (targetScale * scale - groupRef.current.scale.x) * 0.1
      groupRef.current.scale.y +=
        (targetScale * scale - groupRef.current.scale.y) * 0.1
      groupRef.current.scale.z +=
        (targetScale * scale - groupRef.current.scale.z) * 0.1
    }
  })

  const minVal = effectData.min_value ?? 0
  const maxVal = effectData.max_value ?? 0
  const valueRange = minVal === maxVal ? `${minVal}` : `${minVal}-${maxVal}`

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Three.js group element, not HTML
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={isPlayable ? onClick : undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Card background */}
      <mesh>
        <planeGeometry args={[1.5, 2]} />
        <meshStandardMaterial
          color={isPlayable ? baseColor : "#374151"}
          opacity={isPlayable ? 1 : 0.5}
          transparent={!isPlayable}
        />
      </mesh>

      {/* Card border */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[1.4, 1.9]} />
        <meshStandardMaterial color="#c4a47a" />
      </mesh>

      {/* Card inner with gradient */}
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.3, 1.8]} />
        <primitive object={gradientMaterial} attach="material" />
      </mesh>

      {/* Card type label */}
      <Text
        position={[0, 0.7, 0.03]}
        fontSize={0.12}
        color={baseColor}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        font={GAME_FONT}
      >
        {cardTypeLabels[cardType] || cardType.toUpperCase()}
      </Text>

      {/* Card name */}
      <Text
        position={[0, 0.2, 0.03]}
        fontSize={0.14}
        color="#2c1810"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.2}
        textAlign="center"
        font={GAME_FONT}
      >
        {name}
      </Text>

      {/* Effect value */}
      <Text
        position={[0, -0.4, 0.03]}
        fontSize={0.25}
        color={baseColor}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        font={GAME_FONT}
      >
        {valueRange}
      </Text>

      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.7, 2.2]} />
          <meshStandardMaterial color="#fbbf24" opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  )
}

export default Card3D
