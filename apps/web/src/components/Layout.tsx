import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, LogOut, User, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { path: '/clientes', label: 'Clientes', icon: Building2 },
  { path: '/backlog', label: 'Backlog', icon: Lightbulb },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <nav className="bg-white border-b-2 border-[#000033]/10 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <span className="font-bold text-[#000033] text-xl">
                Sistema de Contenido
              </span>

              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                        isActive
                          ? 'bg-[#024fff] text-white shadow-lg shadow-[#024fff]/20'
                          : 'text-[#000033]/60 hover:text-[#000033] hover:bg-[#000033]/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-[#000033]/60">
                <User className="w-4 h-4" />
                {user?.name}
              </div>
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 text-xs text-[#000033]/40 hover:text-[#000033] font-medium transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
