import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TicketFormatPicker } from '../TicketFormatPicker';

describe('TicketFormatPicker', () => {
  const availableFormats = ['Post', 'Carrusel', 'Reel', 'Historia'];

  it('muestra "Seleccionar…" cuando no hay formatos seleccionados', () => {
    render(
      <TicketFormatPicker
        selectedFormats={[]}
        availableFormats={availableFormats}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Seleccionar…')).toBeInTheDocument();
  });

  it('muestra los formatos seleccionados separados por comas', () => {
    render(
      <TicketFormatPicker
        selectedFormats={['Post', 'Reel']}
        availableFormats={availableFormats}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Post, Reel')).toBeInTheDocument();
  });

  it('abre el dropdown al hacer click en el botón principal', () => {
    render(
      <TicketFormatPicker
        selectedFormats={['Post']}
        availableFormats={availableFormats}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /Formato/i });
    fireEvent.click(trigger);

    expect(screen.getByTestId('format-dropdown-menu')).toBeInTheDocument();
    expect(screen.getByText('Elegí 1 o más')).toBeInTheDocument();
    expect(screen.getByLabelText('Carrusel')).toBeInTheDocument();
  });

  it('permite seleccionar un formato no marcado y dispara onChange con el nuevo array', () => {
    const onChange = vi.fn();
    render(
      <TicketFormatPicker
        selectedFormats={['Post']}
        availableFormats={availableFormats}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Formato/i }));

    const carruselCheckbox = screen.getByLabelText('Carrusel');
    expect(carruselCheckbox).not.toBeChecked();

    fireEvent.click(carruselCheckbox);
    expect(onChange).toHaveBeenCalledWith(['Post', 'Carrusel']);
  });

  it('permite deseleccionar un formato marcado y dispara onChange', () => {
    const onChange = vi.fn();
    render(
      <TicketFormatPicker
        selectedFormats={['Post', 'Reel']}
        availableFormats={availableFormats}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Formato/i }));

    const postCheckbox = screen.getByLabelText('Post');
    expect(postCheckbox).toBeChecked();

    fireEvent.click(postCheckbox);
    expect(onChange).toHaveBeenCalledWith(['Reel']);
  });

  it('cierra el dropdown al hacer click en "Listo"', () => {
    render(
      <TicketFormatPicker
        selectedFormats={['Post']}
        availableFormats={availableFormats}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Formato/i }));
    expect(screen.getByTestId('format-dropdown-menu')).toBeInTheDocument();

    const listoBtn = screen.getByRole('button', { name: 'Listo' });
    fireEvent.click(listoBtn);

    expect(screen.queryByTestId('format-dropdown-menu')).not.toBeInTheDocument();
  });

  it('cierra el dropdown al hacer click afuera', () => {
    render(
      <div>
        <span data-testid="outside">Afuera</span>
        <TicketFormatPicker
          selectedFormats={['Post']}
          availableFormats={availableFormats}
          onChange={vi.fn()}
        />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /Formato/i }));
    expect(screen.getByTestId('format-dropdown-menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('format-dropdown-menu')).not.toBeInTheDocument();
  });
});
