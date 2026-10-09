import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketPublishLinks } from '../TicketPublishLinks';

describe('TicketPublishLinks', () => {
  it('renderiza la lista de links existentes correctamente', () => {
    const rawLinks = JSON.stringify(['https://instagram.com/p/123', 'https://linkedin.com/feed/456']);
    const onChange = vi.fn();

    render(<TicketPublishLinks value={rawLinks} onChange={onChange} />);

    expect(screen.getByText('https://instagram.com/p/123')).toBeInTheDocument();
    expect(screen.getByText('https://linkedin.com/feed/456')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('permite agregar un nuevo link presionando Enter y emite onChange con URL serializada', async () => {
    const onChange = vi.fn();
    render(<TicketPublishLinks value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/pegá un link a la publicación/i);
    await userEvent.type(input, 'twitter.com/post/999{enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    const emitted = onChange.mock.calls[0][0];
    expect(emitted).toContain('https://twitter.com/post/999');
  });

  it('permite agregar un nuevo link usando el botón Agregar', async () => {
    const onChange = vi.fn();
    render(<TicketPublishLinks value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/pegá un link a la publicación/i);
    await userEvent.type(input, 'https://youtube.com/watch?v=1');

    const addBtn = screen.getByRole('button', { name: /agregar/i });
    await userEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledWith('https://youtube.com/watch?v=1');
  });

  it('permite eliminar un link de la lista', async () => {
    const rawLinks = 'https://instagram.com/p/1\nhttps://instagram.com/p/2';
    const onChange = vi.fn();

    render(<TicketPublishLinks value={rawLinks} onChange={onChange} />);

    const deleteButtons = screen.getAllByTitle(/eliminar link/i);
    expect(deleteButtons).toHaveLength(2);

    await userEvent.click(deleteButtons[0]);

    expect(onChange).toHaveBeenCalledWith('https://instagram.com/p/2');
  });

  it('guarda automáticamente el link al hacer blur del input', async () => {
    const onChange = vi.fn();
    render(<TicketPublishLinks value="" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/pegá un link a la publicación/i);
    await userEvent.type(input, 'linkedin.com/posts/auto-save');
    await userEvent.tab(); // trigger blur

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('https://linkedin.com/posts/auto-save');
  });

  it('procesa y agrega múltiples links pegados separados por saltos de línea', async () => {
    const onChange = vi.fn();
    render(<TicketPublishLinks value="https://existente.com/post" onChange={onChange} />);

    const input = screen.getByPlaceholderText(/pegá un link a la publicación/i);
    await userEvent.type(input, 'linkedin.com/p/1{enter}');

    expect(onChange).toHaveBeenCalledWith('https://existente.com/post\nhttps://linkedin.com/p/1');
  });

  it('respeta el estado disabled ocultando inputs y botones de eliminación', () => {
    const rawLinks = JSON.stringify(['https://instagram.com/p/1']);
    render(<TicketPublishLinks value={rawLinks} onChange={vi.fn()} disabled />);

    expect(screen.queryByPlaceholderText(/pegá un link a la publicación/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/eliminar link/i)).not.toBeInTheDocument();
    expect(screen.getByText('https://instagram.com/p/1')).toBeInTheDocument();
  });
});
