"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Hash,
  Image as ImageIcon,
  ImageOff,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Type,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { uploadImage } from "@/lib/image-upload"
import { preloadImage } from "@/lib/image-cache"
import {
  LIST_FIELD_TYPES,
  getSafeHref,
  sanitizeCustomFieldValue,
} from "@/lib/list-field-utils"
import type { ListField, ListFieldType, ListItem } from "@/lib/types"

export function FieldTypeIcon({
  type,
  className,
}: {
  type: ListFieldType
  className?: string
}) {
  switch (type) {
    case "text":
      return <Type className={className} />
    case "number":
      return <Hash className={className} />
    case "link":
      return <Link2 className={className} />
    case "image":
      return <ImageIcon className={className} />
  }
}

export function ImageThumbnail({
  src,
  alt,
  className,
  onClick,
}: {
  src: string
  alt: string
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  if (hasError || !src) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-muted/60 text-muted-foreground",
          className,
        )}
        title="Image could not be loaded"
      >
        <ImageOff className="h-4 w-4 opacity-60" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      onClick={onClick}
      className={cn("rounded-md border border-border object-cover bg-muted/30", className)}
      loading="lazy"
    />
  )
}

export function ImageLightboxDialog({
  imageUrl,
  title,
  open,
  onOpenChange,
}: {
  imageUrl: string | null
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const safeHref = getSafeHref(imageUrl)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] flex flex-col gap-3 p-4">
        <DialogHeader className="pr-8">
          <DialogTitle className="truncate text-sm font-medium">
            {title || "Image Preview"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-[200px] items-center justify-center overflow-hidden rounded-md bg-muted/20 p-2">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title || "Preview"}
              className="max-h-[75vh] w-auto max-w-full rounded-md object-contain"
            />
          ) : null}
        </div>
        {safeHref && (
          <div className="flex justify-end">
            <a
              href={safeHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ImageFieldInput({
  value,
  onChange,
  onPreview,
  compact = false,
}: {
  value: string | null
  onChange: (value: string | null) => void
  onPreview?: (url: string) => void
  compact?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState("")

  useEffect(() => {
    setUrlInput("")
  }, [value])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      const url = await uploadImage(file)
      preloadImage(url)
      onChange(url)
      toast.success("Image uploaded")
    } catch {
      toast.error("Failed to upload image")
    } finally {
      setUploading(false)
      if (e.target) e.target.value = ""
    }
  }

  const handleApplyUrl = () => {
    const safeUrl = getSafeHref(urlInput)
    if (!safeUrl) {
      toast.error("Please enter a valid http(s) image URL")
      return
    }
    preloadImage(safeUrl)
    onChange(safeUrl)
    setUrlInput("")
  }

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-2.5")}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {value ? (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/20 p-2">
          <ImageThumbnail
            src={value}
            alt="Field preview"
            onClick={onPreview ? () => onPreview(value) : undefined}
            className={cn(
              compact ? "h-12 w-12" : "h-16 w-16",
              "shrink-0",
              onPreview && "cursor-zoom-in",
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{value}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3" />
                )}
                Replace
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50",
            compact ? "px-2.5 py-2" : "px-3 py-2.5",
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-3.5 w-3.5" />
              Upload image
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-1.5">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              e.stopPropagation()
              handleApplyUrl()
            }
          }}
          placeholder="Or paste image URL..."
          className="flex h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={handleApplyUrl}
          disabled={!urlInput.trim()}
          className="h-8 shrink-0 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  )
}

