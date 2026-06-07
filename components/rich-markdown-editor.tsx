"use client"

import React, { useEffect, useRef, useState } from "react"
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { markdownToHtml, htmlToMarkdown } from "@/lib/markdown"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-mobile"

export { markdownToHtml, htmlToMarkdown } from "@/lib/markdown"

interface RichMarkdownEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

interface EditorSurfaceProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  trailingTool?: React.ReactNode
}

function EditorSurface({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  trailingTool,
}: EditorSurfaceProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const savedRange = useRef<Range | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")

  useEffect(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML
      const targetHtml = markdownToHtml(value)

      if (isFirstRender.current || htmlToMarkdown(currentHtml) !== htmlToMarkdown(targetHtml)) {
        editorRef.current.innerHTML = targetHtml || "<p><br></p>"
        isFirstRender.current = false
      }
    }
  }, [value])

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus()
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [autoFocus])

  const handleInput = () => {
    if (editorRef.current) {
      onChange(htmlToMarkdown(editorRef.current.innerHTML))
    }
  }

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, arg)
    handleInput()
  }

  const toggleBlock = (tag: "h1" | "h2" | "h3") => {
    editorRef.current?.focus()
    const current = (document.queryCommandValue("formatBlock") || "").toLowerCase()
    document.execCommand("formatBlock", false, current.includes(tag) ? "p" : tag)
    handleInput()
  }

  const openLinkPopover = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
      setLinkText(selection.toString())
    } else {
      savedRange.current = null
      setLinkText("")
    }
    setLinkUrl("")
    setLinkOpen(true)
  }

  const insertLink = () => {
    const url = linkUrl.trim()
    if (!url) return

    editorRef.current?.focus()
    const sel = window.getSelection()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }

    const text = linkText.trim() || url
    const anchor = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">${escapeHtml(text)}</a>`
    document.execCommand("insertHTML", false, anchor)
    handleInput()

    setLinkOpen(false)
    setLinkUrl("")
    setLinkText("")
    savedRange.current = null
  }

  const getCurrentBlock = (): HTMLElement | null => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    let n: Node | null = sel.getRangeAt(0).startContainer
    while (n && n !== editorRef.current) {
      if (n.nodeType === Node.ELEMENT_NODE && /^(P|DIV|H1|H2|H3|LI)$/.test((n as HTMLElement).tagName)) {
        return n as HTMLElement
      }
      n = n.parentNode
    }
    return null
  }

  const placeCaretAtStart = (el: Node) => {
    const sel = window.getSelection()
    if (!sel) return
    const r = document.createRange()
    r.setStart(el, 0)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
  }

  const placeCaretAtEnd = (el: Node) => {
    const sel = window.getSelection()
    if (!sel) return
    const r = document.createRange()
    r.selectNodeContents(el)
    r.collapse(false)
    sel.removeAllRanges()
    sel.addRange(r)
  }

  const stripLeadingChars = (el: HTMLElement, count: number) => {
    let remaining = count
    while (remaining > 0 && el.firstChild) {
      const fc = el.firstChild
      if (fc.nodeType === Node.TEXT_NODE) {
        const v = fc.nodeValue || ""
        if (v.length > remaining) {
          fc.nodeValue = v.slice(remaining)
          remaining = 0
        } else {
          remaining -= v.length
          el.removeChild(fc)
        }
      } else {
        break
      }
    }
  }

  const buildCheckboxLine = (): HTMLParagraphElement => {
    const p = document.createElement("p")
    p.className = "md-task"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.className = "md-task-box"
    input.setAttribute("contenteditable", "false")
    p.appendChild(input)
    p.appendChild(document.createTextNode("\u00A0"))
    return p
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      // Ctrl/Cmd+Enter -> soft line break within the current paragraph.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        document.execCommand("insertLineBreak")
        handleInput()
        return
      }

      // Inside a checkbox line, Enter continues the checklist like bullets do:
      // a fresh checkbox on the next line, or exit to a plain paragraph when empty.
      const block = getCurrentBlock()
      if (block && block.querySelector("input.md-task-box")) {
        e.preventDefault()
        const lineText = (block.textContent || "").replace(/\u00A0/g, "").trim()
        if (lineText === "") {
          const p = document.createElement("p")
          p.appendChild(document.createElement("br"))
          block.replaceWith(p)
          placeCaretAtStart(p)
        } else {
          const next = buildCheckboxLine()
          block.after(next)
          placeCaretAtEnd(next)
        }
        handleInput()
      }
      // Otherwise let the browser create a new paragraph block.
      return
    }

    if (e.key === " ") {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return

      const range = selection.getRangeAt(0)
      const node = range.startContainer

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || ""
        const offset = range.startOffset
        const textBeforeCursor = text.substring(0, offset)

        // Slash command for headings: "/h1".."/h3" — behaves like the toolbar button,
        // so the heading applies to the text typed next on this same line.
        const slash = textBeforeCursor.match(/^\/(h[123])$/i)
        if (slash) {
          e.preventDefault()
          document.execCommand("formatBlock", false, slash[1].toLowerCase())
          const block = getCurrentBlock()
          if (block) {
            stripLeadingChars(block, offset)
            if (!block.firstChild) block.appendChild(document.createElement("br"))
            placeCaretAtStart(block)
          }
          handleInput()
          return
        }

        // Checkbox: "[]" or "[ ]"
        if (textBeforeCursor === "[]" || textBeforeCursor === "[ ]") {
          e.preventDefault()
          const block = getCurrentBlock()
          if (block) {
            stripLeadingChars(block, offset)
            block.classList.add("md-task")
            const input = document.createElement("input")
            input.type = "checkbox"
            input.className = "md-task-box"
            input.setAttribute("contenteditable", "false")
            block.insertBefore(document.createTextNode("\u00A0"), block.firstChild)
            block.insertBefore(input, block.firstChild)
            placeCaretAtEnd(block)
          }
          handleInput()
          return
        }

        // Bullet list: "*", "-", or "•"
        if (textBeforeCursor === "*" || textBeforeCursor === "-" || textBeforeCursor === "•") {
          e.preventDefault()
          node.nodeValue = text.substring(offset)
          document.execCommand("insertUnorderedList", false)
          handleInput()
        }
      }
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target instanceof HTMLInputElement && target.classList.contains("md-task-box")) {
      // The native click already toggled `checked`; mirror it onto the
      // attribute so innerHTML serialization (and the markdown) stays in sync.
      if (target.checked) {
        target.setAttribute("checked", "checked")
      } else {
        target.removeAttribute("checked")
      }
      handleInput()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")

    const hasMarkdown = /^(#+\s+|\*\s+|-\s+|•\s+|\d+\.\s+)/m.test(text) || /(\*\*|__|\*|_|\[.+\]\(.+\))/.test(text)

    let htmlToInsert = ""
    if (hasMarkdown) {
      htmlToInsert = markdownToHtml(text)
    } else {
      htmlToInsert = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
    }

    document.execCommand("insertHTML", false, htmlToInsert)
  }

  const toolbarButton = "inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 border-border bg-muted/30 px-1.5 py-1">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h1")} className={toolbarButton} title="Heading 1" aria-label="Heading 1">
          <Heading1 className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h2")} className={toolbarButton} title="Heading 2" aria-label="Heading 2">
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h3")} className={toolbarButton} title="Heading 3" aria-label="Heading 3">
          <Heading3 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={toolbarButton} title="Bold" aria-label="Bold">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={toolbarButton} title="Italic" aria-label="Italic">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={toolbarButton} title="Bullet list" aria-label="Bullet list">
          <List className="h-4 w-4" />
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        <Popover open={linkOpen} onOpenChange={setLinkOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                openLinkPopover()
              }}
              className={toolbarButton}
              title="Insert link"
              aria-label="Insert link"
            >
              <LinkIcon className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-2">
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text</label>
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Link text"
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">URL</label>
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    insertLink()
                  }
                }}
                placeholder="https://example.com"
                autoFocus
                className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setLinkOpen(false)}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insertLink}
                disabled={!linkUrl.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add link
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {trailingTool && <div className="ml-auto flex items-center">{trailingTool}</div>}
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={cn(
          "rich-editor prose prose-sm dark:prose-invert max-w-none min-h-0 w-full flex-1 rounded-b-md border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground/90 overflow-y-auto outline-none transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:outline-none focus:ring-1 focus:ring-ring",
          "[&_h1]:text-base [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:font-sans [&_h1]:border-b [&_h1]:border-border/10 [&_h1]:pb-0.5",
          "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-sans",
          "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-sans [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1",
          "[&_li]:leading-relaxed [&_li]:text-xs [&_li]:text-foreground/90",
          "[&_strong]:font-bold [&_strong]:text-foreground",
          "[&_em]:italic [&_em]:text-foreground/90",
          "[&_a]:text-primary [&_a]:hover:underline [&_a]:font-semibold",
          "[&_p]:mb-3 [&_p]:text-xs [&_p]:text-foreground/90 [&_p]:leading-relaxed",
          "[&>div]:mb-3 [&>div]:text-xs [&>div]:text-foreground/90 [&>div]:leading-relaxed",
          "[&_.md-task]:flex [&_.md-task]:items-start [&_.md-task]:gap-2",
          "[&_.md-task-box]:mt-0.5 [&_.md-task-box]:h-3.5 [&_.md-task-box]:w-3.5 [&_.md-task-box]:shrink-0 [&_.md-task-box]:cursor-pointer [&_.md-task-box]:accent-primary",
        )}
      />
    </div>
  )
}

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
}: RichMarkdownEditorProps) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <EditorSurface
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={cn("mt-1.5 min-h-[180px]", className)}
        trailingTool={
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Expand editor"
            aria-label="Expand editor"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        }
      />

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            isMobile
              ? "fixed inset-0 z-50 h-full w-full max-w-none translate-x-0 translate-y-0 rounded-none border-none"
              : "h-[85vh] w-[90vw] max-w-4xl sm:rounded-lg"
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
            <DialogTitle className="text-sm font-semibold">Details</DialogTitle>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              title="Collapse editor"
              aria-label="Collapse editor"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Collapse
            </button>
          </div>
          {expanded && (
            <EditorSurface
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              autoFocus
              className="flex-1 p-4"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
