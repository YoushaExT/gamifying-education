import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DraggableChoiceProps {
  id: string
  index: number
  text: string
  isCorrect: boolean
  onTextChange: (text: string) => void
  onCorrectChange: (checked: boolean) => void
  disabled?: boolean
}

export function DraggableChoice({
  id,
  index,
  text,
  isCorrect,
  onTextChange,
  onCorrectChange,
  disabled = false,
}: DraggableChoiceProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Compute label (A, B, C, D) from index
  const label = String.fromCharCode(65 + index)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200 hover:border-gray-300"
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>

      {/* Correct answer checkbox */}
      <Checkbox
        checked={isCorrect}
        onCheckedChange={onCorrectChange}
        disabled={disabled}
        className="flex-shrink-0"
      />

      {/* Choice label */}
      <Label className="w-8 flex-shrink-0 font-medium text-gray-700">
        {label}.
      </Label>

      {/* Choice text input */}
      <Input
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={`Choice ${label}`}
        disabled={disabled}
        className="flex-1"
      />
    </div>
  )
}
