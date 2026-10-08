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
      <MemoryRouter initialEntries={[`/tickets/${ticketId}`]}>
        <Routes>
          <Route path="/tickets/:ticketId" element={<TicketDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TicketDetallePage (Smoke / Montaje)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('monta correctamente y renderiza el ticket completo sin romper ni lanzar errores', async () => {
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

  it('renderiza vista de error o no encontrado si la API falla sin explotar', async () => {
    (api.getTicket as any).mockRejectedValue(new Error('Network error'));

    renderTicketDetalle('ticket-inexistente');

    await waitFor(() => {
      expect(screen.getByText(/no se pudo cargar el ticket/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /volver al backlog/i })).toBeInTheDocument();
    });
  });
});
