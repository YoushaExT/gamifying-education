import { Text, type TextProps } from "@react-three/drei"

interface OutlinedTextProps
  extends Omit<TextProps, "color" | "outlineColor" | "outlineWidth"> {
  textColor?: string
  outlineColor?: string
  outlineWidth?: number
  children: React.ReactNode
}

export function OutlinedText({
  textColor = "white",
  outlineColor = "black",
  outlineWidth = 0.015,
  children,
  ...props
}: OutlinedTextProps) {
  return (
    <Text
      color={textColor}
      outlineColor={outlineColor}
      outlineWidth={outlineWidth}
      {...props}
    >
      {children}
    </Text>
  )
}
