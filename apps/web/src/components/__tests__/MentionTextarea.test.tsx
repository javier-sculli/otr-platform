import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MentionTextarea, formatCommentWithMentions } from '../MentionTextarea';

describe('MentionTextarea', () => {
  const mockUsers = [
    { id: 'u1', name: 'Shaiel Terán', email: 'shaiel@otr.com' },
    { id: 'u2', name: 'Javier Sculli', email: 'javier@otr.com' },
    { id: 'u3', name: 'Manuela Garabenta', email: 'manu@otr.com' },
  ];

  function TestWrapper({ initial = '', onChange }: { initial?: string; onChange?: (val: string) => void }) {
    const [val, setVal] = useState(initial);
    return (
      <MentionTextarea
        value={val}
        onChange={(v) => {
          setVal(v);
          onChange?.(v);
        }}
        users={mockUsers}
        placeholder="Comentar..."
      />
    );
  }

  it('abre el menú de menciones al tipear @ y filtra por nombre desplegando hacia abajo', () => {
    render(<TestWrapper />);

    const textarea = screen.getByPlaceholderText('Comentar...');
    fireEvent.change(textarea, { target: { value: '@sh' } });

    const menu = screen.getByText('Mencionar a:').closest('[data-mention-dropdown]');
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveClass('top-full');
    expect(screen.getByText('Shaiel Terán')).toBeInTheDocument();
    expect(screen.queryByText('Javier Sculli')).not.toBeInTheDocument();
  });

  it('inserta el nombre del usuario al seleccionar una opción con click', () => {
    let captured = '';
    render(<TestWrapper onChange={(v) => { captured = v; }} />);

    const textarea = screen.getByPlaceholderText('Comentar...');
    fireEvent.change(textarea, { target: { value: '@' } });

    const userOption = screen.getByText('Javier Sculli');
    fireEvent.mouseDown(userOption);

    expect(captured).toBe('@Javier Sculli ');
  });

  it('permite navegar con flechas y presionar Enter para seleccionar', () => {
    let captured = '';
    render(<TestWrapper onChange={(v) => { captured = v; }} />);

    const textarea = screen.getByPlaceholderText('Comentar...');
    fireEvent.change(textarea, { target: { value: '@' } });

    // Presionar ArrowDown para pasar al segundo usuario (Javier Sculli)
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(captured).toBe('@Javier Sculli ');
  });

  it('cierra el menú al presionar Escape', () => {
    render(<TestWrapper />);

    const textarea = screen.getByPlaceholderText('Comentar...');
    fireEvent.change(textarea, { target: { value: '@' } });

    expect(screen.getByText('Mencionar a:')).toBeInTheDocument();

    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByText('Mencionar a:')).not.toBeInTheDocument();
  });
});

describe('formatCommentWithMentions', () => {
  it('resalta las menciones con formato estilizado', () => {
    render(
      <div>{formatCommentWithMentions('Hola @Shaiel Terán fijate esto')}</div>
    );
    expect(screen.getByText('@Shaiel Terán')).toHaveClass('text-[#024fff]');
  });
});
