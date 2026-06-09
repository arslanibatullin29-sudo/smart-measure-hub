import { Link, useLocation } from "react-router-dom";
import { Users, Settings, LogOut, Ruler, Building2, UserCog, LayoutDashboard, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { authService } from "@/features/auth/services/authService";
import { useNavigate } from "react-router-dom";
import { useOrganization } from "@/features/organizations/contexts/OrganizationProvider";
import OrgSwitcher from "@/features/organizations/components/OrgSwitcher";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { activeOrg, activeRole, isHead, canManage } = useOrganization();

  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Дашборд", show: true },
    ...(isHead ? [{ to: "/franchises", icon: Store, label: "Франчайзи", show: true }] : []),
    { to: "/customers", icon: Users, label: "Клиенты", show: true },
    { to: "/profiles", icon: Settings, label: "Профили", show: activeRole !== 'viewer' },
    { to: "/organization/members", icon: UserCog, label: "Сотрудники", show: canManage },
    { to: "/organization/settings", icon: Building2, label: "Организация", show: canManage },
  ].filter(i => i.show);

  const handleLogout = async () => {
    await authService.signOut();
    navigate("/login");
  };

  const handleLinkClick = () => {
    if (window.innerWidth < 1024 && onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={cn(
        "w-56 bg-sidebar h-screen flex flex-col fixed left-0 top-0 z-50 border-r border-sidebar-border transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      {/* Logo - компактный */}
      <div className="p-3 sm:p-4 border-b border-sidebar-border">
        <Link to="/customers" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Ruler className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground">RumaRum</h1>
            <p className="text-[10px] text-sidebar-foreground/60">Замеры и сметы</p>
          </div>
        </Link>
      </div>

      {activeOrg && (
        <div className="px-3 pt-2 pb-1 space-y-1">
          <div className="text-[10px] uppercase text-sidebar-foreground/50">Активная организация</div>
          <div className="text-xs text-sidebar-foreground truncate">{activeOrg.name}</div>
          <OrgSwitcher />
        </div>
      )}

      {/* Navigation - компактная */}
      <nav className="flex-1 p-2 sm:p-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleLinkClick}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all",
                isActive && "bg-sidebar-accent text-sidebar-foreground font-medium",
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer - компактный */}
      <div className="p-2 sm:p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <p className="text-xs text-sidebar-foreground truncate flex-1">{user?.email || "Пользователь"}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Выйти
        </button>
      </div>
    </aside>
  );
}
