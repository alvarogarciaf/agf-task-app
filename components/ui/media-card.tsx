"use client"

import React, { useEffect, useState } from "react"
import { Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MediaCardProps {
  imageUrl?: string | null
  imageAlt?: string
  onImageClick?: (e: React.MouseEvent) => void
  showCoverWhenEmpty?: boolean
  accentColor?: string | null
  fallbackIcon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  topLeft?: React.ReactNode
  topRight?: React.ReactNode
  title: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  dimmed?: boolean
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
  className?: string
  coverClassName?: string
}

export function MediaCard({
  imageUrl,
  imageAlt,
  onImageClick,
  showCoverWhenEmpty = false,
  accentColor,
  fallbackIcon: FallbackIcon = ImageIcon,
  topLeft,
  topRight,
  title,
  children,
  footer,
  dimmed = false,
  onClick,
  className,
  coverClassName,
}: MediaCardProps) {
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    setImgError(false)
  }, [imageUrl])

  const hasValidImage = !!imageUrl && !imgError
  const showCover = !!imageUrl || showCoverWhenEmpty

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/50 hover:shadow-md",
        onClick && "cursor-pointer",
        dimmed && "opacity-70",
        className,
      )}
    >
      {showCover ? (
        <div
          className={cn(
            "relative w-full overflow-hidden border-b border-border/50 bg-muted/40",
            coverClassName || "aspect-[16/10]",
          )}
          style={
            !hasValidImage && accentColor
              ? { backgroundColor: `color-mix(in oklch, ${accentColor} 14%, transparent)` }
              : undefined
          }
        >
          {hasValidImage ? (
            <img
              src={imageUrl!}
              alt={imageAlt ?? ""}
              loading="eager"
              decoding="async"
              onError={() => setImgError(true)}
              onClick={onImageClick}
              className={cn(
                "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                onImageClick && "cursor-zoom-in",
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FallbackIcon
                className="h-11 w-11 opacity-30"
                style={accentColor ? { color: accentColor } : undefined}
              />
            </div>
          )}

          {topLeft && (
            <div
              className="absolute top-2 left-2 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {topLeft}
            </div>
          )}

          {topRight && (
            <div
              className="absolute top-2 right-2 z-20"
              onClick={(e) => e.stopPropagation()}
            >
              {topRight}
            </div>
          )}
        </div>
      ) : (
        accentColor && (
          <div
            className="h-[3px] w-full shrink-0"
            style={{ backgroundColor: accentColor }}
          />
        )
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3.5 min-w-0">
        {showCover ? (
          title
        ) : (
          <div className="flex items-start justify-between gap-2 min-w-0">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              {topLeft && (
                <div className="shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
                  {topLeft}
                </div>
              )}
              <div className="min-w-0 flex-1">{title}</div>
            </div>
            {topRight && (
              <div className="shrink-0 -mr-1 -mt-0.5" onClick={(e) => e.stopPropagation()}>
                {topRight}
              </div>
            )}
          </div>
        )}

        {children}

        {footer && <div className="mt-auto pt-1">{footer}</div>}
      </div>
    </div>
  )
}
