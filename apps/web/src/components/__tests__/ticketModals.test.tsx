import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TransitionToDesignModal } from '../TransitionToDesignModal';
import { CreateTicketModal } from '../CreateTicketModal';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    getClients: vi.fn().mockResolvedValue({ data: [] }),
    getUsers: vi.fn().mockResolvedValue({ data: [] }),
    getTicketTypes: vi.fn().mockResolvedValue({ data: [] }),
    getPilares: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
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

describe('TransitionToDesignModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no sobreescribe ni pierde los links existentes al pasar a diseño', async () => {
    const mockTicket = {
      id: 'ticket-123',
      title: 'Post de prueba',
      objetivo: 'Brief original',
      notasAudiovisual: 'Notas de diseño previas',
      links: ['https://drive.google.com/folder-existente'],
      client: { name: 'Cliente X' },
    };

    (api.getTicket as any).mockResolvedValue({
      data: mockTicket,
    });

    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TransitionToDesignModal
        isOpen={true}
        onClose={onClose}
        ticket={mockTicket}
        onConfirm={onConfirm}
      />,
      { wrapper: createWrapper() }
    );

    // Esperar que se muestre el link existente
    await waitFor(() => {
      expect(screen.getByText('https://drive.google.com/folder-existente')).toBeInTheDocument();
    });

    // Agregar un nuevo link de Figma
    const input = screen.getByPlaceholderText('https://figma.com/file/...');
    await userEvent.type(input, 'https://figma.com/file/nuevo-diseno');

    const addBtn = screen.getByRole('button', { name: /sumar/i });
    await userEvent.click(addBtn);

    // Guardar y pasar a diseño
    const submitBtn = screen.getByRole('button', { name: /guardar y pasar a diseño/i });
    await userEvent.click(submitBtn);

    // Verificar que onConfirm recibe AMBOS links acumulativamente
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const confirmData = onConfirm.mock.calls[0][0];

    expect(confirmData.links).toContain('https://drive.google.com/folder-existente');
    expect(confirmData.links).toContain('https://figma.com/file/nuevo-diseno');
    expect(confirmData.notasAudiovisual).toBe('Notas de diseño previas');
  });
});

