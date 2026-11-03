import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ZeroFormDropzone } from '../ZeroFormDropzone';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', () => ({
  api: {
    uploadInferredDocument: vi.fn(),
  },
}));

describe('ZeroFormDropzone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la zona de drop con instrucciones de cero formulario', () => {
    render(<ZeroFormDropzone clientId="c1" onSuccess={vi.fn()} />);

    expect(
      screen.getByText(/Arrastrá acá archivos de marca, decks, PDFs o notas/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cero formularios: la IA infiere título, tipo, relevancia/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pegar texto o transcripción/i })).toBeInTheDocument();
  });

  it('abre el modal de texto pegado y procesa el contenido con IA', async () => {
    const onSuccess = vi.fn();
    (api.uploadInferredDocument as any).mockResolvedValueOnce({
      data: {
        id: 'doc-new',
        title: 'Manual de Identidad Q4',
        type: 'BRAND_GUIDELINES',
        relevance: 'ESTRATEGICO',
        summary: 'Resumen clave de marca',
        tags: ['identidad', 'relevancia:estrategico'],
      },
    });

    render(<ZeroFormDropzone clientId="c1" onSuccess={onSuccess} />);

    // Click paste button
    fireEvent.click(screen.getByRole('button', { name: /Pegar texto o transcripción/i }));

    expect(screen.getByText(/Ingesta Asistida de Texto/i)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Pegá acá el texto completo/i);
    fireEvent.change(textarea, { target: { value: 'Texto de la guía de marca y voz de la empresa.' } });

    const processBtn = screen.getByRole('button', { name: /Procesar e Ingestar/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(api.uploadInferredDocument).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    const callArgs = (api.uploadInferredDocument as any).mock.calls[0][0];
    expect(callArgs.clientId).toBe('c1');
    expect(callArgs.text).toBe('Texto de la guía de marca y voz de la empresa.');

    expect(await screen.findByText(/¡Texto analizado y guardado!/i)).toBeInTheDocument();
  });
});
