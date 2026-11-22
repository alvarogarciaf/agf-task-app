"use client"

import { useCallback, useRef, useState } from "react"
import {
  ExternalLink,
  Globe,
  Link2,
  Lock,
  MoreVertical,
  Share2,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import {
  buildPublicPageUrl,
  copyTextToClipboard,
  shareTaskLink,
  syncPublicPageSetting,
} from "@/lib/public-pages-client"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"

export function useToggleTaskPublic({
  task,
  onApply,
}: {
  task: Task | null
  onApply: (isPublic: boolean, publicId: string | null) => void
}) {
  const [togglingPublic, setTogglingPublic] = useState(false)
  const inFlightRef = useRef(false)

  const togglePublic = useCallback(
    async (nextPublic: boolean) => {
      if (!task?.id || inFlightRef.current) return
      inFlightRef.current = true
      setTogglingPublic(true)
      try {
        if (nextPublic) {
          const candidateId = task.public_id || crypto.randomUUID()
          try {
            const res = await syncPublicPageSetting(
              task.id,
              true,
              candidateId,
            )
            const finalId = res.publicId || candidateId
            onApply(true, finalId)
            toast.success("Page is now public", {
              action: {
                label: "Copy link",
                onClick: () => {
                  void copyTextToClipboard(buildPublicPageUrl(finalId)).then(
                    (ok) => ok && toast.success("Public link copied"),
                  )
                },
              },
            })
          } catch {
            toast.error(
              "Could not make page public. Check your internet connection.",
            )
          }
        } else {
          onApply(false, task.public_id ?? null)
          try {
            await syncPublicPageSetting(
              task.id,
              false,
              task.public_id ?? null,
            )
            toast.success("Page is now private")
          } catch {
            toast.success("Page set to private (will sync when online)")
          }
        }
      } finally {
        inFlightRef.current = false
        setTogglingPublic(false)
      }
    },
    [task, onApply],
  )

  return { togglingPublic, togglePublic }
}

export function PublicPageBadge({
  publicId,
  onClick,
}: {
  publicId?: string | null
  onClick?: () => void
}) {
  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }
    if (!publicId) return
    void copyTextToClipboard(buildPublicPageUrl(publicId)).then((ok) => {
      if (ok) toast.success("Public link copied to clipboard")
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
      title="Public page — click to copy link"
    >
      <Globe className="h-3 w-3" />
      <span>Public</span>
    </button>
  )
}

export function PageSettingsMenu({
  task,
  onTogglePublic,
  togglingPublic,
  isMobile,
  triggerClassName,
}: {
  task: Task
  onTogglePublic: (nextPublic: boolean) => Promise<void> | void
  togglingPublic?: boolean
  isMobile?: boolean
  triggerClassName?: string
}) {
  const isPublic = !!task.is_public

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            triggerClassName,
          )}
          aria-label="Page settings"
          title="Page settings"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[60] w-64 p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Page settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            if (!togglingPublic) void onTogglePublic(!isPublic)
          }}
          className="flex items-center justify-between gap-3 px-2 py-2"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {isPublic ? (
              <Globe className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium leading-tight text-foreground">
                Public page
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {isPublic
                  ? "Anyone with the link can view"
                  : "Only you & collaborators"}
              </span>
            </div>
          </div>
          <Switch
            checked={isPublic}
            disabled={togglingPublic}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(checked) => void onTogglePublic(checked)}
            aria-label="Make page public"
          />
        </DropdownMenuItem>

        {isPublic && task.public_id && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void shareTaskLink(task, { isMobile })}
            >
              <Link2 className="mr-2 h-4 w-4" />
              <span>Copy public link</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                window.open(
                  buildPublicPageUrl(task.public_id!),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              <span>Open public page</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            void shareTaskLink(task, { isMobile, forceAppLink: true })
          }
        >
          <Share2 className="mr-2 h-4 w-4" />
          <span>Copy in-app link</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
