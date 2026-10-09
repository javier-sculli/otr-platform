import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCommentsThread, TicketCommentItem } from '../TicketCommentsThread';

vi.mock('../../../lib/imageCompression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/imageCompression')>();
  return {
    ...actual,
    compressImageFile: vi.fn().mockResolvedValue('data:image/png;base64,dummy'),
  };
});

describe('TicketCommentsThread', () => {
  const mockTeam = [
    { id: 'u1', name: 'Ana Garcia' },
    { id: 'u2', name: 'Carlos Gomez' },
  ];

  const mockComments: TicketCommentItem[] = [
    {
      id: 'c1',
      content: 'Primer comentario @[Ana Garcia](u1)',
      userId: 'u1',
      user: { id: 'u1', name: 'Ana Garcia' },
      createdAt: '2026-10-01T12:00:00Z',
    },
    {
      id: 'c2',
      content: '«fragmento del brief»: comentario sobre fragmento',
      userId: 'u2',
      user: { id: 'u2', name: 'Carlos Gomez' },
      createdAt: '2026-10-02T15:30:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la lista de comentarios con autores e iniciales', () => {
    render(
      <TicketCommentsThread
        comments={mockComments}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={vi.fn()}
      />
    );

    expect(screen.getByText('Comentarios')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
    expect(screen.getByText('Carlos Gomez')).toBeInTheDocument();
    expect(screen.getByText('AG')).toBeInTheDocument();
    expect(screen.getByText('CG')).toBeInTheDocument();
  });

  it('resalta las menciones con formato estilizado', () => {
    render(
      <TicketCommentsThread
        comments={mockComments}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={vi.fn()}
      />
    );

    const mention = screen.getByText('@Ana Garcia');
    expect(mention).toHaveClass('text-[#024fff]');
  });

  it('renderiza fragmento citado y dispara onLocateQuote al hacer click', () => {
    const onLocateQuote = vi.fn();
    render(
      <TicketCommentsThread
        comments={mockComments}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={vi.fn()}
        onLocateQuote={onLocateQuote}
      />
    );

    const quoteBtn = screen.getByText('«fragmento del brief»');
    expect(quoteBtn).toBeInTheDocument();
    fireEvent.click(quoteBtn);
    expect(onLocateQuote).toHaveBeenCalledWith('fragmento del brief');
  });

  it('muestra el botón de eliminar solo en comentarios propios y dispara confirmación', () => {
    const onDeleteComment = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TicketCommentsThread
        comments={mockComments}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={vi.fn()}
        onDeleteComment={onDeleteComment}
      />
    );

    // Ana (u1) solo puede borrar c1, no c2
    const deleteButtons = screen.getAllByRole('button', { name: /eliminar comentario/i });
    expect(deleteButtons).toHaveLength(1);

    fireEvent.click(deleteButtons[0]);
    expect(window.confirm).toHaveBeenCalled();
    expect(onDeleteComment).toHaveBeenCalledWith('c1');
  });

  it('permite escribir y enviar un comentario nuevo', async () => {
    const onAddComment = vi.fn();
    render(
      <TicketCommentsThread
        comments={mockComments}
        teamList={mockTeam}
        currentUserId="u1"
        currentUserName="Ana Garcia"
        onAddComment={onAddComment}
      />
    );

    const textarea = screen.getByPlaceholderText(/Escribí un comentario para el equipo/i);
    await userEvent.type(textarea, 'Nuevo comentario para el equipo');

    const submitBtn = screen.getByRole('button', { name: 'Comentar' });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(onAddComment).toHaveBeenCalledWith('Nuevo comentario para el equipo');
    expect(textarea).toHaveValue('');
  });

  it('renderiza variante page con mensaje vacío cuando no hay comentarios', () => {
    render(
      <TicketCommentsThread
        comments={[]}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={vi.fn()}
        variant="page"
        createdDate="2026-10-01T10:00:00Z"
      />
    );

    expect(
      screen.getByText(/Sin comentarios. Para comentar un fragmento del copy/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Creado el/i)).toBeInTheDocument();
  });

  it('renderiza imágenes embebidas en comentarios y abre el modal al hacer click', () => {
    const commentsWithImage: TicketCommentItem[] = [
      {
        id: 'c-img',
        content: 'Captura del problema:\n\n![imagen](data:image/jpeg;base64,mockImageData)',
        userId: 'u1',
        user: { id: 'u1', name: 'Ana Garcia' },
        createdAt: '2026-10-01T12:00:00Z',
      },
    ];

    render(
      <TicketCommentsThread
        comments={commentsWithImage}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={vi.fn()}
      />
    );

    expect(screen.getByText('Captura del problema:')).toBeInTheDocument();
    const img = screen.getByAltText('Imagen adjunta en comentario');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,mockImageData');

    // Click en la imagen para abrir modal visor
    fireEvent.click(img);
    expect(screen.getByTestId('comment-image-viewer-modal')).toBeInTheDocument();

    // Cerrar modal
    const closeBtn = screen.getByRole('button', { name: /cerrar imagen/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByTestId('comment-image-viewer-modal')).not.toBeInTheDocument();
  });

  it('permite adjuntar imagen y habilita el botón comentar sin necesidad de texto', async () => {
    const onAddComment = vi.fn();
    render(
      <TicketCommentsThread
        comments={[]}
        teamList={mockTeam}
        currentUserId="u1"
        onAddComment={onAddComment}
      />
    );

    // Enviar sin texto ni imagen está deshabilitado
    const submitBtn = screen.getByRole('button', { name: 'Comentar' });
    expect(submitBtn).toBeDisabled();

    // Simular selección de archivo de imagen
    const fileInput = screen.getByTestId('comment-file-input') as HTMLInputElement;
    const file = new File(['dummy-content'], 'screenshot.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    // La miniatura de la imagen aparece en el preview
    const previewContainer = await screen.findByTestId('pasted-images-preview');
    expect(previewContainer).toBeInTheDocument();
    expect(screen.getByAltText('Vista previa de imagen')).toBeInTheDocument();

    // El botón comentar se habilita aun sin texto
    expect(submitBtn).not.toBeDisabled();

    // Click en Comentar
    fireEvent.click(submitBtn);
    expect(onAddComment).toHaveBeenCalledWith('![imagen](data:image/png;base64,dummy)');
  });
});
