import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarioBacklog } from '../CalendarioBacklog';

// Pedido del equipo (2026-11-18, Signatura): los títulos llevan prefijo "XX | título" para
// distinguir vocería/marca. La vista calendario cortaba lo anterior al "|".
describe('CalendarioBacklog — título de la tarjeta', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('muestra el título completo, incluido el prefijo "GB |"', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T12:00:00'));

    const ticket = {
      id: 't1',
      title: 'GB | Cómo responde Signatura a los pedidos de los clientes.',
      status: 'ESPERANDO_FEEDBACK',
      plannedDate: '2026-11-18',
      dueDate: '2026-11-16',
      client: { id: 'c1', name: 'Signatura' },
    };

    render(<CalendarioBacklog tickets={[ticket as any]} onTicketClick={vi.fn()} />);

    expect(screen.getByText('GB | Cómo responde Signatura a los pedidos de los clientes.')).toBeInTheDocument();
  });
});
