import { useEffect, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "./auth";
import { SidebarIcon } from "./SidebarIcon";
import "./signed-in-layout.css";

const links = [
  ["/", "home", "Trang chủ"],
  ["/about", "info", "Giới thiệu"],
  ["/dashboard", "games", "Trò chơi của tôi"],
  ["/builder/new", "create", "Tạo trò chơi mới"],
  ["/library", "library", "Thư viện mẫu"],
  ["/questions", "questions", "Ngân hàng câu hỏi"],
  ["/media", "media", "Tài nguyên"],
  ["/exports", "exports", "Lịch sử xuất"],
  ["/help", "help", "Hướng dẫn"],
];
export function SignedInLayout({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  useEffect(() => {
    const header = document.querySelector<HTMLElement>(".home-header"),
      app = header?.closest<HTMLElement>(".eg-app");
    if (!header || !app) return;
    const update = () =>
      app.style.setProperty(
        "--studio-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  if (!session || !profile) return <>{children}</>;
  return (
    <div className="eg-member-shell">
      <nav
        className="eg-sidebar eg-persistent-sidebar"
        aria-label="Không gian giáo viên"
      >
        <p>KHÔNG GIAN GIÁO VIÊN</p>
        {links.map(([to, icon, label]) => (
          <NavLink key={to} to={to} end aria-label={label} title={label}>
            <span className="eg-sidebar-icon" aria-hidden="true">
              <SidebarIcon name={icon} />
            </span>
            <span className="eg-sidebar-label">{label}</span>
          </NavLink>
        ))}
        {profile.role !== "teacher" && (
          <NavLink to="/admin" end aria-label="Quản trị" title="Quản trị">
            <span className="eg-sidebar-icon" aria-hidden="true">
              <SidebarIcon name="admin" />
            </span>
            <span className="eg-sidebar-label">Quản trị</span>
          </NavLink>
        )}
      </nav>
      <div className="eg-member-content">{children}</div>
    </div>
  );
}
