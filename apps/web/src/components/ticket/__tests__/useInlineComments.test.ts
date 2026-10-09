import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInlineComments } from '../useInlineComments';

describe('useInlineComments', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('inicializa con estado vacío', () => {
    const { result } = renderHook(() => useInlineComments());

    expect(result.current.pop).toBeNull();
    expect(result.current.popInput).toBe('');
    expect(result.current.threads).toEqual({});
    expect(result.current.hoverComment).toBeNull();
  });

  it('alerta si se intenta crear comentario inline sin selección de texto', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useInlineComments());

    const ref = { current: document.createElement('div') };
    act(() => {
      result.current.startInlineComment(ref);
    });

    expect(alertMock).toHaveBeenCalledWith('Seleccioná un fragmento del texto para comentarlo.');
  });

  it('envía un comentario actualizando el thread y disparando onSubmitComment', () => {
    const onSubmitComment = vi.fn();
    const { result } = renderHook(() =>
      useInlineComments({
        currentUser: { name: 'Juan Perez' },
        onSubmitComment,
      })
    );

    // Set an active popover
    act(() => {
      result.current.setPop({ id: 'c123', x: 100, y: 150, isDraft: true });
      result.current.setThreads({ c123: { quote: 'fragmento citado', items: [] } });
      result.current.setPopInput('Este es mi comentario');
    });

    act(() => {
      result.current.sendPop();
    });

    expect(result.current.threads['c123'].items).toHaveLength(1);
    expect(result.current.threads['c123'].items[0].author).toBe('Juan Perez');
    expect(result.current.threads['c123'].items[0].text).toBe('Este es mi comentario');
    expect(result.current.pop?.isDraft).toBe(false);
    expect(result.current.popInput).toBe('');

    expect(onSubmitComment).toHaveBeenCalledWith({
      quote: 'fragmento citado',
      text: 'Este es mi comentario',
      fullContent: '«fragmento citado»: Este es mi comentario',
    });
  });

  it('closePop limpia el mark del DOM si es un draft sin comentarios', () => {
    const { result } = renderHook(() => useInlineComments());

    const container = document.createElement('div');
    const mark = document.createElement('mark');
    mark.setAttribute('data-c', 'draft_1');
    mark.textContent = 'texto marcado';
    container.appendChild(mark);
    document.body.appendChild(container);

    act(() => {
      result.current.setPop({ id: 'draft_1', x: 50, y: 50, isDraft: true });
      result.current.setThreads({ draft_1: { quote: 'texto marcado', items: [] } });
    });

    act(() => {
      result.current.closePop();
    });

    expect(result.current.pop).toBeNull();
    expect(document.querySelector('mark[data-c="draft_1"]')).toBeNull();
    expect(container.textContent).toBe('texto marcado');
    expect(result.current.threads['draft_1']).toBeUndefined();
  });

  it('resolvePop elimina el mark y limpia el thread', () => {
    const { result } = renderHook(() => useInlineComments());

    const container = document.createElement('div');
    const mark = document.createElement('mark');
    mark.setAttribute('data-c', 'resolved_1');
    mark.textContent = 'texto marcado';
    container.appendChild(mark);
    document.body.appendChild(container);

    act(() => {
      result.current.setPop({ id: 'resolved_1', x: 50, y: 50, isDraft: false });
      result.current.setThreads({
        resolved_1: {
          quote: 'texto marcado',
          items: [{ author: 'Ana', when: '10:00', text: 'Ok' }],
        },
      });
    });

    act(() => {
      result.current.resolvePop();
    });

    expect(result.current.pop).toBeNull();
    expect(document.querySelector('mark[data-c="resolved_1"]')).toBeNull();
    expect(result.current.threads['resolved_1']).toBeUndefined();
  });

  it('handleMarkClick combina comentarios persistidos con el thread local', () => {
    const comments = [
      {
        id: '99',
        content: '«mi texto»: Comentario previo persistido',
        author: 'Carlos',
        createdAt: '2026-03-01T12:00:00Z',
      },
    ];

    const { result } = renderHook(() => useInlineComments({ comments }));

    const mark = document.createElement('mark');
    mark.setAttribute('data-c', 'c_99');
    mark.textContent = 'mi texto';
    document.body.appendChild(mark);

    act(() => {
      result.current.handleMarkClick('c_99', mark);
    });

    expect(result.current.pop?.id).toBe('c_99');
    expect(result.current.pop?.isDraft).toBe(false);
    expect(result.current.threads['c_99'].items).toHaveLength(1);
    expect(result.current.threads['c_99'].items[0].text).toBe('Comentario previo persistido');
    expect(result.current.threads['c_99'].items[0].author).toBe('Carlos');
  });

  it('handleMarkHover no duplica comentarios cuando ya existen en el thread local', () => {
    const comments = [
      {
        id: '101',
        content: '«frase»: Comentario único',
        user: { name: 'Shaiel Terán' },
        createdAt: '2026-10-08T12:00:00Z',
      },
    ];

    const { result } = renderHook(() => useInlineComments({ comments }));

    const mark = document.createElement('mark');
    mark.setAttribute('data-c', 'c_101');
    mark.textContent = 'frase';
    document.body.appendChild(mark);

    // 1. Simular click previo que puebla threads['c_101']
    act(() => {
      result.current.handleMarkClick('c_101', mark);
    });

    // 2. Cerrar popover
    act(() => {
      result.current.closePop();
    });

    // 3. Hover sobre la marca
    act(() => {
      result.current.handleMarkHover('c_101', mark);
    });

    expect(result.current.hoverComment).not.toBeNull();
    expect(result.current.hoverComment?.items).toHaveLength(1);
    expect(result.current.hoverComment?.items[0].author).toBe('Shaiel Terán');
    expect(result.current.hoverComment?.items[0].text).toBe('Comentario único');
  });

  it('closePop limpia el mark del DOM y notifica onHtmlChange en borrador descartado', () => {
    const { result } = renderHook(() => useInlineComments());
    const onHtmlChange = vi.fn();

    const container = document.createElement('div');
    container.textContent = 'Texto para comentar';
    document.body.appendChild(container);

    const ref = { current: container };

    // Simular selección de 'comentar'
    const range = document.createRange();
    range.selectNodeContents(container);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      result.current.startInlineComment(ref, onHtmlChange);
    });

    expect(onHtmlChange).toHaveBeenCalledTimes(1);
    expect(container.querySelector('mark')).not.toBeNull();

    // Ahora cancelar / cerrar popover
    act(() => {
      result.current.closePop();
    });

    // Debe haber limpiado el mark y notificado el HTML limpio
    expect(container.querySelector('mark')).toBeNull();
    expect(onHtmlChange).toHaveBeenCalledTimes(2);
    expect(onHtmlChange).toHaveBeenLastCalledWith('Texto para comentar');
  });

  it('startInlineComment evita anidar marcas si el texto ya pertenece a un comentario', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = renderHook(() => useInlineComments());

    const container = document.createElement('div');
    const existingMark = document.createElement('mark');
    existingMark.setAttribute('data-c', 'c_existing');
    existingMark.textContent = 'texto ya marcado';
    container.appendChild(existingMark);
    document.body.appendChild(container);

    const ref = { current: container };

    const range = document.createRange();
    range.selectNodeContents(existingMark);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    act(() => {
      result.current.startInlineComment(ref);
    });

    expect(alertMock).toHaveBeenCalledWith('Este texto ya forma parte de un comentario. Podés hacer click sobre él para responder.');
    expect(container.querySelectorAll('mark')).toHaveLength(1);
  });
});
