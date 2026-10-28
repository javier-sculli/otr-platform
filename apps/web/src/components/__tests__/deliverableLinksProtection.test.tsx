import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CreateTicketModal } from '../CreateTicketModal';
import { TicketDetallePage } from '../../pages/TicketDetallePage';
import { ContentPage } from '../../pages/ContentPage';
import { api } from '../../lib/api';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  api: {
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    createTicket: vi.fn(),
    getClients: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'Cliente Test', canales: ['LinkedIn'] }] }),
    getUsers: vi.fn().mockResolvedValue({ data: [{ id: 'u1', name: 'Usuario Test' }] }),
    getTicketTypes: vi.fn().mockResolvedValue({ data: [] }),
    getPilares: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
    getComments: vi.fn().mockResolvedValue({ data: [] }),
    getReferences: vi.fn().mockResolvedValue({ data: [] }),
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

describe('Blindaje del campo Entregable Final contra pérdidas y auto-saves', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('CreateTicketModal: al editar otros campos (como prioridad o título), NO envía linkEntregable null en el auto-save', async () => {
    const existingTicket = {
      id: 'ticket-entregable-1',
      title: 'Post con entregables existentes',
      status: 'DISENO',
      prioridad: 'MEDIA',
      clientId: 'c1',
      client: { id: 'c1', name: 'Cliente Test', canales: ['LinkedIn'] },
      canales: ['LinkedIn'],
      links: [],
      linkEntregable: 'https://figma.com/file/123\nhttps://drive.google.com/asset-456',
      linkPublicacion: null,
      objetivo: 'Brief de prueba',
      notasAudiovisual: '',
      contentPerCanal: {},
    };

    (api.getTicket as any).mockResolvedValue({ data: existingTicket });
    (api.updateTicket as any).mockResolvedValue({ data: { ...existingTicket, prioridad: 'ALTA' } });

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        ticket={existingTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Post con entregables existentes')).toBeInTheDocument();
    });

    // Verificamos que ambos links aparecen renderizados en el modal
    expect(screen.getByText('https://figma.com/file/123')).toBeInTheDocument();
    expect(screen.getByText('https://drive.google.com/asset-456')).toBeInTheDocument();

    // El usuario cambia la prioridad a ALTA (sin tocar el campo entregable)
    const btnAlta = screen.getByRole('button', { name: /^alta$/i });
    fireEvent.click(btnAlta);

    // Esperar que se ejecute el updateTicket
    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalled();
    });

    // Comprobamos la llamada a updateTicket: NO debe tener linkEntregable
    const updateCall = (api.updateTicket as any).mock.calls[0];
    const updatePayload = updateCall[1];
    expect(updatePayload.prioridad).toBe('ALTA');
    expect(updatePayload).not.toHaveProperty('linkEntregable');
  });

  it('CreateTicketModal: al agregar un nuevo link entregable, se marca dirty y se envía la lista combinada', async () => {
    const user = userEvent.setup();
    const existingTicket = {
      id: 'ticket-entregable-2',
      title: 'Post para agregar link',
      status: 'DISENO',
      prioridad: 'MEDIA',
      clientId: 'c1',
      client: { id: 'c1', name: 'Cliente Test', canales: ['LinkedIn'] },
      canales: ['LinkedIn'],
      links: [],
      linkEntregable: 'https://figma.com/file/original',
      linkPublicacion: null,
      objetivo: 'Brief de prueba',
    };

    (api.getTicket as any).mockResolvedValue({ data: existingTicket });
    (api.updateTicket as any).mockResolvedValue({
      data: { ...existingTicket, linkEntregable: 'https://figma.com/file/original\nhttps://mi-nuevo-link.com' },
    });

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        ticket={existingTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText('https://figma.com/file/original')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/pegá un link al diseño terminado/i);
    await user.type(input, 'https://mi-nuevo-link.com{enter}');

    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        'ticket-entregable-2',
        expect.objectContaining({
          linkEntregable: 'https://figma.com/file/original\nhttps://mi-nuevo-link.com',
        })
      );
    });
  });

  it('TicketDetallePage: el input para agregar links se inicializa vacío y no precarga el string concatenado de links', async () => {
    const existingTicket = {
      id: 'ticket-entregable-3',
      title: 'Ticket en detalle',
      status: 'DISENO',
      prioridad: 'MEDIA',
      clientId: 'c1',
      client: { id: 'c1', name: 'Cliente Test' },
      canales: ['LinkedIn'],
      links: [],
      linkEntregable: 'https://figma.com/diseno-existente',
      objetivo: 'Brief',
    };

    (api.getTicket as any).mockResolvedValue({ data: existingTicket });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/piezas/ticket-entregable-3']}>
          <Routes>
            <Route path="/piezas/:ticketId" element={<TicketDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('https://figma.com/diseno-existente')).toBeInTheDocument();
    });

    // El input para escribir un nuevo link NO debe tener precargado 'https://figma.com/diseno-existente'
    const input = screen.getByPlaceholderText(/pegá un link al diseño terminado y presioná enter/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('ContentPage: al guardar copy, NO sobreescribe ni envía linkEntregable si no fue modificado', async () => {
    const existingTicket = {
      id: 'ticket-content-1',
      title: 'Ticket en ContentPage',
      status: 'REDACCION',
      clientId: 'c1',
      client: { id: 'c1', name: 'Cliente Test' },
      canales: ['LinkedIn'],
      objetivo: 'Brief original',
      contentPerCanal: { LinkedIn: '<p>Texto inicial de copy</p>' },
      linkEntregable: 'https://figma.com/file/safe-deliverable',
    };

    (api.getTicket as any).mockResolvedValue({ data: existingTicket });
    (api.updateTicket as any).mockResolvedValue({ data: existingTicket });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/content/ticket-content-1']}>
          <Routes>
            <Route path="/content/:ticketId" element={<ContentPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/entregable/i)).toBeInTheDocument();
    });

    // El link original se muestra como entregable
    expect(screen.getByTitle('https://figma.com/file/safe-deliverable')).toBeInTheDocument();

    // Modificamos el brief para generar cambios pendientes
    const briefTextarea = screen.getByDisplayValue('Brief original');
    fireEvent.change(briefTextarea, { target: { value: 'Brief modificado' } });

    // Hacemos click en "Guardar"
    const saveBtn = screen.getByRole('button', { name: /^guardar$/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalled();
    });

    const updatePayload = (api.updateTicket as any).mock.calls[0][1];
    // NO debe enviar linkEntregable porque no fue modificado en ContentPage
    expect(updatePayload).not.toHaveProperty('linkEntregable');
  });
});
