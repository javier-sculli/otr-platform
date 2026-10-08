import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InlineCommentHoverTooltip, HoverCommentData } from '../InlineCommentHoverTooltip';

describe('InlineCommentHoverTooltip', () => {
  it('no renderiza nada cuando hoverComment es null o isVisible es false', () => {
    const { container: c1 } = render(<InlineCommentHoverTooltip hoverComment={null} />);
    expect(c1.firstChild).toBeNull();

    const mockData: HoverCommentData = {
      x: 100,
      y: 200,
      quote: 'Texto marcado',
      items: [],
    };
    const { container: c2 } = render(<InlineCommentHoverTooltip hoverComment={mockData} isVisible={false} />);
    expect(c2.firstChild).toBeNull();
  });

  it('muestra la cita y mensaje placeholder cuando no hay comentarios en el hilo', () => {
    const mockData: HoverCommentData = {
      x: 100,
      y: 200,
      quote: 'Párrafo de introducción',
      items: [],
    };

    render(<InlineCommentHoverTooltip hoverComment={mockData} isVisible={true} />);

    expect(screen.getByText('«Párrafo de introducción»')).toBeInTheDocument();
    expect(screen.getByText(/hacé click para escribir o responder este comentario/i)).toBeInTheDocument();
  });

  it('muestra los comentarios con autor, fecha y contenido formateado', () => {
    const mockData: HoverCommentData = {
      x: 150,
      y: 250,
      quote: 'Título principal',
      items: [
        { author: 'Javier Sculli', when: 'hace 5m', text: 'Cambiar a mayúsculas' },
        { author: 'Ana Editora', when: 'hace 1m', text: 'Listo, @Javier!' },
      ],
    };

    render(<InlineCommentHoverTooltip hoverComment={mockData} isVisible={true} />);

    expect(screen.getByText('«Título principal»')).toBeInTheDocument();
    expect(screen.getByText('Javier Sculli')).toBeInTheDocument();
    expect(screen.getByText('Cambiar a mayúsculas')).toBeInTheDocument();
    expect(screen.getByText('Ana Editora')).toBeInTheDocument();
    expect(screen.getByText(/Listo,/)).toBeInTheDocument();
  });
});
