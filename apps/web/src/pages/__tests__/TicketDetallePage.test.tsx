import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TicketDetallePage } from '../TicketDetallePage';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    getComments: vi.fn().mockResolvedValue({ data: [] }),
    createComment: vi.fn().mockResolvedValue({ data: {} }),
    deleteComment: vi.fn().mockResolvedValue({ data: {} }),
    getUsers: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
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
    },
  }),
}));

const mockFullTicket = {
  id: 'ticket-999',
  title: 'Ticket Completo Mock',
  objetivo: 'Brief detallado del ticket',
  status: 'LISTO_PARA_PUBLICAR',
  prioridad: 'ALTA',
  canales: ['LinkedIn'],
  linkPublicacion: 'https://linkedin.com/feed/post/1',
  client: { id: 'client-1', name: 'Cliente Test' },
  owner: { id: 'user-1', name: 'Tester' },
  contentPerCanal: {
    LinkedIn: '<p>Texto de copy para LinkedIn</p>',
  },
  notasAudiovisual: '<p>Notas de diseño</p>',
  links: ['https://drive.google.com/test'],
  linkEntregable: 'https://figma.com/test',
  references: [],
};

function renderTicketDetalle(ticketId = 'ticket-999') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/piezas/${ticketId}`]}>
        <Routes>
          <Route path="/piezas/:ticketId" element={<TicketDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketDetallePage (Smoke / Montaje)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('monta correctamente y renderiza el ticket completo con ruta /piezas/:ticketId', async () => {
    (api.getTicket as any).mockResolvedValue({
      data: mockFullTicket,
    });

    renderTicketDetalle('ticket-999');

    // Debe mostrar primero estado de carga
    expect(screen.getByText(/cargando ticket/i)).toBeInTheDocument();

    // Esperar a que cargue el ticket completo
    await waitFor(() => {
      expect(screen.getByDisplayValue('Ticket Completo Mock')).toBeInTheDocument();
    });

    // Validar elementos esenciales
    expect(screen.getAllByText('Cliente Test')[0]).toBeInTheDocument();
    expect(screen.getByText('Link a la Publicación')).toBeInTheDocument();
    expect(screen.getByText('https://linkedin.com/feed/post/1')).toBeInTheDocument();
  });

  it('monta sin romper cuando el ticket tiene campos nulos o vacíos', async () => {
    const minimalTicket = {
      id: 'ticket-min',
      title: 'Ticket Mínimo',
      status: 'PENDIENTE',
      canales: null,
      links: null,
      linkPublicacion: null,
      linkEntregable: null,
      contentPerCanal: null,
      notasAudiovisual: null,
      objetivo: null,
      client: null,
      owner: null,
      references: null,
    };

    (api.getTicket as any).mockResolvedValue({
      data: minimalTicket,
    });

    renderTicketDetalle('ticket-min');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ticket Mínimo')).toBeInTheDocument();
    });

    // Link a la publicación no debe aparecer en PENDIENTE
    expect(screen.queryByText('Link a la Publicación')).not.toBeInTheDocument();
  });

  it('renderiza comentarios persistidos incluyendo citas con comillas latinas', async () => {
    (api.getTicket as any).mockResolvedValue({
      data: mockFullTicket,
    });

    (api.getComments as any).mockResolvedValue({
      data: [
        {
          id: 'cm-1',
          content: '«Texto con cita»: Corregir esto por favor',
          user: { id: 'u1', name: 'Martín Revisor' },
          createdAt: new Date().toISOString(),
        },
      ],
    });

    renderTicketDetalle('ticket-999');

    await waitFor(() => {
      expect(screen.getByText('Martín Revisor')).toBeInTheDocument();
      expect(screen.getByText('«Texto con cita»')).toBeInTheDocument();
      expect(screen.getByText(/Corregir esto por favor/)).toBeInTheDocument();
    });
  });

  it('renderiza vista de error o no encontrado si la API falla sin explotar', async () => {
    (api.getTicket as any).mockRejectedValue(new Error('Network error'));

    renderTicketDetalle('ticket-inexistente');

    await waitFor(() => {
      expect(screen.getByText(/no se pudo cargar el ticket/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /volver al backlog/i })).toBeInTheDocument();
    });
  });

  it('en DISENO o EDICION, las notas de diseño aparecen antes que el copy en TicketDetallePage', async () => {
    (api.getTicket as any).mockResolvedValue({
      data: {
        ...mockFullTicket,
        id: 'ticket-diseno-page',
        status: 'DISENO',
        notasAudiovisual: '<p>Directivas de diseño</p>',
      },
    });

    renderTicketDetalle('ticket-diseno-page');

    await waitFor(() => {
      expect(screen.getByText('Directivas de diseño')).toBeInTheDocument();
    });

    const notasHeader = screen.getAllByText('Notas de diseño')[0];
    const copyEditor = screen.getByText('Texto de copy para LinkedIn');

    // En DISENO: notas aparece antes que copy
    expect(notasHeader.compareDocumentPosition(copyEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('en estados que no son DISENO ni EDICION, las notas de diseño aparecen abajo del copy en TicketDetallePage', async () => {
    (api.getTicket as any).mockResolvedValue({
      data: {
        ...mockFullTicket,
        id: 'ticket-revision-page',
        status: 'REVISION_INTERNA',
        notasAudiovisual: '<p>Directivas de diseño</p>',
      },
    });

    renderTicketDetalle('ticket-revision-page');

    await waitFor(() => {
      expect(screen.getByText('Texto de copy para LinkedIn')).toBeInTheDocument();
    });

    const copyEditor = screen.getByText('Texto de copy para LinkedIn');
    const notasHeader = screen.getAllByText('Notas de diseño')[0];

    // En REVISION_INTERNA: copy aparece antes que notas (notas abajo del copy)
    expect(copyEditor.compareDocumentPosition(notasHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
