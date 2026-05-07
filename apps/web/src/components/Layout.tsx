import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, LogOut, User, Building2, TrendingUp, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';

const navItems = [
  { path: '/clientes', label: 'Clientes', icon: Building2 },
  { path: '/backlog', label: 'Backlog', icon: Lightbulb },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
    refetchInterval: 30000,
  });

  const notifications = notifData?.data ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications]);

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

              {/* Notification Bell */}
              <div className="relative" ref={panelRef}>
                <button
                  onClick={() => setShowNotifications(v => !v)}
                  className="relative p-1.5 rounded-lg hover:bg-[#000033]/5 transition-all text-[#000033]/60 hover:text-[#000033]"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#024fff] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-[#000033]/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#000033]/10">
                      <span className="text-xs font-bold text-[#000033] uppercase tracking-wide">Notificaciones</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllMutation.mutate()}
                          className="text-xs text-[#024fff] font-bold hover:underline"
                        >
                          Marcar todas leídas
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-xs text-[#000033]/40 text-center">Sin notificaciones</p>
                      ) : (
                        notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => {
                              if (!n.read) markReadMutation.mutate(n.id);
                              if (n.ticketId) navigate(`/piezas/${n.ticketId}`);
                              setShowNotifications(false);
                            }}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-[#000033]/5 cursor-pointer hover:bg-[#000033]/5 transition-all ${!n.read ? 'bg-[#024fff]/5' : ''}`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-[#024fff]' : 'bg-transparent'}`} />
                            <div className="min-w-0">
                              <p className="text-xs text-[#000033] leading-relaxed">{n.message}</p>
                              <p className="text-[10px] text-[#000033]/40 mt-0.5">
                                {new Date(n.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
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
