"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { InlineTaskCard } from "@/components/inline-task-card"
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
  AlignCenter,
  AlignLeft,
  AlignRight,
  Trash2,
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

function hasMeaningfulLineBreak(block: HTMLElement): boolean {
  const brs = Array.from(block.querySelectorAll("br"))
  if (brs.length === 0) return false
  if (brs.length === 1 && block.lastElementChild === brs[0]) {
    let after: Node | null = brs[0].nextSibling
    let hasTextAfter = false
    while (after) {
      if (after.textContent && after.textContent.length > 0) {
        hasTextAfter = true
        break
      }
      after = after.nextSibling
    }
    if (!hasTextAfter) return false
  }
  return true
}

function parseHeadingShortcut(
  lineText: string,
  requireTrailingSpace: boolean,
): { tag: "h1" | "h2" | "h3"; markerLength: number } | null {
  if (requireTrailingSpace) {
    const slashBefore = lineText.match(/^\/(h[123])\s/i)
    if (slashBefore) {
      return {
        tag: slashBefore[1].toLowerCase() as "h1" | "h2" | "h3",
        markerLength: slashBefore[0].length,
      }
    }
    const slashAfter = lineText.match(/^(h[123])\/\s/i)
    if (slashAfter) {
      return {
        tag: slashAfter[1].toLowerCase() as "h1" | "h2" | "h3",
        markerLength: slashAfter[0].length,
      }
    }
    const hashes = lineText.match(/^(#{1,3})\s/)
    if (hashes) {
      return {
        tag: `h${hashes[1].length}` as "h1" | "h2" | "h3",
        markerLength: hashes[0].length,
      }
    }
    return null
  } else {
    const slashBefore = lineText.match(/^\/(h[123])$/i)
    if (slashBefore) {
      return {
        tag: slashBefore[1].toLowerCase() as "h1" | "h2" | "h3",
        markerLength: slashBefore[0].length,
      }
    }
    const slashAfter = lineText.match(/^(h[123])\/$/i)
    if (slashAfter) {
      return {
        tag: slashAfter[1].toLowerCase() as "h1" | "h2" | "h3",
        markerLength: slashAfter[0].length,
      }
    }
    const hashes = lineText.match(/^(#{1,3})$/)
    if (hashes) {
      return {
        tag: `h${hashes[1].length}` as "h1" | "h2" | "h3",
        markerLength: hashes[0].length,
      }
    }
    return null
  }
}

interface SelectionBookmark {
  startPath: number[]
  startOffset: number
  endPath: number[]
  endOffset: number
}

interface EditorHistorySnapshot {
  html: string
  markdown: string
  selection: SelectionBookmark | null
  timestamp: number
  locked: boolean
}

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = []
  let cur: Node | null = target
  while (cur && cur !== root) {
    const parentNode: ParentNode | null = cur.parentNode
    if (!parentNode) return null
    const idx = Array.prototype.indexOf.call(parentNode.childNodes, cur)
    if (idx === -1) return null
    path.unshift(idx)
    cur = parentNode
  }
  return cur === root ? path : null
}

function resolveNodePath(root: Node, path: number[]): Node | null {
  let cur: Node = root
  for (const idx of path) {
    if (!cur.childNodes || idx < 0 || idx >= cur.childNodes.length) {
      return null
    }
    cur = cur.childNodes[idx]
  }
  return cur
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
  const lastEmittedMarkdownRef = useRef<string>(value || "")
  const editorHistoryRef = useRef<EditorHistorySnapshot[]>([])
  const editorHistoryIndexRef = useRef<number>(0)
  const isRestoringHistoryRef = useRef<boolean>(false)
  const lastInputTypeRef = useRef<string>("")
  const lastInputDataRef = useRef<string | null>(null)
  const lastWasDeleteRef = useRef<boolean>(false)

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

  // Floating Image Menu & Resize State
  const [activeImageMenu, setActiveImageMenu] = useState<{
    element: HTMLElement
    img: HTMLImageElement
    url: string
    alt: string
    rect: DOMRect
    currentWidth: string
    align: "left" | "center" | "right" | ""
  } | null>(null)
  const [dragState, setDragState] = useState<{
    startX: number
    startWidth: number
    handle: "right" | "bottom-right" | "bottom-left"
    currentWidth: number
  } | null>(null)

  const [taskEmbeds, setTaskEmbeds] = useState<{ id: string, el: HTMLElement }[]>([])

  const saveSelectionBookmark = useCallback((): SelectionBookmark | null => {
    if (!editorRef.current) return null
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    if (!editorRef.current.contains(range.startContainer)) return null
    const startPath = getNodePath(editorRef.current, range.startContainer)
    const endPath = getNodePath(editorRef.current, range.endContainer)
    if (!startPath || !endPath) return null
    return {
      startPath,
      startOffset: range.startOffset,
      endPath,
      endOffset: range.endOffset,
    }
  }, [])

  const restoreSelectionBookmark = useCallback((bookmark: SelectionBookmark | null) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    if (!bookmark) {
      placeCaretAtEnd(editorRef.current)
      return
    }
    const sel = window.getSelection()
    if (!sel) return
    const startNode = resolveNodePath(editorRef.current, bookmark.startPath)
    const endNode = resolveNodePath(editorRef.current, bookmark.endPath)
    if (!startNode || !endNode) {
      placeCaretAtEnd(editorRef.current)
      return
    }
    try {
      const range = document.createRange()
      const maxStart =
        startNode.nodeType === Node.TEXT_NODE
          ? (startNode.textContent?.length ?? 0)
          : startNode.childNodes.length
      const maxEnd =
        endNode.nodeType === Node.TEXT_NODE
          ? (endNode.textContent?.length ?? 0)
          : endNode.childNodes.length
      range.setStart(startNode, Math.min(bookmark.startOffset, maxStart))
      range.setEnd(endNode, Math.min(bookmark.endOffset, maxEnd))
      sel.removeAllRanges()
      sel.addRange(range)
    } catch {
      placeCaretAtEnd(editorRef.current)
    }
  }, [])

  const updateEmptyState = useCallback(() => {
    const root = editorRef.current
    if (!root) return
    const rawText = (root.textContent || "").replace(/[\u200B\r\n]/g, "")
    const hasNonParagraphElement = !!root.querySelector(
      "h1, h2, h3, ul, ol, hr, img, input.md-task-box, .image-resizer, .link-card-wrapper, .task-embed-wrapper",
    )
    const isEmpty = rawText.length === 0 && !hasNonParagraphElement
    if (isEmpty) {
      root.setAttribute("data-empty", "true")
    } else {
      root.removeAttribute("data-empty")
    }
  }, [])

  const ensureBlockStructure = useCallback(() => {
    const root = editorRef.current
    if (!root) return

    if (root.childNodes.length === 0) {
      const p = document.createElement("p")
      p.appendChild(document.createElement("br"))
      root.appendChild(p)
      if (isFocusedRef.current) {
        placeCaretAtStart(p)
      }
      return
    }

    const hasBareInline = Array.from(root.childNodes).some(
      (n) =>
        (n.nodeType === Node.TEXT_NODE && (n.textContent || "").length > 0) ||
        (n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).tagName === "BR"),
    )
    if (!hasBareInline) return

    const sel = window.getSelection()
    let savedNode: Node | null = null
    let savedOffset = 0
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0)
      savedNode = r.startContainer
      savedOffset = r.startOffset
    }

    const children = Array.from(root.childNodes)
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (!(child.textContent || "")) {
          child.remove()
          continue
        }
        const next = child.nextSibling as HTMLElement | null
        if (
          next &&
          next.nodeType === Node.ELEMENT_NODE &&
          next.tagName === "P" &&
          !next.textContent &&
          next.querySelector("br")
        ) {
          next.innerHTML = ""
          next.appendChild(child)
        } else {
          const p = document.createElement("p")
          child.replaceWith(p)
          p.appendChild(child)
        }
      } else if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName === "BR") {
        const p = document.createElement("p")
        child.replaceWith(p)
        p.appendChild(child)
      }
    }

    if (savedNode && savedNode.nodeType === Node.TEXT_NODE && root.contains(savedNode) && sel) {
      const r = document.createRange()
      r.setStart(savedNode, Math.min(savedOffset, savedNode.textContent?.length ?? 0))
      r.collapse(true)
      sel.removeAllRanges()
      sel.addRange(r)
    }
  }, [])

  const sanitizeEditorDom = useCallback(() => {
    const root = editorRef.current
    if (!root) return

    const sel = window.getSelection()
    let savedStartNode: Node | null = null
    let savedStartOffset = 0
    let savedEndNode: Node | null = null
    let savedEndOffset = 0
    let hadSelectionInside = false

    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0)
      if (root.contains(r.startContainer)) {
        hadSelectionInside = true
        savedStartNode = r.startContainer
        savedStartOffset = r.startOffset
        savedEndNode = r.endContainer
        savedEndOffset = r.endOffset
      }
    }

    let modifiedSelectionContainer = false

    const fonts = Array.from(root.querySelectorAll("font"))
    for (const font of fonts) {
      const parent = font.parentNode
      if (!parent) continue
      if (savedStartNode === font || savedEndNode === font) {
        modifiedSelectionContainer = true
      }
      while (font.firstChild) {
        parent.insertBefore(font.firstChild, font)
      }
      font.remove()
    }

    const styledEls = Array.from(root.querySelectorAll("[style]")) as HTMLElement[]
    for (const el of styledEls) {
      if (
        el.classList.contains("image-resizer") ||
        el.classList.contains("link-card-wrapper") ||
        el.classList.contains("task-embed-wrapper") ||
        el.tagName === "IMG"
      ) {
        continue
      }
      if (el.style.color) el.style.removeProperty("color")
      if (el.style.backgroundColor) el.style.removeProperty("background-color")
      if (el.style.fontSize) el.style.removeProperty("font-size")
      if (el.style.fontFamily) el.style.removeProperty("font-family")
      if (el.style.textTransform) el.style.removeProperty("text-transform")
      if (el.style.letterSpacing) el.style.removeProperty("letter-spacing")
      if (el.getAttribute("style")?.trim() === "") {
        el.removeAttribute("style")
      }
      if (
        el.tagName === "SPAN" &&
        el.attributes.length === 0 &&
        el.parentNode
      ) {
        if (savedStartNode === el || savedEndNode === el) {
          modifiedSelectionContainer = true
        }
        const parent = el.parentNode
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el)
        }
        el.remove()
      }
    }

    if (
      hadSelectionInside &&
      (fonts.length > 0 || modifiedSelectionContainer) &&
      sel &&
      savedStartNode &&
      savedEndNode &&
      root.contains(savedStartNode) &&
      root.contains(savedEndNode)
    ) {
      try {
        const r = document.createRange()
        r.setStart(savedStartNode, savedStartOffset)
        r.setEnd(savedEndNode, savedEndOffset)
        sel.removeAllRanges()
        sel.addRange(r)
      } catch {}
    }
  }, [])

  const lockCurrentHistoryEntry = useCallback(() => {
    const stack = editorHistoryRef.current
    const idx = editorHistoryIndexRef.current
    if (stack[idx]) {
      stack[idx].locked = true
      const sel = saveSelectionBookmark()
      if (sel) stack[idx].selection = sel
    }
  }, [saveSelectionBookmark])

  const recordHistorySnapshot = useCallback(
    (forceNewEntry = false, isWordBoundary = false) => {
      if (isRestoringHistoryRef.current || !editorRef.current) return
      const currentHtml = editorRef.current.innerHTML
      const currentMd = htmlToMarkdown(currentHtml)
      const now = Date.now()
      const selection = saveSelectionBookmark()

      const stack = editorHistoryRef.current
      const idx = editorHistoryIndexRef.current

      if (stack.length === 0) {
        editorHistoryRef.current = [
          {
            html: currentHtml,
            markdown: currentMd,
            selection,
            timestamp: now,
            locked: true,
          },
        ]
        editorHistoryIndexRef.current = 0
        return
      }

      const top = stack[idx]
      if (top && top.html === currentHtml) {
        if (selection) top.selection = selection
        if (forceNewEntry || isWordBoundary) top.locked = true
        return
      }

      const truncated = stack.slice(0, idx + 1)
      const currentTop = truncated[idx]

      const isSmallContinuousEdit =
        !forceNewEntry &&
        currentTop &&
        !currentTop.locked &&
        now - currentTop.timestamp < 500 &&
        Math.abs(currentMd.length - currentTop.markdown.length) <= 4

      if (isSmallContinuousEdit) {
        truncated[idx] = {
          html: currentHtml,
          markdown: currentMd,
          selection,
          timestamp: now,
          locked: isWordBoundary,
        }
        editorHistoryRef.current = truncated
        return
      }

      truncated.push({
        html: currentHtml,
        markdown: currentMd,
        selection,
        timestamp: now,
        locked: forceNewEntry || isWordBoundary,
      })

      if (truncated.length > 150) {
        truncated.shift()
      }
      editorHistoryRef.current = truncated
      editorHistoryIndexRef.current = truncated.length - 1
    },
    [saveSelectionBookmark],
  )

  const commitUndoCheckpoint = useCallback(() => {
    if (isRestoringHistoryRef.current || !editorRef.current) return
    const currentHtml = editorRef.current.innerHTML
    const stack = editorHistoryRef.current
    const idx = editorHistoryIndexRef.current
    const top = stack[idx]
    if (!top || top.html !== currentHtml) {
      recordHistorySnapshot(true)
    } else {
      top.locked = true
      const sel = saveSelectionBookmark()
      if (sel) top.selection = sel
    }
  }, [recordHistorySnapshot, saveSelectionBookmark])

  const editorUndo = useCallback((): boolean => {
    if (!editorRef.current) return false
    const currentHtml = editorRef.current.innerHTML
    const stack = editorHistoryRef.current
    const idx = editorHistoryIndexRef.current
    if (stack[idx] && stack[idx].html !== currentHtml) {
      recordHistorySnapshot(true)
    }

    if (editorHistoryIndexRef.current <= 0) return false

    const newIdx = editorHistoryIndexRef.current - 1
    const target = editorHistoryRef.current[newIdx]
    if (!target) return false

    isRestoringHistoryRef.current = true
    editorHistoryIndexRef.current = newIdx
    editorRef.current.innerHTML = target.html || "<p><br></p>"
    updateEmptyState()
    restoreSelectionBookmark(target.selection)
    lastEmittedMarkdownRef.current = target.markdown
    onChange(target.markdown)
    isRestoringHistoryRef.current = false
    return true
  }, [onChange, recordHistorySnapshot, restoreSelectionBookmark, updateEmptyState])

  const editorRedo = useCallback((): boolean => {
    if (!editorRef.current) return false
    const stack = editorHistoryRef.current
    if (editorHistoryIndexRef.current >= stack.length - 1) return false

    const newIdx = editorHistoryIndexRef.current + 1
    const target = stack[newIdx]
    if (!target) return false

    isRestoringHistoryRef.current = true
    editorHistoryIndexRef.current = newIdx
    editorRef.current.innerHTML = target.html || "<p><br></p>"
    updateEmptyState()
    restoreSelectionBookmark(target.selection)
    lastEmittedMarkdownRef.current = target.markdown
    onChange(target.markdown)
    isRestoringHistoryRef.current = false
    return true
  }, [onChange, restoreSelectionBookmark, updateEmptyState])

  useEffect(() => {
    if (!editorRef.current) return
    
    const updateEmbeds = () => {
      if (!editorRef.current) return
      const embeds = Array.from(editorRef.current.querySelectorAll(".task-embed-wrapper")) as HTMLElement[]
      const current = embeds.map(el => ({
        id: el.getAttribute("data-task-id") || "",
        el
      })).filter(x => x.id)

      setTaskEmbeds(prev => {
        if (prev.length !== current.length) return current
        const isSame = prev.every((p, i) => p.id === current[i].id && p.el === current[i].el)
        return isSame ? prev : current
      })
    }
    
    const observer = new MutationObserver(updateEmbeds)
    observer.observe(editorRef.current, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-task-id"] })
    updateEmbeds()

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!activeImageMenu) return
    const updateRect = () => {
      if (activeImageMenu.element && document.body.contains(activeImageMenu.element)) {
        const rect = activeImageMenu.element.getBoundingClientRect()
        setActiveImageMenu(prev => prev ? { ...prev, rect } : null)
      } else {
        setActiveImageMenu(null)
      }
    }

    window.addEventListener("scroll", updateRect, true)
    window.addEventListener("resize", updateRect)
    return () => {
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("resize", updateRect)
    }
  }, [activeImageMenu])

  const applyImageWidth = (widthStr: string) => {
    if (!activeImageMenu) return
    commitUndoCheckpoint()
    const { element } = activeImageMenu
    if (widthStr === "auto" || widthStr === "") {
      element.style.width = ""
      element.removeAttribute("data-width")
    } else {
      element.style.width = widthStr
      element.setAttribute("data-width", widthStr)
    }
    syncMarkdown()
    recordHistorySnapshot(true)
    const rect = element.getBoundingClientRect()
    setActiveImageMenu(prev => prev ? { ...prev, currentWidth: widthStr, rect } : null)
  }

  const applyImageAlign = (align: "left" | "center" | "right") => {
    if (!activeImageMenu) return
    commitUndoCheckpoint()
    const { element } = activeImageMenu
    element.setAttribute("data-align", align)
    if (align === "center") {
      element.style.display = "block"
      element.style.marginLeft = "auto"
      element.style.marginRight = "auto"
    } else if (align === "right") {
      element.style.display = "block"
      element.style.marginLeft = "auto"
      element.style.marginRight = "0"
    } else {
      element.style.display = "inline-block"
      element.style.marginLeft = "0"
      element.style.marginRight = "auto"
    }
    syncMarkdown()
    recordHistorySnapshot(true)
    const rect = element.getBoundingClientRect()
    setActiveImageMenu(prev => prev ? { ...prev, align, rect } : null)
  }

  const deleteActiveImage = () => {
    if (!activeImageMenu) return
    commitUndoCheckpoint()
    activeImageMenu.element.remove()
    setActiveImageMenu(null)
    setDragState(null)
    ensureBlockStructure()
    updateEmptyState()
    syncMarkdown()
    recordHistorySnapshot(true)
  }

  const handleResizeStart = (e: React.PointerEvent, handle: "right" | "bottom-right" | "bottom-left") => {
    if (!activeImageMenu) return
    e.preventDefault()
    e.stopPropagation()
    commitUndoCheckpoint()

    const startX = e.clientX
    const currentRect = activeImageMenu.element.getBoundingClientRect()
    const startWidth = currentRect.width

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault()
      const deltaX = handle === "bottom-left" ? (startX - ev.clientX) : (ev.clientX - startX)
      const editorWidth = editorRef.current ? editorRef.current.clientWidth - 32 : 600
      const newWidth = Math.max(60, Math.min(editorWidth, startWidth + deltaX))
      
      activeImageMenu.element.style.width = `${Math.round(newWidth)}px`
      activeImageMenu.element.setAttribute("data-width", `${Math.round(newWidth)}px`)
      
      setDragState({
        startX,
        startWidth,
        handle,
        currentWidth: Math.round(newWidth),
      })
    }

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      setDragState(null)

      if (activeImageMenu && activeImageMenu.element && document.body.contains(activeImageMenu.element)) {
        const finalRect = activeImageMenu.element.getBoundingClientRect()
        setActiveImageMenu(prev => prev ? { ...prev, rect: finalRect, currentWidth: activeImageMenu.element.style.width } : null)
        syncMarkdown()
        recordHistorySnapshot(true)
      }
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
  }

  useEffect(() => {
    if (!editorRef.current) return

    const normalizedIncoming = (value || "").trim()
    const normalizedLastEmitted = (lastEmittedMarkdownRef.current || "").trim()

    if (!isFirstRender.current && normalizedIncoming === normalizedLastEmitted) {
      return
    }

    const currentHtml = editorRef.current.innerHTML
    const targetHtml = markdownToHtml(value)

    if (isFirstRender.current || htmlToMarkdown(currentHtml) !== htmlToMarkdown(targetHtml)) {
      const wasFirst = isFirstRender.current
      editorRef.current.innerHTML = targetHtml || "<p><br></p>"
      lastEmittedMarkdownRef.current = value || ""
      isFirstRender.current = false
      updateEmptyState()

      if (wasFirst) {
        editorHistoryRef.current = [
          {
            html: editorRef.current.innerHTML,
            markdown: value || "",
            selection: null,
            timestamp: Date.now(),
            locked: true,
          },
        ]
        editorHistoryIndexRef.current = 0
      } else {
        if (isFocusedRef.current) {
          placeCaretAtEnd(editorRef.current)
        }
        recordHistorySnapshot(true)
      }
    } else {
      lastEmittedMarkdownRef.current = value || ""
      updateEmptyState()
    }
  }, [value, recordHistorySnapshot, updateEmptyState])

  // Handle mobile keyboard dismissal
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined' || !window.visualViewport) return;
    
    let previousHeight = window.visualViewport.height;

    const handleResize = () => {
      const currentHeight = window.visualViewport!.height;
      
      // If the height increased by a large amount (e.g., > 100px), the keyboard likely closed
      if (currentHeight - previousHeight > 100) {
        if (document.activeElement === editorRef.current) {
          editorRef.current?.blur();
        }
      }
      
      previousHeight = currentHeight;
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport!.removeEventListener('resize', handleResize);
  }, [isMobile]);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus()
      const target = editorRef.current.lastElementChild || editorRef.current
      placeCaretAtEnd(target)
    }
  }, [autoFocus])

  const syncMarkdown = () => {
    if (editorRef.current) {
      const md = htmlToMarkdown(editorRef.current.innerHTML)
      lastEmittedMarkdownRef.current = md
      onChange(md)
    }
  }

  const handleInput = () => {
    if (!editorRef.current || isRestoringHistoryRef.current) return

    ensureBlockStructure()
    sanitizeEditorDom()

    // Run fixups before checking isComposing. On Android Gboard, composition 
    // often stays active even after typing a space. We want these shortcut 
    // conversions to happen immediately (which intentionally breaks composition).
    let fixedUp = false
    if (fixupHeadingAfterInput()) fixedUp = true
    else if (fixupCheckboxAfterInput()) fixedUp = true
    else if (fixupHrAfterInput()) fixedUp = true
    else if (fixupListAfterInput()) fixedUp = true
    else if (fixupLinkAfterInput()) fixedUp = true

    updateEmptyState()

    if (fixedUp) {
      syncMarkdown()
      recordHistorySnapshot(true)
      return
    }

    if (isComposingRef.current) return
    syncMarkdown()

    const inputType = lastInputTypeRef.current
    const inputData = lastInputDataRef.current
    const isDelete = inputType.startsWith("delete")
    const switchedDeleteMode = isDelete !== lastWasDeleteRef.current
    lastWasDeleteRef.current = isDelete

    const forceNew =
      switchedDeleteMode ||
      inputType === "insertFromPaste" ||
      inputType === "insertFromDrop" ||
      inputType === "insertReplacementText" ||
      inputType === "insertParagraph" ||
      inputType === "insertLineBreak"

    const isWordBoundary =
      !isDelete && !!inputData && (inputData.endsWith(" ") || inputData.endsWith("\u00A0"))

    recordHistorySnapshot(forceNew, isWordBoundary)
    lastInputTypeRef.current = ""
    lastInputDataRef.current = null
  }

  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus()
    commitUndoCheckpoint()
    document.execCommand(command, false, arg)
    sanitizeEditorDom()
    ensureBlockStructure()
    updateEmptyState()
    syncMarkdown()
    recordHistorySnapshot(true)
  }

  const toggleInlineFormat = (command: "bold" | "italic") => {
    editorRef.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    commitUndoCheckpoint()
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
    sanitizeEditorDom()
    updateEmptyState()
    syncMarkdown()
    recordHistorySnapshot(true)
  }

  const toggleBlock = (tag: "h1" | "h2" | "h3" | "p") => {
    editorRef.current?.focus()
    commitUndoCheckpoint()
    ensureBlockStructure()
    let block = getCurrentBlock()
    if (!block && editorRef.current) {
      const firstBlock = editorRef.current.querySelector("p, div, h1, h2, h3, li") as HTMLElement | null
      if (firstBlock) {
        block = firstBlock
      } else {
        const p = document.createElement("p")
        p.innerHTML = "<br>"
        editorRef.current.appendChild(p)
        block = p
      }
    }
    if (!block) return

    const currentTag = block.tagName.toLowerCase()
    const targetTag = currentTag === tag && tag !== "p" ? "p" : tag

    if (currentTag === "li") {
      document.execCommand("formatBlock", false, targetTag)
      const newBlock = getCurrentBlock()
      if (newBlock && (targetTag === "h1" || targetTag === "h2" || targetTag === "h3")) {
        newBlock.className = HEADING_CLASSES[targetTag]
      }
    } else {
      const newEl = document.createElement(targetTag)
      if (targetTag === "h1" || targetTag === "h2" || targetTag === "h3") {
        newEl.className = HEADING_CLASSES[targetTag]
      } else {
        newEl.className = "leading-relaxed text-sm text-foreground/90 mb-3 font-sans"
      }
      while (block.firstChild) {
        newEl.appendChild(block.firstChild)
      }
      if (!newEl.textContent && !newEl.querySelector("br")) {
        newEl.appendChild(document.createElement("br"))
      }
      block.replaceWith(newEl)
      if (!newEl.textContent) {
        placeCaretAtStart(newEl)
      } else {
        placeCaretAtEnd(newEl)
      }
    }
    sanitizeEditorDom()
    updateEmptyState()
    syncMarkdown()
    recordHistorySnapshot(true)
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
    commitUndoCheckpoint()
    const sel = window.getSelection()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }

    const text = linkText.trim() || url
    const anchor = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">${escapeHtml(text)}</a>`
    document.execCommand("insertHTML", false, anchor)
    handleInput()
    recordHistorySnapshot(true)

    setLinkOpen(false)
    setLinkUrl("")
    setLinkText("")
    savedRange.current = null
  }

  const getCurrentBlock = (): HTMLElement | null => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return null
    let n: Node | null = sel.getRangeAt(0).startContainer
    if (n === editorRef.current) {
      const offset = sel.getRangeAt(0).startOffset
      const child = editorRef.current.childNodes[offset] || editorRef.current.firstElementChild
      if (child && child.nodeType === Node.ELEMENT_NODE && /^(P|DIV|H1|H2|H3|LI)$/.test((child as HTMLElement).tagName)) {
        return child as HTMLElement
      }
    }
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

    // If inside a list item, use formatBlock first to break out of the list cleanly
    if (block.tagName === "LI") {
      if (!block.textContent && !block.querySelector("br")) {
        block.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(block)
      document.execCommand("formatBlock", false, tag)
      sanitizeEditorDom()
      const newBlock = getCurrentBlock()
      if (newBlock) {
        newBlock.className = HEADING_CLASSES[tag]
        if (!newBlock.textContent && !newBlock.querySelector("br")) {
          newBlock.appendChild(document.createElement("br"))
        }
        placeCaretAtEnd(newBlock)
      }
      return
    }

    const heading = document.createElement(tag)
    heading.className = HEADING_CLASSES[tag]
    while (block.firstChild) {
      heading.appendChild(block.firstChild)
    }
    if (!heading.textContent && !heading.querySelector("br")) {
      heading.appendChild(document.createElement("br"))
    }
    block.replaceWith(heading)
    if (!heading.textContent) {
      placeCaretAtStart(heading)
    } else {
      placeCaretAtEnd(heading)
    }
  }

  const applyHeadingShortcut = (
    block: HTMLElement,
    range: Range,
    tag: "h1" | "h2" | "h3",
    markerLength: number,
  ) => {
    lockCurrentHistoryEntry()
    let target = block
    // Isolate the line only if there are actual multi-line breaks or checkboxes
    if (block.querySelector("input.md-task-box") || hasMeaningfulLineBreak(block)) {
      target = isolateLineToParagraph(block, range)
    }
    convertBlockToHeading(target, tag, markerLength)
  }

  const fixupHeadingAfterInput = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx) return false

    const tag = ctx.block.tagName.toLowerCase()
    if (tag === "h1" || tag === "h2" || tag === "h3") return false

    const lineText = (
      getLineTextBeforeCursor(ctx.block, ctx.range) +
      getLineTextAfterCursor(ctx.block, ctx.range)
    ).replace(/\u00A0/g, " ")
    const match = parseHeadingShortcut(lineText, true)
    if (!match) return false

    applyHeadingShortcut(ctx.block, ctx.range, match.tag, match.markerLength)
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

    lockCurrentHistoryEntry()
    let target = ctx.block
    if (hasMeaningfulLineBreak(ctx.block)) {
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
      lockCurrentHistoryEntry()
      const prefixLen = ulMatch[1].length + 1
      let target = ctx.block
      if (hasMeaningfulLineBreak(ctx.block)) {
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
      lockCurrentHistoryEntry()
      const prefixLen = olMatch[1].length + 1
      let target = ctx.block
      if (hasMeaningfulLineBreak(ctx.block)) {
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

  const applyEnterShortcuts = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx) return false

    const { block, range, textBefore } = ctx

    const tokenMatch = textBefore.match(/(\S+)$/)
    const anchor = getEnclosingAnchor(range.startContainer)
    if (tokenMatch && (!anchor || anchor.getAttribute("contenteditable") !== "false")) {
      const token = tokenMatch[1]
      if (URL_TOKEN_RE.test(token)) {
        const tokenStart = textBefore.length - token.length
        const startPos = locateTextPosition(block, tokenStart)
        if (!startPos) return false

        const startAnchor = getEnclosingAnchor(startPos.node)
        if (startAnchor && startAnchor.getAttribute("contenteditable") === "false") {
          return false
        }

        commitUndoCheckpoint()

        const deleteRange = document.createRange()
        if (startAnchor && startAnchor.textContent?.trim() === token) {
          deleteRange.selectNode(startAnchor)
        } else {
          deleteRange.setStart(startPos.node, startPos.offset)
          deleteRange.setEnd(range.startContainer, range.startOffset)
        }
        deleteRange.deleteContents()

        const sel = window.getSelection()
        if (sel) {
          const caret = document.createRange()
          caret.setStart(deleteRange.startContainer, deleteRange.startOffset)
          caret.collapse(true)
          sel.removeAllRanges()
          sel.addRange(caret)
        }
        
        handleUrlPaste(normalizeUrl(token), false)
        return true
      }
    }

    return false
  }

  const fixupHrAfterInput = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx || ctx.block.querySelector("input.md-task-box") || ctx.block.closest("ul, ol")) return false

    const lineText = (
      getLineTextBeforeCursor(ctx.block, ctx.range) +
      getLineTextAfterCursor(ctx.block, ctx.range)
    ).replace(/\u00A0/g, " ")

    const match = lineText.match(/^---\s+(.*)$/)
    if (match) {
      lockCurrentHistoryEntry()
      const prefixLen = 4 // "--- "
      let target = ctx.block
      if (hasMeaningfulLineBreak(ctx.block)) {
        target = isolateLineToParagraph(ctx.block, ctx.range)
      }
      
      const hr = document.createElement("hr")
      hr.className = "my-4 border-t border-border"
      target.parentNode?.insertBefore(hr, target)
      
      removeBlockPrefix(target, prefixLen)
      if (!target.textContent && !target.querySelector("br")) {
        target.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(target)
      return true
    }

    return false
  }

  const fixupLinkAfterInput = (): boolean => {
    const ctx = getCursorTextContext()
    if (!ctx) return false

    const { block, range, textBefore } = ctx
    
    // Check if the last character is a space (can be regular space or non-breaking)
    if (!textBefore.endsWith(" ") && !textBefore.endsWith("\u00A0")) return false

    // Extract the word immediately before the space
    const textWithoutSpace = textBefore.slice(0, -1)
    const tokenMatch = textWithoutSpace.match(/(\S+)$/)
    const anchor = getEnclosingAnchor(range.startContainer)
    if (tokenMatch && (!anchor || anchor.getAttribute("contenteditable") !== "false")) {
      const token = tokenMatch[1]
      if (URL_TOKEN_RE.test(token)) {
        const tokenStart = textWithoutSpace.length - token.length
        const startPos = locateTextPosition(block, tokenStart)
        if (!startPos) return false

        const startAnchor = getEnclosingAnchor(startPos.node)
        if (startAnchor && startAnchor.getAttribute("contenteditable") === "false") {
          return false
        }

        lockCurrentHistoryEntry()

        const deleteRange = document.createRange()
        if (startAnchor && startAnchor.textContent?.trim() === token) {
          deleteRange.selectNode(startAnchor)
        } else {
          deleteRange.setStart(startPos.node, startPos.offset)
          deleteRange.setEnd(range.startContainer, range.startOffset)
        }
        deleteRange.deleteContents()

        const sel = window.getSelection()
        if (sel) {
          const caret = document.createRange()
          caret.setStart(deleteRange.startContainer, deleteRange.startOffset)
          caret.collapse(true)
          sel.removeAllRanges()
          sel.addRange(caret)
        }
        
        handleUrlPaste(normalizeUrl(token), true)
        return true
      }
    }
    return false
  }

  const applySpaceShortcuts = (): boolean => {
    if (isComposingRef.current) return false

    const ctx = getCursorTextContext()
    if (!ctx) return false

    const { block, range, textBefore } = ctx

    const tokenMatch = textBefore.match(/(\S+)$/)
    const anchor = getEnclosingAnchor(range.startContainer)
    if (tokenMatch && (!anchor || anchor.getAttribute("contenteditable") !== "false")) {
      const token = tokenMatch[1]
      if (URL_TOKEN_RE.test(token)) {
        const tokenStart = textBefore.length - token.length
        const startPos = locateTextPosition(block, tokenStart)
        if (!startPos) return false

        const startAnchor = getEnclosingAnchor(startPos.node)
        if (startAnchor && startAnchor.getAttribute("contenteditable") === "false") {
          return false
        }

        commitUndoCheckpoint()

        const deleteRange = document.createRange()
        if (startAnchor && startAnchor.textContent?.trim() === token) {
          deleteRange.selectNode(startAnchor)
        } else {
          deleteRange.setStart(startPos.node, startPos.offset)
          deleteRange.setEnd(range.startContainer, range.startOffset)
        }
        deleteRange.deleteContents()

        const sel = window.getSelection()
        if (sel) {
          const caret = document.createRange()
          caret.setStart(deleteRange.startContainer, deleteRange.startOffset)
          caret.collapse(true)
          sel.removeAllRanges()
          sel.addRange(caret)
        }
        
        handleUrlPaste(normalizeUrl(token), true)
        return true
      }
    }

    const lineBefore = getLineTextBeforeCursor(block, range).replace(/\u00A0/g, " ")
    const lineAfter = getLineTextAfterCursor(block, range)

    const headingShortcut = parseHeadingShortcut(lineBefore, false)
    if (headingShortcut) {
      commitUndoCheckpoint()
      applyHeadingShortcut(block, range, headingShortcut.tag, headingShortcut.markerLength)
      updateEmptyState()
      syncMarkdown()
      recordHistorySnapshot(true)
      return true
    }

    const taskSlash = lineBefore.match(/^(\/task|task\/)$/i)
    if (taskSlash) {
      commitUndoCheckpoint()
      let target = block
      if (block.querySelector("input.md-task-box") || hasMeaningfulLineBreak(block)) {
        target = isolateLineToParagraph(block, range)
      }
      removeBlockPrefix(target, lineBefore.length)
      
      const taskId = crypto.randomUUID()
      const placeholderHtml = `&#8203;<div class="task-embed-wrapper block my-2" data-task-id="${taskId}" contenteditable="false"></div>&#8203;`
      
      placeCaretAtStart(target)
      document.execCommand("insertHTML", false, placeholderHtml)
      
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("inline-task-create", { detail: { id: taskId, title: "New task" } }))
      }
      updateEmptyState()
      syncMarkdown()
      recordHistorySnapshot(true)
      return true
    }

    if (lineBefore === "[]" || lineBefore === "[ ]") {
      commitUndoCheckpoint()
      let target = block
      if (block.querySelector("input.md-task-box") || hasMeaningfulLineBreak(block)) {
        target = isolateLineToParagraph(block, range)
      }
      convertBlockToCheckbox(target, lineBefore.length, lineAfter)
      updateEmptyState()
      syncMarkdown()
      recordHistorySnapshot(true)
      return true
    }

    if (lineBefore === "*" || lineBefore === "-" || lineBefore === "•") {
      commitUndoCheckpoint()
      let target = block
      if (block.querySelector("input.md-task-box") || hasMeaningfulLineBreak(block)) {
        target = isolateLineToParagraph(block, range)
      }
      removeBlockPrefix(target, lineBefore.length)
      if (!target.textContent && !target.querySelector("br")) {
        target.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(target)
      document.execCommand("insertUnorderedList", false)
      updateEmptyState()
      syncMarkdown()
      recordHistorySnapshot(true)
      return true
    }

    if (lineBefore === "---") {
      commitUndoCheckpoint()
      let target = block
      if (block.querySelector("input.md-task-box") || hasMeaningfulLineBreak(block)) {
        target = isolateLineToParagraph(block, range)
      }
      
      const hr = document.createElement("hr")
      hr.className = "my-4 border-t border-border"
      target.parentNode?.insertBefore(hr, target)
      
      removeBlockPrefix(target, lineBefore.length)
      if (!target.textContent && !target.querySelector("br")) {
        target.appendChild(document.createElement("br"))
      }
      placeCaretAtStart(target)
      updateEmptyState()
      syncMarkdown()
      recordHistorySnapshot(true)
      return true
    }

    return false
  }

  const getEnclosingAnchor = (n: Node | null): HTMLAnchorElement | null => {
    let cur: Node | null = n
    while (cur && cur !== editorRef.current) {
      if (cur.nodeType === Node.ELEMENT_NODE && (cur as HTMLElement).tagName === "A") {
        return cur as HTMLAnchorElement
      }
      cur = cur.parentNode
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
    // If the element only has a placeholder <br>, place caret BEFORE the <br>, not after it
    if (
      el.nodeType === Node.ELEMENT_NODE &&
      (el as HTMLElement).childNodes.length === 1 &&
      (el as HTMLElement).firstChild?.nodeName === "BR"
    ) {
      r.setStart(el, 0)
      r.collapse(true)
    } else if (
      el.nodeType === Node.ELEMENT_NODE &&
      (el as HTMLElement).lastChild?.nodeName === "BR" &&
      !(el as HTMLElement).textContent
    ) {
      r.setStart(el, 0)
      r.collapse(true)
    } else {
      r.selectNodeContents(el)
      r.collapse(false)
    }
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
    // Handle Editor-level Undo / Redo before parent window listeners intercept it
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase()
      if (key === "z" && !e.shiftKey) {
        e.preventDefault()
        e.stopPropagation()
        editorUndo()
        return
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault()
        e.stopPropagation()
        editorRedo()
        return
      }
    }

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
            commitUndoCheckpoint()
            checkbox.remove()
            if (block.firstChild && block.firstChild.nodeType === Node.TEXT_NODE) {
              block.firstChild.textContent = block.firstChild.textContent?.replace(/^[\s\u00A0]+/, "") || ""
            }
            block.classList.remove("md-task")
            if (block.className === "") block.removeAttribute("class")
            if (!block.textContent && !block.querySelector("br")) {
              block.appendChild(document.createElement("br"))
            }
            updateEmptyState()
            syncMarkdown()
            recordHistorySnapshot(true)
            return
          }
        }
      }
    }

    if (e.key === "Enter") {
      // Convert any trailing URL before inserting line break
      applyEnterShortcuts()

      // Ctrl/Cmd+Enter -> soft line break within the current paragraph.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        commitUndoCheckpoint()
        document.execCommand("insertLineBreak")
        handleInput()
        return
      }

      const sel = window.getSelection()
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      const block = getCurrentBlock()

      if (block && range) {
        const lineBefore = getLineTextBeforeCursor(block, range).replace(/\u00A0/g, " ")
        const headingShortcut = parseHeadingShortcut(lineBefore, false)
        if (headingShortcut && /^(\/?h[123]\/?)$/i.test(lineBefore.trim())) {
          e.preventDefault()
          commitUndoCheckpoint()
          applyHeadingShortcut(block, range, headingShortcut.tag, headingShortcut.markerLength)
          updateEmptyState()
          syncMarkdown()
          recordHistorySnapshot(true)
          return
        }

        const taskSlash = lineBefore.match(/^(\/task|task\/)$/i)
        if (taskSlash) {
          e.preventDefault()
          commitUndoCheckpoint()
          let target = block
          if (block.querySelector("input.md-task-box") || hasMeaningfulLineBreak(block)) {
            target = isolateLineToParagraph(block, range)
          }
          removeBlockPrefix(target, lineBefore.length)
          
          const taskId = crypto.randomUUID()
          const placeholderHtml = `&#8203;<div class="task-embed-wrapper block my-2" data-task-id="${taskId}" contenteditable="false"></div>&#8203;`
          
          placeCaretAtStart(target)
          document.execCommand("insertHTML", false, placeholderHtml)
          
          // Insert a new empty line after the task
          const p = document.createElement("p")
          p.innerHTML = "<br>"
          if (target.nextSibling) {
            target.parentNode?.insertBefore(p, target.nextSibling)
          } else {
            target.parentNode?.appendChild(p)
          }
          placeCaretAtStart(p)

          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent("inline-task-create", { detail: { id: taskId, title: "New task" } }))
          }
          updateEmptyState()
          syncMarkdown()
          recordHistorySnapshot(true)
          return
        }

        // Explicitly handle Enter inside a heading (H1, H2, H3) to prevent Chromium
        // from injecting <font color="oklch(...)"> tags on the new line!
        if (/^H[1-3]$/.test(block.tagName)) {
          e.preventDefault()
          commitUndoCheckpoint()

          if (!range.collapsed) {
            range.deleteContents()
          }

          const headingText = (block.textContent || "").replace(/\u200B/g, "").trim()
          if (!headingText) {
            // Pressing Enter on an empty heading converts it back to a plain paragraph
            const p = document.createElement("p")
            p.appendChild(document.createElement("br"))
            block.replaceWith(p)
            placeCaretAtStart(p)
          } else {
            // Extract content after cursor into a clean <p> without inline styles or <font> tags
            const afterRange = document.createRange()
            afterRange.setStart(range.endContainer, range.endOffset)
            afterRange.setEnd(block, block.childNodes.length)
            const trailingFrag = afterRange.extractContents()

            if (!(block.textContent || "").trim() && !block.querySelector("br")) {
              block.appendChild(document.createElement("br"))
            }

            const p = document.createElement("p")
            const hasTrailingContent =
              (trailingFrag.textContent || "").length > 0 ||
              Boolean(trailingFrag.querySelector?.("img, a, input, .task-embed-wrapper"))

            if (hasTrailingContent) {
              p.appendChild(trailingFrag)
            } else {
              p.appendChild(document.createElement("br"))
            }

            block.after(p)
            placeCaretAtStart(p)
          }

          sanitizeEditorDom()
          updateEmptyState()
          syncMarkdown()
          recordHistorySnapshot(true)
          return
        }
      }

      // Inside a checkbox line, Enter continues the checklist like bullets do:
      // a fresh checkbox on the next line, or exit to a plain paragraph when empty.
      if (block && block.querySelector("input.md-task-box") && range) {
        if (isCursorAfterLineBreak(block, range)) {
          e.preventDefault()
          commitUndoCheckpoint()
          const paragraph = isolateLineToParagraph(block, range)
          placeCaretAtStart(paragraph)
          updateEmptyState()
          syncMarkdown()
          recordHistorySnapshot(true)
          return
        }

        e.preventDefault()
        commitUndoCheckpoint()
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
        updateEmptyState()
        syncMarkdown()
        recordHistorySnapshot(true)
        return
      }
      // Otherwise let the browser create a new paragraph block, but lock undo state before line break
      commitUndoCheckpoint()
      return
    }

    if (activeImageMenu) {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        deleteActiveImage()
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setActiveImageMenu(null)
        setDragState(null)
        return
      }
    }

    if (e.key === "Tab" && !e.ctrlKey && !e.metaKey) {
      const block = getCurrentBlock()
      if (block && block.tagName.toLowerCase() === "li") {
        e.preventDefault()
        commitUndoCheckpoint()
        if (e.shiftKey) {
          document.execCommand("outdent", false)
        } else {
          document.execCommand("indent", false)
        }
        sanitizeEditorDom()
        updateEmptyState()
        syncMarkdown()
        recordHistorySnapshot(true)
      }
      return
    }

    if (e.key === " " && applySpaceShortcuts()) {
      e.preventDefault()
    }
  }

  const handleBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
    const inputEvent = e.nativeEvent as InputEvent
    lastInputTypeRef.current = inputEvent.inputType || ""
    lastInputDataRef.current = inputEvent.data ?? null
    
    // Support Android keyboard paste suggestions which arrive as insertText / insertFromPaste / insertReplacementText
    if (
      (inputEvent.inputType === "insertText" || 
       inputEvent.inputType === "insertFromPaste" || 
       inputEvent.inputType === "insertReplacementText") && 
      inputEvent.data
    ) {
      if (URL_TOKEN_RE.test(inputEvent.data.trim())) {
        e.preventDefault()
        commitUndoCheckpoint()
        handleUrlPaste(inputEvent.data.trim())
        return
      }
    }

    if (inputEvent.inputType === "insertLineBreak" || inputEvent.inputType === "insertParagraph") {
      commitUndoCheckpoint()
      applyEnterShortcuts()
      return
    }

    if (inputEvent.inputType !== "insertText" || inputEvent.data !== " ") return
    if (applySpaceShortcuts()) {
      e.preventDefault()
    }
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement

    if (target === editorRef.current) {
      ensureBlockStructure()
      const lastChild = editorRef.current.lastElementChild;
      if (lastChild) {
        const rect = lastChild.getBoundingClientRect();
        if (e.clientY > rect.bottom) {
          if (lastChild.tagName === "P" && (lastChild.innerHTML === "<br>" || lastChild.textContent === "")) {
            placeCaretAtStart(lastChild as HTMLElement);
          } else {
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            editorRef.current.appendChild(p);
            placeCaretAtStart(p);
            updateEmptyState();
            syncMarkdown();
          }
          return;
        }
      }
    }

    if (target instanceof HTMLInputElement && target.classList.contains("md-task-box")) {
      commitUndoCheckpoint()
      // The native click already toggled `checked`; mirror it onto the
      // attribute so innerHTML serialization (and the markdown) stays in sync.
      if (target.checked) {
        target.setAttribute("checked", "checked")
      } else {
        target.removeAttribute("checked")
      }
      handleInput()
      recordHistorySnapshot(true)
      return
    }

    const imageResizer = target.closest(".image-resizer") as HTMLElement | null
    if (imageResizer) {
      e.preventDefault()
      e.stopPropagation()
      const img = (target.tagName === "IMG" ? target : imageResizer.querySelector("img")) as HTMLImageElement | null
      if (img) {
        setActiveLinkMenu(null)
        setEditingLink(null)
        const rect = imageResizer.getBoundingClientRect()
        const currentWidth = imageResizer.style.width || imageResizer.getAttribute("data-width") || ""
        const align = (imageResizer.getAttribute("data-align") as any) || ""
        setActiveImageMenu({
          element: imageResizer,
          img,
          url: img.getAttribute("data-original-src") || img.src,
          alt: img.alt || "",
          rect,
          currentWidth,
          align,
        })
        return
      }
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

    if (activeImageMenu && !target.closest(".image-resizer-popover") && !target.closest(".image-resize-handle")) {
      setActiveImageMenu(null)
      setDragState(null)
    }
  }

  const resizeImageToThumbnail = (blob: Blob, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          let w = img.naturalWidth
          let h = img.naturalHeight
          if (w > maxSize || h > maxSize) {
            if (w > h) {
              h = Math.round((h / w) * maxSize)
              w = maxSize
            } else {
              w = Math.round((w / h) * maxSize)
              h = maxSize
            }
          }
          const canvas = document.createElement("canvas")
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext("2d")
          if (!ctx) { reject(new Error("Canvas not supported")); return }
          ctx.drawImage(img, 0, 0, w, h)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7)
          resolve(dataUrl)
        } catch (err) {
          reject(err)
        } finally {
          URL.revokeObjectURL(img.src)
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(img.src)
        reject(new Error("Failed to load image for thumbnail"))
      }
      img.src = URL.createObjectURL(blob)
    })
  }

  const handleUrlPaste = async (url: string, addSpace = false) => {
    commitUndoCheckpoint()
    const id = Math.random().toString(36).substring(2, 9)
    const spaceHtml = addSpace ? "&nbsp;" : ""
    const placeholderHtml = `<a href="${url}" id="preview-${id}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold" contenteditable="false">[Fetching preview for ${url}...]</a>${spaceHtml}`
    document.execCommand("insertHTML", false, placeholderHtml)
    updateEmptyState()
    syncMarkdown()
    recordHistorySnapshot(true)

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
            finalImageUrl = await resizeImageToThumbnail(blob, 128)
          }
        } catch (e) {
          console.error("Failed to generate preview thumbnail, falling back to original", e)
          finalImageUrl = data.imageUrl
        }
      }

      if (editorRef.current) {
        const el = editorRef.current.querySelector(`#preview-${id}`)
        if (el) {
          const title = (data.title || data.domain || url).replace(/\|/g, "-")
          const domain = data.domain || url
          const cardMd = `[card:${title}|${domain}|${finalImageUrl}](${url})`
          const cardHtml = markdownToHtml(cardMd).replace(/^<p[^>]*>/, "").replace(/<\/p>$/, "")
          el.outerHTML = cardHtml
          updateEmptyState()
          syncMarkdown()
          // Replace the top history snapshot if it was the "[Fetching preview...]" placeholder
          const top = editorHistoryRef.current[editorHistoryIndexRef.current]
          if (top && top.html.includes(`id="preview-${id}"`)) {
            top.html = editorRef.current.innerHTML
            top.selection = saveSelectionBookmark()
            top.timestamp = Date.now()
            top.locked = true
          } else {
            recordHistorySnapshot(true)
          }
        }
      }
    } catch (e) {
      console.error(e)
      if (editorRef.current) {
        const el = editorRef.current.querySelector(`#preview-${id}`)
        if (el) {
          el.outerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">${url}</a>`
          updateEmptyState()
          syncMarkdown()
          const top = editorHistoryRef.current[editorHistoryIndexRef.current]
          if (top && top.html.includes(`id="preview-${id}"`)) {
            top.html = editorRef.current.innerHTML
            top.selection = saveSelectionBookmark()
            top.timestamp = Date.now()
            top.locked = true
          } else {
            recordHistorySnapshot(true)
          }
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
    if (!text) return

    commitUndoCheckpoint()

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
    sanitizeEditorDom()
    ensureBlockStructure()
    updateEmptyState()
    syncMarkdown()
    recordHistorySnapshot(true)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
    if (files.length > 0) {
      e.preventDefault()
      handleImageFiles(files)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageFiles = async (files: File[]) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    commitUndoCheckpoint()

    for (const file of files) {
      const placeholderId = Math.random().toString(36).substring(7)
      const placeholderText = `![Uploading_${placeholderId}...]()`
      document.execCommand("insertText", false, placeholderText)
      updateEmptyState()
      syncMarkdown()

      try {
        const url = await uploadImage(file)
        if (editorRef.current) {
          const currentHtml = editorRef.current.innerHTML
          const markdown = htmlToMarkdown(currentHtml)
          const updatedMarkdown = markdown.replace(placeholderText, `![${file.name}](${url})`)
          const newHtml = markdownToHtml(updatedMarkdown)
          editorRef.current.innerHTML = newHtml || "<p><br></p>"
          updateEmptyState()
          syncMarkdown()
          recordHistorySnapshot(true)
        }
      } catch (error: any) {
        toast.error("Failed to upload image")
        if (editorRef.current) {
          const currentHtml = editorRef.current.innerHTML
          const markdown = htmlToMarkdown(currentHtml)
          const updatedMarkdown = markdown.replace(placeholderText, `![Upload_Failed:_${error.message.replace(/\s+/g, "_")}]()`)
          const newHtml = markdownToHtml(updatedMarkdown)
          editorRef.current.innerHTML = newHtml || "<p><br></p>"
          updateEmptyState()
          syncMarkdown()
          recordHistorySnapshot(true)
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

  const headingLevels = ["h1", "h2", "h3", "p"] as const
  const headingLabels = ["H1", "H2", "H3", "T"]

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
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Text</label>
                  <input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Link text" className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">URL</label>
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
          ensureBlockStructure()
          updateEmptyState()
          // If the editor is empty and the selection landed on the root or after <br>, normalize it into the first block before <br>
          const el = editorRef.current
          if (el && el.getAttribute("data-empty") === "true" && el.firstElementChild) {
            const sel = window.getSelection()
            if (sel && sel.rangeCount > 0) {
              const r = sel.getRangeAt(0)
              if (r.startContainer === el || (r.startContainer === el.firstElementChild && r.startOffset > 0)) {
                placeCaretAtStart(el.firstElementChild)
              }
            }
          }
          if (isMobile) {
            document.documentElement.style.setProperty("--keyboard-toolbar-height", "48px")
          }
        }}
        onBlur={() => {
          isFocusedRef.current = false
          updateEmptyState()
          syncMarkdown()
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
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Text</label>
                  <input 
                    value={editingLink.text} 
                    onChange={(e) => setEditingLink({ ...editingLink, text: e.target.value })} 
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">URL</label>
                  <input 
                    value={editingLink.url} 
                    onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })} 
                    className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring" 
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setEditingLink(null)} className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">Cancel</button>
                  <button type="button" onClick={() => {
                    commitUndoCheckpoint();
                    activeLinkMenu.element.textContent = editingLink.text || editingLink.url;
                    activeLinkMenu.element.setAttribute("href", editingLink.url);
                    updateEmptyState();
                    syncMarkdown();
                    recordHistorySnapshot(true);
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
                    commitUndoCheckpoint();
                    activeLinkMenu.element.outerHTML = `<a href="${activeLinkMenu.url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">${activeLinkMenu.url}</a>`;
                    updateEmptyState();
                    syncMarkdown();
                    recordHistorySnapshot(true);
                    setActiveLinkMenu(null);
                  }}
                >
                  <span className="flex-1 text-left">Show link only</span>
                </button>
                <button 
                  type="button"
                  className="flex items-center gap-2 rounded-sm px-2 py-3 md:py-1.5 text-sm outline-none transition-colors hover:bg-destructive/10 text-destructive cursor-pointer"
                  onClick={() => {
                    commitUndoCheckpoint();
                    activeLinkMenu.element.remove();
                    ensureBlockStructure();
                    updateEmptyState();
                    syncMarkdown();
                    recordHistorySnapshot(true);
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
                    commitUndoCheckpoint();
                    activeLinkMenu.element.remove();
                    ensureBlockStructure();
                    updateEmptyState();
                    syncMarkdown();
                    recordHistorySnapshot(true);
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

      {/* Floating Image Resize Handles & Action Bar */}
      {activeImageMenu && (
        <>
          {/* Invisible Backdrop to deselect on outside click */}
          <div 
            className="fixed inset-0 z-[89]" 
            onClick={() => { setActiveImageMenu(null); setDragState(null) }} 
          />
          
          {/* Active Image Bounding Box & Interactive Drag Handles */}
          <div
            className="fixed z-[90] pointer-events-none rounded-md ring-2 ring-primary ring-offset-2 ring-offset-background"
            style={{
              top: activeImageMenu.rect.top,
              left: activeImageMenu.rect.left,
              width: activeImageMenu.rect.width,
              height: activeImageMenu.rect.height,
            }}
          >
            {/* Right Edge Drag Handle */}
            <div
              onPointerDown={(e) => handleResizeStart(e, "right")}
              className="image-resize-handle pointer-events-auto absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-8 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-md cursor-ew-resize flex items-center justify-center transition-transform hover:scale-110 active:scale-125 touch-none z-[92]"
              title="Drag to resize width"
            >
              <div className="w-0.5 h-3 bg-white/80 rounded-full" />
            </div>

            {/* Bottom Right Corner Drag Handle */}
            <div
              onPointerDown={(e) => handleResizeStart(e, "bottom-right")}
              className="image-resize-handle pointer-events-auto absolute -right-2.5 -bottom-2.5 w-5 h-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-md cursor-nwse-resize flex items-center justify-center transition-transform hover:scale-110 active:scale-125 touch-none z-[92]"
              title="Drag to resize"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>

            {/* Bottom Left Corner Drag Handle */}
            <div
              onPointerDown={(e) => handleResizeStart(e, "bottom-left")}
              className="image-resize-handle pointer-events-auto absolute -left-2.5 -bottom-2.5 w-5 h-5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-md cursor-nesw-resize flex items-center justify-center transition-transform hover:scale-110 active:scale-125 touch-none z-[92]"
              title="Drag to resize"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>

            {/* Live Drag Width Tooltip */}
            {dragState && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs font-mono font-medium px-2 py-0.5 rounded shadow whitespace-nowrap z-[93]">
                {dragState.currentWidth}px
              </div>
            )}
          </div>

          {/* Floating Image Control Toolbar */}
          <div
            className="image-resizer-popover fixed z-[95] bg-popover/95 backdrop-blur-sm text-popover-foreground rounded-lg border border-border shadow-xl flex items-center gap-1 p-1 animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: Math.max(12, activeImageMenu.rect.top > 60 ? activeImageMenu.rect.top - 46 : activeImageMenu.rect.bottom + 12),
              left: Math.max(12, Math.min(activeImageMenu.rect.left + (activeImageMenu.rect.width / 2) - 160, typeof window !== 'undefined' ? window.innerWidth - 330 : 0)),
            }}
          >
            {/* Size Presets */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-md">
              {(["25%", "50%", "75%", "100%"] as const).map((preset) => {
                const isSelected = activeImageMenu.currentWidth === preset
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyImageWidth(preset)}
                    className={cn(
                      "px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer",
                      isSelected
                        ? "bg-background text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                    title={`Resize to ${preset}`}
                  >
                    {preset}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => applyImageWidth("auto")}
                className={cn(
                  "px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer",
                  !activeImageMenu.currentWidth || activeImageMenu.currentWidth === "auto"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                title="Reset to original width"
              >
                Auto
              </button>
            </div>

            <div className="h-4 w-px bg-border my-auto mx-0.5" />

            {/* Alignment Controls */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => applyImageAlign("left")}
                className={cn(
                  "p-1.5 rounded transition-colors cursor-pointer",
                  activeImageMenu.align === "left" || !activeImageMenu.align
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Align Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyImageAlign("center")}
                className={cn(
                  "p-1.5 rounded transition-colors cursor-pointer",
                  activeImageMenu.align === "center"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Align Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyImageAlign("right")}
                className={cn(
                  "p-1.5 rounded transition-colors cursor-pointer",
                  activeImageMenu.align === "right"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
                title="Align Right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="h-4 w-px bg-border my-auto mx-0.5" />

            {/* Delete Image */}
            <button
              type="button"
              onClick={deleteActiveImage}
              className="p-1.5 rounded text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              title="Delete image"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
      
      {taskEmbeds.map(embed => createPortal(
        <InlineTaskCard
          key={embed.id}
          taskId={embed.id}
          onClick={(id) => {
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent("open-task", { detail: { taskId: id } }))
            }
          }}
        />,
        embed.el
      ))}
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
