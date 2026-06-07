import React from "react"
import { cn } from "@/lib/utils"

const TASK_RE = /^[-*]\s+\[([ xX])\]\s?(.*)$/

function isBlockLine(trimmed: string): boolean {
  return (
    trimmed === "" ||
    TASK_RE.test(trimmed) ||
    trimmed.startsWith("# ") ||
    trimmed.startsWith("## ") ||
    trimmed.startsWith("### ") ||
    trimmed.startsWith("* ") ||
    trimmed.startsWith("- ") ||
    trimmed.startsWith("• ")
  )
}

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

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const taskMatch = trimmed.match(TASK_RE);

    if (trimmed.startsWith("# ")) {
      flushList();
      html += `<h1 class="text-base font-bold text-foreground mt-3 mb-1.5 font-sans border-b border-border/10 pb-0.5">${parseInline(trimmed.substring(2))}</h1>`;
      i++;
    } else if (trimmed.startsWith("## ")) {
      flushList();
      html += `<h2 class="text-sm font-semibold text-foreground mt-3 mb-1.5 font-sans">${parseInline(trimmed.substring(3))}</h2>`;
      i++;
    } else if (trimmed.startsWith("### ")) {
      flushList();
      html += `<h3 class="text-xs font-semibold text-foreground mt-2 mb-1 font-sans uppercase tracking-wider text-muted-foreground">${parseInline(trimmed.substring(4))}</h3>`;
      i++;
    } else if (taskMatch) {
      flushList();
      const checked = taskMatch[1].toLowerCase() === "x";
      html += `<p class="md-task"><input type="checkbox" class="md-task-box" contenteditable="false"${checked ? " checked" : ""}>${parseInline(taskMatch[2])}</p>`;
      i++;
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      if (!inList) {
        html += '<ul class="list-disc pl-5 mb-3 space-y-1 text-foreground/90 font-sans text-xs">';
        inList = true;
      }
      html += `<li class="leading-relaxed">${parseInline(trimmed.substring(2))}</li>`;
      i++;
    } else if (trimmed === "") {
      flushList();
      html += "<p><br></p>";
      i++;
    } else {
      // Plain paragraph — group soft-break-joined lines (lines ending with two spaces).
      flushList();
      const parts: string[] = [];
      while (i < lines.length) {
        const r = lines[i];
        if (isBlockLine(r.trim())) break;
        parts.push(parseInline(r.trim()));
        const soft = /  +$/.test(r);
        i++;
        if (!soft) break;
      }
      html += `<p class="leading-relaxed text-xs text-foreground/90 mb-3 font-sans">${parts.join("<br>")}</p>`;
    }
  }

  flushList();
  return html;
}

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
      case "div": {
        const box = el.querySelector("input.md-task-box") as HTMLInputElement | null;
        if (box) {
          const checked = box.hasAttribute("checked") || box.checked;
          return `- [${checked ? "x" : " "}] ${childContent.trim()}\n`;
        }
        if (el.innerHTML === "<br>" || el.innerHTML === "" || childContent.trim() === "") {
          return "\n";
        }
        return `${childContent}\n`;
      }
      case "br":
        return "  \n";
      case "input":
        return "";
      case "strong":
      case "b":
        return `**${childContent}**`;
      case "em":
      case "i":
        return `*${childContent}*`;
      case "a": {
        const href = el.getAttribute("href") || "";
        return `[${childContent}](${href})`;
      }
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

/**
 * Flip the checked state of the Nth task item (0-based) in a markdown string,
 * preserving the line's original indentation and label.
 */
export function toggleMarkdownTask(md: string, taskIndex: number, checked: boolean): string {
  const lines = md.split("\n");
  let count = 0;
  return lines
    .map((line) => {
      const indentMatch = line.match(/^(\s*)([\s\S]*)$/);
      const indent = indentMatch ? indentMatch[1] : "";
      const rest = indentMatch ? indentMatch[2] : line;
      const m = rest.match(TASK_RE);
      if (!m) return line;
      const isTarget = count === taskIndex;
      count++;
      if (!isTarget) return line;
      return `${indent}- [${checked ? "x" : " "}] ${m[2]}`;
    })
    .join("\n");
}

