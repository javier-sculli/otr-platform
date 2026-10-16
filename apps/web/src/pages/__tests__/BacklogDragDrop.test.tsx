import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { BacklogPage } from '../BacklogPage';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getTickets: vi.fn(),
    getClients: vi.fn().mockResolvedValue({ data: [] }),
    updateTicket: vi.fn().mockResolvedValue({ data: {} }),
    getTicket: vi.fn(),
    getUsers: vi.fn().mockResolvedValue({ data: [] }),
    getPilares: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
    getTicketTypes: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Tester', role: 'CONTENIDISTA' },
    preferredClientIds: [],
  }),
}));

const mockTicket = {
  id: 'ticket-1',
  title: 'Post de Lanzamiento',
  canales: ['LinkedIn'],
  status: 'PENDIENTE',
  prioridad: 'ALTA',
  area: 'CONTENIDO',
  dueDate: '2026-10-20',
  links: [],
  owner: { id: 'user-1', name: 'Tester' },
  client: { id: 'client-1', name: 'Cliente Alpha' },
  ticketType: { id: 'type-1', name: 'Post', kind: 'CONTENIDO' },
};

describe('BacklogPage Drag and Drop', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.mocked(api.getTickets).mockResolvedValue({
      data: [mockTicket],
    });
  });

  it('permite arrastrar un ticket desde Pendiente y soltarlo en Redacción llamando a updateTicket', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BacklogPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Esperar a que el ticket aparezca en pantalla
    await waitFor(() => {
      expect(screen.getByText('Post de Lanzamiento')).toBeInTheDocument();
    });

    const ticketCard = screen.getByText('Post de Lanzamiento').closest('[draggable="true"]');
    expect(ticketCard).toBeInTheDocument();
    expect(ticketCard).not.toHaveClass('pointer-events-none');

    // Simular dataTransfer
    const dataStore: Record<string, string> = {};
    const mockDataTransfer = {
      setData: vi.fn((key: string, val: string) => { dataStore[key] = val; }),
      getData: vi.fn((key: string) => dataStore[key] || ''),
      effectAllowed: 'move',
      dropEffect: 'move',
    };

    // 1. Drag start en el ticket
    fireEvent.dragStart(ticketCard!, { dataTransfer: mockDataTransfer });
    expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/plain', 'ticket-1');

    // 2. Drag over en la columna Redacción
    const redaccionHeading = screen.getByRole('heading', { name: 'Redacción' });
    const redaccionCol = redaccionHeading.closest('.flex-col')!;
    expect(redaccionCol).toBeInTheDocument();

    fireEvent.dragOver(redaccionCol, { dataTransfer: mockDataTransfer });

    // 3. Drop en la columna Redacción
    fireEvent.drop(redaccionCol, { dataTransfer: mockDataTransfer });

    // Verificar que se llamó a api.updateTicket con el nuevo estado REDACCION
    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith('ticket-1', { status: 'REDACCION' });
    });
  });
});
