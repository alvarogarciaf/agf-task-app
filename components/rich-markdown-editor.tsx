"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import {
  Bold,
  Heading,
  Italic,
  Link as LinkIcon,
  List,
  Maximize2,
  Minimize2,
  Indent,
  Outdent,
  Copy,
  Image as ImageIcon,
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
import { uploadImage } from "@/lib/image-upload"

export { markdownToHtml, htmlToMarkdown } from "@/lib/markdown"

interface RichMarkdownEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
  variant?: "default" | "ghost"
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
  variant?: "default" | "ghost"
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
  variant = "default",
}: EditorSurfaceProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)
  const isFocusedRef = useRef(false)
  const isComposingRef = useRef(false)
  const savedRange = useRef<Range | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkText, setLinkText] = useState("")

  const isMobile = useIsMobile()
  const [isFocused, setIsFocused] = useState(false)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [headingCycleIndex, setHeadingCycleIndex] = useState(0)

  // Floating Context Menu State
  const [activeLinkMenu, setActiveLinkMenu] = useState<{
    type: "card" | "link"
    element: HTMLElement
    url: string
    text?: string
    rect: DOMRect
  } | null>(null)
  const [editingLink, setEditingLink] = useState<{ url: string, text: string } | null>(null)

  useEffect(() => {
    if (!editorRef.current || isFocusedRef.current) return

    const currentHtml = editorRef.current.innerHTML
    const targetHtml = markdownToHtml(value)

    if (isFirstRender.current || htmlToMarkdown(currentHtml) !== htmlToMarkdown(targetHtml)) {
      editorRef.current.innerHTML = targetHtml || "<p><br></p>"
      
      // Ensure there is an empty paragraph at the end if the last element is non-editable (like a card)
      // This allows the user to click below the card and continue typing
      const lastChild = editorRef.current.lastElementChild
      if (lastChild && lastChild.getAttribute("contenteditable") === "false") {
        editorRef.current.insertAdjacentHTML('beforeend', '<p><br></p>')
      }

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
    if (fixupListAfterInput()) {
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
    h1: "text-lg font-bold text-foreground mt-3 mb-1.5 font-sans border-b border-border/10 pb-0.5",
    h2: "text-base font-semibold text-foreground mt-3 mb-1.5 font-sans",
    h3: "text-sm font-semibold text-foreground mt-2 mb-1 font-sans uppercase tracking-wider text-muted-foreground",
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

    const lineText = (
      getLineTextBeforeCursor(ctx.block, ctx.range) +
      getLineTextAfterCursor(ctx.block, ctx.range)
    ).replace(/\u00A0/g, " ")
    
    const match = lineText.match(/^(\[\]|\[ \])\s(.*)$/)
    if (!match) return false

    let target = ctx.block
    if (ctx.block.querySelector("br")) {
      target = isolateLineToParagraph(ctx.block, ctx.range)
    }

    convertBlockToCheckbox(target, match[1].length + 1, match[2])
    return true
  }

  const fixupListAfterInput = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx || ctx.block.querySelector("input.md-task-box") || ctx.block.closest("ul, ol")) return false

    const lineText = (
      getLineTextBeforeCursor(ctx.block, ctx.range) +
      getLineTextAfterCursor(ctx.block, ctx.range)
    ).replace(/\u00A0/g, " ")

    const ulMatch = lineText.match(/^([*\-•])\s+(.*)$/)
    if (ulMatch) {
      const prefixLen = ulMatch[1].length + 1
      let target = ctx.block
      if (ctx.block.querySelector("br")) {
        target = isolateLineToParagraph(ctx.block, ctx.range)
      }
      removeBlockPrefix(target, prefixLen)
      if (!target.textContent && !target.querySelector("br")) {
        target.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(target)
      document.execCommand("insertUnorderedList", false)
      return true
    }

    const olMatch = lineText.match(/^(\d+[\.\)])\s+(.*)$/)
    if (olMatch) {
      const prefixLen = olMatch[1].length + 1
      let target = ctx.block
      if (ctx.block.querySelector("br")) {
        target = isolateLineToParagraph(ctx.block, ctx.range)
      }
      removeBlockPrefix(target, prefixLen)
      if (!target.textContent && !target.querySelector("br")) {
        target.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(target)
      document.execCommand("insertOrderedList", false)
      return true
    }

    return false
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
    if (e.key === "Backspace") {
      const sel = window.getSelection()
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      const block = getCurrentBlock()
      
      if (block && block.classList.contains("md-task") && range && range.collapsed) {
        const checkbox = block.querySelector("input.md-task-box")
        if (checkbox) {
          const lineText = getLineTextBeforeCursor(block, range).replace(/\u00A0/g, "")
          if (lineText === "") {
            e.preventDefault()
            checkbox.remove()
            if (block.firstChild && block.firstChild.nodeType === Node.TEXT_NODE) {
              block.firstChild.textContent = block.firstChild.textContent?.replace(/^[\s\u00A0]+/, "") || ""
            }
            block.classList.remove("md-task")
            if (block.className === "") block.removeAttribute("class")
            syncMarkdown()
            return
          }
        }
      }
    }

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
      return
    }

    const cardMenuBtn = target.closest(".card-menu-btn") as HTMLElement | null
    if (cardMenuBtn) {
      e.preventDefault()
      e.stopPropagation()
      const url = cardMenuBtn.getAttribute("data-url")
      if (url) {
        const wrapper = cardMenuBtn.closest(".link-card-wrapper") as HTMLElement
        if (wrapper) {
          const rect = wrapper.getBoundingClientRect()
          setEditingLink(null)
          setActiveLinkMenu({
            type: "card",
            element: wrapper,
            url,
            rect,
          })
        }
      }
      return
    }

    const linkEl = target.closest("a:not(.link-card)") as HTMLElement | null
    if (linkEl) {
      e.preventDefault()
      e.stopPropagation()
      const url = linkEl.getAttribute("href")
      if (url) {
        const rect = linkEl.getBoundingClientRect()
        setEditingLink(null)
        setActiveLinkMenu({
          type: "link",
          element: linkEl,
          url,
          text: linkEl.textContent || "",
          rect,
        })
      }
      return
    }

    // Close menu if clicking elsewhere in the editor
    if (activeLinkMenu && !target.closest(".context-menu-popover")) {
      setActiveLinkMenu(null)
      setEditingLink(null)
    }
  }

  const handleUrlPaste = async (url: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    const placeholderHtml = `<a href="${url}" id="preview-${id}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold" contenteditable="false">[Fetching preview for ${url}...]</a>`
    document.execCommand("insertHTML", false, placeholderHtml)
    syncMarkdown()

    try {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error("Failed to fetch preview")
      const data = await res.json()
      let finalImageUrl = data.imageUrl || ""
      if (data.imageUrl) {
        try {
          const proxyRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(data.imageUrl)}`)
          if (proxyRes.ok) {
            const blob = await proxyRes.blob()
            const file = new File([blob], "preview.jpg", { type: blob.type || "image/jpeg" })
            finalImageUrl = await uploadImage(file)
          }
        } catch (e) {
          console.error("Failed to upload preview image, falling back to original", e)
          finalImageUrl = data.imageUrl
        }
      }

      if (editorRef.current) {
        const el = editorRef.current.querySelector(`#preview-${id}`)
        if (el) {
          const title = (data.title || data.domain || url).replace(/\|/g, "-")
          const domain = data.domain || url
          const cardMd = `[card:${title}|${domain}|${finalImageUrl}](${url})`
          const cardHtml = markdownToHtml(cardMd)
          
          const isLast = !el.nextSibling
          el.outerHTML = cardHtml
          
          if (isLast) {
            editorRef.current.insertAdjacentHTML('beforeend', '<p><br></p>')
          }
          
          syncMarkdown()
        }
      }
    } catch (e) {
      console.error(e)
      if (editorRef.current) {
        const el = editorRef.current.querySelector(`#preview-${id}`)
        if (el) {
          const isLast = !el.nextSibling
          el.outerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">${url}</a>`
          
          if (isLast) {
            editorRef.current.insertAdjacentHTML('beforeend', '<p><br></p>')
          }
          
          syncMarkdown()
        }
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Check for images in clipboard
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith("image/"))
    if (imageItems.length > 0) {
      e.preventDefault()
      const files = imageItems.map(item => item.getAsFile()).filter(f => f !== null) as File[]
      handleImageFiles(files)
      return
    }

    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")

    if (URL_TOKEN_RE.test(text.trim())) {
      handleUrlPaste(text.trim())
      return
    }

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

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
    if (files.length > 0) {
      e.preventDefault()
      // Optional: focus where the image was dropped, but it's hard to get exact caret reliably.
      // Usually the caret moves to drop location automatically on native drop if we don't preventDefault too early.
      handleImageFiles(files)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFiles = async (files: File[]) => {
    if (!editorRef.current) return
    editorRef.current.focus()

    for (const file of files) {
      const placeholderId = Math.random().toString(36).substring(7)
      const placeholderText = `![Uploading_${placeholderId}...]()`
      document.execCommand("insertText", false, placeholderText)
      syncMarkdown()

      try {
        const url = await uploadImage(file)
        if (editorRef.current) {
          const currentHtml = editorRef.current.innerHTML
          const markdown = htmlToMarkdown(currentHtml)
          const updatedMarkdown = markdown.replace(placeholderText, `![${file.name}](${url})`)
          const newHtml = markdownToHtml(updatedMarkdown)
          editorRef.current.innerHTML = newHtml || "<p><br></p>"
          syncMarkdown()
        }
      } catch (error: any) {
        toast.error("Failed to upload image")
        if (editorRef.current) {
          const currentHtml = editorRef.current.innerHTML
          const markdown = htmlToMarkdown(currentHtml)
          const updatedMarkdown = markdown.replace(placeholderText, `![Upload_Failed:_${error.message.replace(/\s+/g, "_")}]()`)
          const newHtml = markdownToHtml(updatedMarkdown)
          editorRef.current.innerHTML = newHtml || "<p><br></p>"
          syncMarkdown()
        }
      }
    }
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

  const toolbarButton = "inline-flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
  const iconClass = "h-5 w-5 md:h-4 md:w-4"

  const headingLevels = ["h1", "h2", "h3"] as const
  const headingLabels = ["H1", "H2", "H3"]

  const cycleHeading = () => {
    const level = headingLevels[headingCycleIndex]
    toggleBlock(level)
    setHeadingCycleIndex((prev) => (prev + 1) % headingLevels.length)
  }

  const showToolbar = !isMobile || isFocused

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {showToolbar && (
        <div 
          className={cn(
            "flex items-center gap-0.5 px-1.5 py-1",
            variant === "ghost" ? "bg-transparent border-transparent" : "border-border bg-muted/30",
            isMobile
              ? "fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-[0_-4px_10px_rgba(0,0,0,0.1)]"
              : variant === "ghost" ? "mb-1 flex-wrap" : "rounded-t-md border border-b-0 flex-wrap"
          )}
          onMouseDown={(e) => {
            // Prevent toolbar clicks from stealing focus and triggering blur
            if (isMobile) e.preventDefault()
          }}
        >
          {/* Heading: combined into one cycling button on mobile, three separate on desktop */}
          {isMobile ? (
            <button type="button" onClick={cycleHeading} className={toolbarButton} title={`Heading (${headingLabels[headingCycleIndex]})`} aria-label="Cycle heading">
              <span className="relative">
                <Heading className={iconClass} />
                <span className="absolute -bottom-0.5 -right-1.5 text-[8px] font-bold leading-none">{headingCycleIndex + 1}</span>
              </span>
            </button>
          ) : (
            <>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h1")} className={toolbarButton} title="Heading 1" aria-label="Heading 1">
                <span className="text-xs font-bold">H1</span>
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h2")} className={toolbarButton} title="Heading 2" aria-label="Heading 2">
                <span className="text-xs font-bold">H2</span>
              </button>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleBlock("h3")} className={toolbarButton} title="Heading 3" aria-label="Heading 3">
                <span className="text-xs font-bold">H3</span>
              </button>
            </>
          )}
          <span className="mx-0.5 h-5 w-px bg-border md:mx-1 md:h-4" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleInlineFormat("bold")} className={toolbarButton} title="Bold" aria-label="Bold">
            <Bold className={iconClass} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => toggleInlineFormat("italic")} className={toolbarButton} title="Italic" aria-label="Italic">
            <Italic className={iconClass} />
          </button>
          <span className="mx-0.5 h-5 w-px bg-border md:mx-1 md:h-4" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={toolbarButton} title="Bullet list" aria-label="Bullet list">
            <List className={iconClass} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("indent")} className={toolbarButton} title="Indent" aria-label="Indent">
            <Indent className={iconClass} />
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("outdent")} className={toolbarButton} title="Outdent" aria-label="Outdent">
            <Outdent className={iconClass} />
          </button>
          <span className="mx-0.5 h-5 w-px bg-border md:mx-1 md:h-4" />
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fileInputRef.current?.click()} className={toolbarButton} title="Insert Image" aria-label="Insert Image">
            <ImageIcon className={iconClass} />
          </button>
          {/* Link popover: desktop only */}
          {!isMobile && (
            <Popover
              open={linkOpen}
              onOpenChange={(o) => {
                if (o) prepareLinkPopover()
                setLinkOpen(o)
              }}
            >
              <PopoverTrigger asChild>
                <button type="button" onMouseDown={(e) => e.preventDefault()} className={toolbarButton} title="Insert link" aria-label="Insert link">
                  <LinkIcon className={iconClass} />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 space-y-2">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text</label>
                  <input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Link text" className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">URL</label>
                  <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink() } }} placeholder="https://example.com" autoFocus className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setLinkOpen(false)} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
                  <button type="button" onClick={insertLink} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Insert</button>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={handleCopyMarkdown} className={toolbarButton} title="Copy as Markdown" aria-label="Copy as Markdown">
              <Copy className={iconClass} />
            </button>
            {trailingTool && <div>{trailingTool}</div>}
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        contentEditable
        onFocus={() => {
          if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current)
            blurTimeoutRef.current = null
          }
          isFocusedRef.current = true
          setIsFocused(true)
          if (isMobile) {
            document.documentElement.style.setProperty("--keyboard-toolbar-height", "48px")
          }
        }}
        onBlur={() => {
          isFocusedRef.current = false
          handleInput()
          // Delay hiding toolbar so toolbar button taps don't cause a flash
          blurTimeoutRef.current = setTimeout(() => {
            if (!isFocusedRef.current) {
              setIsFocused(false)
              document.documentElement.style.removeProperty("--keyboard-toolbar-height")
            }
          }, 200)
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
        onDrop={handleDrop}
        data-placeholder={placeholder}
        className={cn(
          "rich-editor prose prose-sm md:prose-base dark:prose-invert max-w-none min-h-0 w-full flex-1 border text-sm md:text-base leading-relaxed text-foreground/90 overflow-y-auto outline-none transition-colors",
          variant === "ghost" ? "border-transparent bg-transparent px-0 py-1.5" : "border-border bg-background p-3",
          (!isMobile && variant !== "ghost") ? "rounded-b-md" : (variant !== "ghost" ? "rounded-md" : ""),
          variant !== "ghost" && "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:outline-none focus:ring-1 focus:ring-ring",
          "[&_h1]:text-lg md:[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:font-sans [&_h1]:border-b [&_h1]:border-border/10 [&_h1]:pb-0.5",
          "[&_h2]:text-base md:[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-sans",
          "[&_h3]:text-sm md:[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-sans [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground",
          "[&_ul]:my-2 [&_ul]:ml-4 [&_ul]:list-disc",
          "[&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal",
          "[&_li]:leading-relaxed [&_li]:text-sm [&_li]:text-foreground/90",
          "[&_strong]:font-bold [&_strong]:text-foreground",
          "[&_em]:italic [&_em]:text-foreground/90",
          "[&_a]:text-primary [&_a]:hover:underline [&_a]:font-semibold",
          "[&_p]:mb-3 [&_p]:text-sm [&_p]:text-foreground/90 [&_p]:leading-relaxed",
          "[&>div]:mb-3 [&>div]:text-sm [&>div]:text-foreground/90 [&>div]:leading-relaxed",
          "[&_.md-task]:relative [&_.md-task]:pl-6 [&_.md-task]:block",
          "[&_.md-task-box]:absolute [&_.md-task-box]:left-0.5 [&_.md-task-box]:top-1 [&_.md-task-box]:h-3.5 [&_.md-task-box]:w-3.5 [&_.md-task-box]:cursor-pointer [&_.md-task-box]:accent-primary",
          "[&_.image-resizer]:outline [&_.image-resizer]:outline-transparent hover:[&_.image-resizer]:outline-border/50",
        )}
      />

      {/* Floating Context Menu */}
      {activeLinkMenu && (
        <>
          <div 
            className="fixed inset-0 z-[99]" 
            onClick={() => { setActiveLinkMenu(null); setEditingLink(null) }} 
          />
          <div
            className="context-menu-popover fixed z-[100] bg-popover text-popover-foreground rounded-md border shadow-md flex flex-col p-1 w-64 animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: Math.min(activeLinkMenu.rect.bottom + 8, typeof window !== 'undefined' ? window.innerHeight - 200 : 0),
              left: Math.max(16, Math.min(activeLinkMenu.rect.left, typeof window !== 'undefined' ? window.innerWidth - 272 : 0)),
            }}
          >
            {editingLink ? (
              <div className="p-2 space-y-3">
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text</label>
                  <input 
                    value={editingLink.text} 
                    onChange={(e) => setEditingLink({ ...editingLink, text: e.target.value })} 
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">URL</label>
                  <input 
                    value={editingLink.url} 
                    onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })} 
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setEditingLink(null)} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
                  <button type="button" onClick={() => {
                    activeLinkMenu.element.textContent = editingLink.text || editingLink.url;
                    activeLinkMenu.element.setAttribute("href", editingLink.url);
                    syncMarkdown();
                    setActiveLinkMenu(null);
                    setEditingLink(null);
                  }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</button>
                </div>
              </div>
            ) : activeLinkMenu.type === "card" ? (
              <>
                <button 
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-3 md:py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => {
                    activeLinkMenu.element.outerHTML = `<a href="${activeLinkMenu.url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">${activeLinkMenu.url}</a>`;
                    syncMarkdown();
                    setActiveLinkMenu(null);
                  }}
                >
                  <span className="flex-1 text-left">Show link only</span>
                </button>
                <button 
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-3 md:py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 text-destructive cursor-pointer"
                  onClick={() => {
                    activeLinkMenu.element.remove();
                    syncMarkdown();
                    setActiveLinkMenu(null);
                  }}
                >
                  <span className="flex-1 text-left">Delete link</span>
                </button>
              </>
            ) : (
              <>
                <button 
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-3 md:py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => {
                    window.open(activeLinkMenu.url, "_blank");
                    setActiveLinkMenu(null);
                  }}
                >
                  <span className="flex-1 text-left">Follow link</span>
                </button>
                <button 
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-3 md:py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => {
                    setEditingLink({ url: activeLinkMenu.url, text: activeLinkMenu.text || "" });
                  }}
                >
                  <span className="flex-1 text-left">Edit link</span>
                </button>
                <button 
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-3 md:py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 text-destructive cursor-pointer"
                  onClick={() => {
                    activeLinkMenu.element.remove();
                    syncMarkdown();
                    setActiveLinkMenu(null);
                  }}
                >
                  <span className="flex-1 text-left">Delete link</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  variant = "default",
}: RichMarkdownEditorProps) {
  const isMobile = useIsMobile()
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <EditorSurface
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        variant={variant}
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
        <DialogContent className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile 
            ? "fixed inset-0 z-50 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-none shadow-none" 
            : "max-h-[85vh] h-[85vh] max-w-3xl sm:rounded-lg"
        )}>
          <DialogTitle className="sr-only">Edit Description</DialogTitle>
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
            <span className="font-semibold">Edit Description</span>
            <button
              onClick={() => setExpanded(false)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-4 md:p-6 pb-20">
            <EditorSurface
              value={value}
              onChange={onChange}
              placeholder={placeholder}
              variant={variant}
              className="h-full rounded-md border border-border bg-background"
              autoFocus
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
