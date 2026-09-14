import { ReactNode } from "react";
import { AdminProvider } from "@/components/admin/admin-provider";
import Link from "next/link";
import { LayoutDashboard, Users } from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <div className="flex h-screen bg-zinc-100 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hidden md:flex flex-col">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h1 className="text-xl font-bold tracking-tight">Admin Panel</h1>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <Link 
              href="/panel"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link 
              href="/panel/users"
              className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Users className="h-4 w-4" />
              Users
            </Link>
          </nav>
        </aside>
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AdminProvider>
  );
}
