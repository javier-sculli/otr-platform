import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineCommentPopover } from '../InlineCommentPopover';

describe('InlineCommentPopover', () => {
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
});
