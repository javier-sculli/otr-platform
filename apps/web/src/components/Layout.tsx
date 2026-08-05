import { useNavigate, useLocation } from 'react-router-dom';
import { Lightbulb, LogOut, User, Building2, TrendingUp, Bell, Check, Newspaper, Calendar, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';

const baseNavItems = [
  { path: '/clientes', label: 'Clientes', icon: Building2 },
  { path: '/backlog', label: 'Backlog', icon: Lightbulb },
  { path: '/prensa', label: 'Prensa', icon: Newspaper },
  { path: '/sumario', label: 'Sumario', icon: Calendar },
  { path: '/performance', label: 'Performance', icon: TrendingUp },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, updatePreferredClients } = useAuth();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.getNotifications(),
    refetchInterval: 10000,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const notifications = notifData?.data ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;
  const clients: { id: string; name: string }[] = clientsData?.data ?? [];
  const preferredIds: string[] = user?.preferredClientIds ?? [];

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
        const updatedData = old.data?.map((n: any) => n.id === id ? { ...n, read: true } : n);
        const unreadCount = updatedData?.filter((n: any) => !n.read).length ?? 0;
        return { ...old, data: updatedData, unreadCount };
      });
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const previous = queryClient.getQueryData(['notifications']);
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
        const updatedData = old.data?.map((n: any) => ({ ...n, read: true }));
        return { ...old, data: updatedData, unreadCount: 0 };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['notifications'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const prevNotifIdsRef = useRef<string[]>([]);

  // Notificaciones de escritorio de Chrome/Browser
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (notifications.length === 0) return;

    // Detectar notificaciones nuevas no leídas
    const newUnread = notifications.filter(
      n => !n.read && !prevNotifIdsRef.current.includes(n.id)
    );

    if (newUnread.length > 0 && prevNotifIdsRef.current.length > 0) {
      if (Notification.permission === 'granted') {
        newUnread.forEach(n => {
          try {
            const desktopNotif = new Notification(n.fromName ? `${n.fromName} (Sistema de Contenido)` : 'Sistema de Contenido', {
              body: n.message,
              icon: '/favicon.ico',
              tag: n.id,
            });
            desktopNotif.onclick = () => {
              window.focus();
              markReadMutation.mutate(n.id);
              if (n.ticketId) navigate(`/piezas/${n.ticketId}`);
            };
          } catch (e) {
            console.error('Error mostrando notificacion nativa:', e);
          }
        });
      }
    }

    prevNotifIdsRef.current = notifications.map(n => n.id);
  }, [notifications, navigate]);

  const requestDesktopPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission();
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    if (showNotifications || showProfile) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications, showProfile]);

  const toggleClient = (id: string) => {
    const next = preferredIds.includes(id)
      ? preferredIds.filter(c => c !== id)
      : [...preferredIds, id];
    updatePreferredClients(next);
  };

  const isDirector =
    user?.role === 'DIRECCION' ||
    ['javier', 'javi', 'joaco', 'manu', 'manuela'].some((n) =>
      user?.email?.toLowerCase().includes(n)
    );

  const navItems = isDirector
    ? [...baseNavItems, { path: '/reportes', label: 'Reportes', icon: BarChart3 }]
    : baseNavItems;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <nav className="bg-white border-b-2 border-[#000033]/10 sticky top-0 z-40 shadow-sm">
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
              {/* Profile button */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => { setShowProfile(v => !v); setShowNotifications(false); }}
                  className="flex items-center gap-1.5 text-sm text-[#000033]/60 hover:text-[#000033] transition-colors px-2 py-1 rounded-lg hover:bg-[#000033]/5"
                >
                  <User className="w-4 h-4" />
                  <span className="text-xs font-medium">{user?.name}</span>
                  {preferredIds.length > 0 && (
                    <span className="ml-0.5 text-[10px] font-bold text-[#024fff] bg-[#024fff]/10 rounded-full px-1.5 py-0.5">
                      {preferredIds.length}
                    </span>
                  )}
                </button>

                {showProfile && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white border-2 border-[#000033]/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-[#000033]/10">
                      <p className="text-xs font-bold text-[#000033]">{user?.name}</p>
                      <p className="text-[11px] text-[#000033]/40">{user?.email}</p>
                    </div>

                    {/* Mis clientes */}
                    <div className="px-4 py-3 border-b border-[#000033]/10">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-[#000033]/50 uppercase tracking-wide">Mis clientes</p>
                        {preferredIds.length > 0 && (
                          <button
                            onClick={() => updatePreferredClients([])}
                            className="text-[10px] text-[#000033]/40 hover:text-[#000033] transition-colors"
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                      {preferredIds.length === 0 && (
                        <p className="text-[11px] text-[#000033]/40 mb-2">
                          Sin selección — ves todos los clientes por defecto.
                        </p>
                      )}
                      <div className="space-y-0.5 max-h-52 overflow-y-auto">
                        {clients.map(c => {
                          const selected = preferredIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleClient(c.id)}
                              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                                selected
                                  ? 'bg-[#024fff]/8 text-[#024fff]'
                                  : 'text-[#000033]/70 hover:bg-[#000033]/5'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                                selected ? 'bg-[#024fff] border-[#024fff]' : 'border-[#000033]/20'
                              }`}>
                                {selected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <span className="text-xs font-medium truncate">{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Logout */}
                    <div className="px-4 py-2.5">
                      <button
                        onClick={() => { logout(); setShowProfile(false); }}
                        className="flex items-center gap-1.5 text-xs text-[#000033]/40 hover:text-[#000033] font-medium transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Salir
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              <div className="relative" ref={panelRef}>
                <button
                  onClick={() => { setShowNotifications(v => !v); setShowProfile(false); }}
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
                  <div className="absolute right-0 top-full mt-2 w-84 sm:w-96 bg-white border-2 border-[#000033]/10 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#000033]/10 bg-[#fafafa]">
                      <span className="text-xs font-bold text-[#000033] uppercase tracking-wide">Notificaciones</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => markAllMutation.mutate()}
                          className="text-xs text-[#024fff] font-bold hover:underline"
                        >
                          Marcar leídas
                        </button>
                      )}
                    </div>

                    {/* Banner para activar notificaciones de escritorio si aún no fueron solicitadas */}
                    {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
                      <div className="px-4 py-2 bg-[#024fff]/5 border-b border-[#024fff]/10 flex items-center justify-between">
                        <span className="text-[11px] text-[#000033]/70">¿Activar notificaciones de escritorio en Chrome?</span>
                        <button
                          onClick={requestDesktopPermission}
                          className="px-2 py-1 bg-[#024fff] text-white text-[10px] font-bold rounded hover:bg-[#024fff]/90 transition-all"
                        >
                          Activar
                        </button>
                      </div>
                    )}

                    <div className="max-h-80 overflow-y-auto divide-y divide-[#000033]/5">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell className="w-6 h-6 text-[#000033]/20 mx-auto mb-2" />
                          <p className="text-xs text-[#000033]/40">Sin notificaciones aún</p>
                        </div>
                      ) : (
                        notifications.map(n => {
                          const typeLabel = n.type === 'MENTION' ? '@mención' : n.type === 'ASSIGNED' ? 'Asignación' : 'Estado';
                          const typeBadgeBg = n.type === 'MENTION' ? 'bg-[#024fff]/10 text-[#024fff]' : n.type === 'ASSIGNED' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700';

                          return (
                            <div
                              key={n.id}
                              onClick={() => {
                                if (!n.read) markReadMutation.mutate(n.id);
                                if (n.ticketId) navigate(`/piezas/${n.ticketId}`);
                                setShowNotifications(false);
                              }}
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#024fff]/5 transition-all ${
                                !n.read ? 'bg-[#024fff]/[0.03]' : ''
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-[#024fff]' : 'bg-transparent'}`} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeBadgeBg}`}>
                                    {typeLabel}
                                  </span>
                                  <span className="text-[10px] text-[#000033]/40 ml-auto">
                                    {new Date(n.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-[#000033] leading-relaxed font-medium">{n.message}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {children}
    </div>
  );
}
