import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CreateTicketModal } from '../CreateTicketModal';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    createTicket: vi.fn(),
    getClients: vi.fn().mockResolvedValue({ data: [{ id: 'client-1', name: 'Cliente Test' }] }),
    getUsers: vi.fn().mockResolvedValue({ data: [] }),
    getTicketTypes: vi.fn().mockResolvedValue({ data: [] }),
    getPilares: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
    getComments: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Tester',
      email: 'test@otr.com',
      role: 'CONTENIDISTA',
      preferredClientIds: [],
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Ticket description/brief persistence on close', () => {
  const mockTicket: any = {
    id: 'ticket-desc-1',
    title: 'Ticket Test Descripción',
    tipoTicket: 'TAREA',
    status: 'PENDIENTE',
    prioridad: 'MEDIA',
    clientId: 'client-1',
    objetivo: 'Descripción inicial',
    links: [],
    canales: [],
    tiposContenido: ['Otro'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getTicket).mockResolvedValue({ data: mockTicket });
    vi.mocked(api.updateTicket).mockResolvedValue({ data: mockTicket });
  });

  it('guarda los cambios de descripción inmediatamente al hacer click en Cerrar sin perder texto', async () => {
    const handleClose = vi.fn();
    let resolveUpdate: (val: any) => void = () => {};
    const updatePromise = new Promise(res => {
      resolveUpdate = res;
    });
    vi.mocked(api.updateTicket).mockImplementation(() => updatePromise as any);

    render(
      <CreateTicketModal
        isOpen={true}
        ticket={mockTicket}
        onClose={handleClose}
      />,
      { wrapper: createWrapper() }
    );

    // Esperar a que renderice la descripción
    const editor = await screen.findByPlaceholderText('Descripción — detalle del pedido');
    expect(editor).toBeInTheDocument();

    // El usuario edita la descripción
    fireEvent.input(editor, { target: { innerHTML: 'Nueva descripción con instrucciones urgentes' } });

    // Inmediatamente hace click en Cerrar
    const closeBtn = screen.getByTitle('Cerrar (Esc)');
    fireEvent.click(closeBtn);

    // Debe haber disparado updateTicket con el nuevo objetivo
    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        'ticket-desc-1',
        expect.objectContaining({
          objetivo: 'Nueva descripción con instrucciones urgentes',
        })
      );
    });

    // onClose NO debe haberse llamado todavía mientras la promesa de guardado siga pendiente
    expect(handleClose).not.toHaveBeenCalled();

    // Se resuelve el guardado del servidor
    resolveUpdate({ data: { ...mockTicket, objetivo: 'Nueva descripción con instrucciones urgentes' } });

    // Ahora sí se cierra el modal
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('guarda los cambios de descripción inmediatamente al presionar Escape sin perder texto', async () => {
    const handleClose = vi.fn();
    let resolveUpdate: (val: any) => void = () => {};
    const updatePromise = new Promise(res => {
      resolveUpdate = res;
    });
    vi.mocked(api.updateTicket).mockImplementation(() => updatePromise as any);

    render(
      <CreateTicketModal
        isOpen={true}
        ticket={mockTicket}
        onClose={handleClose}
      />,
      { wrapper: createWrapper() }
    );

    const editor = await screen.findByPlaceholderText('Descripción — detalle del pedido');
    fireEvent.input(editor, { target: { innerHTML: 'Texto guardado al presionar escape' } });

    // Presionar tecla Escape
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        'ticket-desc-1',
        expect.objectContaining({
          objetivo: 'Texto guardado al presionar escape',
        })
      );
    });

    expect(handleClose).not.toHaveBeenCalled();
    resolveUpdate({ data: { ...mockTicket, objetivo: 'Texto guardado al presionar escape' } });

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('guarda los cambios de brief en ticket de CONTENIDO al hacer click en Cerrar', async () => {
    const handleClose = vi.fn();
    let resolveUpdate: (val: any) => void = () => {};
    const updatePromise = new Promise(res => {
      resolveUpdate = res;
    });
    vi.mocked(api.updateTicket).mockImplementation(() => updatePromise as any);

    const mockContentTicket: any = {
      ...mockTicket,
      tipoTicket: 'CONTENIDO',
      objetivo: 'Brief previo',
    };
    vi.mocked(api.getTicket).mockResolvedValue({ data: mockContentTicket });

    render(
      <CreateTicketModal
        isOpen={true}
        ticket={mockContentTicket}
        onClose={handleClose}
      />,
      { wrapper: createWrapper() }
    );

    const editor = await screen.findByPlaceholderText('Qué querés comunicar y por qué');
    fireEvent.input(editor, { target: { innerHTML: 'Nuevo brief de contenido' } });

    const closeBtn = screen.getByTitle('Cerrar (Esc)');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        'ticket-desc-1',
        expect.objectContaining({
          objetivo: 'Nuevo brief de contenido',
        })
      );
    });

    resolveUpdate({ data: { ...mockContentTicket, objetivo: 'Nuevo brief de contenido' } });
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
