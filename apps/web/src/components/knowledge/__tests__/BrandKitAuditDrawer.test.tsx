import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrandKitAuditDrawer } from '../BrandKitAuditDrawer';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', () => ({
  api: {
    auditBrandKit: vi.fn(),
    applyBrandKit: vi.fn(),
  },
}));

describe('BrandKitAuditDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ejecuta la auditoría al abrirse y muestra los gaps detectados', async () => {
    (api.auditBrandKit as any).mockResolvedValueOnce({
      data: {
        resumenDiagnostico: 'Diagnóstico: El Brand Kit no contempla los nuevos temas fintech.',
        gaps: [
          {
            campo: 'lineas_editoriales',
            tituloCampo: 'Líneas editoriales',
            estado: 'FALTANTE',
            observacion: 'Falta incorporar Open Banking e Inteligencia Artificial.',
            valorActual: 'Pagos y transferencias.',
            valorSugerido: 'Pagos, transferencias, Open Banking e IA aplicada.',
          },
        ],
        proposedBrandVoice: {
          lineas_editoriales: 'Pagos, transferencias, Open Banking e IA aplicada.',
        },
      },
    });

    render(
      <BrandKitAuditDrawer
        isOpen={true}
        onClose={vi.fn()}
        clientId="c1"
        clientName="Cámara Fintech"
      />
    );

    expect(screen.getByText(/Auditoría Viva de Brand Kit/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Líneas editoriales/i)).toBeInTheDocument();
      expect(screen.getByText(/FALTANTE/i)).toBeInTheDocument();
      expect(screen.getByText(/Falta incorporar Open Banking e Inteligencia Artificial/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Aplicar 1 sugerencias al Brand Kit/i })).toBeInTheDocument();
  });

  it('aplica las sugerencias seleccionadas al presionar el botón de confirmación', async () => {
    const onApplied = vi.fn();
    (api.auditBrandKit as any).mockResolvedValueOnce({
      data: {
        resumenDiagnostico: 'Brecha detectada',
        gaps: [
          {
            campo: 'mensajes_clave',
            tituloCampo: 'Mensajes clave',
            estado: 'DESALINEADO',
            observacion: 'El foco actual es regionalización.',
            valorActual: 'Foco local.',
            valorSugerido: 'Liderazgo en fintech regional.',
          },
        ],
        proposedBrandVoice: {
          mensajes_clave: 'Liderazgo en fintech regional.',
        },
      },
    });

    (api.applyBrandKit as any).mockResolvedValueOnce({
      data: {
        success: true,
        updatedFieldsCount: 1,
      },
    });

    render(
      <BrandKitAuditDrawer
        isOpen={true}
        onClose={vi.fn()}
        clientId="c1"
        clientName="Cámara Fintech"
        onAppliedSuccessfully={onApplied}
      />
    );

    const applyBtn = await screen.findByRole('button', { name: /Aplicar 1 sugerencias al Brand Kit/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(api.applyBrandKit).toHaveBeenCalledWith('c1', {
        mensajes_clave: 'Liderazgo en fintech regional.',
      });
      expect(onApplied).toHaveBeenCalled();
      expect(screen.getByText(/¡Brand Kit actualizado exitosamente!/i)).toBeInTheDocument();
    });
  });

  it('cuando no hay brechas detectadas, muestra mensaje de alineado y botón deshabilitado', async () => {
    (api.auditBrandKit as any).mockResolvedValueOnce({
      data: {
        resumenDiagnostico: 'Todo alineado.',
        gaps: [],
        proposedBrandVoice: {
          lineas_editoriales: 'Actual',
          tono: 'Actual',
        },
      },
    });

    render(
      <BrandKitAuditDrawer
        isOpen={true}
        onClose={vi.fn()}
        clientId="c1"
        clientName="Cámara Fintech"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No se detectaron brechas significativas/i)).toBeInTheDocument();
    });

    const btn = screen.getByRole('button', { name: /Sin sugerencias para aplicar/i });
    expect(btn).toBeDisabled();
  });
});
