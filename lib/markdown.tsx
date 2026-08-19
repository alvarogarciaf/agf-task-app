import React from "react"
import { cn } from "@/lib/utils"
import { Link as LinkIcon } from "lucide-react"

const TASK_RE = /^[-*]\s+\[([ xX])\]\s?(.*)$/

function isBlockLine(trimmed: string): boolean {
  return (
    trimmed === "" ||
    TASK_RE.test(trimmed) ||
    trimmed === "#" ||
    trimmed === "##" ||
    trimmed === "###" ||
    trimmed.startsWith("# ") ||
    trimmed.startsWith("## ") ||
    trimmed.startsWith("### ") ||
    trimmed.startsWith("- ") ||
    trimmed.startsWith("• ") ||
    trimmed === "---"
  )
}

export function parseImageDimensions(spec: string | undefined): { style: string; width?: string; height?: string; align?: "left" | "center" | "right" } {
  if (!spec) return { style: "" };
  const parts = spec.trim().split("|").map(p => p.trim());
  let dimPart = parts[0] || "";
  let alignPart = parts[1] || "";

  let align: "left" | "center" | "right" | undefined;
  if (alignPart === "left" || alignPart === "center" || alignPart === "right") {
    align = alignPart;
  } else if (dimPart === "left" || dimPart === "center" || dimPart === "right") {
    align = dimPart;
    dimPart = "";
  }

  let style = "";
  let width: string | undefined;
  let height: string | undefined;

  if (dimPart) {
    if (/^\d+%$/.test(dimPart)) {
      width = dimPart;
      style += `width:${dimPart};`;
    } else if (/^\d+(?:px)?$/i.test(dimPart)) {
      const px = parseInt(dimPart);
      width = `${px}px`;
      style += `width:${px}px;`;
    } else {
      const dimMatch = dimPart.match(/^(\d+(?:px|%)?)\s*x\s*(\d+(?:px|%)?)$/i);
      if (dimMatch) {
        width = dimMatch[1].endsWith("%") ? dimMatch[1] : `${parseInt(dimMatch[1])}px`;
        height = dimMatch[2].endsWith("%") ? dimMatch[2] : `${parseInt(dimMatch[2])}px`;
        style += `width:${width};height:${height};`;
      }
    }
  }

  if (align === "center") {
    style += "display:block;margin-left:auto;margin-right:auto;";
  } else if (align === "right") {
    style += "display:block;margin-left:auto;margin-right:0;";
  } else if (align === "left") {
    style += "display:inline-block;margin-right:auto;margin-left:0;";
  }

  return { style, width, height, align };
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

    // Images ![alt|WxH](url) or ![alt](url)
    // We add an onerror handler to display an offline placeholder
    const fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100' style='background:%23f3f4f6;border-radius:6px;'><text x='50%' y='50%' fill='%239ca3af' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-size='12'>Image unavailable offline</text></svg>";
    result = result.replace(/!\[([^|\]]*)(?:\|([^\]]+))?\]\(([^)]+)\)/g, (match, alt, dimSpec, url) => {
      const { style, width, align } = parseImageDimensions(dimSpec);
      const alignAttr = align ? ` data-align="${align}"` : "";
      const widthAttr = width ? ` data-width="${width}"` : "";
      const baseDisplay = align ? "" : "display:inline-block;";
      return `<span class="image-resizer relative max-w-full align-bottom select-none" style="${baseDisplay}${style}"${alignAttr}${widthAttr}><img src="${url}" data-original-src="${url}" alt="${alt}" class="w-full h-auto object-contain rounded-md block pointer-events-auto cursor-pointer" onerror="this.onerror=null; this.src='${fallbackSvg}';" /></span>`;
    });

    // Cards [card:Title|Domain|ImageURL](url)
    result = result.replace(/\[card:([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\(([^)]+)\)/g, (match, title, domain, image, url) => {
      const imgHtml = image 
        ? `<img src="${image}" data-original-src="${image}" class="w-16 h-16 object-cover bg-muted shrink-0 rounded-l-lg" alt="" onerror="this.style.display='none';" />`
        : `<span class="w-16 h-16 bg-muted shrink-0 flex items-center justify-center text-muted-foreground rounded-l-lg"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></span>`;
      return `&#8203;<span class="link-card-wrapper inline-flex align-middle items-center bg-muted/30 border border-border/50 rounded-lg overflow-hidden m-0.5 max-w-[calc(100%-1rem)] relative" contenteditable="false">` +
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="link-card flex items-center gap-3 flex-1 min-w-0 decoration-transparent text-foreground hover:bg-muted/50 transition-colors">` +
          imgHtml +
          `<span class="flex flex-col min-w-0 py-2 pr-3 text-left">` +
            `<span class="text-sm font-semibold truncate leading-tight">${title || url}</span>` +
            `<span class="text-xs text-muted-foreground truncate leading-tight mt-0.5">${domain}</span>` +
          `</span>` +
        `</a>` +
        `<span class="card-menu-btn flex items-center justify-center p-1.5 mr-1 cursor-pointer rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10 shrink-0" role="button" tabindex="0" aria-label="Menu" data-url="${url}">` +
          `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>` +
        `</span>` +
      `</span>&#8203;`;
    });

    // Links [text](url) - Note: simple regex, but since we run this after images, `![alt](url)` could be problematic if we don't differentiate.
    // To prevent matching `![alt](url)` as a link if it wasn't caught (it should be caught above), we use a regex that doesn't start with `!`.
    // Actually, string replace processes sequentially. But if we replace `![]()` with `<img>`, the `<img>` won't match `[]()`.
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

    if (trimmed === "#" || trimmed.startsWith("# ")) {
      flushList();
      html += `<h1 class="text-lg font-bold text-foreground mt-3 mb-1.5 font-sans border-b border-border/10 pb-0.5">${parseInline(trimmed === "#" ? "" : trimmed.substring(2))}</h1>`;
      i++;
    } else if (trimmed === "##" || trimmed.startsWith("## ")) {
      flushList();
      html += `<h2 class="text-base font-semibold text-foreground mt-3 mb-1.5 font-sans">${parseInline(trimmed === "##" ? "" : trimmed.substring(3))}</h2>`;
      i++;
    } else if (trimmed === "###" || trimmed.startsWith("### ")) {
      flushList();
      html += `<h3 class="text-sm font-semibold text-foreground mt-2 mb-1 font-sans uppercase tracking-wider text-muted-foreground">${parseInline(trimmed === "###" ? "" : trimmed.substring(4))}</h3>`;
      i++;
    } else if (taskMatch) {
      flushList();
      const checked = taskMatch[1].toLowerCase() === "x";
      html += `<p class="md-task text-sm"><input type="checkbox" class="md-task-box" contenteditable="false"${checked ? " checked" : ""}>${parseInline(taskMatch[2])}</p>`;
      i++;
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      if (!inList) {
        html += '<ul class="list-disc pl-5 mb-3 space-y-1 text-foreground/90 font-sans text-sm">';
        inList = true;
      }
      html += `<li class="leading-relaxed text-sm">${parseInline(trimmed.substring(2))}</li>`;
      i++;
    } else if (trimmed === "---") {
      flushList();
      html += `<hr class="my-4 border-t border-border" />`;
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
      html += `<p class="leading-relaxed text-sm text-foreground/90 mb-3 font-sans">${parts.join("<br>")}</p>`;
    }
  }

  flushList();
  return html;
}

