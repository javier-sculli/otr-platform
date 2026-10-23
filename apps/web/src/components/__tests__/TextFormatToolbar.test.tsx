import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { TextFormatToolbar } from '../TextFormatToolbar';

describe('TextFormatToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza todos los botones de formato estándar y el botón de comentar si se provee onComment', () => {
    const onComment = vi.fn();
    const onChange = vi.fn();
    const editorRef = { current: document.createElement('div') };

    render(
      <TextFormatToolbar
        editorRef={editorRef}
        onChange={onChange}
        onComment={onComment}
      />
    );

    expect(screen.getByTitle('Negrita')).toBeInTheDocument();
    expect(screen.getByTitle('Cursiva')).toBeInTheDocument();
    expect(screen.getByTitle('Subrayado')).toBeInTheDocument();
    expect(screen.getByTitle('Tachado')).toBeInTheDocument();
    expect(screen.getByTitle('Lista con viñetas')).toBeInTheDocument();
    expect(screen.getByTitle('Lista numerada')).toBeInTheDocument();
    expect(screen.getByTitle('Enlace')).toBeInTheDocument();
    expect(screen.getByLabelText('Insertar imagen')).toBeInTheDocument();
    expect(screen.getByTitle('Seleccioná texto y dejá un comentario')).toBeInTheDocument();
  });

  it('ejecuta onComment al hacer clic en el botón Comentar de la barra', () => {
    const onComment = vi.fn();
    const editorRef = { current: document.createElement('div') };

    render(
      <TextFormatToolbar
        editorRef={editorRef}
        onComment={onComment}
      />
    );

    const commentBtn = screen.getByTitle('Seleccioná texto y dejá un comentario');
    fireEvent.mouseDown(commentBtn);
    expect(onComment).toHaveBeenCalledTimes(1);
  });

  it('aplica formato al editor usando document.execCommand al hacer clic en los botones', () => {
    const editor = document.createElement('div');
    editor.innerHTML = 'Texto de prueba';
    document.body.appendChild(editor);

    const origExec = (document as any).execCommand;
    const execCommandMock = vi.fn().mockReturnValue(true);
    (document as any).execCommand = execCommandMock;

    const onChange = vi.fn();
    const editorRef = { current: editor };

    render(
      <TextFormatToolbar
        editorRef={editorRef}
        onChange={onChange}
      />
    );

    fireEvent.mouseDown(screen.getByTitle('Negrita'));
    expect(execCommandMock).toHaveBeenCalledWith('bold', false);
    expect(onChange).toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByTitle('Cursiva'));
    expect(execCommandMock).toHaveBeenCalledWith('italic', false);

    fireEvent.mouseDown(screen.getByTitle('Subrayado'));
    expect(execCommandMock).toHaveBeenCalledWith('underline', false);

    fireEvent.mouseDown(screen.getByTitle('Tachado'));
    expect(execCommandMock).toHaveBeenCalledWith('strikeThrough', false);

    (document as any).execCommand = origExec;
    document.body.removeChild(editor);
  });

  it('soporta la propiedad sticky aplicando estilos sticky en la barra', () => {
    const editorRef = { current: document.createElement('div') };
    const { container } = render(
      <TextFormatToolbar
        editorRef={editorRef}
        sticky={true}
        stickyOffset="180px"
      />
    );

    const bar = container.querySelector('.sticky');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveStyle({ position: 'sticky', top: '180px' });
  });

  it('muestra la barra flotante (bubble) cuando se selecciona texto dentro del editor y permite comentar o dar formato', () => {
    const editor = document.createElement('div');
    const textNode = document.createTextNode('Párrafo con selección para comentar');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    const onComment = vi.fn();
    const editorRef = { current: editor };

    render(
      <TextFormatToolbar
        editorRef={editorRef}
        onComment={onComment}
      />
    );

    // Simular getSelection sobre el texto dentro del editor
    const mockRange = {
      getBoundingClientRect: () => ({
        top: 200,
        bottom: 220,
        left: 100,
        right: 250,
        width: 150,
        height: 20,
      }),
    };

    const mockSelection = {
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: textNode,
      focusNode: textNode,
      toString: () => 'selección para comentar',
      getRangeAt: () => mockRange,
    };

    vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as any);

    // Disparar evento de selección
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    // Debe aparecer la barra flotante
    const floatingBar = document.querySelector('[data-floating-format-bar="1"]');
    expect(floatingBar).toBeInTheDocument();

    // La barra flotante también incluye listas e imagen además de negrita/cursiva/enlace
    const floatingScope = within(floatingBar as HTMLElement);
    expect(floatingScope.getByTitle('Lista con viñetas')).toBeInTheDocument();
    expect(floatingScope.getByTitle('Lista numerada')).toBeInTheDocument();
    expect(floatingScope.getByTitle('Insertar imagen')).toBeInTheDocument();

    // El botón comentar de la barra flotante debe ejecutar onComment
    const commentFloatingBtn = screen.getByTitle('Comentar selección');
    expect(commentFloatingBtn).toBeInTheDocument();
    fireEvent.mouseDown(commentFloatingBtn);
    expect(onComment).toHaveBeenCalledTimes(1);

    // Presionar escape cierra la barra flotante
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.querySelector('[data-floating-format-bar="1"]')).not.toBeInTheDocument();

    (window.getSelection as any).mockRestore();
    document.body.removeChild(editor);
  });

  it('posiciona la barra flotante debajo de la selección cuando está cerca de la barra sticky superior para no taparla', () => {
    const editor = document.createElement('div');
    const textNode = document.createTextNode('Texto cerca del borde superior');
    editor.appendChild(textNode);
    document.body.appendChild(editor);

    const editorRef = { current: editor };
    const { container } = render(
      <TextFormatToolbar
        editorRef={editorRef}
        sticky={true}
        stickyOffset="140px"
      />
    );

    const stickyToolbar = container.querySelector('.sticky') as HTMLElement;
    vi.spyOn(stickyToolbar, 'getBoundingClientRect').mockReturnValue({
      top: 140,
      bottom: 184,
      left: 0,
      right: 800,
      width: 800,
      height: 44,
      x: 0,
      y: 140,
      toJSON: () => {},
    });

    const mockRange = {
      getBoundingClientRect: () => ({
        top: 190, // 190 - 48 = 142 < 184 + 8 (colisionaría con la barra sticky)
        bottom: 212,
        left: 120,
        right: 260,
        width: 140,
        height: 22,
      }),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      anchorNode: textNode,
      focusNode: textNode,
      toString: () => 'Texto cerca',
      getRangeAt: () => mockRange,
    } as any);

    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });

    const floatingBar = document.querySelector('[data-floating-format-bar="1"]') as HTMLElement;
    expect(floatingBar).toBeInTheDocument();
    // Debe ubicarse debajo de la selección (bottom 212 + 8 = 220px)
    expect(floatingBar.style.top).toBe('220px');

    (window.getSelection as any).mockRestore();
    document.body.removeChild(editor);
  });
});

