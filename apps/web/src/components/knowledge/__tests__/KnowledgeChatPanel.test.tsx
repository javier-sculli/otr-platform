import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeChatPanel } from '../KnowledgeChatPanel';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', () => ({
  api: {
    chatWithKnowledge: vi.fn(),
  },
}));

describe('KnowledgeChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el saludo inicial con el nombre del cliente y sugerencias', () => {
    render(
      <KnowledgeChatPanel
        clientId="c1"
        clientName="Acero Tech"
        documents={[{ id: 'd1' } as any]}
      />
    );

    expect(screen.getByText(/Chat con la Base/i)).toBeInTheDocument();
    expect(screen.getByText(/1 docs activos/i)).toBeInTheDocument();
    expect(screen.getByText(/Soy el asistente de la base de conocimiento de/i)).toBeInTheDocument();
    expect(screen.getByText(/¿De qué temas pide no hablar el cliente\?/i)).toBeInTheDocument();
  });

  it('envía una pregunta, muestra la respuesta de la IA y cita las fuentes', async () => {
    const user = userEvent.setup();
    const mockOnOpen = vi.fn();

    vi.mocked(api.chatWithKnowledge).mockResolvedValue({
      data: {
        response: 'El cliente pidió enfocarse en clientes corporativos.',
        citedSources: [
          { id: 'd1', title: 'Call de planning Q4', type: 'REUNION', date: new Date().toISOString() },
        ],
      },
    } as any);

    render(
      <KnowledgeChatPanel
        clientId="c1"
        clientName="Acero Tech"
        onOpenDocumentDetail={mockOnOpen}
      />
    );

    const textarea = screen.getByPlaceholderText(/Preguntale algo a la base de Acero Tech/i);
    await user.type(textarea, '¿Cuál fue el acuerdo de la última reunión?{enter}');

    await waitFor(() => {
      expect(screen.getByText('El cliente pidió enfocarse en clientes corporativos.')).toBeInTheDocument();
    });

    const sourceBadge = screen.getByText('Call de planning Q4');
    expect(sourceBadge).toBeInTheDocument();

    await user.click(sourceBadge);
    expect(mockOnOpen).toHaveBeenCalledWith('d1');
  });

  it('envía pregunta rápida al hacer click en una sugerencia', async () => {
    const user = userEvent.setup();

    vi.mocked(api.chatWithKnowledge).mockResolvedValue({
      data: {
        response: 'No hablar de precios ni criptomonedas.',
        citedSources: [],
      },
    } as any);

    render(
      <KnowledgeChatPanel
        clientId="c1"
        clientName="Acero Tech"
      />
    );

    const quickBtn = screen.getByText(/• ¿De qué temas pide no hablar el cliente\?/i);
    await user.click(quickBtn);

    await waitFor(() => {
      expect(api.chatWithKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          question: '¿De qué temas pide no hablar el cliente?',
        })
      );
    });
  });
});
