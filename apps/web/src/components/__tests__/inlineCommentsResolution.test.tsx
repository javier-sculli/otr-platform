import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TicketDetallePage } from '../../pages/TicketDetallePage';
import { InlineCommentPopover } from '../ticket/InlineCommentPopover';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    deleteComment: vi.fn(),
    getComments: vi.fn(),
    getClients: vi.fn().mockResolvedValue({ data: [] }),
    getUsers: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
    getReferences: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-rocky',
      name: 'Rocky',
      email: 'rocky@otr.com',
      role: 'CONTENIDISTA',
    },
  }),
}));

function renderWithProviders(ui: React.ReactNode, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Punto 2: Resolución Real y Permanente de Comentarios Inline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('InlineCommentPopover: muestra el botón Resolver para cualquier marca existente (!isDraft) aunque no tenga items', () => {
    const onResolveMock = vi.fn();
    render(
      <InlineCommentPopover
        pop={{ id: 'c_orphan_123', x: 100, y: 100, isDraft: false }}
        thread={{ quote: 'Texto con marca huérfana', items: [] }}
        onSend={vi.fn()}
        onResolve={onResolveMock}
        onClose={vi.fn()}
      />
    );

    // El botón Resolver debe estar visible para que el usuario pueda limpiar la marca
    const resolveBtn = screen.getByRole('button', { name: /resolver/i });
    expect(resolveBtn).toBeInTheDocument();

    fireEvent.click(resolveBtn);
    expect(onResolveMock).toHaveBeenCalled();
  });

  it('TicketDetallePage: al resolver un comentario inline, llama a api.deleteComment y actualiza el copy sin <mark>', async () => {
    const mockCommentId = 'comment-abc-123';
    const mockTicket = {
      id: 'ticket-rocky-1',
      title: 'Ticket con feedback de copy',
      status: 'REDACCION',
      canales: ['LinkedIn'],
      contentPerCanal: {
        LinkedIn: '<p>Texto inicial <mark data-c="c_comment-abc-123">frase con feedback</mark> fin del copy</p>',
      },
      client: { id: 'c1', name: 'Cliente A' },
      owner: { id: 'user-rocky', name: 'Rocky' },
    };

    const mockComments = [
      {
        id: mockCommentId,
        ticketId: 'ticket-rocky-1',
        content: '«frase con feedback»: Cambiar esta redacción por favor',
        quote: 'frase con feedback',
        user: { name: 'Revisor' },
        createdAt: new Date().toISOString(),
      },
    ];

    (api.getTicket as any).mockResolvedValue({ data: mockTicket });
    (api.getComments as any).mockResolvedValue({ data: mockComments });
    (api.deleteComment as any).mockResolvedValue({ success: true });
    (api.updateTicket as any).mockResolvedValue({ data: mockTicket });

    renderWithProviders(
      <Routes>
        <Route path="/piezas/:ticketId" element={<TicketDetallePage />} />
      </Routes>,
      '/piezas/ticket-rocky-1'
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ticket con feedback de copy')).toBeInTheDocument();
    });

    // Encontrar la marca en el documento y hacerle click
    const markEl = document.querySelector('mark[data-c="c_comment-abc-123"]') as HTMLElement;
    expect(markEl).toBeInTheDocument();
    fireEvent.click(markEl);

    // Debe abrirse el popover y contener el botón Resolver
    const resolveBtn = await screen.findByRole('button', { name: /resolver/i });
    expect(resolveBtn).toBeInTheDocument();

    // Hacemos click en Resolver
    fireEvent.click(resolveBtn);

    // 1. Debe llamar a la API para eliminar el comentario
    await waitFor(() => {
      expect(api.deleteComment).toHaveBeenCalledWith('ticket-rocky-1', mockCommentId);
    });

    // 2. Debe persistir la actualización del ticket sin la etiqueta <mark>
    await waitFor(() => {
      expect(api.updateTicket).toHaveBeenCalledWith(
        'ticket-rocky-1',
        expect.objectContaining({
          contentPerCanal: expect.objectContaining({
            LinkedIn: expect.not.stringContaining('<mark'),
          }),
        })
      );
    });
  });
});
