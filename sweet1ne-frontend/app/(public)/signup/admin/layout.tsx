import { Sidebar } from "@/components/staff/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-6 py-8 max-md:pt-20 md:px-10">{children}</main>
    </div>
  );
}