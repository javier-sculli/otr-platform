import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KnowledgeBasePage } from '../KnowledgeBasePage';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    getClients: vi.fn(),
    getSpeakers: vi.fn(),
    getKnowledgeDocuments: vi.fn(),
    createKnowledgeDocument: vi.fn(),
    updateKnowledgeDocument: vi.fn(),
    deleteKnowledgeDocument: vi.fn(),
    analyzeKnowledgeContent: vi.fn(),
    chatWithKnowledge: vi.fn(),
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Tester', role: 'CONTENIDISTA' },
  }),
}));

const mockClients = [
  { id: 'c1', name: 'Acero Tech', active: true },
  { id: 'c2', name: 'Tiendanube', active: true },
];

const mockDocs = [
  {
    id: 'd1',
    clientId: 'c1',
    title: 'Weekly Planning Q4',
    type: 'REUNION',
    tags: ['planning', 'q4'],
    content: 'Acordamos foco en clientes corporativos y no usar modismos.',
    summary: 'Foco corporativo y tono sobrio.',
    date: new Date('2026-10-20').toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'd2',
    clientId: 'c1',
    title: 'Directiva de Tono en LinkedIn',
    type: 'FEEDBACK',
    tags: ['linkedin', 'tono'],
    content: 'No usar emojis en la primera línea nunca.',
    summary: 'Sin emojis al inicio.',
    date: new Date('2026-10-25').toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('KnowledgeBasePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getClients).mockResolvedValue({ data: mockClients } as any);
    vi.mocked(api.getSpeakers).mockResolvedValue({ data: [] } as any);
    vi.mocked(api.getKnowledgeDocuments).mockResolvedValue({ data: mockDocs } as any);
  });

  it('renderiza la cabecera, selector de clientes y botón de carga', async () => {
    renderWithClient(<KnowledgeBasePage />);

    expect(screen.getByText(/Knowledge Base & Cerebro/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Cargar Documento/i })).toBeInTheDocument();
    });
  });

  it('lista los documentos del cliente activo con sus badges y resúmenes', async () => {
    renderWithClient(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Weekly Planning Q4')).toBeInTheDocument();
      expect(screen.getByText('Directiva de Tono en LinkedIn')).toBeInTheDocument();
    });

    expect(screen.getByText('REUNION')).toBeInTheDocument();
    expect(screen.getByText('FEEDBACK')).toBeInTheDocument();
  });

  it('filtra por tipo al hacer click en una pill de categoría', async () => {
    const user = userEvent.setup();
    renderWithClient(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Feedbacks')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Feedbacks'));

    await waitFor(() => {
      expect(api.getKnowledgeDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'FEEDBACK' })
      );
    });
  });

  it('abre el drawer de detalle al hacer click en una tarjeta de documento', async () => {
    const user = userEvent.setup();
    renderWithClient(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByText('Weekly Planning Q4')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Weekly Planning Q4'));

    await waitFor(() => {
      expect(screen.getByText('Contenido Completo')).toBeInTheDocument();
      expect(screen.getByText('Acordamos foco en clientes corporativos y no usar modismos.')).toBeInTheDocument();
    });
  });

  it('abre el modal de carga al presionar + Cargar Documento', async () => {
    const user = userEvent.setup();
    renderWithClient(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Cargar Documento/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /\+ Cargar Documento/i }));

    await waitFor(() => {
      expect(screen.getByText('Cargar Documento de Conocimiento')).toBeInTheDocument();
      expect(screen.getByText(/Auto-completar campos con IA/i)).toBeInTheDocument();
    });
  });
});
