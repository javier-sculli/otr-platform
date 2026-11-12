import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { CreateTicketModal } from '../CreateTicketModal';
import { ToastContainer } from '../ToastContainer';
import { clearAllToasts, notifyApiSaveError } from '../../lib/toast';
import { api } from '../../lib/api';

vi.mock('../../lib/imageCompression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/imageCompression')>();
  return {
    ...actual,
    compressImageFile: vi.fn().mockImplementation((file: File) =>
      Promise.resolve(`data:image/jpeg;base64,mock_${file.name}`)
    ),
  };
});

vi.mock('../../lib/api', () => ({
  api: {
    getTicket: vi.fn(),
    updateTicket: vi.fn(),
    createTicket: vi.fn(),
    createComment: vi.fn(),
    deleteComment: vi.fn(),
    uploadAttachment: vi.fn(),
    getClients: vi.fn().mockResolvedValue({ data: [{ id: 'client-1', name: 'Icona' }] }),
    getUsers: vi.fn().mockResolvedValue({ data: [{ id: 'user-1', name: 'Paloma Ascurdía' }] }),
    getTicketTypes: vi.fn().mockResolvedValue({
      data: [{ id: 'type-1', name: 'Carrusel', kind: 'CONTENIDO' }],
    }),
    getPilares: vi.fn().mockResolvedValue({ data: [] }),
    getSpeakers: vi.fn().mockResolvedValue({ data: [] }),
    getComments: vi.fn().mockResolvedValue({ data: [] }),
  },
  resolveAttachmentUrl: (url: string) => url,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: 'Paloma Ascurdía',
      email: 'pa@ontherocks.tech',
      role: 'CONTENIDISTA',
      preferredClientIds: [],
    },
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {children}
        <ToastContainer />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Auto-envío de comentarios/imágenes al crear o cerrar ticket y Toasts de error', () => {
  const existingTicket: any = {
    id: '0bce4a95-9024-4b9d-9a72-a63442b2f993',
    title: 'Carrusel León Papa',
    tipoTicket: 'CONTENIDO',
    status: 'DISENO',
    prioridad: 'ALTA',
    clientId: 'client-1',
    ownerId: 'user-1',
    assigneeIds: ['user-1'],
    objetivo: '',
    links: [],
    canales: ['Instagram'],
    tiposContenido: ['Carrusel'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearAllToasts();
    sessionStorage.clear();
    vi.mocked(api.getTicket).mockResolvedValue({ data: existingTicket });
    vi.mocked(api.updateTicket).mockResolvedValue({ data: existingTicket });
    vi.mocked(api.createComment).mockResolvedValue({
      data: { id: 'cm-1', content: 'ok' },
    });
    vi.mocked(api.uploadAttachment).mockImplementation(async (_ticketId: string, file: File) => ({
      data: {
        id: `att-${file.name}`,
        url: `/tickets/attachments/att-${file.name}`,
        fileName: file.name,
        mimeType: file.type || 'image/png',
        size: file.size || 1000,
      },
    }));
  });

  it('envía automáticamente el comentario y las imágenes adjuntas al cerrar el modal aunque el usuario no toque "Comentar"', async () => {
    const handleClose = vi.fn();

    render(
      <CreateTicketModal
        isOpen={true}
        ticket={existingTicket}
        onClose={handleClose}
      />,
      { wrapper: createWrapper() }
    );

    const textarea = await screen.findByPlaceholderText(/Escribí un comentario/i);
    await userEvent.type(textarea, 'Adjunto placas para diseño');

    const imgFile = new File(['placa-data'], 'carrusel_placa_01.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('comment-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [imgFile] } });

    await waitFor(() => {
      expect(screen.getAllByAltText('Vista previa de imagen')).toHaveLength(1);
    });

    // El usuario cierra el modal directamente sin apretar "Comentar"
    const closeBtn = screen.getByTitle('Cerrar (Esc)');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(api.createComment).toHaveBeenCalledTimes(1);
    });

    expect(api.createComment).toHaveBeenCalledWith(
      existingTicket.id,
      expect.stringContaining('Adjunto placas para diseño')
    );
    expect(api.createComment).toHaveBeenCalledWith(
      existingTicket.id,
      expect.stringContaining('![imagen](/tickets/attachments/att-carrusel_placa_01.png)')
    );

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('al crear un ticket nuevo ("Crear ticket"), sube las imágenes pendientes y publica el comentario antes de cerrar', async () => {
    const handleClose = vi.fn();
    vi.mocked(api.createTicket).mockResolvedValue({
      data: { ...existingTicket, id: 'new-ticket-123' },
    });

    render(
      <CreateTicketModal
        isOpen={true}
        ticket={null}
        defaultClientId="client-1"
        onClose={handleClose}
      />,
      { wrapper: createWrapper() }
    );

    // Completar título, formato y responsable
    const titleInput = await screen.findByPlaceholderText(/Nombre de la pieza/i);
    await userEvent.type(titleInput, 'Carrusel León Papa');

    const formatPickerBtn = screen.getByRole('button', { name: 'Formato' });
    await userEvent.click(formatPickerBtn);
    const carruselOpt = await screen.findByText('Carrusel');
    await userEvent.click(carruselOpt);

    const addOwnerBtn = screen.getByRole('button', { name: /\+ Agregar/i });
    await userEvent.click(addOwnerBtn);
    const ownerBtn = await screen.findByText('Paloma Ascurdía');
    await userEvent.click(ownerBtn);

    // Escribir comentario y adjuntar 2 imágenes sin apretar "Comentar"
    const commentBox = screen.getByPlaceholderText(/Escribí un comentario/i);
    await userEvent.type(commentBox, 'Vuelvo a adjuntar');

    const img1 = new File(['p1'], 'placa_01.png', { type: 'image/png' });
    const img2 = new File(['p2'], 'placa_02.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('comment-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [img1, img2] } });

    await waitFor(() => {
      expect(screen.getAllByAltText('Vista previa de imagen')).toHaveLength(2);
    });

    // Tocar directamente el botón principal "Crear ticket"
    const createBtn = screen.getByRole('button', { name: /Crear ticket/i });
    await userEvent.click(createBtn);

    await waitFor(() => {
      expect(api.createTicket).toHaveBeenCalledTimes(1);
      expect(api.uploadAttachment).toHaveBeenCalledTimes(2);
      expect(api.createComment).toHaveBeenCalledTimes(1);
    });

    expect(api.createComment).toHaveBeenCalledWith(
      'new-ticket-123',
      expect.stringContaining('Vuelvo a adjuntar')
    );
    expect(api.createComment).toHaveBeenCalledWith(
      'new-ticket-123',
      expect.stringContaining('![imagen](/tickets/attachments/att-placa_01.png)')
    );
    expect(api.createComment).toHaveBeenCalledWith(
      'new-ticket-123',
      expect.stringContaining('![imagen](/tickets/attachments/att-placa_02.png)')
    );

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('si falla el endpoint de comentarios al cerrar, muestra un Toast de error y NO cierra el modal ni pierde las imágenes', async () => {
    const handleClose = vi.fn();
    vi.mocked(api.createComment).mockRejectedValue(new Error('Error 500: Timeout en base de datos'));

    render(
      <CreateTicketModal
        isOpen={true}
        ticket={existingTicket}
        onClose={handleClose}
      />,
      { wrapper: createWrapper() }
    );

    const textarea = await screen.findByPlaceholderText(/Escribí un comentario/i);
    await userEvent.type(textarea, 'Comentario importante que no debe perderse');

    const closeBtn = screen.getByTitle('Cerrar (Esc)');
    fireEvent.click(closeBtn);

    // Debe aparecer el Toast global de error
    const toast = await screen.findByTestId('global-toast');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('No se pudo guardar el comentario');
    expect(toast).toHaveTextContent('Error 500: Timeout en base de datos');

    // NO debe cerrarse el modal y el texto sigue en el input para reintentar
    expect(handleClose).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('Comentario importante que no debe perderse');
  });

  it('muestra Toast de error cuando falla cualquier endpoint de guardado (PATCH /tickets, POST /attachments, etc.)', async () => {
    render(<ToastContainer />);

    notifyApiSaveError('/tickets/0bce4a95/attachments', 'POST', 'Archivo corrupto o límite excedido');

    const toast = await screen.findByTestId('global-toast');
    expect(toast).toHaveTextContent('No se pudo subir el archivo adjunto');
    expect(toast).toHaveTextContent('Archivo corrupto o límite excedido');
  });
});
