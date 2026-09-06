import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./SidebarIcon";
import { appPath } from "../app/hostRouting";

interface SidebarItem { to: string; label: string; icon: IconName }
export interface SidebarGroup { label: string; items: SidebarItem[] }
interface Props {
  platform?: boolean; groups: SidebarGroup[]; collapsed: boolean; drawerOpen: boolean;
  onToggle(): void; onClose(): void; onLogout(): void;
  initials: string; userName: string; accountInfo: string;
}
export function Sidebar({ platform = false, groups, collapsed, drawerOpen, onToggle, onClose, onLogout, initials, userName, accountInfo }: Props) {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);
  const aside = useRef<HTMLElement>(null), search = useRef<HTMLInputElement>(null);
  const items = groups.flatMap((group) => group.items);
  useEffect(() => {
    setAccountOpen(false); setTooltip(null);
  }, [pathname]);
  useEffect(() => { if (searchOpen) search.current?.focus(); }, [searchOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    aside.current?.querySelector<HTMLButtonElement>(".mobile-close")?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const targets = Array.from(aside.current?.querySelectorAll<HTMLElement>('a, button, input') ?? []).filter((node) => node.getClientRects().length && !node.hasAttribute("disabled"));
      const first = targets[0], last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); previous?.focus(); };
  }, [drawerOpen]);
  useEffect(() => { setTooltip(null); }, [collapsed]);
  const row = (item: SidebarItem) => <NavLink key={item.to} to={item.to} end={item.to === appPath("/app") || item.to === appPath("/app/platform")} aria-label={item.label} data-tooltip={item.label} onClick={() => { onClose(); setQuery(""); setSearchOpen(false); }}>
    <span className="nav-icon"><Icon name={item.icon} /></span><span className="nav-label">{item.label}</span>
  </NavLink>;
  return <aside ref={aside} id="application-sidebar" aria-label="Application navigation" onMouseLeave={() => setTooltip(null)}
    onKeyDown={(event) => { if (event.key === "Escape") { setAccountOpen(false); setSearchOpen(false); setQuery(""); } }}
    onMouseOver={(event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-tooltip]");
      if (!collapsed || window.innerWidth <= 800 || !target) { setTooltip(null); return; }
      const rect = target.getBoundingClientRect(); setTooltip({ label: target.dataset.tooltip!, top: rect.top + rect.height / 2, left: 76 });
    }} onFocus={(event) => {
      const target = event.target.closest<HTMLElement>("[data-tooltip]");
      if (collapsed && window.innerWidth > 800 && target) { const rect = target.getBoundingClientRect(); setTooltip({ label: target.dataset.tooltip!, top: rect.top + rect.height / 2, left: 76 }); }
    }} onBlur={() => setTooltip(null)}>
    <div className="sidebar-header">
      <NavLink className="brand brand-desktop" to={appPath(platform ? "/app/platform" : "/app")} aria-label="Horizon home"><img src="/brand-icon.svg" alt="" /><span className="brand-full"><strong>Horizon</strong><small>by Lexorion</small></span></NavLink>
      <NavLink className="brand brand-mobile" to={appPath(platform ? "/app/platform" : "/app")} aria-label="Horizon home"><img src="/brand-icon.svg" alt="" /><span className="brand-full"><strong>Horizon</strong><small>by Lexorion</small></span></NavLink>
      <button className="sidebar-control sidebar-search" aria-label="Search navigation" data-tooltip="Search navigation" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setQuery(""); if (collapsed && window.innerWidth > 800) onToggle(); }}><Icon name="search" /></button>
      <button className="sidebar-control desktop-control" onClick={onToggle} aria-label={collapsed ? "Open sidebar" : "Close sidebar"} data-tooltip={collapsed ? "Open sidebar" : "Close sidebar"} aria-expanded={!collapsed} aria-controls="sidebar-content">
        <span className="toggle-affordance"><span className="toggle-primary"><Icon name={collapsed ? "expand" : "collapse"} /></span><span className="toggle-secondary"><Icon name={collapsed ? "collapse" : "expand"} /></span></span>
      </button>
      <button className="sidebar-control mobile-close" onClick={onClose} aria-label="Close navigation"><Icon name="close" /></button>
    </div>
    {platform && <div className="sidebar-console-label">Platform Console</div>}
    {searchOpen && <div className="sidebar-search-field"><Icon name="search" /><input ref={search} aria-label="Search navigation" placeholder="Find a page…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>}
    <nav id="sidebar-content" aria-label="Main navigation" onScroll={() => {
      const target = document.activeElement as HTMLElement | null;
      if (collapsed && window.innerWidth > 800 && target?.dataset.tooltip && aside.current?.contains(target)) {
        const rect = target.getBoundingClientRect();
        setTooltip({ label: target.dataset.tooltip, top: rect.top + rect.height / 2, left: 76 });
      } else setTooltip(null);
    }}>
      {query.trim() ? <section className="nav-group"><h2>Search results</h2>{items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())).map(row)}{!items.some((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())) && <p className="sidebar-empty">No matching pages.</p>}</section> : <>
        {groups.map((group) => <section className="nav-group" key={`${group.label}:${group.items[0]?.to ?? "empty"}`} aria-label={group.label || group.items[0]?.label || "Navigation"}>{group.label && <h2>{group.label}</h2>}{group.items.map(row)}</section>)}

      </>}
    </nav>
    <div className="sidebar-account">
      {accountOpen && <div className="sidebar-account-menu"><strong>{userName}</strong><small>{accountInfo}</small>{items.filter((item) => item.to.endsWith("/settings") || item.to.endsWith("/me")).map((item) => <NavLink key={item.to} to={item.to} onClick={() => { setAccountOpen(false); onClose(); }}>{item.label}</NavLink>)}<button onClick={onLogout}>Sign out</button></div>}
      <button className="sidebar-account-button" aria-label={`Account: ${userName}`} data-tooltip="Account" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><span className="user-avatar" aria-hidden="true">{initials}</span><span className="user-copy"><strong>{userName}</strong><small>{accountInfo}</small></span><span className="account-dots" aria-hidden="true">···</span></button>
    </div>
    {tooltip && createPortal(<div className="sidebar-tooltip" role="tooltip" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.label}</div>, document.body)}
  </aside>;
}