function validateFieldName(
  name: string,
  existingFields: ListField[],
  excludeId?: string,
): string | null {
  const trimmed = name.trim()
  if (!trimmed) return "Field name is required."
  const duplicate = existingFields.some(
    (f) => f.id !== excludeId && f.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (duplicate) return `A field named "${trimmed}" already exists.`
  return null
}

export function AddFieldDialog({
  open,
  onOpenChange,
  existingFields,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingFields: ListField[]
  onAdd: (field: ListField) => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<ListFieldType>("text")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName("")
      setType("text")
      setError(null)
    }
  }, [open])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const validationError = validateFieldName(name, existingFields)
    if (validationError) {
      setError(validationError)
      return
    }
    const maxOrder = existingFields.reduce((max, f) => Math.max(max, f.order), -1)
    const newField: ListField = {
      id: `fld_${uuidv4().slice(0, 8)}`,
      name: name.trim(),
      type,
      order: maxOrder + 1,
    }
    onAdd(newField)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <label htmlFor="add-field-name" className="text-sm font-medium">
              Field name
            </label>
            <input
              id="add-field-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="e.g. Price, Notes, Reference link, Photo..."
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Field type</span>
            <div className="grid grid-cols-2 gap-2">
              {LIST_FIELD_TYPES.map((meta) => {
                const active = type === meta.type
                return (
                  <button
                    key={meta.type}
                    type="button"
                    onClick={() => setType(meta.type)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted/60",
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FieldTypeIcon type={meta.type} className="h-4 w-4" />
                      <span>{meta.label}</span>
                    </div>
                    <span
                      className={cn(
                        "text-xs leading-snug",
                        active ? "text-primary/80" : "text-muted-foreground",
                      )}
                    >
                      {meta.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Add Field
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function FieldsManagerModal({
  open,
  onOpenChange,
  fields,
  items,
  onAddField,
  onRenameField,
  onReorderFields,
  onDeleteField,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: ListField[]
  items: ListItem[]
  onAddField: (field: ListField) => void
  onRenameField: (fieldId: string, name: string) => void
  onReorderFields: (fields: ListField[]) => void
  onDeleteField: (fieldId: string) => void
}) {
  const sortedFields = useMemo(
    () => [...fields].sort((a, b) => a.order - b.order),
    [fields],
  )

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState("")
  const [renameError, setRenameError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<ListFieldType>("text")
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setRenamingId(null)
      setRenameText("")
      setRenameError(null)
      setConfirmDeleteId(null)
      setShowAddForm(fields.length === 0)
      setNewName("")
      setNewType("text")
      setAddError(null)
    }
  }, [open, fields.length])

  const getValueCount = (field: ListField) => {
    let count = 0
    for (const item of items) {
      const val = sanitizeCustomFieldValue(field.type, item.custom_fields?.[field.id])
      if (val !== null) count++
    }
    return count
  }

  const handleMove = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta
    if (targetIdx < 0 || targetIdx >= sortedFields.length) return
    const next = [...sortedFields]
    const [moved] = next.splice(index, 1)
    next.splice(targetIdx, 0, moved)
    onReorderFields(next.map((f, idx) => ({ ...f, order: idx })))
  }

  const commitRename = (fieldId: string) => {
    const err = validateFieldName(renameText, fields, fieldId)
    if (err) {
      setRenameError(err)
      return
    }
    onRenameField(fieldId, renameText.trim())
    setRenamingId(null)
    setRenameText("")
    setRenameError(null)
  }

  const handleInlineAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateFieldName(newName, fields)
    if (err) {
      setAddError(err)
      return
    }
    const maxOrder = fields.reduce((max, f) => Math.max(max, f.order), -1)
    onAddField({
      id: `fld_${uuidv4().slice(0, 8)}`,
      name: newName.trim(),
      type: newType,
      order: maxOrder + 1,
    })
    setNewName("")
    setNewType("text")
    setAddError(null)
    setShowAddForm(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 md:p-5 border-b pb-4">
          <DialogTitle>Custom Fields</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-4 md:p-5 flex flex-col gap-3">
          {sortedFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">
              No custom fields yet. Add fields like text, numbers, links, or images to turn this list into a custom database.
            </p>
          ) : (
            sortedFields.map((field, index) => {
              const count = getValueCount(field)
              const isRenaming = renamingId === field.id
              const isConfirmingDelete = confirmDeleteId === field.id

              return (
                <div
                  key={field.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                      <FieldTypeIcon type={field.type} className="h-4 w-4" />
                    </div>

                    {isRenaming ? (
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            autoFocus
                            value={renameText}
                            onChange={(e) => {
                              setRenameText(e.target.value)
                              if (renameError) setRenameError(null)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                commitRename(field.id)
                              } else if (e.key === "Escape") {
                                e.preventDefault()
                                setRenamingId(null)
                                setRenameError(null)
                              }
                            }}
                            className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          />
                          <button
                            type="button"
                            onClick={() => commitRename(field.id)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                            title="Save name"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(null)
                              setRenameError(null)
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
                            title="Cancel"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {renameError && (
                          <span className="text-xs text-destructive">{renameError}</span>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{field.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">
                            {field.type} · {count} {count === 1 ? "value" : "values"}
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMove(index, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                            title="Move up"
                            aria-label="Move field up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortedFields.length - 1}
                            onClick={() => handleMove(index, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                            title="Move down"
                            aria-label="Move field down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(null)
                              setRenamingId(field.id)
                              setRenameText(field.name)
                              setRenameError(null)
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Rename field"
                            aria-label="Rename field"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingId(null)
                              setConfirmDeleteId(isConfirmingDelete ? null : field.id)
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete field"
                            aria-label="Delete field"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {isConfirmingDelete && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs">
                      <span className="text-destructive font-medium">
                        Remove &ldquo;{field.name}&rdquo;? Clears {count}{" "}
                        {count === 1 ? "item value" : "item values"}.
                      </span>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteField(field.id)
                            setConfirmDeleteId(null)
                          }}
                          className="rounded bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}

          {showAddForm ? (
            <form
              onSubmit={handleInlineAdd}
              className="mt-1 flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New Field
                </span>
                {sortedFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false)
                      setAddError(null)
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <div className="grid gap-1">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value)
                    if (addError) setAddError(null)
                  }}
                  placeholder="Field name (e.g. Notes, Price, URL...)"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {addError && <p className="text-xs text-destructive">{addError}</p>}
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {LIST_FIELD_TYPES.map((meta) => {
                  const active = newType === meta.type
                  return (
                    <button
                      key={meta.type}
                      type="button"
                      onClick={() => setNewType(meta.type)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 rounded-md border py-2 px-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <FieldTypeIcon type={meta.type} className="h-3.5 w-3.5" />
                      <span>{meta.label}</span>
                    </button>
                  )
                })}
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Field
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Field
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
