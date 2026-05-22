"use client"

import React, { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface RichMarkdownEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}

// 1. Markdown to HTML Converter
export function markdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  let html = "";
  let inList = false;

  const flushList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  const parseInline = (text: string): string => {
    let result = text;
    
    // Links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-semibold">$1</a>');
    
    // Bold: **text** or __text__
    result = result.replace(/(\*\*|__)(.*?)\1/g, "<strong>$2</strong>");
    
    // Italics: *text* or _text_
    result = result.replace(/(\*|_)(.*?)\1/g, "<em>$2</em>");
    
    return result;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("# ")) {
      flushList();
      html += `<h1 class="text-base font-bold text-foreground mt-3 mb-1.5 font-sans border-b border-border/10 pb-0.5">${parseInline(trimmed.substring(2))}</h1>`;
    } else if (trimmed.startsWith("## ")) {
      flushList();
      html += `<h2 class="text-sm font-semibold text-foreground mt-3 mb-1.5 font-sans">${parseInline(trimmed.substring(3))}</h2>`;
    } else if (trimmed.startsWith("### ")) {
      flushList();
      html += `<h3 class="text-xs font-semibold text-foreground mt-2 mb-1 font-sans uppercase tracking-wider text-muted-foreground">${parseInline(trimmed.substring(4))}</h3>`;
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      if (!inList) {
        html += '<ul class="list-disc pl-5 mb-3 space-y-1 text-foreground/90 font-sans text-xs">';
        inList = true;
      }
      html += `<li class="leading-relaxed">${parseInline(trimmed.substring(2))}</li>`;
    } else if (trimmed === "") {
      flushList();
      html += "<p><br></p>";
    } else {
      flushList();
      html += `<p class="leading-relaxed text-xs text-foreground/90 mb-2 font-sans">${parseInline(line)}</p>`;
    }
  });

  flushList();
  return html;
}

// 2. HTML to Markdown Converter
export function htmlToMarkdown(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  let md = nodeToMarkdown(body);
  
  // Clean up excessive newlines
  md = md.replace(/\n{3,}/g, "\n\n");
  
  return md.trim();
}

function nodeToMarkdown(node: Node): string {
  let result = "";
  
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue || "";
  }
  
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    
    let childContent = "";
    el.childNodes.forEach(child => {
      childContent += nodeToMarkdown(child);
    });

    switch (tagName) {
      case "h1":
        return `# ${childContent}\n`;
      case "h2":
        return `## ${childContent}\n`;
      case "h3":
        return `### ${childContent}\n`;
      case "li":
        return `* ${childContent}\n`;
      case "ul":
        return `${childContent}`; // `li` will prepend the "* " themselves
      case "p":
        if (el.innerHTML === "<br>" || el.innerHTML === "" || childContent.trim() === "") {
          return "\n";
        }
        return `${childContent}\n`;
      case "div":
        if (el.innerHTML === "<br>" || el.innerHTML === "" || childContent.trim() === "") {
          return "\n";
        }
        return `${childContent}\n`;
      case "br":
        return "\n";
      case "strong":
      case "b":
        return `**${childContent}**`;
      case "em":
      case "i":
        return `*${childContent}*`;
      case "a":
        const href = el.getAttribute("href") || "";
        return `[${childContent}](${href})`;
      case "span":
        if (el.style.fontWeight === "bold") {
          return `**${childContent}**`;
        }
        if (el.style.fontStyle === "italic") {
          return `*${childContent}*`;
        }
        return childContent;
      default:
        return childContent;
    }
  }
  
  return result;
}

export function RichMarkdownEditor({
  value,
  onChange,
  placeholder,
  className
}: RichMarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)

  // Sync editor content with external value only when task mounts/changes.
  // Using a ref to track if we've initialized for the current session or task.
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (editorRef.current) {
      const currentHtml = editorRef.current.innerHTML;
      const targetHtml = markdownToHtml(value);
      
      // Only set innerHTML if the content is structurally different,
      // or it is the first render, to avoid resetting selection and cursor
      if (isFirstRender.current || htmlToMarkdown(currentHtml) !== htmlToMarkdown(targetHtml)) {
        editorRef.current.innerHTML = targetHtml || "<p><br></p>";
        isFirstRender.current = false;
      }
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Convert to Markdown
      const md = htmlToMarkdown(html);
      onChange(md);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Intercept typing '*' or '-' or '•' at start of line + Space
    if (e.key === " ") {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const node = range.startContainer;

      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || "";
        const offset = range.startOffset;
        const textBeforeCursor = text.substring(0, offset);

        if (textBeforeCursor === "*" || textBeforeCursor === "-" || textBeforeCursor === "•") {
          e.preventDefault();

          // Delete the bullet character
          node.nodeValue = text.substring(offset);

          // Execute native list command
          document.execCommand("insertUnorderedList", false);
        }
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");

    // Detect if pasted text contains markdown indicators
    const hasMarkdown = /^(#+\s+|\*\s+|-\s+|•\s+|\d+\.\s+)/m.test(text) || /(\*\*|__|\*|_|\[.+\]\(.+\))/.test(text);

    let htmlToInsert = "";
    if (hasMarkdown) {
      htmlToInsert = markdownToHtml(text);
    } else {
      // Escape HTML for normal text
      htmlToInsert = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    }

    document.execCommand("insertHTML", false, htmlToInsert);
  };

  return (
    <div
      ref={editorRef}
      contentEditable
      onInput={handleInput}
      onBlur={handleInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className={cn(
        "rich-editor prose prose-sm dark:prose-invert max-w-none mt-1.5 min-h-[140px] w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground/90 overflow-y-auto outline-none transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:outline-none focus:ring-1 focus:ring-ring",
        // Styling children inside contenteditable natively
        "[&_h1]:text-base [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:font-sans [&_h1]:border-b [&_h1]:border-border/10 [&_h1]:pb-0.5",
        "[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:font-sans",
        "[&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:font-sans [&_h3]:uppercase [&_h3]:tracking-wider [&_h3]:text-muted-foreground",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1",
        "[&_li]:leading-relaxed [&_li]:text-xs [&_li]:text-foreground/90",
        "[&_strong]:font-bold [&_strong]:text-foreground",
        "[&_em]:italic [&_em]:text-foreground/90",
        "[&_a]:text-primary [&_a]:hover:underline [&_a]:font-semibold",
        "[&_p]:mb-2 [&_p]:text-xs [&_p]:text-foreground/90 [&_p]:leading-relaxed",
        className
      )}
      style={{ whiteSpace: "pre-wrap" }}
    />
  )
}
