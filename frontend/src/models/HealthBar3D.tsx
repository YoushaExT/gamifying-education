import { Text } from "@react-three/drei"
import { useFrame } from "@react-three/fiber"
import { useMemo, useRef } from "react"
import type { Group, Mesh } from "three"

import { OutlinedText } from "@/components/Game"
import { COLORS, GAME_FONT } from "@/constants"
import { Shield3D } from "@/models/Shield3D"

const DEFAULT_SCALE = 1.0
const SHIELD_SCALE = 1.8

const BASE_DIMENSIONS = {
  barWidth: 2.5,
  barHeight: 0.3,
  borderWidth: 0.08,
  nameFontSize: 0.2,
  healthTextFontSize: 0.15,
  shieldTextFontSize: 0.14,
  nameYOffsetPlayer: -0.25,
  nameYOffsetOpponent: 0.55,
  turnDotYOffsetPlayer: -0.5,
  turnDotYOffsetOpponent: 0.85,
  turnDotRadius: 0.06,
  shieldTextXOffset: 0.25,
  shieldGlowPadding: 0.2,
  divisionLineWidth: 0.025,
  healthBarYPosition: 0.15,
} as const

const Z_DEPTHS = {
  shieldGlow: -0.01,
  border: 0,
  background: 0.005,
  healthFill: 0.01,
  divisionLines: 0.015,
  text: 0.02,
} as const

const ANIMATION = {
  healthLerpSpeed: 0.1,
  pulseFrequency: 5,
  pulseAmplitude: 0.08,
  pulseSmoothingFactor: 0.15,
} as const

interface HealthBar3DProps {
  currentHealth: number
  maxHealth: number
  shield: number
  playerName: string
  position?: [number, number, number]
  isCurrentTurn?: boolean
  isPlayer?: boolean // true = "you" (bottom), false = opponent (top)
  scale?: number // Scale factor for all dimensions (default: 1.0)
  isDisconnected?: boolean // Show disconnected state (grayed out, opacity reduced)
  overrides?: {
    barWidth?: number
    barHeight?: number
    nameFontSize?: number
  }
}

function useHealthBarDimensions(
  scale: number = DEFAULT_SCALE,
  overrides?: HealthBar3DProps["overrides"],
) {
  return useMemo(() => {
    const base = BASE_DIMENSIONS

    return {
      barWidth: overrides?.barWidth ?? base.barWidth * scale,
      barHeight: overrides?.barHeight ?? base.barHeight * scale,
      borderWidth: base.borderWidth * scale,
      nameFontSize: overrides?.nameFontSize ?? base.nameFontSize * scale,
      healthTextFontSize: base.healthTextFontSize * scale,
      shieldTextFontSize: base.shieldTextFontSize * scale,
      nameYOffsetPlayer: base.nameYOffsetPlayer * scale,
      nameYOffsetOpponent: base.nameYOffsetOpponent * scale,
      turnDotYOffsetPlayer: base.turnDotYOffsetPlayer * scale,
      turnDotYOffsetOpponent: base.turnDotYOffsetOpponent * scale,
      turnDotRadius: base.turnDotRadius * scale,
      shieldTextXOffset: base.shieldTextXOffset * scale,
      shieldGlowPadding: base.shieldGlowPadding * scale,
      divisionLineWidth: base.divisionLineWidth * scale,
      healthBarYPosition: base.healthBarYPosition * scale,
      zDepths: Z_DEPTHS,
      animation: ANIMATION,
    }
  }, [scale, overrides])
}

