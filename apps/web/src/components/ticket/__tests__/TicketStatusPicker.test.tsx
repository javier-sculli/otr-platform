import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketStatusPicker } from '../TicketStatusPicker';

const mockOptions = [
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'REDACCION', label: 'Redacción' },
  { value: 'DISENO', label: 'Diseño' },
  { value: 'PUBLICADO', label: 'Publicado' },
];

describe('TicketStatusPicker', () => {
  it('renderiza el botón primario con el label de próximo estado y llama onAdvance al hacer click', async () => {
    const onAdvance = vi.fn();
    const user = userEvent.setup();

    render(
      <TicketStatusPicker
        currentStatus="PENDIENTE"
        nextStatusLabel="Redacción"
        nextStatusValue="REDACCION"
        options={mockOptions}
        onAdvance={onAdvance}
        onSelectStatus={vi.fn()}
      />
    );

    const advanceBtn = screen.getByTestId('advance-status-btn');
    expect(advanceBtn).toHaveTextContent('Pasar a Redacción');

    await user.click(advanceBtn);
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it('permite customizar el label primario y muestra el atajo si está presente', () => {
    render(
      <TicketStatusPicker
        currentStatus="PENDIENTE"
        nextStatusLabel="Redacción"
        options={mockOptions}
        onAdvance={vi.fn()}
        onSelectStatus={vi.fn()}
        primaryLabel="Crear ticket"
        shortcutHint="⌘↵"
        showDropdown={false}
      />
    );

    expect(screen.getByText('Crear ticket')).toBeInTheDocument();
    expect(screen.getByText('⌘↵')).toBeInTheDocument();
    expect(screen.queryByTestId('status-dropdown-trigger')).not.toBeInTheDocument();
  });

  it('abre el menú de estados al hacer click en el chevron y emite onSelectStatus', async () => {
    const onSelectStatus = vi.fn();
    const user = userEvent.setup();

    render(
      <TicketStatusPicker
        currentStatus="PENDIENTE"
        nextStatusLabel="Redacción"
        nextStatusValue="REDACCION"
        options={mockOptions}
        onAdvance={vi.fn()}
        onSelectStatus={onSelectStatus}
      />
    );

    const trigger = screen.getByTestId('status-dropdown-trigger');
    await user.click(trigger);

    expect(screen.getByTestId('status-options-menu')).toBeInTheDocument();
    expect(screen.getByTestId('status-option-PENDIENTE')).toHaveTextContent(/actual/i);

    const disenoOption = screen.getByTestId('status-option-DISENO');
    await user.click(disenoOption);

    expect(onSelectStatus).toHaveBeenCalledWith('DISENO');
    expect(screen.queryByTestId('status-options-menu')).not.toBeInTheDocument();
  });

  it('soporta la variante page con su diseño correspondiente', async () => {
    const onSelectStatus = vi.fn();
    const user = userEvent.setup();

    render(
      <TicketStatusPicker
        variant="page"
        currentStatus="REDACCION"
        nextStatusLabel="Diseño"
        nextStatusValue="DISENO"
        options={mockOptions}
        onAdvance={vi.fn()}
        onSelectStatus={onSelectStatus}
      />
    );

    expect(screen.getByText('Pasar a Diseño')).toBeInTheDocument();
    await user.click(screen.getByTestId('status-dropdown-trigger'));
    expect(screen.getByTestId('status-options-menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('status-option-PUBLICADO'));
    expect(onSelectStatus).toHaveBeenCalledWith('PUBLICADO');
  });

  it('cierra el dropdown al presionar Escape', async () => {
    const user = userEvent.setup();

    render(
      <TicketStatusPicker
        currentStatus="PENDIENTE"
        nextStatusLabel="Redacción"
        options={mockOptions}
        onAdvance={vi.fn()}
        onSelectStatus={vi.fn()}
      />
    );

    await user.click(screen.getByTestId('status-dropdown-trigger'));
    expect(screen.getByTestId('status-options-menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('status-options-menu')).not.toBeInTheDocument();
  });

  it('respeta el estado de carga deshabilitando el botón primario', () => {
    render(
      <TicketStatusPicker
        currentStatus="PENDIENTE"
        nextStatusLabel="Redacción"
        options={mockOptions}
        onAdvance={vi.fn()}
        onSelectStatus={vi.fn()}
        isLoading
      />
    );

    expect(screen.getByTestId('advance-status-btn')).toBeDisabled();
  });

  it('respeta el estado disabled deshabilitando ambos botones', () => {
    render(
      <TicketStatusPicker
        currentStatus="PENDIENTE"
        nextStatusLabel="Redacción"
        options={mockOptions}
        onAdvance={vi.fn()}
        onSelectStatus={vi.fn()}
        disabled
      />
    );

    expect(screen.getByTestId('advance-status-btn')).toBeDisabled();
    expect(screen.getByTestId('status-dropdown-trigger')).toBeDisabled();
  });
});
