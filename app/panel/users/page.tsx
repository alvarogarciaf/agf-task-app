"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { formatDateDDMMMYYYY, formatLastSignIn } from "@/lib/admin-date-utils";

export default function UsersListPage() {
  const { fetchApi } = useAdmin();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const loadUsers = () => {
    setLoading(true);
    fetchApi("/api/panel/users")
      .then(res => res.json())
      .then(data => {
        if (data.users) setUsers(data.users);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, [fetchApi]);

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) || 
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Users</h2>
          <p className="text-zinc-500">Manage all registered users</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:bg-zinc-800"
        >
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search by email or name..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border rounded-md dark:bg-zinc-800 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium text-center">Tasks</th>
                <th className="px-4 py-3 font-medium text-center">Notes</th>
                <th className="px-4 py-3 font-medium text-center">Projects</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Last Sign In</th>
                <th className="px-6 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">Loading users...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">No users found</td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.uid} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <div className="font-medium">{u.displayName || 'No name'}</div>
                      <div className="text-zinc-500 text-xs">{u.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      {u.disabled ? (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Disabled</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {u.isPro ? (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">Pro</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 rounded-full">Free</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-zinc-700 dark:text-zinc-300">
                      {u.usage?.taskCount ?? 0}
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-zinc-700 dark:text-zinc-300">
                      {u.usage?.noteCount ?? 0}
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-zinc-700 dark:text-zinc-300">
                      {u.usage?.projectCount ?? 0}
                    </td>
                    <td className="px-4 py-4 text-zinc-500 whitespace-nowrap">
                      {formatDateDDMMMYYYY(u.creationTime)}
                    </td>
                    <td className="px-4 py-4 text-zinc-500 whitespace-nowrap" title={u.lastSignInTime ? formatDateDDMMMYYYY(u.lastSignInTime) : undefined}>
                      {formatLastSignIn(u.lastSignInTime)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <Link 
                        href={`/panel/users/${u.uid}`}
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateUserDialog 
          onClose={() => setShowCreate(false)} 
          onCreated={loadUsers} 
        />
      )}
    </div>
  );
}
