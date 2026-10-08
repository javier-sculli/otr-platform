import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCommentsThread, TicketCommentItem } from '../TicketCommentsThread';

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
    vi.restoreAllMocks();
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
});
