import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextFormatToolbar } from '../TextFormatToolbar';

// Pedido del equipo (2026-11-16): en el campo Copy no se ofrece insertar imagen y se suma menú de emojis.
describe('TextFormatToolbar — modo copy (sin imagen, con emojis)', () => {
  it('con allowImage={false} no muestra el botón de imagen ni el input de archivo', () => {
    const editorRef = { current: document.createElement('div') };
    render(<TextFormatToolbar editorRef={editorRef} onChange={vi.fn()} allowImage={false} showEmoji />);
    expect(screen.queryByLabelText('Insertar imagen')).toBeNull();
    expect(screen.queryByTestId('toolbar-image-input')).toBeNull();
    expect(screen.getByLabelText('Insertar emoji')).toBeInTheDocument();
  });

  it('por defecto (otros campos) mantiene imagen y no muestra emojis', () => {
    const editorRef = { current: document.createElement('div') };
    render(<TextFormatToolbar editorRef={editorRef} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Insertar imagen')).toBeInTheDocument();
    expect(screen.queryByLabelText('Insertar emoji')).toBeNull();
  });

  it('elegir un emoji lo inserta en el editor y dispara onChange', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.innerHTML = 'Hola';
    document.body.appendChild(editor);
    const onChange = vi.fn();
    render(<TextFormatToolbar editorRef={{ current: editor }} onChange={onChange} allowImage={false} showEmoji />);

    fireEvent.mouseDown(screen.getByLabelText('Insertar emoji'));
    fireEvent.mouseDown(screen.getAllByTitle('🚀')[0]);

    expect(editor.textContent).toBe('Hola🚀');
    expect(onChange).toHaveBeenCalledWith('Hola🚀');
    editor.remove();
  });
});
