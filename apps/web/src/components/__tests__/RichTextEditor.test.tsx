import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RichTextEditor } from '../RichTextEditor';

describe('RichTextEditor', () => {
  it('renderiza el contenido HTML inicial', () => {
    const onChange = vi.fn();
    render(<RichTextEditor value="<p>Texto de prueba</p>" onChange={onChange} />);

    expect(screen.getByText('Texto de prueba')).toBeInTheDocument();
  });

  it('no fuerza el cursor al final al recibir focus (permite posicionar el cursor libremente)', () => {
    const onChange = vi.fn();
    const onFocus = vi.fn();
    render(
      <RichTextEditor
        value="<p>Línea 1</p><p>Línea 2</p><p>Línea 3</p>"
        onChange={onChange}
        onFocus={onFocus}
      />
    );

    const editor = screen.getByText('Línea 1').closest('[contenteditable]') as HTMLDivElement;
    expect(editor).toBeInTheDocument();

    // Mock window.getSelection
    const selectNodeContentsSpy = vi.fn();
    const collapseSpy = vi.fn();
    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: selectNodeContentsSpy,
      collapse: collapseSpy,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    } as any);

    try {
      fireEvent.focus(editor);
      expect(onFocus).toHaveBeenCalled();
      // handleFocus ya NO debe invocar selectNodeContents/collapse para no pisar el cursor del usuario
      expect(selectNodeContentsSpy).not.toHaveBeenCalled();
    } finally {
      document.createRange = originalCreateRange;
    }
  });

  it('al hacer click en un elemento de texto hijo (párrafo/línea), no altera la selección', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value="<p id='p1'>Párrafo inicial</p><p id='p2'>Párrafo del medio</p>"
        onChange={onChange}
      />
    );

    const p2 = screen.getByText('Párrafo del medio');

    const selectNodeContentsSpy = vi.fn();
    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: selectNodeContentsSpy,
      collapse: vi.fn(),
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    } as any);

    try {
      fireEvent.click(p2);
      // El click sobre texto NO debe forzar mover el cursor al final
      expect(selectNodeContentsSpy).not.toHaveBeenCalled();
    } finally {
      document.createRange = originalCreateRange;
    }
  });

  it('al hacer click en el espacio vacío del contenedor, mueve el cursor al final', () => {
    const onChange = vi.fn();
    render(
      <RichTextEditor
        value="<p>Texto</p>"
        onChange={onChange}
      />
    );

    const editor = screen.getByText('Texto').closest('[contenteditable]') as HTMLDivElement;

    const selectNodeContentsSpy = vi.fn();
    const collapseSpy = vi.fn();
    const originalCreateRange = document.createRange;
    document.createRange = () => ({
      selectNodeContents: selectNodeContentsSpy,
      collapse: collapseSpy,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    } as any);

    try {
      fireEvent.click(editor);
      // El click sobre el contenedor vacío (target === currentTarget) sí lleva el cursor al final
      expect(selectNodeContentsSpy).toHaveBeenCalledWith(editor);
      expect(collapseSpy).toHaveBeenCalledWith(false);
    } finally {
      document.createRange = originalCreateRange;
    }
  });

  it('dispara onMarkClick al clickear una marca de comentario', () => {
    const onChange = vi.fn();
    const onMarkClick = vi.fn();
    render(
      <RichTextEditor
        value='<p>Texto con <mark data-c="c123">comentario</mark></p>'
        onChange={onChange}
        onMarkClick={onMarkClick}
      />
    );

    const mark = screen.getByText('comentario');
    fireEvent.click(mark);

    expect(onMarkClick).toHaveBeenCalledWith('c123', mark);
  });
});
