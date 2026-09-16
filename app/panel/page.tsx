"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/admin-provider";
import { 
  Users, UserCheck, Star, Clock, 
  Calendar, Mail, MonitorSmartphone, AlertTriangle, RefreshCw
} from "lucide-react";
import { formatDateDDMMMYYYY, formatLastSignIn } from "@/lib/admin-date-utils";

export default function AdminDashboard() {
  const { fetchApi } = useAdmin();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi("/api/panel/stats");
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        setError(text || `Server returned error status ${res.status}`);
        setLoading(false);
        return;
      }

      if (res.ok && data && !data.error) {
        setStats(data);
      } else {
        setError(data?.error || `Server error (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [fetchApi]);

  if (loading) {
    return <div className="p-8">Loading stats...</div>;
  }

  if (!stats) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-lg">Unable to Load Statistics</h3>
        <p className="text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-left font-mono">
          {error || "Unknown server error"}
        </p>
        <button
          onClick={loadStats}
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-800"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-zinc-500">Overview of Tasker AGF</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={<Users className="w-4 h-4" />} />
        <StatCard title="Verified Users" value={stats.verifiedUsers} icon={<UserCheck className="w-4 h-4" />} />
        <StatCard title="Pro Users" value={stats.proUsers} icon={<Star className="w-4 h-4 text-yellow-500" />} />
        <StatCard title="Legacy Users" value={stats.legacyUsers} icon={<Clock className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4" /> Sign-in Methods
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Google Sign-In</span>
              <span className="font-medium">{stats.googleSignInUsers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Email/Password</span>
              <span className="font-medium">{stats.emailSignInUsers}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Feature Adoption
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Google Calendar</span>
              <span className="font-medium">{stats.googleCalendarUsers}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Star className="w-4 h-4" /> Revenue Estimate
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-zinc-500">Pro Subscriptions</span>
              <span className="font-medium">
                ${(stats.proUsers - stats.legacyUsers) * 4.99}/mo
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">Excludes legacy users who are grandfathered into Pro features.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="font-semibold mb-4">Recent Signups (7 days)</h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {stats.recentSignups.map((u: any) => (
                  <tr key={`signup-${u.uid}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.displayName || 'No name'}</div>
                      <div className="text-zinc-500 text-xs">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      {formatDateDDMMMYYYY(u.creationTime)}
                    </td>
                  </tr>
                ))}
                {stats.recentSignups.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-500">No recent signups</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4">Recent Logins (24 hours)</h3>
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {stats.recentLogins.map((u: any) => (
                  <tr key={`login-${u.uid}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.displayName || 'No name'}</div>
                      <div className="text-zinc-500 text-xs">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap" title={u.lastSignInTime ? formatDateDDMMMYYYY(u.lastSignInTime) : undefined}>
                      {formatLastSignIn(u.lastSignInTime)}
                    </td>
                  </tr>
                ))}
                {stats.recentLogins.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-zinc-500">No recent logins</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl flex items-center gap-4">
      <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-300">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  )
}
