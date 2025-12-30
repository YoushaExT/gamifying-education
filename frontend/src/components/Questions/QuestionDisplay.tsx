import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import Mathematics from "@tiptap/extension-mathematics"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import katex from "katex"
import { common, createLowlight } from "lowlight"
import { useEffect, useRef } from "react"
import "highlight.js/styles/github.css"
import "katex/dist/katex.min.css"

const lowlight = createLowlight(common)

interface QuestionDisplayProps {
  html: string
  className?: string
}

export function QuestionDisplay({
  html,
  className = "",
}: QuestionDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Mathematics,
    ],
    content: html,
    editable: false,
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none ${className}`,
      },
    },
  })

  useEffect(() => {
    if (editor && html !== editor.getHTML()) {
      editor.commands.setContent(html)
    }
  }, [html, editor])

  // Render KaTeX math equations after content is loaded
  useEffect(() => {
    if (!containerRef.current || !editor) return

    const renderMath = () => {
      if (!containerRef.current) return

      // Helper to unescape HTML entities
      const unescapeHtml = (text: string) => {
        const textarea = document.createElement("textarea")
        textarea.innerHTML = text
        return textarea.value
      }

      // First, handle wrapped math elements (new format)
      const inlineMathElements =
        containerRef.current.querySelectorAll(".math-inline")
      inlineMathElements.forEach((element) => {
        let mathContent =
          element.getAttribute("data-math") ||
          element.textContent?.replace(/^\$|\$$/g, "") ||
          ""
        mathContent = unescapeHtml(mathContent)
        if (mathContent && element.children.length === 0) {
          try {
            katex.render(mathContent, element as HTMLElement, {
              throwOnError: false,
              displayMode: false,
            })
          } catch (error) {
            console.error("KaTeX inline rendering error:", error)
          }
        }
      })

      const displayMathElements =
        containerRef.current.querySelectorAll(".math-display")
      displayMathElements.forEach((element) => {
        let mathContent =
          element.getAttribute("data-math") ||
          element.textContent?.replace(/^\$\$|\$\$$/g, "") ||
          ""
        mathContent = unescapeHtml(mathContent)
        if (mathContent && element.children.length === 0) {
          try {
            katex.render(mathContent, element as HTMLElement, {
              throwOnError: false,
              displayMode: true,
            })
          } catch (error) {
            console.error("KaTeX display rendering error:", error)
          }
        }
      })

      // Second, find and render plain text math (old format or unwrapped)
      const textNodes: Node[] = []
      const walker = document.createTreeWalker(
        containerRef.current,
        NodeFilter.SHOW_TEXT,
        null,
      )

      let node: Node | null = walker.nextNode()
      while (node !== null) {
        if (node.textContent?.includes("$")) {
          textNodes.push(node)
        }
        node = walker.nextNode()
      }

      textNodes.forEach((node) => {
        if (!node.textContent || !node.parentElement) return

        let html = node.textContent

        // Replace display math $$...$$ first
        html = html.replace(/\$\$(.*?)\$\$/g, (_, math) => {
          try {
            return katex.renderToString(math, {
              throwOnError: false,
              displayMode: true,
            })
          } catch (_e) {
            return `$$${math}$$`
          }
        })

        // Replace inline math $...$
        html = html.replace(/\$([^$]+?)\$/g, (_, math) => {
          try {
            return katex.renderToString(math, {
              throwOnError: false,
              displayMode: false,
            })
          } catch (_e) {
            return `$${math}$`
          }
        })

        if (html !== node.textContent) {
          const span = document.createElement("span")
          span.innerHTML = html
          node.parentElement.replaceChild(span, node)
        }
      })
    }

    // Use requestAnimationFrame instead of setTimeout for better performance
    const frameId = requestAnimationFrame(renderMath)
    return () => cancelAnimationFrame(frameId)
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div ref={containerRef}>
      <EditorContent editor={editor} />
    </div>
  )
}
