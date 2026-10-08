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
});
