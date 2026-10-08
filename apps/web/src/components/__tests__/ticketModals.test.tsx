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
    createTicket: vi.fn(),
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

  it('al hacer clic en Duplicar crea un nuevo ticket independiente vía api.createTicket', async () => {
    const mockTicket = {
      id: 'ticket-orig-1',
      title: 'posteo Lanzamiento Kombucha',
      status: 'EN_PROCESO',
      prioridad: 'MEDIA',
      clientId: 'client-1',
      ownerId: 'user-1',
      assigneeIds: ['user-1'],
      canales: ['LinkedIn'],
      tiposContenido: ['Post'],
      objetivo: 'Contando beneficios',
      contentPerCanal: { LinkedIn: 'Texto del post' },
      links: [],
    };

    (api.getTicket as any).mockResolvedValue({
      data: mockTicket,
    });
    (api.createTicket as any).mockResolvedValue({
      data: { ...mockTicket, id: 'ticket-copy-2', title: 'Copia de posteo Lanzamiento Kombucha', status: 'PENDIENTE' },
    });

    const onClose = vi.fn();

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={onClose}
        ticket={mockTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    const dupButton = await screen.findByRole('button', { name: /duplicar/i });
    fireEvent.click(dupButton);

    await waitFor(() => {
      expect(api.createTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Copia de posteo Lanzamiento Kombucha',
          status: 'PENDIENTE',
          clientId: 'client-1',
          contentPerCanal: { LinkedIn: 'Texto del post' },
        })
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('en PENDIENTE, el copy aparece antes que las notas de diseño y las notas son colapsables', async () => {
    const mockTicket = {
      id: 'ticket-pendiente-1',
      title: 'Pieza en pendiente',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'PENDIENTE',
      prioridad: 'MEDIA',
      canales: ['LinkedIn'],
      tiposContenido: ['Post'],
      notasAudiovisual: 'Notas para cuando pase a diseño',
      contentPerCanal: { LinkedIn: 'Borrador de copy' },
    };

    (api.getTicket as any).mockResolvedValue({
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

    // Esperar a que cargue el ticket
    await waitFor(() => {
      expect(screen.getByText('Borrador de copy')).toBeInTheDocument();
    });

    // Encontrar elemento Copy y botón colapsable de Notas de diseño
    const copyLabel = screen.getByText('Copy');
    const notasBtn = screen.getByRole('button', { name: /notas de diseño/i });

    expect(copyLabel).toBeInTheDocument();
    expect(notasBtn).toBeInTheDocument();

    // Validar orden: Copy aparece antes que Notas de diseño
    expect(copyLabel.compareDocumentPosition(notasBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Validar que en PENDIENTE las notas son colapsables: muestran "Ver notas" y no el editor completo
    expect(screen.getByText('Ver notas')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/placa estilo «en medios»/i)).not.toBeInTheDocument();

    // Al hacer clic en "Ver notas", se expanden
    fireEvent.click(notasBtn);
    expect(screen.getByText('Ocultar')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/placa estilo «en medios»/i)).toBeInTheDocument();
  });

  it('en REDACCION, el copy aparece antes que las notas de diseño y las notas aparecen abiertas directamente', async () => {
    const mockTicket = {
      id: 'ticket-redaccion-1',
      title: 'Pieza en redacción',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'REDACCION',
      prioridad: 'MEDIA',
      canales: ['LinkedIn'],
      tiposContenido: ['Post'],
      notasAudiovisual: 'Notas para cuando pase a diseño',
      contentPerCanal: { LinkedIn: 'Borrador de copy' },
    };

    (api.getTicket as any).mockResolvedValue({
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

    // Esperar a que cargue el ticket
    await waitFor(() => {
      expect(screen.getByText('Borrador de copy')).toBeInTheDocument();
    });

    // Encontrar elemento Copy y editor de Notas de diseño
    const copyLabel = screen.getByText('Copy');
    const notasEditor = screen.getByPlaceholderText(/placa estilo «en medios»/i);

    expect(copyLabel).toBeInTheDocument();
    expect(notasEditor).toBeInTheDocument();

    // Validar orden: Copy aparece antes que Notas de diseño
    expect(copyLabel.compareDocumentPosition(notasEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Validar que en REDACCION las notas aparecen abiertas directamente (no colapsadas)
    expect(screen.queryByText('Ver notas')).not.toBeInTheDocument();
  });

  it('en DISENO, las notas de diseño aparecen antes que el copy y están abiertas', async () => {
    const mockTicket = {
      id: 'ticket-diseno-1',
      title: 'Pieza en diseño',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'DISENO',
      prioridad: 'MEDIA',
      canales: ['LinkedIn'],
      tiposContenido: ['Post'],
      notasAudiovisual: 'Notas para el diseñador',
      contentPerCanal: { LinkedIn: 'Copy ya terminado' },
    };

    (api.getTicket as any).mockResolvedValue({
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

    // Esperar a que cargue el ticket
    await waitFor(() => {
      expect(screen.getByText('Copy ya terminado')).toBeInTheDocument();
    });

    // Encontrar elementos
    const copySection = screen.getByRole('button', { name: /copy/i });
    const notasEditor = screen.getByPlaceholderText(/placa estilo «en medios»/i);

    expect(copySection).toBeInTheDocument();
    expect(notasEditor).toBeInTheDocument();

    // Validar orden: Notas de diseño aparece antes que Copy
    expect(notasEditor.compareDocumentPosition(copySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('en EDICION, las notas de diseño aparecen antes que el copy', async () => {
    const mockTicket = {
      id: 'ticket-edicion-1',
      title: 'Pieza en edición',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'EDICION',
      prioridad: 'MEDIA',
      canales: ['LinkedIn'],
      tiposContenido: ['Post'],
      notasAudiovisual: 'Notas para la edición',
      contentPerCanal: { LinkedIn: 'Copy aprobado' },
    };

    (api.getTicket as any).mockResolvedValue({
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

    await waitFor(() => {
      expect(screen.getByText('Copy aprobado')).toBeInTheDocument();
    });

    const copySection = screen.getByRole('button', { name: /copy/i });
    const notasEditor = screen.getByPlaceholderText(/placa estilo «en medios»/i);

    expect(copySection).toBeInTheDocument();
    expect(notasEditor).toBeInTheDocument();

    // En EDICION las notas de diseño van antes que Copy
    expect(notasEditor.compareDocumentPosition(copySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('en estados posteriores como REVISION_INTERNA, las notas de diseño quedan siempre abajo del copy', async () => {
    const mockTicket = {
      id: 'ticket-rev-1',
      title: 'Pieza en revisión interna',
      client: { id: 'c1', name: 'Cliente 1' },
      owner: { id: 'user-1', name: 'Tester' },
      status: 'REVISION_INTERNA',
      prioridad: 'MEDIA',
      canales: ['LinkedIn'],
      tiposContenido: ['Post'],
      notasAudiovisual: 'Notas de diseño finales',
      contentPerCanal: { LinkedIn: 'Copy listo para revisión' },
    };

    (api.getTicket as any).mockResolvedValue({
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

    await waitFor(() => {
      expect(screen.getByText('Copy listo para revisión')).toBeInTheDocument();
    });

    const copySection = screen.getByRole('button', { name: /copy/i });
    const notasBtn = screen.getByRole('button', { name: /notas de diseño/i });

    expect(copySection).toBeInTheDocument();
    expect(notasBtn).toBeInTheDocument();

    // Fuera de Diseño/Edición, el copy va primero y las notas de diseño abajo
    expect(copySection.compareDocumentPosition(notasBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('monta sin errores en modo edición con campos nulos y renderiza Link a la Publicación en estados finales', async () => {
    const minimalTicket = {
      id: 'ticket-modal-min',
      title: 'Ticket Modal Mínimo',
      status: 'LISTO_PARA_PUBLICAR',
      canales: null,
      links: null,
      linkPublicacion: 'https://twitter.com/status/12345',
      linkEntregable: null,
      contentPerCanal: null,
      notasAudiovisual: null,
      objetivo: null,
      client: { id: 'c1', name: 'Cliente X' },
      owner: null,
      prioridad: 'ALTA',
    };

    (api.getTicket as any).mockResolvedValue({
      data: minimalTicket,
    });

    render(
      <CreateTicketModal
        isOpen={true}
        onClose={vi.fn()}
        ticket={minimalTicket as any}
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Ticket Modal Mínimo')).toBeInTheDocument();
      expect(screen.getByText('Link a la Publicación')).toBeInTheDocument();
      expect(screen.getByText('https://twitter.com/status/12345')).toBeInTheDocument();
    });
  });
});