/**
 * 3D Health Bar component with customizable size
 *
 * @example
 * // Default size (scale = 1.0)
 * <HealthBar3D
 *   currentHealth={10}
 *   maxHealth={10}
 *   shield={0}
 *   playerName="Player"
 *   position={[0, -2.8, 0]}
 *   isCurrentTurn={true}
 *   isPlayer={true}
 * />
 *
 * @example
 * // 50% larger
 * <HealthBar3D
 *   scale={1.5}
 *   currentHealth={10}
 *   maxHealth={10}
 *   playerName="Player"
 *   {...otherProps}
 * />
 *
 * @example
 * // 30% smaller
 * <HealthBar3D
 *   scale={0.7}
 *   currentHealth={10}
 *   maxHealth={10}
 *   playerName="Opponent"
 *   {...otherProps}
 * />
 *
 * @example
 * // Advanced: Override specific dimensions
 * <HealthBar3D
 *   scale={1.2}
 *   overrides={{ barWidth: 4.0, nameFontSize: 0.3 }}
 *   currentHealth={10}
 *   maxHealth={10}
 *   playerName="Boss"
 *   {...otherProps}
 * />
 *
 * @param scale - Scale factor for all dimensions (default: 1.0). Recommended range: 0.5-2.0
 * @param overrides - Optional object to override specific dimensions after scaling
 */
