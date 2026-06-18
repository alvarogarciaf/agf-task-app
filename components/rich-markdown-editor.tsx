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
  Indent,
  Outdent,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
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

// Matches a bare URL token: an explicit http(s):// URL, a www.* host, or a
// domain with a 2+ letter TLD and optional path (e.g. "example.com/page").
const URL_TOKEN_RE = /^(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.[a-z]{2,}(?:\/[^\s]*)?)$/i

function normalizeUrl(token: string): string {
  return /^https?:\/\//i.test(token) ? token : `https://${token}`
}

function isPointBeforeRange(node: Node, offset: number, range: Range): boolean {
  const point = document.createRange()
  if (node.nodeName === "BR" || node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "BR") {
    point.setStartBefore(node)
  } else {
    try {
      point.setStart(node, offset)
    } catch (e) {
      point.setStartBefore(node)
    }
  }
  point.collapse(true)
  return point.compareBoundaryPoints(Range.START_TO_START, range) < 0
}

function getLineStartRange(block: HTMLElement, range: Range): Range {
  const lineStart = document.createRange()
  lineStart.setStart(block, 0)
  lineStart.collapse(true)

  const checkbox = block.querySelector("input.md-task-box")
  if (checkbox) {
    lineStart.setStartAfter(checkbox)
    lineStart.collapse(true)
  }

  block.querySelectorAll("br").forEach((br) => {
    if (isPointBeforeRange(br, 0, range)) {
      lineStart.setStartAfter(br)
      lineStart.collapse(true)
    }
  })

  return lineStart
}

function getLineTextBeforeCursor(block: HTMLElement, range: Range): string {
  const lineStart = getLineStartRange(block, range)
  const lineRange = document.createRange()
  lineRange.setStart(lineStart.startContainer, lineStart.startOffset)
  lineRange.setEnd(range.startContainer, range.startOffset)
  return lineRange.toString().replace(/\u00A0/g, " ")
}

function getLineTextAfterCursor(block: HTMLElement, range: Range): string {
  const lineEnd = document.createRange()
  lineEnd.setStart(range.startContainer, range.startOffset)

  const nextBr = Array.from(block.querySelectorAll("br")).find(
    (br) => !isPointBeforeRange(br, 0, range),
  )

  if (nextBr) {
    lineEnd.setEndBefore(nextBr)
  } else {
    lineEnd.setEnd(block, block.childNodes.length)
  }

  return lineEnd.toString().replace(/\u00A0/g, " ")
}

function isCursorAfterLineBreak(block: HTMLElement, range: Range): boolean {
  return Array.from(block.querySelectorAll("br")).some((br) =>
    isPointBeforeRange(br, 0, range),
  )
}

function isolateLineToParagraph(block: HTMLElement, range: Range): HTMLParagraphElement {
  const lineStart = getLineStartRange(block, range)
  
  // Extract everything from the start of the line to the end of the block
  const tailRange = document.createRange()
  tailRange.setStart(lineStart.startContainer, lineStart.startOffset)
  tailRange.setEnd(block, block.childNodes.length)

  const tailFragment = tailRange.extractContents()
  
  // Clean up trailing BRs in the original block
  while (block.lastChild?.nodeName === "BR") {
    block.removeChild(block.lastChild)
  }
  if (!block.textContent && !block.querySelector("br")) {
    block.appendChild(document.createElement("br"))
  }

  // Process the tailFragment which starts with our target line
  const targetParagraph = document.createElement("p")
  const restParagraph = document.createElement("p")
  
  const tempDiv = document.createElement("div")
  tempDiv.appendChild(tailFragment)
  
  // Find the first BR in the tail fragment (marks the end of our target line)
  const firstBr = tempDiv.querySelector("br")
  if (firstBr) {
    const firstLineRange = document.createRange()
    firstLineRange.setStart(tempDiv, 0)
    firstLineRange.setEndBefore(firstBr)
    targetParagraph.appendChild(firstLineRange.extractContents())
    
    firstBr.remove() // remove the separating BR
    
    // Everything else goes to restParagraph
    restParagraph.append(...Array.from(tempDiv.childNodes))
  } else {
    targetParagraph.append(...Array.from(tempDiv.childNodes))
  }

  if (!targetParagraph.textContent && !targetParagraph.querySelector("br")) {
    targetParagraph.appendChild(document.createElement("br"))
  }
  
  // Insert the new blocks into the document
  block.after(targetParagraph)
  
  if (restParagraph.childNodes.length > 0 && (restParagraph.textContent || restParagraph.querySelector("br"))) {
    if (!restParagraph.textContent && !restParagraph.querySelector("br")) {
      restParagraph.appendChild(document.createElement("br"))
    }
    targetParagraph.after(restParagraph)
  }

  // Clean up original block if it's completely empty and we just split from it
  if (block.textContent === "" && block.childNodes.length <= 1) {
    block.remove()
  }

  return targetParagraph
}

