"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Check, Loader2 } from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { functions } from "@/lib/firebase/config"
import { toast } from "sonner"

interface PaywallDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureName?: string
}

export function PaywallDialog({ open, onOpenChange, featureName }: PaywallDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const createCheckoutSession = httpsCallable(functions, "createCheckoutSession")
      const result = await createCheckoutSession()
      const data = result.data as { url: string }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      console.error("Failed to start checkout:", err)
      toast.error(err.message || "Could not connect to billing service.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>
            {featureName ? `Unlock ${featureName} and much more with Tasker Pro.` : "Get the most out of your task manager with a Pro subscription."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mb-6">
            <h4 className="font-semibold text-lg text-primary mb-1">$4.99<span className="text-sm font-normal text-muted-foreground">/month</span></h4>
            <p className="text-sm text-muted-foreground">Cancel anytime.</p>
          </div>

          <ul className="space-y-3 mb-6">
            <li className="flex items-center gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              Unlimited Tasks
            </li>
            <li className="flex items-center gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              Unlimited Projects
            </li>
            <li className="flex items-center gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              Google Calendar Push Sync
            </li>
            <li className="flex items-center gap-3 text-sm">
              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              Collaborative Workspaces
            </li>
          </ul>
          
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Redirecting to Stripe..." : "Upgrade to Pro"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
