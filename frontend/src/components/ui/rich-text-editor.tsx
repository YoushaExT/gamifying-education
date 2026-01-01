import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Mathematics from "@tiptap/extension-mathematics"
import Image from "@tiptap/extension-image"
import { common, createLowlight } from "lowlight"
import { Bold, Italic, Code, Braces, ListOrdered, List, Sigma, ImageIcon } from "lucide-react"
import { useEffect, useState, useRef, useCallback } from "react"
import katex from "katex"
import { MediaService } from "@/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import "highlight.js/styles/github.css"
import "katex/dist/katex.min.css"

const lowlight = createLowlight(common)

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing your question...",
}: RichTextEditorProps) {
  const [showMathDialog, setShowMathDialog] = useState(false)
  const [mathInput, setMathInput] = useState("")
  const [isInlineMath, setIsInlineMath] = useState(true)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Disable default code block
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "javascript",
      }),
      Mathematics,
      Image.configure({
        inline: true,
        allowBase64: false, // Use URLs only
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none",
      },
      handlePaste: (_view, event) => {
        // Handle image paste from clipboard
        const items = event.clipboardData?.items
        if (!items) return false

        for (const item of Array.from(items)) {
          if (item.type.indexOf("image") === 0) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              // Use setTimeout to avoid setState during render
              setTimeout(() => handleImageUpload(file), 0)
            }
            return true
          }
        }
        return false
      },
    },
  })

  // Handle image upload
  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert("Image file size must be less than 5MB")
      return
    }

    setIsUploadingImage(true)

    try {
      // Upload image using generated client
      const response = await MediaService.uploadImage({
        formData: { file },
      })

      // Convert relative URL to absolute URL
      const baseUrl = import.meta.env.VITE_API_URL || window.location.origin
      const imageUrl = response.url.startsWith("http")
        ? response.url
        : `${baseUrl}${response.url}`

      // Insert image into editor
      editor.chain().focus().setImage({ src: imageUrl }).run()
    } catch (error) {
      console.error("Failed to upload image:", error)
      alert("Failed to upload image. Please try again.")
    } finally {
      setIsUploadingImage(false)
    }
  }, [editor])

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Update editor content when value changes externally
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  // Render KaTeX math equations in the editor
  useEffect(() => {
    if (!editorContainerRef.current || !editor) return

    const renderMath = () => {
      if (!editorContainerRef.current) return

      // Helper to unescape HTML entities
      const unescapeHtml = (text: string) => {
        const textarea = document.createElement('textarea')
        textarea.innerHTML = text
        return textarea.value
      }

      // Render inline math: $...$
      const inlineMathElements = editorContainerRef.current.querySelectorAll('.math-inline')
      inlineMathElements.forEach((element) => {
        let mathContent = element.getAttribute('data-math') || element.textContent?.replace(/^\$|\$$/g, '') || ''
        mathContent = unescapeHtml(mathContent)
        if (mathContent && element.children.length === 0) {
          try {
            katex.render(mathContent, element as HTMLElement, {
              throwOnError: false,
              displayMode: false,
            })
          } catch (error) {
            console.error('KaTeX inline rendering error:', error)
          }
        }
      })

      // Render display math: $$...$$
      const displayMathElements = editorContainerRef.current.querySelectorAll('.math-display')
      displayMathElements.forEach((element) => {
        let mathContent = element.getAttribute('data-math') || element.textContent?.replace(/^\$\$|\$\$$/g, '') || ''
        mathContent = unescapeHtml(mathContent)
        if (mathContent && element.children.length === 0) {
          try {
            katex.render(mathContent, element as HTMLElement, {
              throwOnError: false,
              displayMode: true,
            })
          } catch (error) {
            console.error('KaTeX display rendering error:', error)
          }
        }
      })
    }

    // Use requestAnimationFrame instead of setTimeout for better performance
    const frameId = requestAnimationFrame(renderMath)
    return () => cancelAnimationFrame(frameId)
  }, [value, editor])

  if (!editor) {
    return null
  }

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title,
  }: {
    onClick: () => void
    active?: boolean
    children: React.ReactNode
    title: string
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-gray-200 font-semibold text-gray-900"
          : "hover:bg-gray-100 text-gray-700"
      }`}
      title={title}
    >
      {children}
    </button>
  )

  const setLanguage = (language: string) => {
    editor.chain().focus().updateAttributes("codeBlock", { language }).run()
  }

  const currentLanguage =
    editor.getAttributes("codeBlock").language || "javascript"

  const insertMath = () => {
    if (!mathInput.trim()) return

    // Escape HTML entities for the data attribute
    const escapedMath = mathInput
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    if (isInlineMath) {
      editor
        .chain()
        .focus()
        .insertContent(`<span class="math-inline" data-math="${escapedMath}"></span>`)
        .run()
    } else {
      editor
        .chain()
        .focus()
        .insertContent(`<div class="math-display" data-math="${escapedMath}"></div>`)
        .run()
    }

    setMathInput("")
    setShowMathDialog(false)
  }

  return (
    <div ref={editorContainerRef} className="border rounded-lg bg-white shadow-sm">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 flex gap-1 items-center flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive("code")}
          title="Inline Code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Braces className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => setShowMathDialog(true)}
          active={false}
          title="Insert Math Equation"
        >
          <Sigma className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          active={false}
          title="Upload Image"
        >
          {isUploadingImage ? (
            <span className="text-xs">...</span>
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </ToolbarButton>

        {/* Language selector - only show when code block is active */}
        {editor.isActive("codeBlock") && (
          <>
            <div className="w-px h-6 bg-gray-300 mx-1" />
            <select
              value={currentLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="sql">SQL</option>
              <option value="typescript">TypeScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
            </select>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Editor Content */}
      <EditorContent editor={editor} placeholder={placeholder} />

      {/* Math Equation Dialog */}
      <Dialog open={showMathDialog} onOpenChange={setShowMathDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Math Equation</DialogTitle>
            <DialogDescription>
              Enter your LaTeX math equation below. Use inline for equations within text, or block for standalone equations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Equation Type</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={isInlineMath}
                    onChange={() => setIsInlineMath(true)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Inline (within text)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!isInlineMath}
                    onChange={() => setIsInlineMath(false)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Block (standalone)</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="math-input">LaTeX Equation</Label>
              <Input
                id="math-input"
                value={mathInput}
                onChange={(e) => setMathInput(e.target.value)}
                placeholder="e.g., x^2 + y^2 = z^2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    insertMath()
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Examples:</Label>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>• Fraction: <code className="bg-muted px-1 rounded">\frac{"{a}{b}"}</code></div>
                <div>• Square root: <code className="bg-muted px-1 rounded">\sqrt{"{x}"}</code></div>
                <div>• Summation: <code className="bg-muted px-1 rounded">\sum_{"{i=1}"}^{"{n}"} i</code></div>
                <div>• Greek letters: <code className="bg-muted px-1 rounded">\alpha, \beta, \theta</code></div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowMathDialog(false)
                setMathInput("")
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={insertMath}>
              Insert Equation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

