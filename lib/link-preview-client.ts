"use client"

import { uploadImage } from "@/lib/image-upload"
import { preloadImage } from "@/lib/image-cache"
import { getSafeHref } from "@/lib/list-field-utils"
import type { LinkFieldPreview } from "@/lib/types"

const sessionPreviewCache = new Map<string, LinkFieldPreview>()
const inFlightRequests = new Map<string, Promise<LinkFieldPreview | null>>()

function capText(val: unknown, maxLen: number): string | null {
  if (typeof val !== "string") return null
  const trimmed = val.trim()
  if (!trimmed) return null
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed
}

function resizeImageBlobToJpegFile(
  blob: Blob,
  maxDimension = 640,
  quality = 0.82,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      try {
        let width = img.naturalWidth
        let height = img.naturalHeight
        if (!width || !height) {
          reject(new Error("Image has zero dimensions"))
          return
        }
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height / width) * maxDimension)
            width = maxDimension
          } else {
            width = Math.round((width / height) * maxDimension)
            height = maxDimension
          }
        }
        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (jpegBlob) => {
            if (!jpegBlob) {
              reject(new Error("Failed to encode JPEG blob"))
              return
            }
            resolve(
              new File([jpegBlob], "link-preview.jpg", { type: "image/jpeg" }),
            )
          },
          "image/jpeg",
          quality,
        )
      } catch (err) {
        reject(err)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Failed to decode proxied image"))
    }

    img.src = objectUrl
  })
}

async function performFetchLinkPreview(
  safeUrl: string,
): Promise<LinkFieldPreview | null> {
  try {
    const res = await fetch(`/api/link-preview?url=${encodeURIComponent(safeUrl)}`)
    if (!res.ok) return null
    const data = await res.json()

    let finalImageUrl: string | null = null
    const rawImgUrl = getSafeHref(
      typeof data.imageUrl === "string" ? data.imageUrl : null,
    )

    if (rawImgUrl) {
      try {
        const proxyRes = await fetch(
          `/api/proxy-image?url=${encodeURIComponent(rawImgUrl)}`,
        )
        if (proxyRes.ok) {
          const blob = await proxyRes.blob()
          const file = await resizeImageBlobToJpegFile(blob, 640, 0.82)
          finalImageUrl = await uploadImage(file)
        }
      } catch {
        // Fall back to the direct safe image URL if proxying/resizing/uploading fails
      }

      if (!finalImageUrl) {
        finalImageUrl = rawImgUrl
      }

      if (finalImageUrl) {
        preloadImage(finalImageUrl)
      }
    }

    const preview: LinkFieldPreview = {
      url: safeUrl,
      title: capText(data.title, 160),
      description: capText(data.description, 240),
      domain: capText(data.domain, 120),
      imageUrl: finalImageUrl,
      fetched_at: Date.now(),
    }

    sessionPreviewCache.set(safeUrl, preview)
    return preview
  } catch {
    return null
  }
}

export async function fetchLinkPreviewMetadata(
  rawUrl: string,
): Promise<LinkFieldPreview | null> {
  const safeUrl = getSafeHref(rawUrl)
  if (!safeUrl) return null

  const cached = sessionPreviewCache.get(safeUrl)
  if (cached) return cached

  const existingInFlight = inFlightRequests.get(safeUrl)
  if (existingInFlight) return existingInFlight

  const promise = performFetchLinkPreview(safeUrl).finally(() => {
    inFlightRequests.delete(safeUrl)
  })
  inFlightRequests.set(safeUrl, promise)
  return promise
}
