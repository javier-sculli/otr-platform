import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineCommentPopover } from '../InlineCommentPopover';

describe('InlineCommentPopover', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });
  it('no renderiza nada cuando pop es null', () => {
    const { container } = render(
      <InlineCommentPopover pop={null} onSend={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderiza la cita del hilo y el textarea', () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const thread = { quote: 'Texto seleccionado', items: [] };

    render(
      <InlineCommentPopover
        pop={pop}
        thread={thread}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('«Texto seleccionado»')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/escribí un comentario/i)).toBeInTheDocument();
  });

  it('permite escribir y enviar comentario con el botón Enviar', async () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const onSend = vi.fn();

    render(
      <InlineCommentPopover
        pop={pop}
        thread={{ quote: 'Quote', items: [] }}
        onSend={onSend}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/escribí un comentario/i);
    await userEvent.type(textarea, 'Excelente propuesta');

    const sendBtn = screen.getByRole('button', { name: /comentar/i });
    expect(sendBtn).not.toBeDisabled();
    await userEvent.click(sendBtn);

    expect(onSend).toHaveBeenCalledWith('Excelente propuesta');
  });

  it('permite enviar comentario con Enter', async () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const onSend = vi.fn();

    render(
      <InlineCommentPopover
        pop={pop}
        thread={{ quote: 'Quote', items: [] }}
        onSend={onSend}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/escribí un comentario/i);
    await userEvent.type(textarea, 'Revisar ortografía{enter}');

    expect(onSend).toHaveBeenCalledWith('Revisar ortografía');
  });

  it('permite resolver el comentario si hay items previos en el hilo', async () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const onResolve = vi.fn();
    const thread = {
      quote: 'Texto con comentario',
      items: [{ author: 'Pedro', text: 'Hay un error acá', when: '10:00' }],
    };

    render(
      <InlineCommentPopover
        pop={pop}
        thread={thread}
        onSend={vi.fn()}
        onResolve={onResolve}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Hay un error acá')).toBeInTheDocument();
    const resolveBtn = screen.getByRole('button', { name: /resolver/i });
    await userEvent.click(resolveBtn);

    expect(onResolve).toHaveBeenCalledTimes(1);
  });

  it('cierra el popover al hacer clic en Cancelar o presionar Escape', async () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const onClose = vi.fn();

    render(
      <InlineCommentPopover
        pop={pop}
        thread={{ quote: 'Quote', items: [] }}
        onSend={vi.fn()}
        onClose={onClose}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    await userEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const textarea = screen.getByPlaceholderText(/escribí un comentario/i);
    await userEvent.type(textarea, '{escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('permite arrobar a un usuario haciendo click en la lista desplegada hacia abajo sin cerrar el popover', async () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const onClose = vi.fn();
    const users = [{ id: 'u1', name: 'Javier Sculli', email: 'javier@otr.com' }];

    render(
      <InlineCommentPopover
        pop={pop}
        users={users}
        onSend={vi.fn()}
        onClose={onClose}
      />
    );

    const textarea = screen.getByPlaceholderText(/escribí un comentario/i);
    await userEvent.type(textarea, '@Jav');

    const userOption = screen.getByText('Javier Sculli');
    expect(userOption).toBeInTheDocument();

    await userEvent.click(userOption);

    expect(onClose).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('@Javier Sculli ');
  });

  it('guarda el borrador en sessionStorage y lo restaura al volver a abrir el popover', () => {
    sessionStorage.setItem('otr_draft_inline_c1', 'Comentario pendiente restaurado');
    const pop = { id: 'c1', x: 100, y: 150 };

    render(
      <InlineCommentPopover
        pop={pop}
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(/escribí un comentario/i);
    expect(textarea).toHaveValue('Comentario pendiente restaurado');

    fireEvent.change(textarea, { target: { value: 'Comentario modificado' } });
    expect(sessionStorage.getItem('otr_draft_inline_c1')).toBe('Comentario modificado');
  });

  it('mantiene el texto y muestra Reintentar cuando onSend falla', async () => {
    const pop = { id: 'c1', x: 100, y: 150 };
    const onSend = vi.fn().mockRejectedValue(new Error('Fallo en el servidor'));
    const onClose = vi.fn();

    render(
      <InlineCommentPopover
        pop={pop}
        onSend={onSend}
        onClose={onClose}
      />
    );

    const textarea = screen.getByPlaceholderText(/escribí un comentario/i);
    fireEvent.change(textarea, { target: { value: 'Texto valioso que no se debe borrar' } });

    const sendBtn = screen.getByRole('button', { name: /comentar/i });
    fireEvent.click(sendBtn);

    const errorMsg = await screen.findByText('Fallo en el servidor');
    expect(errorMsg).toBeInTheDocument();
    expect(textarea).toHaveValue('Texto valioso que no se debe borrar');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });

  it('permite adjuntar un archivo PDF y enviarlo junto con o sin texto', async () => {
    const pop = { id: 'c-attach', x: 100, y: 150 };
    const onSend = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <InlineCommentPopover
        pop={pop}
        onSend={onSend}
        onClose={onClose}
      />
    );

    const attachInput = screen.getByTestId('inline-comment-attachment-input');
    const fakePdf = new File(['mock content'], 'brief_referencia.pdf', { type: 'application/pdf' });

    fireEvent.change(attachInput, { target: { files: [fakePdf] } });

    // Se muestra el chip de previsualización del archivo
    await screen.findByText('brief_referencia.pdf');

    // Botón de comentar habilitado incluso sin texto
    const sendBtn = screen.getByRole('button', { name: /comentar/i });
    expect(sendBtn).not.toBeDisabled();

    fireEvent.click(sendBtn);

    await vi.waitFor(() => {
      expect(onSend).toHaveBeenCalledWith(
        expect.stringContaining('[📎 brief_referencia.pdf](data:application/pdf')
      );
    });
  });
});
