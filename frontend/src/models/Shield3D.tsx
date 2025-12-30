import type { ReactNode } from "react"
import * as THREE from "three"

import { COLORS } from "@/constants"

interface Shield3DProps {
  children: ReactNode
  position?: [number, number, number]
  scale?: number
  isDisconnected?: boolean
}

/**
 * 3D Shield icon component with customizable size
 *
 * @example
 * <Shield3D scale={1.2} position={[1, 0, 0]}>
 *   <OutlinedText fontSize={0.15}>5</OutlinedText>
 * </Shield3D>
 *
 * @param scale - Scale factor for the shield size (default: 1.0)
 * @param children - Content to render inside the shield (typically text)
 * @param position - 3D position [x, y, z]
 * @param isDisconnected - Whether to reduce opacity (default: false)
 */
export function Shield3D({
  children,
  position = [0, 0, 0],
  scale = 1.0,
  isDisconnected = false,
}: Shield3DProps) {
  // Base dimensions for the shield
  const baseWidth = 0.25
  const baseHeight = 0.28
  const baseRadius = 0.022

  // Scaled dimensions
  const width = baseWidth * scale
  const height = baseHeight * scale
  const radius = baseRadius * scale

  // Z-depth for layering
  const shieldZ = -0.005
  const contentZ = 0

  return (
    <group position={position}>
      {/* Shield icon background */}
      <mesh position={[0, 0, shieldZ]}>
        <shapeGeometry
          args={[
            (() => {
              const shape = new THREE.Shape()

              // Start at top-left corner
              shape.moveTo(-width / 2 + radius, height / 2)
              // Top edge
              shape.lineTo(width / 2 - radius, height / 2)
              // Top-right corner
              shape.quadraticCurveTo(
                width / 2,
                height / 2,
                width / 2,
                height / 2 - radius,
              )
              // Right edge
              shape.lineTo(width / 2, -height / 4)
              // Bottom point (shield tip)
              shape.lineTo(0, -height / 2)
              // Left edge
              shape.lineTo(-width / 2, -height / 4)
              // Left edge to top
              shape.lineTo(-width / 2, height / 2 - radius)
              // Top-left corner
              shape.quadraticCurveTo(
                -width / 2,
                height / 2,
                -width / 2 + radius,
                height / 2,
              )

              return shape
            })(),
          ]}
        />
        <meshStandardMaterial
          color={COLORS.SHIELD_GREY_BLUE}
          opacity={isDisconnected ? 0.4 : 1.0}
          transparent={isDisconnected}
        />
      </mesh>

      {/* Content (children) */}
      <group position={[0, 0.01, contentZ]}>{children}</group>
    </group>
  )
}

export default Shield3D
