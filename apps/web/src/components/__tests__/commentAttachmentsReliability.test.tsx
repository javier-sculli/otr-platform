import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketCommentsThread } from '../ticket/TicketCommentsThread';
import { MentionTextarea } from '../MentionTextarea';
import { MAX_COMMENT_ATTACHMENT_SIZE_BYTES } from '../../lib/attachments';

vi.mock('../../lib/imageCompression', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/imageCompression')>();
  return {
    ...actual,
    compressImageFile: vi.fn().mockImplementation((file: File) => Promise.resolve(`data:image/jpeg;base64,mock_${file.name}`)),
  };
});

vi.mock('../../lib/attachments', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/attachments')>();
  return {
    ...actual,
    readFileAsDataUrl: vi.fn().mockImplementation((file: File) => Promise.resolve(`data:application/pdf;base64,mock_${file.name}`)),
  };
});

describe('Punto 3: Confiabilidad en Carga de Archivos y Fotos en Comentarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TicketCommentsThread: permite adjuntar múltiples imágenes simultáneamente y las envía junto al texto', async () => {
    const handleAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <TicketCommentsThread
        comments={[]}
        teamList={[]}
        currentUserId="user-1"
        onAddComment={handleAdd}
      />
    );

    // Escribir texto
    const textarea = screen.getByPlaceholderText(/Escribí un comentario/i);
    await userEvent.type(textarea, 'Revisar estas capturas');

    // Cargar 3 imágenes simultáneamente
    const file1 = new File(['content-1'], 'foto1.png', { type: 'image/png' });
    const file2 = new File(['content-2'], 'foto2.jpg', { type: 'image/jpeg' });
    const file3 = new File(['content-3'], 'foto3.png', { type: 'image/png' });

    const fileInput = screen.getByTestId('comment-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file1, file2, file3] } });

    // Esperar a que se procesen las 3 imágenes
    await waitFor(() => {
      expect(screen.getAllByAltText('Vista previa de imagen')).toHaveLength(3);
    });

    // Enviar comentario
    const submitBtn = screen.getByRole('button', { name: /comentar/i });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleAdd).toHaveBeenCalledTimes(1);
    });

    const sentContent = handleAdd.mock.calls[0][0];
    expect(sentContent).toContain('Revisar estas capturas');
    expect(sentContent).toContain('![imagen](data:image/jpeg;base64,mock_foto1.png)');
    expect(sentContent).toContain('![imagen](data:image/jpeg;base64,mock_foto2.jpg)');
    expect(sentContent).toContain('![imagen](data:image/jpeg;base64,mock_foto3.png)');
  });

  it('TicketCommentsThread: rechaza archivos individuales que superen el límite de 4MB para comentarios', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const handleAdd = vi.fn().mockResolvedValue(undefined);

    render(
      <TicketCommentsThread
        comments={[]}
        teamList={[]}
        currentUserId="user-1"
        onAddComment={handleAdd}
      />
    );

    const oversizedFile = new File(['x'.repeat(100)], 'enorme.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedFile, 'size', { value: MAX_COMMENT_ATTACHMENT_SIZE_BYTES + 1024 });

    const fileInput = screen.getByTestId('comment-attachment-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith(
        expect.stringContaining('supera el tamaño máximo permitido de 4MB')
      );
    });

    // No debe agregarse ningún chip de archivo adjunto
    expect(screen.queryByText('enorme.pdf')).not.toBeInTheDocument();
    alertMock.mockRestore();
  });

  it('MentionTextarea: procesa múltiples archivos cuando se arrastran y sueltan (drag and drop)', () => {
    const onPasteImage = vi.fn();
    const onPasteFile = vi.fn();

    render(
      <MentionTextarea
        value=""
        users={[]}
        onChange={vi.fn()}
        onPasteImage={onPasteImage}
        onPasteFile={onPasteFile}
      />
    );

    const textarea = screen.getByRole('textbox');
    const img1 = new File(['img1'], 'img1.png', { type: 'image/png' });
    const img2 = new File(['img2'], 'img2.jpg', { type: 'image/jpeg' });
    const doc1 = new File(['doc1'], 'doc1.pdf', { type: 'application/pdf' });

    fireEvent.drop(textarea, {
      dataTransfer: {
        files: [img1, img2, doc1],
      },
    });

    expect(onPasteImage).toHaveBeenCalledTimes(2);
    expect(onPasteImage).toHaveBeenCalledWith(img1);
    expect(onPasteImage).toHaveBeenCalledWith(img2);

    expect(onPasteFile).toHaveBeenCalledTimes(1);
    expect(onPasteFile).toHaveBeenCalledWith(doc1);
  });
});
