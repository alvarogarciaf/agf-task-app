"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HardDrive, ShieldAlert, KeyRound, Mail, Calendar, Trash2, Ban, CheckCircle, Star } from "lucide-react";
import { formatDateDDMMMYYYY, formatLastSignIn } from "@/lib/admin-date-utils";

export default function UserDetailPage() {
  const { uid } = useParams();
  const router = useRouter();
  const { fetchApi } = useAdmin();
  const [user, setUser] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!uid) return;
    
    // Load user detail
    fetchApi(`/api/panel/users/${uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load user:", err);
        setLoading(false);
      });
      
    // Load storage separately (might be slow)
    fetchApi(`/api/panel/users/${uid}/storage`)
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setStorage(data);
      })
      .catch((err) => {
        console.warn("Storage fetch skipped or failed:", err);
      });
  }, [uid, fetchApi]);

  const handleAction = async (method: string, endpoint: string, body?: any, successMsg?: string) => {
    if (!confirm("Are you sure?")) return;
    setActionLoading(true);
    try {
      const res = await fetchApi(endpoint, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) throw new Error(await res.text());
      if (successMsg) alert(successMsg);
      if (method === "DELETE") router.push("/panel/users");
      else {
        // reload
        const fresh = await fetchApi(`/api/panel/users/${uid}`).then(r => r.json());
        if (fresh.user) setUser(fresh.user);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendWelcome = async () => {
    setActionLoading(true);
    try {
      // first get a link
      const patchRes = await fetchApi(`/api/panel/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: 'reset_password' })
      });
      const data = await patchRes.json();
      if (!patchRes.ok) throw new Error(data.error);

      // send email
      const emailRes = await fetchApi("/api/panel/send-welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          displayName: user.displayName,
          passwordResetUrl: data.link
        })
      });
      if (!emailRes.ok) throw new Error(await emailRes.text());
      alert("Welcome email resent successfully");
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading user details...</div>;
  if (!user) return <div className="p-8 text-red-500">User not found</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Link href="/panel/users" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-900 mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to users
      </Link>
      
      <div className="flex flex-col md:flex-row gap-6">
        
        {/* Left Column - Profile & Actions */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl font-bold mb-4">
              {user.email[0].toUpperCase()}
            </div>
            <h2 className="text-xl font-bold">{user.displayName || "No name provided"}</h2>
            <p className="text-zinc-500 mb-2">{user.email}</p>
            <div className="flex gap-2">
              {user.isPro ? (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">Pro Plan</span>
              ) : (
                <span className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-semibold">Free Plan</span>
              )}
              {user.disabled ? (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Disabled</span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Active</span>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4 border-b pb-2">Admin Actions</h3>
            <div className="space-y-3">
              <button 
                disabled={actionLoading}
                onClick={() => handleAction("PATCH", `/api/panel/users/${uid}`, { disabled: !user.disabled })}
                className="w-full flex items-center gap-2 p-2 text-sm border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Ban className="w-4 h-4" />
                {user.disabled ? "Enable Account" : "Disable Account"}
              </button>
              <button 
                disabled={actionLoading}
                onClick={() => handleAction("PATCH", `/api/panel/users/${uid}`, { action: "reset_password" }, "Password reset link generated. Check console if you need the raw link.")}
                className="w-full flex items-center gap-2 p-2 text-sm border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <KeyRound className="w-4 h-4" />
                Generate Password Reset
              </button>
              <button 
                disabled={actionLoading}
                onClick={handleResendWelcome}
                className="w-full flex items-center gap-2 p-2 text-sm border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <Mail className="w-4 h-4" />
                Resend Welcome Email
              </button>
              <button 
                disabled={actionLoading}
                onClick={() => handleAction("PATCH", `/api/panel/users/${uid}`, { emailVerified: true })}
                className="w-full flex items-center gap-2 p-2 text-sm border rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <CheckCircle className="w-4 h-4" />
                Force Verify Email
              </button>
              <div className="pt-4 border-t border-red-100 mt-4">
                <button 
                  disabled={actionLoading}
                  onClick={() => handleAction("DELETE", `/api/panel/users/${uid}`)}
                  className="w-full flex items-center gap-2 p-2 text-sm border border-red-200 text-red-600 bg-red-50 rounded-md hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete User & Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Details */}
        <div className="w-full md:w-2/3 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <p className="text-sm text-zinc-500 mb-1">Created</p>
              <p className="font-medium">{formatDateDDMMMYYYY(user.creationTime)}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <p className="text-sm text-zinc-500 mb-1">Last Sign In</p>
              <p className="font-medium" title={user.lastSignInTime ? formatDateDDMMMYYYY(user.lastSignInTime) : undefined}>
                {formatLastSignIn(user.lastSignInTime)}
                {user.lastSignInTime && formatLastSignIn(user.lastSignInTime) !== "Never" && formatLastSignIn(user.lastSignInTime) !== formatDateDDMMMYYYY(user.lastSignInTime) && (
                  <span className="text-xs text-zinc-400 block font-normal mt-0.5">{formatDateDDMMMYYYY(user.lastSignInTime)}</span>
                )}
              </p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <p className="text-sm text-zinc-500 mb-1">Auth Provider</p>
              <p className="font-medium uppercase">{user.authProvider}</p>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
              <p className="text-sm text-zinc-500 mb-1">Legacy Status</p>
              <p className="font-medium">{user.isLegacy ? 'Grandfathered' : 'Standard'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Usage & Metrics
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-400">Total Tasks</span>
                <span className="font-medium">{user.usage.taskCount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-400">Open Tasks</span>
                <span className="font-medium">{user.usage.openTaskCount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-400">Total Notes</span>
                <span className="font-medium">{user.usage.noteCount}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-600 dark:text-zinc-400">Total Projects</span>
                <span className="font-medium">{user.usage.projectCount}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                  <HardDrive className="w-4 h-4" /> Storage Used
                </span>
                <span className="font-medium">
                  {storage ? `${storage.totalMB} MB (${storage.fileCount} files)` : 'Calculating...'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="w-4 h-4" /> Subscription Management
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <button 
                  disabled={actionLoading}
                  onClick={() => handleAction("PATCH", `/api/panel/users/${uid}/subscription`, { plan: 'pro', status: 'active' })}
                  className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-md text-sm font-medium hover:bg-blue-100"
                >
                  Override to Pro
                </button>
                <button 
                  disabled={actionLoading}
                  onClick={() => handleAction("PATCH", `/api/panel/users/${uid}/subscription`, { plan: 'free', status: 'canceled' })}
                  className="px-4 py-2 bg-zinc-50 text-zinc-600 border border-zinc-200 rounded-md text-sm font-medium hover:bg-zinc-100"
                >
                  Override to Free
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                This only overrides local database entitlement. It does not charge or cancel the Stripe customer.
                Current record: Plan <b>{user.subscription.plan}</b> / Status <b>{user.subscription.status}</b>
              </p>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