describe('CreateTicketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra "Cargando…" en el header mientras descarga los datos completos del ticket', async () => {
    let resolveTicket: (val: any) => void;
    const ticketPromise = new Promise((resolve) => {
      resolveTicket = resolve;
    });
    (api.getTicket as any).mockReturnValue(ticketPromise);

    const initialTicketSummary = {
      id: 'ticket-456',
      title: 'Ticket en resumen',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'PENDIENTE',
      prioridad: 'MEDIA',
    };

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        ticket={initialTicketSummary as any}
      />,
      { wrapper: createWrapper() }
    );

    // Verificar que aparece el indicador "Cargando…"
    expect(screen.getByText(/cargando…/i)).toBeInTheDocument();

    // Resolver la promesa con los datos completos
    resolveTicket!({
      data: {
        ...initialTicketSummary,
        links: ['https://drive.google.com/recurso-completo'],
        notasAudiovisual: 'Notas completas',
      },
    });

    // Una vez resuelto, "Cargando…" debe desaparecer y mostrar el link cargado
    await waitFor(() => {
      expect(screen.queryByText(/cargando…/i)).not.toBeInTheDocument();
      expect(screen.getByText('https://drive.google.com/recurso-completo')).toBeInTheDocument();
    });
  });

  it('al editar y guardar un ticket con links existentes, los links se preservan en el auto-save', async () => {
    const mockTicket = {
      id: 'ticket-789',
      title: 'Ticket existente con links',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'PENDIENTE',
      prioridad: 'MEDIA',
      links: ['https://drive.google.com/link-importante'],
      notasAudiovisual: 'Notas importantes',
      canales: ['LinkedIn'],
    };

    (api.getTicket as any).mockResolvedValue({
      data: mockTicket,
    });
    (api.updateTicket as any).mockResolvedValue({
      data: mockTicket,
    });

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        ticket={mockTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    // Esperar a que cargue el ticket completo y se muestre el link
    await waitFor(() => {
      expect(screen.getByText('https://drive.google.com/link-importante')).toBeInTheDocument();
    });

    // Modificar el título para gatillar auto-save al salir del campo
    const titleInput = screen.getByPlaceholderText('Nombre de la pieza');
    await userEvent.type(titleInput, ' - Editado');
    await userEvent.tab(); // Sale del campo (onBlur)

    // Esperar a que se ejecute el auto-save
    await waitFor(
      () => {
        expect(api.updateTicket).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );

    const updatePayload = (api.updateTicket as any).mock.calls[0][1];
    expect(updatePayload.title).toBe('Ticket existente con links - Editado');
    expect(updatePayload.links).toEqual(['https://drive.google.com/link-importante']);
    expect(updatePayload.notasAudiovisual).toBe('Notas importantes');
  });

  it('muestra únicamente las redes objetivo que trabaja el cliente seleccionado', async () => {
    (api.getClients as any).mockResolvedValue({
      data: [
        { id: 'c1', name: 'Cliente Solo LinkedIn', canales: ['LinkedIn'] },
      ],
    });

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        defaultClientId="c1"
      />,
      { wrapper: createWrapper() }
    );

    // Esperar a que renderice y verificar que aparece LinkedIn pero no Twitter ni Instagram
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^LinkedIn$/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Twitter$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Instagram$/i })).not.toBeInTheDocument();
    });
  });

  it('no sobreescribe ni pisa el brief/descripción al disparar auto-save en onBlur en un ticket de tipo tarea', async () => {
    const mockTaskTicket = {
      id: 'ticket-task-1',
      title: 'Tarea de prueba',
      objetivo: 'Texto inicial',
      status: 'PENDIENTE',
      prioridad: 'MEDIA',
      links: [],
      client: { id: 'c1', name: 'Cliente A' },
      owner: { id: 'u1', name: 'Usuario 1' },
      ticketType: { id: 'tt1', name: 'Tarea general', kind: 'TAREA' },
    };

    (api.getTicket as any).mockResolvedValue({
      data: mockTaskTicket,
    });
    (api.updateTicket as any).mockImplementation((_id: string, payload: any) =>
      Promise.resolve({
        data: {
          ...mockTaskTicket,
          ...payload,
        },
      })
    );

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        ticket={mockTaskTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    const textarea = await screen.findByPlaceholderText('Descripción — detalle del pedido');
    expect(textarea).toHaveValue('Texto inicial');

    // El usuario escribe texto continuo
    await userEvent.type(textarea, ' con detalles adicionales');
    expect(textarea).toHaveValue('Texto inicial con detalles adicionales');

    // Al salir del campo (onBlur) se dispara el guardado
    await userEvent.tab();

    // Esperar a que se ejecute el auto-save
    await waitFor(
      () => {
        expect(api.updateTicket).toHaveBeenCalled();
      },
      { timeout: 3000 }
    );

    // Verificar que tras responder el auto-save, el contenido NO fue pisado
    expect(textarea).toHaveValue('Texto inicial con detalles adicionales');
  });

  it('guarda los cambios pendientes si el usuario cierra el modal directamente sin salir del campo', async () => {
    const mockTaskTicket = {
      id: 'ticket-task-2',
      title: 'Tarea sin blur previo',
      objetivo: 'Brief previo',
      status: 'PENDIENTE',
      prioridad: 'MEDIA',
      links: [],
      client: { id: 'c1', name: 'Cliente A' },
      owner: { id: 'u1', name: 'Usuario 1' },
      ticketType: { id: 'tt1', name: 'Tarea general', kind: 'TAREA' },
    };

    (api.getTicket as any).mockResolvedValue({
      data: mockTaskTicket,
    });
    (api.updateTicket as any).mockResolvedValue({
      data: mockTaskTicket,
    });

    const onClose = vi.fn();

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={onClose}
        ticket={mockTaskTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    const textarea = await screen.findByPlaceholderText('Descripción — detalle del pedido');

    // El usuario escribe pero NO hace blur
    await userEvent.type(textarea, ' - texto sin salir del campo');

    // Cierra el modal directamente haciendo clic en el backdrop oscuro
    const backdrop = document.querySelector('.bg-black\\/40');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);

    // Debe haberse llamado a updateTicket con los cambios pendientes
    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        'ticket-task-2',
        expect.objectContaining({
          objetivo: 'Brief previo - texto sin salir del campo',
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });
});


