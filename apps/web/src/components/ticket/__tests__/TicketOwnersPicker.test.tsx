import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketOwnersPicker } from '../TicketOwnersPicker';

const mockUsers = [
  { id: 'u1', name: 'Ana Garcia', email: 'ana@example.com' },
  { id: 'u2', name: 'Carlos Mendez', email: 'carlos@example.com' },
  { id: 'u3', name: 'Beatriz Gomez', email: 'beatriz@example.com' },
];

describe('TicketOwnersPicker', () => {
  it('renderiza la lista de asignados con sus iniciales y nombre', () => {
    render(
      <TicketOwnersPicker
        assigneeIds={['u1', 'u2']}
        users={mockUsers}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByTestId('owner-pill-u1')).toBeInTheDocument();
    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
    expect(screen.getByText('AG')).toBeInTheDocument();

    expect(screen.getByTestId('owner-pill-u2')).toBeInTheDocument();
    expect(screen.getByText('Carlos Mendez')).toBeInTheDocument();
    expect(screen.getByText('CM')).toBeInTheDocument();
  });

  it('muestra "Sin asignar" cuando la lista está vacía', () => {
    render(
      <TicketOwnersPicker
        assigneeIds={[]}
        users={mockUsers}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('abre el dropdown al presionar "+ Agregar" y filtra candidatos', async () => {
    const user = userEvent.setup();
    render(
      <TicketOwnersPicker
        assigneeIds={['u1']}
        users={mockUsers}
        onChange={vi.fn()}
      />
    );

    const addBtn = screen.getByRole('button', { name: /\+ agregar/i });
    await user.click(addBtn);

    expect(screen.getByTestId('owners-dropdown')).toBeInTheDocument();
    // u1 is already assigned, so only u2 and u3 should appear
    expect(screen.queryByTestId('candidate-user-u1')).not.toBeInTheDocument();
    expect(screen.getByTestId('candidate-user-u2')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-user-u3')).toBeInTheDocument();

    // Filter with search input
    const input = screen.getByPlaceholderText(/buscar persona/i);
    await user.type(input, 'beatriz');

    expect(screen.queryByTestId('candidate-user-u2')).not.toBeInTheDocument();
    expect(screen.getByTestId('candidate-user-u3')).toBeInTheDocument();
  });

  it('agrega un usuario al hacer click en el candidato y llama onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TicketOwnersPicker
        assigneeIds={['u1']}
        users={mockUsers}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /\+ agregar/i }));
    await user.click(screen.getByTestId('candidate-user-u2'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['u1', 'u2']);
    expect(screen.queryByTestId('owners-dropdown')).not.toBeInTheDocument();
  });

  it('soporta navegación con teclado (ArrowDown y Enter)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TicketOwnersPicker
        assigneeIds={[]}
        users={mockUsers}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /\+ agregar/i }));
    const input = screen.getByPlaceholderText(/buscar persona/i);

    // Initial selected index is 0 (Ana Garcia). Press ArrowDown to select Carlos Mendez (index 1).
    await user.type(input, '{arrowdown}{enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['u2']);
  });

  it('permite quitar un responsable con el botón de cruz', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TicketOwnersPicker
        assigneeIds={['u1', 'u2']}
        users={mockUsers}
        onChange={onChange}
      />
    );

    const removeBtn = screen.getByRole('button', { name: /quitar a ana garcia/i });
    await user.click(removeBtn);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['u2']);
  });

  it('en modo disabled no muestra el botón de agregar ni los botones de remover', () => {
    render(
      <TicketOwnersPicker
        assigneeIds={['u1']}
        users={mockUsers}
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.queryByRole('button', { name: /\+ agregar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar a ana garcia/i })).not.toBeInTheDocument();
    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
  });
});
