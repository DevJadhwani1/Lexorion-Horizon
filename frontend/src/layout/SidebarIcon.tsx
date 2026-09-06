export type IconName = "home" | "admin" | "workforce" | "payroll" | "profile" | "collapse" | "logout" | "menu" | "close" | "expand" | "search" | "building" | "shield" | "package" | "card" | "badge" | "settings" | "panels";

export function Icon({ name }: { name: IconName }) {
  const paths = {
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    admin: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
    workforce: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20a6 6 0 0 1 12 0M14 16a5 5 0 0 1 7 4" /></>,
    payroll: <><circle cx="12" cy="12" r="9" /><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8M12 6v12" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    collapse: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18m7-13-4 4 4 4" /></>,
    expand: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18m4-13 4 4-4 4" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    building: <><rect x="4" y="3" width="12" height="18" rx="2" /><path d="M16 9h4v12H4M8 7h4M8 11h4M8 15h4M9 21v-3h2v3" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    package: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7.5 5.5l9 5" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h4" /></>,
    badge: <><path d="m12 3 3 2 4 1 1 4 1 3-3 3-1 4-5-1-5 1-1-4-3-3 1-3 1-4 4-1 3-2Z" /><path d="m8 12 3 3 5-6" /></>,
    panels: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M9 9v11" /></>,
    settings: <><path d="m9 3-.7 3-2.8 1-2.3 2 1.8 3-1.8 3 2.3 2 2.8 1 .7 3h6l.7-3 2.8-1 2.3-2-1.8-3 1.8-3-2.3-2-2.8-1L15 3H9Z" /><circle cx="12" cy="12" r="3" /></>,
    logout: <><path d="m10 17 5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