export function renderMarkdown(
  text: string,
  onToggleTask?: (taskIndex: number, checked: boolean) => void
): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let currentList: React.ReactNode[] = [];
  let taskCounter = 0;

  const flushList = (key: string) => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 mb-3 space-y-1 text-foreground/90 font-sans text-xs">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  const parseInline = (line: string): React.ReactNode[] => {
    let segments: { type: "text" | "bold" | "italic" | "link"; content: string; url?: string }[] = [
      { type: "text", content: line }
    ];

    // 1. Parse Links: [text](url)
    segments = segments.flatMap(seg => {
      if (seg.type !== "text") return [seg];
      const parts: typeof segments = [];
      const remaining = seg.content;
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      let lastIndex = 0;

      while ((match = linkRegex.exec(remaining)) !== null) {
        const textBefore = remaining.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push({ type: "text", content: textBefore });
        }
        parts.push({ type: "link", content: match[1], url: match[2] });
        lastIndex = linkRegex.lastIndex;
      }
      const textAfter = remaining.substring(lastIndex);
      if (textAfter) {
        parts.push({ type: "text", content: textAfter });
      }
      return parts;
    });

    // 2. Parse Bold: **text** or __text__
    segments = segments.flatMap(seg => {
      if (seg.type !== "text") return [seg];
      const parts: typeof segments = [];
      const remaining = seg.content;
      const boldRegex = /(\*\*|__)(.*?)\1/g;
      let match;
      let lastIndex = 0;

      while ((match = boldRegex.exec(remaining)) !== null) {
        const textBefore = remaining.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push({ type: "text", content: textBefore });
        }
        parts.push({ type: "bold", content: match[2] });
        lastIndex = boldRegex.lastIndex;
      }
      const textAfter = remaining.substring(lastIndex);
      if (textAfter) {
        parts.push({ type: "text", content: textAfter });
      }
      return parts;
    });

    // 3. Parse Italics: *text* or _text_
    segments = segments.flatMap(seg => {
      if (seg.type !== "text") return [seg];
      const parts: typeof segments = [];
      const remaining = seg.content;
      const italicRegex = /(\*|_)(.*?)\1/g;
      let match;
      let lastIndex = 0;

      while ((match = italicRegex.exec(remaining)) !== null) {
        const textBefore = remaining.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push({ type: "text", content: textBefore });
        }
        parts.push({ type: "italic", content: match[2] });
        lastIndex = italicRegex.lastIndex;
      }
      const textAfter = remaining.substring(lastIndex);
      if (textAfter) {
        parts.push({ type: "text", content: textAfter });
      }
      return parts;
    });

    return segments.map((seg, idx) => {
      if (seg.type === "bold") {
        return <strong key={idx} className="font-bold text-foreground">{seg.content}</strong>;
      }
      if (seg.type === "italic") {
        return <em key={idx} className="italic text-foreground/90">{seg.content}</em>;
      }
      if (seg.type === "link") {
        return (
          <a
            key={idx}
            href={seg.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold"
          >
            {seg.content}
          </a>
        );
      }
      return seg.content;
    });
  };

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();
    const taskMatch = trimmed.match(TASK_RE);

    // Headers
    if (trimmed.startsWith("# ")) {
      flushList(`${i}`);
      elements.push(
        <h1 key={i} className="text-base font-bold text-foreground mt-3 mb-1.5 font-sans border-b border-border/10 pb-0.5">
          {parseInline(trimmed.substring(2))}
        </h1>
      );
      i++;
    } else if (trimmed.startsWith("## ")) {
      flushList(`${i}`);
      elements.push(
        <h2 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1.5 font-sans">
          {parseInline(trimmed.substring(3))}
        </h2>
      );
      i++;
    } else if (trimmed.startsWith("### ")) {
      flushList(`${i}`);
      elements.push(
        <h3 key={i} className="text-xs font-semibold text-foreground mt-2 mb-1 font-sans uppercase tracking-wider text-muted-foreground animate-fade-in">
          {parseInline(trimmed.substring(4))}
        </h3>
      );
      i++;
    }
    // Checkbox task item
    else if (taskMatch) {
      flushList(`${i}`);
      const checked = taskMatch[1].toLowerCase() === "x";
      const content = taskMatch[2];
      const thisTaskIndex = taskCounter++;
      elements.push(
        <div key={i} className="flex items-start gap-2 mb-1">
          <input
            type="checkbox"
            checked={checked}
            onChange={
              onToggleTask
                ? (e) => onToggleTask(thisTaskIndex, e.target.checked)
                : undefined
            }
            readOnly={!onToggleTask}
            className={cn(
              "mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary",
              onToggleTask && "cursor-pointer"
            )}
          />
          <span className={cn("text-xs leading-relaxed text-foreground/90", checked && "text-muted-foreground line-through")}>
            {parseInline(content)}
          </span>
        </div>
      );
      i++;
    }
    // Bullet lists starting with *, -, or •
    else if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      const content = trimmed.substring(2);
      currentList.push(
        <li key={`li-${i}-${content.substring(0, 5)}`} className="leading-relaxed">
          {parseInline(content)}
        </li>
      );
      i++;
    }
    // Empty line
    else if (trimmed === "") {
      flushList(`${i}`);
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
    }
    // Normal paragraph — group soft-break-joined lines
    else {
      flushList(`${i}`);
      const parts: string[] = [];
      const startIdx = i;
      while (i < lines.length) {
        const r = lines[i];
        if (isBlockLine(r.trim())) break;
        parts.push(r.trim());
        const soft = /  +$/.test(r);
        i++;
        if (!soft) break;
      }
      elements.push(
        <p key={startIdx} className="leading-relaxed text-xs text-foreground/90 mb-3 font-sans">
          {parts.map((p, pi) => (
            <React.Fragment key={pi}>
              {pi > 0 && <br />}
              {parseInline(p)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  flushList("end");

  return <div className="space-y-0.5">{elements}</div>;
}
