import { useEffect } from "react"
import type { Project } from "@/lib/types"

const memoryImageCache = new Set<string>()
const preloadedElements: HTMLImageElement[] = []

export const IMAGE_CACHE_NAME = "tasker-images-v1"

/**
 * Preloads an image into browser memory and CacheStorage so it is available locally instantly.
 */
export function preloadImage(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return
  const trimmed = url.trim()
  if (!trimmed || memoryImageCache.has(trimmed)) return

  memoryImageCache.add(trimmed)

  // 1. Preload via HTML Image element to keep decoded bitmap in memory
  try {
    const img = new Image()
    img.decoding = "async"
    img.src = trimmed
    preloadedElements.push(img)
    // Cap memory cache elements to avoid memory leaks
    if (preloadedElements.length > 50) {
      preloadedElements.shift()
    }
  } catch (e) {
    // Ignore Image constructor errors
  }

  // 2. Fetch and store in CacheStorage for persistent offline availability
  if ("caches" in window) {
    window.caches
      .open(IMAGE_CACHE_NAME)
      .then((cache) => {
        return cache.match(trimmed).then((existing) => {
          if (!existing) {
            return fetch(trimmed, { mode: "cors" })
              .then((res) => {
                if (res && (res.ok || res.type === "opaque")) {
                  return cache.put(trimmed, res.clone())
                }
              })
              .catch(() => {
                // Fetch failed (e.g. offline or CORS issue), non-fatal
              })
          }
        })
      })
      .catch(() => {
        // CacheStorage unavailable or quota exceeded
      })
  }
}

/**
 * Preload all background images for a list of projects.
 */
export function preloadProjectImages(projects: Project[]): void {
  if (!projects || !projects.length) return
  for (const project of projects) {
    if (project.background_image) {
      preloadImage(project.background_image)
    }
  }
}

/**
 * React hook to preload all project background images upon loading or updating.
 */
export function usePreloadProjectImages(projects: Project[]): void {
  useEffect(() => {
    preloadProjectImages(projects)
  }, [projects])
}
