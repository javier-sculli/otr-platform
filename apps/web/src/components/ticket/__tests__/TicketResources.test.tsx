import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketResources } from '../TicketResources';

describe('TicketResources', () => {
  const mockLinks = ['https://google.com', 'drive.google.com/folder'];
  const mockFiles = [
    { id: 'f1', name: 'foto_portada.jpg' },
    { id: 'f2', name: 'guion_v1.pdf' },
  ];

  it('renderiza chips de links y de archivos adjuntos', () => {
    render(
      <TicketResources
        links={mockLinks}
        attachedFiles={mockFiles}
        onAddLink={vi.fn()}
        onRemoveLink={vi.fn()}
        onRemoveFile={vi.fn()}
      />
    );

    expect(screen.getByText('https://google.com')).toBeInTheDocument();
    expect(screen.getByText('drive.google.com/folder')).toBeInTheDocument();
    expect(screen.getByText('foto_portada.jpg')).toBeInTheDocument();
    expect(screen.getByText('guion_v1.pdf')).toBeInTheDocument();
  });

  it('permite quitar un link disparando onRemoveLink con su índice', () => {
    const onRemoveLink = vi.fn();
    render(
      <TicketResources
        links={mockLinks}
        attachedFiles={[]}
        onAddLink={vi.fn()}
        onRemoveLink={onRemoveLink}
        onRemoveFile={vi.fn()}
      />
    );

    const removeBtn = screen.getByLabelText('Quitar link https://google.com');
    fireEvent.click(removeBtn);

    expect(onRemoveLink).toHaveBeenCalledWith(0);
  });

  it('permite quitar un archivo adjunto disparando onRemoveFile con su id', () => {
    const onRemoveFile = vi.fn();
    render(
      <TicketResources
        links={[]}
        attachedFiles={mockFiles}
        onAddLink={vi.fn()}
        onRemoveLink={vi.fn()}
        onRemoveFile={onRemoveFile}
      />
    );

    const removeBtn = screen.getByLabelText('Quitar archivo foto_portada.jpg');
    fireEvent.click(removeBtn);

    expect(onRemoveFile).toHaveBeenCalledWith('f1');
  });

  it('agrega un link normalizado con Enter y limpia el input', async () => {
    const onAddLink = vi.fn();
    render(
      <TicketResources
        links={[]}
        attachedFiles={[]}
        onAddLink={onAddLink}
        onRemoveLink={vi.fn()}
        onRemoveFile={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Pegá un link/i);
    await userEvent.type(input, 'notion.so/doc{enter}');

    expect(onAddLink).toHaveBeenCalledWith('https://notion.so/doc');
    expect(input).toHaveValue('');
  });

  it('muestra el botón Agregar cuando hay texto y dispara onAddLink al hacer click', async () => {
    const onAddLink = vi.fn();
    render(
      <TicketResources
        links={[]}
        attachedFiles={[]}
        onAddLink={onAddLink}
        onRemoveLink={vi.fn()}
        onRemoveFile={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Pegá un link/i);
    await userEvent.type(input, 'figma.com/file');

    const addBtn = screen.getByRole('button', { name: 'Agregar' });
    expect(addBtn).toBeInTheDocument();
    fireEvent.click(addBtn);

    expect(onAddLink).toHaveBeenCalledWith('https://figma.com/file');
  });

  it('dispara onAddFiles al seleccionar archivos mediante el input file oculto', () => {
    const onAddFiles = vi.fn();
    render(
      <TicketResources
        links={[]}
        attachedFiles={[]}
        onAddLink={vi.fn()}
        onRemoveLink={vi.fn()}
        onAddFiles={onAddFiles}
        onRemoveFile={vi.fn()}
      />
    );

    const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement;
    const testFile = new File(['dummy'], 'logo.png', { type: 'image/png' });

    fireEvent.change(fileInput, { target: { files: [testFile] } });
    expect(onAddFiles).toHaveBeenCalledWith([testFile]);
  });
});
