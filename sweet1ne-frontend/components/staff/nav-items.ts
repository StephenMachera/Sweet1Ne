import {
  Building2,
  ChartColumn,
  Grid3x3,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShieldCheck,
  Tag,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string; // relative — combined with basePath ("/admin" or "/{branchSlug}")
  icon: LucideIcon;
  permission: string | null; // null = any logged-in staff
};

export type NavGroup = {
  heading: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Operations",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "access_reports" },
      { label: "Menu", href: "/menu/manage", icon: UtensilsCrossed, permission: "view_menu" },
      { label: "Tables", href: "/tables", icon: Grid3x3, permission: "manage_tables" },
      { label: "Orders", href: "/orders", icon: ReceiptText, permission: "view_orders" },
    ],
  },
  {
    heading: "People",
    items: [
      { label: "Staff", href: "/staff", icon: Users, permission: "manage_staff" },
      { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck, permission: "manage_roles" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "Branches", href: "/branches", icon: Building2, permission: "manage_tenant" },
      { label: "Promotions", href: "/promotions", icon: Tag, permission: "manage_promotions" },
      { label: "Reports", href: "/reports", icon: ChartColumn, permission: "access_reports" },
      { label: "Hotel Settings", href: "/settings", icon: Settings, permission: "manage_tenant" },
    ],
  },
];