"use client";

import { useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";

export function CreateUserDialog({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
  const { fetchApi } = useAdmin();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetchApi("/api/panel/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName, temporaryPassword: password }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      
      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4">Create New User</h2>
        
        {success ? (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-4">
            User created successfully! A welcome email with a password reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-md">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Display Name (Optional)</label>
              <input 
                type="text" 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Temporary Password</label>
              <input 
                type="text" 
                required 
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700"
                placeholder="Min 8 characters"
              />
            </div>
            
            <div className="pt-4 flex justify-end gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 border rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create User"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