/** Strip markdown syntax for one-line previews (search, snippets). */
export function markdownToPlainText(md: string): string {
  if (!md) return ""

  const stripInline = (text: string) =>
    text
      .replace(/!\[([^|\]]*)(?:\|(\d+)(?:x(\d+))?)?\]\([^)]+\)/g, " [Image] ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/`([^`]+)`/g, "$1")

  const lines = md.split("\n").map((raw) => {
    let line = raw.trim()
    if (!line) return ""

    line = line.replace(/^#{1,3}\s+/, "")
    line = line.replace(/^[-*•]\s+/, "")
    if (line === "---") line = "—"

    return stripInline(line)
  })

  return lines.filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
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
    return (node.nodeValue || "").replace(/\u200b/g, "");
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
        return `# ${childContent.replace(/\u00A0/g, " ").trim()}\n`;
      case "h2":
        return `## ${childContent.replace(/\u00A0/g, " ").trim()}\n`;
      case "h3":
        return `### ${childContent.replace(/\u00A0/g, " ").trim()}\n`;
      case "li":
        return `* ${childContent}\n`;
      case "ul":
        return `${childContent}`; // `li` will prepend the "* " themselves
      case "p":
      case "div": {
        // Handle link-card-wrapper div (now legacy, moved to span, but kept for old data just in case)
        if (el.classList.contains("link-card-wrapper")) {
          const linkEl = el.querySelector("a.link-card");
          if (linkEl) {
            const href = linkEl.getAttribute("href") || "";
            const img = linkEl.querySelector("img");
            const imgUrl = img ? (img.getAttribute("data-original-src") || img.getAttribute("src") || "") : "";
            const titleEl = linkEl.querySelector(".font-semibold");
            const title = titleEl ? (titleEl.textContent || "") : "";
            const domainEl = linkEl.querySelector(".text-muted-foreground:not(.flex):not(.card-menu-btn)");
            const domain = domainEl ? (domainEl.textContent || "") : "";
            return `[card:${title}|${domain}|${imgUrl}](${href})`;
          }
        }
        const box = el.querySelector("input.md-task-box") as HTMLInputElement | null;
        if (box) {
          const checked = box.hasAttribute("checked") || box.checked;
          return `- [${checked ? "x" : " "}] ${childContent.trim()}\n`;
        }
        if (el.innerHTML === "<br>" || el.innerHTML === "" || childContent.trim() === "") {
          return "\n";
        }
        let finalContent = childContent.replace(/(?:  \n)+$/, "");
        return `${finalContent}\n`;
      }
      case "br":
        return "  \n";
      case "hr":
        return "---\n\n";
      case "input":
        return "";
      case "strong":
      case "b":
        return `**${childContent}**`;
      case "em":
      case "i":
        return `*${childContent}*`;
      case "a": {
        if (el.classList.contains("link-card")) {
          const href = el.getAttribute("href") || "";
          const img = el.querySelector("img");
          const imgUrl = img ? (img.getAttribute("data-original-src") || img.getAttribute("src") || "") : "";
          const titleEl = el.querySelector(".font-semibold");
          const title = titleEl ? (titleEl.textContent || "") : "";
          const domainEl = el.querySelector(".text-muted-foreground:not(div)");
          const domain = domainEl ? (domainEl.textContent || "") : "";
          return `[card:${title}|${domain}|${imgUrl}](${href})`;
        }
        const href = el.getAttribute("href") || "";
        return `[${childContent}](${href})`;
      }
      case "img": {
        const src = el.getAttribute("src") || "";
        const originalSrc = el.getAttribute("data-original-src") || src;
        const alt = el.getAttribute("alt") || "";
        return `![${alt}](${originalSrc})`;
      }
      case "span":
        if (el.classList.contains("dismiss-card")) {
          return ""; // dismiss button is UI-only, don't serialize
        }
        if (el.classList.contains("link-card-wrapper")) {
          const linkEl = el.querySelector("a.link-card");
          if (linkEl) {
            const href = linkEl.getAttribute("href") || "";
            const img = linkEl.querySelector("img");
            const imgUrl = img ? (img.getAttribute("data-original-src") || img.getAttribute("src") || "") : "";
            const titleEl = linkEl.querySelector(".font-semibold");
            const title = titleEl ? (titleEl.textContent || "") : "";
            const domainEl = linkEl.querySelector(".text-muted-foreground:not(.flex):not(.card-menu-btn)");
            const domain = domainEl ? (domainEl.textContent || "") : "";
            return `[card:${title}|${domain}|${imgUrl}](${href})`;
          }
        }
        if (el.classList.contains("image-resizer")) {
          const img = el.querySelector("img");
          if (img) {
            const originalSrc = img.getAttribute("data-original-src") || img.getAttribute("src") || "";
            const alt = img.getAttribute("alt") || "";
            
            const wStyle = el.style.width || img.style.width || el.getAttribute("data-width") || "";
            const hStyle = el.style.height || img.style.height || "";
            const alignAttr = el.getAttribute("data-align") || "";
            
            let dimStr = "";
            if (wStyle.endsWith("%")) {
              dimStr = `|${wStyle}`;
            } else if (wStyle) {
              const wNum = parseInt(wStyle);
              const hNum = hStyle && !hStyle.endsWith("%") ? parseInt(hStyle) : null;
              if (wNum && hNum) {
                dimStr = `|${wNum}x${hNum}`;
              } else if (wNum) {
                dimStr = `|${wNum}`;
              }
            }

            if (alignAttr && alignAttr !== "left") {
              if (dimStr) dimStr += `|${alignAttr}`;
              else dimStr = `|${alignAttr}`;
            }

            return `![${alt}${dimStr}](${originalSrc})`;
          }
        }
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

  const fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100%' height='100' style='background:%23f3f4f6;border-radius:6px;'><text x='50%' y='50%' fill='%239ca3af' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-size='12'>Image unavailable offline</text></svg>";
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
    let segments: { type: "text" | "bold" | "italic" | "link" | "image"; content: string; url?: string; dimSpec?: string }[] = [
      { type: "text", content: line }
    ];

    // 0. Parse Images: ![alt|dimensions](url) or ![alt](url)
    segments = segments.flatMap(seg => {
      if (seg.type !== "text") return [seg];
      const parts: typeof segments = [];
      const remaining = seg.content;
      const imgRegex = /!\[([^|\]]*)(?:\|([^\]]+))?\]\(([^)]+)\)/g;
      let match;
      let lastIndex = 0;

      while ((match = imgRegex.exec(remaining)) !== null) {
        const textBefore = remaining.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push({ type: "text", content: textBefore });
        }
        parts.push({ type: "image", content: match[1], url: match[3], dimSpec: match[2] });
        lastIndex = imgRegex.lastIndex;
      }
      const textAfter = remaining.substring(lastIndex);
      if (textAfter) {
        parts.push({ type: "text", content: textAfter });
      }
      return parts;
    });

    // 1. Parse Cards: [card:Title|Domain|ImageURL](URL)
    segments = segments.flatMap(seg => {
      if (seg.type !== "text") return [seg];
      const parts: any[] = [];
      const remaining = seg.content;
      const cardRegex = /\[card:([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\(([^)]+)\)/g;
      let match;
      let lastIndex = 0;

      while ((match = cardRegex.exec(remaining)) !== null) {
        const textBefore = remaining.substring(lastIndex, match.index);
        if (textBefore) {
          parts.push({ type: "text", content: textBefore });
        }
        parts.push({ type: "card", title: match[1], domain: match[2], image: match[3], url: match[4] });
        lastIndex = cardRegex.lastIndex;
      }
      const textAfter = remaining.substring(lastIndex);
      if (textAfter) {
        parts.push({ type: "text", content: textAfter });
      }
      return parts;
    });

    // 2. Parse Links: [text](url)
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

    return segments.map((seg: any, idx) => {
      if (seg.type === "bold") {
        return <strong key={idx} className="font-bold text-foreground">{seg.content}</strong>;
      }
      if (seg.type === "card") {
        return (
          <div
            key={idx}
            className="flex items-center bg-muted/30 border border-border/50 rounded-lg overflow-hidden my-2 max-w-sm relative select-none"
          >
            <a
              href={seg.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-card flex items-center gap-3 flex-1 min-w-0 decoration-transparent text-foreground hover:bg-muted/50 transition-colors"
            >
              {seg.image ? (
                <img
                  src={seg.image}
                  className="w-16 h-16 object-cover bg-muted shrink-0 rounded-l-lg"
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-16 h-16 bg-muted shrink-0 flex items-center justify-center text-muted-foreground rounded-l-lg">
                  <LinkIcon className="w-6 h-6" />
                </div>
              )}
              <div className="flex flex-col min-w-0 py-2 pr-3 text-left">
                <span className="text-sm font-semibold truncate leading-tight">{seg.title || seg.url}</span>
                <span className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{seg.domain}</span>
              </div>
            </a>
          </div>
        );
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
      if (seg.type === "image") {
        const { style } = parseImageDimensions(seg.dimSpec);
        const styleObj = style ? Object.fromEntries(style.split(';').filter(Boolean).map(s => {
          const [k, v] = s.split(':');
          return [k.trim(), v.trim()];
        })) : undefined;

        return (
          <span
            key={idx}
            className="inline-block max-w-full my-2 align-bottom"
            style={styleObj}
          >
            <img
              src={seg.url}
              alt={seg.content}
              className="w-full h-auto rounded-md object-contain"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = fallbackSvg;
              }}
            />
          </span>
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