export function HealthBar3D({
  currentHealth,
  maxHealth,
  shield,
  playerName,
  position = [0, 0, 0],
  isCurrentTurn = false,
  isPlayer = false,
  scale,
  isDisconnected = false,
  overrides,
}: HealthBar3DProps) {
  const groupRef = useRef<Group>(null)
  const healthBarRef = useRef<Mesh>(null)
  const nameTextRef = useRef<Group>(null)
  const pulseRef = useRef(0)

  // Compute dimensions based on scale and overrides
  const dims = useHealthBarDimensions(scale, overrides)
  const { barWidth, barHeight } = dims
  const nameYOffset = isPlayer
    ? dims.nameYOffsetPlayer
    : dims.nameYOffsetOpponent

  const healthPercent = Math.max(0, Math.min(1, currentHealth / maxHealth))

  // Animate health bar and pulse effect for current turn (text only)
  useFrame((_, delta) => {
    if (healthBarRef.current) {
      const currentScale = healthBarRef.current.scale.x
      healthBarRef.current.scale.x +=
        (healthPercent - currentScale) * dims.animation.healthLerpSpeed
    }

    // Pulse animation on player name text only (disabled when disconnected)
    if (isCurrentTurn && !isDisconnected && nameTextRef.current) {
      pulseRef.current += delta * dims.animation.pulseFrequency
      const pulse =
        1 + Math.sin(pulseRef.current) * dims.animation.pulseAmplitude
      nameTextRef.current.scale.set(pulse, pulse, 1)
    } else if (nameTextRef.current) {
      // Smoothly return to normal scale
      nameTextRef.current.scale.x +=
        (1 - nameTextRef.current.scale.x) * dims.animation.pulseSmoothingFactor
      nameTextRef.current.scale.y +=
        (1 - nameTextRef.current.scale.y) * dims.animation.pulseSmoothingFactor
    }
  })

  // Color based on health level
  const getHealthColor = () => {
    if (healthPercent > 0.6) return "#22c55e" // Green
    if (healthPercent > 0.3) return "#eab308" // Yellow
    return "#ef4444" // Red
  }

  // Calculate division positions
  const divisions = Array.from({ length: maxHealth - 1 }, (_, i) => {
    const segmentWidth = barWidth / maxHealth
    return -barWidth / 2 + segmentWidth * (i + 1)
  })

  // Compute display name and color (grayed out when disconnected)
  const displayName = isDisconnected ? `${playerName} (DC)` : playerName
  const nameColor = isDisconnected
    ? COLORS.DISCONNECTED_GRAY
    : isCurrentTurn
      ? COLORS.LIGHT_BROWN
      : COLORS.DARK_BROWN

  return (
    <group ref={groupRef} position={position}>
      {/* Player name with pulse animation */}
      <group ref={nameTextRef}>
        <OutlinedText
          position={[0, nameYOffset, dims.zDepths.text]}
          fontSize={dims.nameFontSize}
          textColor={nameColor}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
          font={GAME_FONT}
        >
          {displayName}
        </OutlinedText>
      </group>

      {/* Turn indicator dot */}
      {isCurrentTurn && (
        <mesh
          position={[
            0,
            isPlayer ? dims.turnDotYOffsetPlayer : dims.turnDotYOffsetOpponent,
            0,
          ]}
        >
          <circleGeometry args={[dims.turnDotRadius, 32]} />
          <meshStandardMaterial color="#d97706" />
        </mesh>
      )}

      {/* Shield border glow (sea blue) - rendered behind health bar */}
      {shield > 0 && (
        <mesh position={[0, dims.healthBarYPosition, dims.zDepths.shieldGlow]}>
          <planeGeometry
            args={[
              barWidth + dims.shieldGlowPadding,
              barHeight + dims.shieldGlowPadding,
            ]}
          />
          <meshStandardMaterial
            color={COLORS.SHIELD_BLUE}
            emissive={COLORS.SHIELD_BLUE}
            emissiveIntensity={0.3}
            opacity={isDisconnected ? 0.4 : 1.0}
            transparent={isDisconnected}
          />
        </mesh>
      )}

      {/* Health bar outer border */}
      <mesh position={[0, dims.healthBarYPosition, dims.zDepths.border]}>
        <planeGeometry
          args={[barWidth + dims.borderWidth, barHeight + dims.borderWidth]}
        />
        <meshStandardMaterial
          color={shield > 0 ? "#0ea5e9" : "#1f2937"}
          opacity={isDisconnected ? 0.4 : 1.0}
          transparent={isDisconnected}
        />
      </mesh>

      {/* Health bar background */}
      <mesh position={[0, dims.healthBarYPosition, dims.zDepths.background]}>
        <planeGeometry args={[barWidth, barHeight]} />
        <meshStandardMaterial
          color="#374151"
          opacity={isDisconnected ? 0.4 : 1.0}
          transparent={isDisconnected}
        />
      </mesh>

      {/* Health bar fill */}
      <mesh
        ref={healthBarRef}
        position={[
          -(barWidth / 2) * (1 - healthPercent),
          dims.healthBarYPosition,
          dims.zDepths.healthFill,
        ]}
      >
        <planeGeometry args={[barWidth, barHeight]} />
        <meshStandardMaterial
          color={getHealthColor()}
          opacity={isDisconnected ? 0.4 : 1.0}
          transparent={isDisconnected}
        />
      </mesh>

      {/* Division lines */}
      {divisions.map((x, i) => (
        <mesh
          key={`division-${i}`}
          position={[x, dims.healthBarYPosition, dims.zDepths.divisionLines]}
        >
          <planeGeometry args={[dims.divisionLineWidth, barHeight]} />
          <meshStandardMaterial
            color="#1f2937"
            opacity={isDisconnected ? 0.3 : 0.7}
            transparent
          />
        </mesh>
      ))}

      {/* Health text */}
      <Text
        position={[0, dims.healthBarYPosition, dims.zDepths.text]}
        fontSize={dims.healthTextFontSize}
        color="#f9fafb"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
        font={GAME_FONT}
      >
        {currentHealth} / {maxHealth}
      </Text>

      {/* Shield indicator with icon background */}
      {shield > 0 && (
        <Shield3D
          position={[
            barWidth / 2 + dims.shieldTextXOffset + 0.15 * SHIELD_SCALE,
            dims.healthBarYPosition,
            dims.zDepths.text,
          ]}
          scale={(scale ?? DEFAULT_SCALE) * SHIELD_SCALE}
          isDisconnected={isDisconnected}
        >
          <OutlinedText
            fontSize={dims.shieldTextFontSize}
            textColor={COLORS.SHIELD_BLUE}
            outlineColor={COLORS.SHIELD_BLUE_DARKER}
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
            font={GAME_FONT}
          >
            {shield}
          </OutlinedText>
        </Shield3D>
      )}
    </group>
  )
}

export default HealthBar3D
