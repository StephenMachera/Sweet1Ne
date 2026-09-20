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
  ChefHat,
  CalendarDays,
  Martini,
  UtensilsCrossed,
  CalendarCheck,
  Mail,
  Images,
  QrCode,
  Inbox,
  UserSearch,
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

// Regrouped to the five sections in the spec: Overview · Guest site · Floor ·
// People · System. Four items below (Media, QR Codes, Inbox, Leads) don't
// have a page yet and are gated on the closest existing permission as a
// placeholder — see the note above each. None of that is settled backend
// policy, just enough to keep the sidebar's filtering correct until a real
// permission key exists for them.
export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "access_reports" },
    ],
  },
  {
    heading: "Guest site",
    items: [
      { label: "Menu", href: "/menu/manage", icon: UtensilsCrossed, permission: "view_menu" },
      { label: "Events", href: "/events", icon: CalendarDays, permission: "manage_promotions" },
      // Placeholder permission — no "manage_media" key exists yet. Media is
      // shared by menu, events, promotions and marketing, so it doesn't sit
      // cleanly under any one of their permissions.
      { label: "Media", href: "/media", icon: Images, permission: "manage_promotions" },
      { label: "Branches", href: "/branches", icon: Building2, permission: "manage_tenant" },
      { label: "Promotions", href: "/promotions", icon: Tag, permission: "manage_promotions" },
    ],
  },
  {
    heading: "Floor",
    items: [
      { label: "Tables", href: "/tables", icon: Grid3x3, permission: "manage_tables" },
      // Placeholder permission — QR codes attach to tables, so this rides
      // on the same permission until it has its own.
      { label: "QR Codes", href: "/qr", icon: QrCode, permission: "manage_tables" },
      { label: "Orders", href: "/orders", icon: ReceiptText, permission: "view_orders" },
      { label: "Reservations", href: "/reservations", icon: CalendarCheck, permission: "manage_reservations" },
      { label: "Kitchen", href: "/kitchen", icon: ChefHat, permission: "access_kitchen" },
      { label: "Bar", href: "/bar", icon: Martini, permission: "access_bar" },
    ],
  },
  {
    heading: "People",
    items: [
      // Placeholder permission — Inbox and Leads are both new; neither has
      // a permission key of its own yet, so both sit on manage_marketing
      // for now.
      { label: "Inbox", href: "/inbox", icon: Inbox, permission: "manage_marketing" },
      { label: "Leads", href: "/leads", icon: UserSearch, permission: "manage_marketing" },
      { label: "Marketing", href: "/marketing", icon: Mail, permission: "manage_marketing" },
      { label: "Staff", href: "/staff", icon: Users, permission: "manage_staff" },
      { label: "Roles & Permissions", href: "/roles", icon: ShieldCheck, permission: "manage_roles" },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Reports", href: "/reports", icon: ChartColumn, permission: "access_reports" },
      { label: "Settings", href: "/settings", icon: Settings, permission: "manage_tenant" },
    ],
  },
];
