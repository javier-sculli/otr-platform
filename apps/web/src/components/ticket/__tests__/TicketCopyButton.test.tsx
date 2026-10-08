import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TicketCopyButton } from '../TicketCopyButton';

describe('TicketCopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renderiza con texto "Copiar" y título accesible', () => {
    render(<TicketCopyButton text="Texto de prueba" />);

    const button = screen.getByTestId('ticket-copy-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Copiar');
    expect(button).toHaveAttribute('title', 'Copiar copy');
  });

  it('copia el texto plano al portapapeles y cambia temporalmente a "Copiado"', async () => {
    render(<TicketCopyButton text="Mi contenido para LinkedIn" />);

    const button = screen.getByTestId('ticket-copy-button');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Mi contenido para LinkedIn');
    expect(button).toHaveTextContent('Copiado');

    // Después de 2 segundos, debe volver a "Copiar"
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(button).toHaveTextContent('Copiar');
  });

  it('prioriza el innerText del editorRef si está presente', async () => {
    function TestComponent() {
      const editorRef = useRef<HTMLDivElement>(null);
      return (
        <div>
          <div ref={editorRef}>Texto renderizado en el editor</div>
          <TicketCopyButton text="Texto fallback" editorRef={editorRef} />
        </div>
      );
    }

    render(<TestComponent />);

    const button = screen.getByTestId('ticket-copy-button');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Texto renderizado en el editor');
    expect(button).toHaveTextContent('Copiado');
  });

  it('no ejecuta copia ni altera estado si el contenido está completamente vacío', async () => {
    render(<TicketCopyButton text="" />);

    const button = screen.getByTestId('ticket-copy-button');
    await act(async () => {
      fireEvent.click(button);
    });

    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(button).toHaveTextContent('Copiar');
  });
});
