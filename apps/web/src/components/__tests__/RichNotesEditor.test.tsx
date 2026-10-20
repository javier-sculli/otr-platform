import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RichNotesEditor } from '../RichNotesEditor';

describe('RichNotesEditor', () => {
  it('renders with placeholder and initial value', () => {
    const onChange = vi.fn();
    render(
      <RichNotesEditor
        value="<p>Texto inicial de sumario</p>"
        onChange={onChange}
        placeholder="Escribí aquí..."
      />
    );

    expect(screen.getByText('Texto inicial de sumario')).toBeTruthy();
  });

  it('contains toolbar buttons for formatting', () => {
    const onChange = vi.fn();
    render(
      <RichNotesEditor
        value=""
        onChange={onChange}
      />
    );

    // Verify Bold, Italic, Link buttons from toolbar exist
    expect(screen.getByTitle('Negrita')).toBeTruthy();
    expect(screen.getByTitle('Cursiva')).toBeTruthy();
    expect(screen.getByTitle('Enlace')).toBeTruthy();
  });

  it('triggers onBlur when editor loses focus', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(
      <RichNotesEditor
        value="Nota de prueba"
        onChange={onChange}
        onBlur={onBlur}
      />
    );

    const editable = container.querySelector('[contenteditable="true"]');
    expect(editable).toBeTruthy();
    if (editable) {
      fireEvent.blur(editable);
      expect(onBlur).toHaveBeenCalledTimes(1);
    }
  });
});