interface EditorSurfaceProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  trailingTool?: React.ReactNode
}

interface CursorTextContext {
  block: HTMLElement
  range: Range
  textBefore: string
  textAfter: string
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
  const isFocusedRef = useRef(false)
  const isComposingRef = useRef(false)
  const savedRange = useRef<Range | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")

  useEffect(() => {
    if (!editorRef.current || isFocusedRef.current) return

    const currentHtml = editorRef.current.innerHTML
    const targetHtml = markdownToHtml(value)

    if (isFirstRender.current || htmlToMarkdown(currentHtml) !== htmlToMarkdown(targetHtml)) {
      editorRef.current.innerHTML = targetHtml || "<p><br></p>"
      isFirstRender.current = false
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

  const syncMarkdown = () => {
    if (editorRef.current) {
      onChange(htmlToMarkdown(editorRef.current.innerHTML))
    }
  }

  const handleInput = () => {
    if (!editorRef.current || isComposingRef.current) return
    if (fixupHeadingAfterInput()) {
      syncMarkdown()
      return
    }
    if (fixupCheckboxAfterInput()) {
      syncMarkdown()
      return
    }
    syncMarkdown()
  }

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, arg)
    syncMarkdown()
  }

  const toggleInlineFormat = (command: "bold" | "italic") => {
    editorRef.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    const block = getCurrentBlock()
    if (block && !range.collapsed) {
      const blockRange = document.createRange()
      blockRange.selectNodeContents(block)
      const trimmed = range.cloneRange()
      if (trimmed.compareBoundaryPoints(Range.START_TO_START, blockRange) < 0) {
        trimmed.setStart(blockRange.startContainer, blockRange.startOffset)
      }
      if (trimmed.compareBoundaryPoints(Range.END_TO_END, blockRange) > 0) {
        trimmed.setEnd(blockRange.endContainer, blockRange.endOffset)
      }
      sel.removeAllRanges()
      sel.addRange(trimmed)
    }

    document.execCommand(command, false)
    syncMarkdown()
  }

  const toggleBlock = (tag: "h1" | "h2" | "h3") => {
    editorRef.current?.focus()
    const current = (document.queryCommandValue("formatBlock") || "").toLowerCase()
    document.execCommand("formatBlock", false, current.includes(tag) ? "p" : tag)
    handleInput()
  }

  // Capture the editor selection and seed the form. Radix owns the open state
  // (via onOpenChange) so we must not toggle `linkOpen` here — doing so fought
  // with Radix's own trigger toggle and made the popover flicker shut.
  const prepareLinkPopover = () => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
      setLinkText(selection.toString())
    } else {
      savedRange.current = null
      setLinkText("")
    }
    setLinkUrl("")
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
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return null
    let n: Node | null = sel.getRangeAt(0).startContainer
    while (n && n !== editorRef.current) {
      if (n.nodeType === Node.ELEMENT_NODE && /^(P|DIV|H1|H2|H3|LI)$/.test((n as HTMLElement).tagName)) {
        return n as HTMLElement
      }
      n = n.parentNode
    }
    return null
  }

  const getCursorTextContext = (): CursorTextContext | null => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    const block = getCurrentBlock()
    if (!block) return null

    const preRange = document.createRange()
    preRange.selectNodeContents(block)
    preRange.setEnd(range.startContainer, range.startOffset)

    const postRange = document.createRange()
    postRange.selectNodeContents(block)
    postRange.setStart(range.startContainer, range.startOffset)

    return {
      block,
      range,
      textBefore: preRange.toString().replace(/\u00A0/g, " "),
      textAfter: postRange.toString().replace(/\u00A0/g, " "),
    }
  }

  const locateTextPosition = (
    block: HTMLElement,
    charIndex: number,
  ): { node: Text; offset: number } | null => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
    let remaining = charIndex

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text
      const len = textNode.nodeValue?.length ?? 0
      if (remaining <= len) {
        return { node: textNode, offset: remaining }
      }
      remaining -= len
    }

    return null
  }

  const removeBlockTextRange = (block: HTMLElement, start: number, end: number) => {
    if (start >= end) return
    const startPos = locateTextPosition(block, start)
    const endPos = locateTextPosition(block, end)
    if (!startPos || !endPos) return

    const r = document.createRange()
    r.setStart(startPos.node, startPos.offset)
    r.setEnd(endPos.node, endPos.offset)
    r.deleteContents()
  }

  const removeBlockPrefix = (block: HTMLElement, prefixLength: number) => {
    removeBlockTextRange(block, 0, prefixLength)
  }

  const HEADING_CLASSES: Record<"h1" | "h2" | "h3", string> = {
    h1: "text-base font-bold text-foreground mt-3 mb-1.5 font-sans border-b border-border/10 pb-0.5",
    h2: "text-sm font-semibold text-foreground mt-3 mb-1.5 font-sans",
    h3: "text-xs font-semibold text-foreground mt-2 mb-1 font-sans uppercase tracking-wider text-muted-foreground",
  }

  const convertBlockToHeading = (
    block: HTMLElement,
    tag: "h1" | "h2" | "h3",
    markerLength: number,
  ) => {
    removeBlockPrefix(block, markerLength)

    if (!block.textContent && !block.querySelector("br")) {
      block.appendChild(document.createElement("br"))
    }

    // Place caret in the block and use the browser's native formatBlock command
    // This correctly handles breaking out of lists and splitting blocks.
    placeCaretAtStart(block)
    document.execCommand("formatBlock", false, tag)

    // The browser replaced the block, find the new one
    const newBlock = getCurrentBlock()
    if (newBlock) {
      newBlock.className = HEADING_CLASSES[tag]
      // If the heading is completely empty, it needs a <br> to be focusable
      if (!newBlock.textContent && !newBlock.querySelector("br")) {
        newBlock.appendChild(document.createElement("br"))
      }
      placeCaretAtEnd(newBlock)
    }
  }

  const applyHeadingShortcut = (
    block: HTMLElement,
    range: Range,
    tag: "h1" | "h2" | "h3",
    markerLength: number,
  ) => {
    let target = block
    // We unconditionally isolate the line so that if there are line breaks AFTER
    // the cursor, they don't get pulled into the heading.
    if (block.querySelector("input.md-task-box") || block.querySelector("br")) {
      target = isolateLineToParagraph(block, range)
    }
    convertBlockToHeading(target, tag, markerLength)
  }

  const fixupHeadingAfterInput = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx) return false

    const tag = ctx.block.tagName.toLowerCase()
    if (tag === "h1" || tag === "h2" || tag === "h3") return false

    const lineText =
      getLineTextBeforeCursor(ctx.block, ctx.range) +
      getLineTextAfterCursor(ctx.block, ctx.range)
    const match = lineText.match(/^\/(h[123])\s/i)
    if (!match) return false

    const headingTag = match[1].toLowerCase() as "h1" | "h2" | "h3"
    applyHeadingShortcut(ctx.block, ctx.range, headingTag, match[1].length + 2)
    return true
  }

  const convertBlockToCheckbox = (block: HTMLElement, markerLength: number, textAfter: string) => {
    removeBlockPrefix(block, markerLength)
    block.classList.add("md-task")

    const input = document.createElement("input")
    input.type = "checkbox"
    input.className = "md-task-box"
    input.setAttribute("contenteditable", "false")

    const suffix = textAfter.replace(/^\s+/, "")
    block.replaceChildren(input, document.createTextNode("\u00A0" + suffix))
    placeCaretAtEnd(block)
  }

  const fixupCheckboxAfterInput = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx || ctx.block.querySelector("input.md-task-box")) return false

    const text = (ctx.block.textContent || "").replace(/\u00A0/g, " ")
    const match = text.match(/^(\[\]|\[ \])\s(.*)$/)
    if (!match) return false

    convertBlockToCheckbox(ctx.block, match[1].length + 1, match[2])
    return true
  }

  const applySpaceShortcuts = (): boolean => {
    if (isComposingRef.current) return false

    const ctx = getCursorTextContext()
    if (!ctx) return false

    const { block, range, textBefore, textAfter } = ctx

    const tokenMatch = textBefore.match(/(\S+)$/)
    if (tokenMatch && !isInsideAnchor(range.startContainer)) {
      const token = tokenMatch[1]
      if (URL_TOKEN_RE.test(token)) {
        const tokenStart = textBefore.length - token.length
        const startPos = locateTextPosition(block, tokenStart)
        if (!startPos) return false

        const deleteRange = document.createRange()
        deleteRange.setStart(startPos.node, startPos.offset)
        deleteRange.setEnd(range.startContainer, range.startOffset)
        deleteRange.deleteContents()

        const anchor = document.createElement("a")
        anchor.href = normalizeUrl(token)
        anchor.target = "_blank"
        anchor.rel = "noopener noreferrer"
        anchor.className = "text-primary hover:underline font-semibold"
        anchor.textContent = token

        deleteRange.insertNode(anchor)
        const spaceNode = document.createTextNode(" ")
        anchor.after(spaceNode)
        if (textAfter) {
          spaceNode.after(document.createTextNode(textAfter))
        }

        const sel = window.getSelection()
        if (sel) {
          const caret = document.createRange()
          caret.setStart(spaceNode, 1)
          caret.collapse(true)
          sel.removeAllRanges()
          sel.addRange(caret)
        }
        syncMarkdown()
        return true
      }
    }

    const lineBefore = getLineTextBeforeCursor(block, range)
    const lineAfter = getLineTextAfterCursor(block, range)

    const slash = lineBefore.match(/^\/(h[123])$/i)
    if (slash) {
      const headingTag = slash[1].toLowerCase() as "h1" | "h2" | "h3"
      applyHeadingShortcut(block, range, headingTag, lineBefore.length)
      syncMarkdown()
      return true
    }

    if (lineBefore === "[]" || lineBefore === "[ ]") {
      let target = block
      if (block.querySelector("input.md-task-box") || block.querySelector("br")) {
        target = isolateLineToParagraph(block, range)
      }
      convertBlockToCheckbox(target, lineBefore.length, lineAfter)
      syncMarkdown()
      return true
    }

    if (lineBefore === "*" || lineBefore === "-" || lineBefore === "•") {
      let target = block
      if (block.querySelector("input.md-task-box") || block.querySelector("br")) {
        target = isolateLineToParagraph(block, range)
      }
      removeBlockPrefix(target, lineBefore.length)
      if (!target.textContent && !target.querySelector("br")) {
        target.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(target)
      document.execCommand("insertUnorderedList", false)
      syncMarkdown()
      return true
    }

    return false
  }

  const isInsideAnchor = (n: Node | null): boolean => {
    let cur: Node | null = n
    while (cur && cur !== editorRef.current) {
      if (cur.nodeType === Node.ELEMENT_NODE && (cur as HTMLElement).tagName === "A") {
        return true
      }
      cur = cur.parentNode
    }
    return false
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

      const sel = window.getSelection()
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      const block = getCurrentBlock()

      if (block && range) {
        const lineBefore = getLineTextBeforeCursor(block, range)
        const slash = lineBefore.match(/^\/(h[123])$/i)
        if (slash) {
          e.preventDefault()
          applyHeadingShortcut(
            block,
            range,
            slash[1].toLowerCase() as "h1" | "h2" | "h3",
            lineBefore.length
          )
          syncMarkdown()
          return
        }
      }

      // Inside a checkbox line, Enter continues the checklist like bullets do:
      // a fresh checkbox on the next line, or exit to a plain paragraph when empty.
      if (block && block.querySelector("input.md-task-box") && range) {
        if (isCursorAfterLineBreak(block, range)) {
          e.preventDefault()
          const paragraph = isolateLineToParagraph(block, range)
          placeCaretAtStart(paragraph)
          syncMarkdown()
          return
        }

        e.preventDefault()
        const lineText = getLineTextBeforeCursor(block, range).replace(/\u00A0/g, "").trim()
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
        syncMarkdown()
        return
      }
      // Otherwise let the browser create a new paragraph block.
      return
    }

    if (e.key === "Tab") {
      const block = getCurrentBlock()
      if (block && block.tagName.toLowerCase() === "li") {
        e.preventDefault()
        if (e.shiftKey) {
          document.execCommand("outdent", false)
        } else {
          document.execCommand("indent", false)
        }
        syncMarkdown()
      }
      return
    }

    if (e.key === " " && applySpaceShortcuts()) {
      e.preventDefault()
    }
  }

  const handleBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = e.nativeEvent as InputEvent
    if (inputEvent.inputType !== "insertText" || inputEvent.data !== " ") return
    if (applySpaceShortcuts()) {
      e.preventDefault()
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

  const handleCopyMarkdown = async () => {
    if (!editorRef.current) return
    const text = htmlToMarkdown(editorRef.current.innerHTML)
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Markdown copied to clipboard")
    } catch (err) {
      toast.error("Failed to copy markdown")
    }
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

        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleInlineFormat("bold")} className={toolbarButton} title="Bold" aria-label="Bold">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleInlineFormat("italic")} className={toolbarButton} title="Italic" aria-label="Italic">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={toolbarButton} title="Bullet list" aria-label="Bullet list">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("indent")} className={toolbarButton} title="Indent" aria-label="Indent">
          <Indent className="h-4 w-4" />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("outdent")} className={toolbarButton} title="Outdent" aria-label="Outdent">
          <Outdent className="h-4 w-4" />
        </button>

        <span className="mx-1 h-4 w-px bg-border" />

        <Popover
          open={linkOpen}
          onOpenChange={(o) => {
            if (o) prepareLinkPopover()
            setLinkOpen(o)
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
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

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={handleCopyMarkdown} className={toolbarButton} title="Copy as Markdown" aria-label="Copy as Markdown">
            <Copy className="h-4 w-4" />
          </button>
          {trailingTool && <div>{trailingTool}</div>}
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onFocus={() => {
          isFocusedRef.current = true
        }}
        onBlur={() => {
          isFocusedRef.current = false
          handleInput()
        }}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false
          handleInput()
        }}
        onInput={handleInput}
        onBeforeInput={handleBeforeInput}
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
              : "h-[88vh] w-[90vw] max-w-none sm:max-w-3xl sm:rounded-lg"
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
