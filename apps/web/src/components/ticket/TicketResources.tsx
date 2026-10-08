import React, { useState, useRef } from 'react';
import { Link2, Paperclip, X } from 'lucide-react';
import { ensureAbsoluteUrl } from '../../lib/utils';

export interface AttachedFileItem {
  id: string;
  name: string;
  size?: number;
  url?: string;
}

export interface TicketResourcesProps {
  links: string[];
  attachedFiles: AttachedFileItem[];
  onAddLink: (link: string) => void;
  onRemoveLink: (index: number) => void;
  onAddFiles?: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  placeholder?: string;
  variant?: 'modal' | 'page';
  className?: string;
}

export const TicketResources: React.FC<TicketResourcesProps> = ({
  links,
  attachedFiles,
  onAddLink,
  onRemoveLink,
  onAddFiles,
  onRemoveFile,
  placeholder = 'Pegá un link a fotos, logos o documentos y presioná Enter',
  variant = 'modal',
  className = '',
}) => {
  const [recursoInput, setRecursoInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPage = variant === 'page';

  const handleAddLink = () => {
    const raw = recursoInput.trim();
    if (!raw) return;
    const url = ensureAbsoluteUrl(raw);
    onAddLink(url);
    setRecursoInput('');
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onAddFiles) {
      onAddFiles(files);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const hasItems = links.length > 0 || attachedFiles.length > 0;

  return (
    <div className={`flex flex-col ${className}`} data-testid="ticket-resources">
      {/* Attached resources chips */}
      {hasItems && (
        <div
          className={`flex flex-wrap ${
            isPage ? 'gap-2 p-3 pt-0' : 'gap-1.5 p-3 pt-0'
          }`}
          data-testid="resources-chips-container"
        >
          {links.map((link, idx) => (
            <span
              key={`link-${idx}`}
              className={`flex items-center gap-1.5 max-w-full border border-[#d6dde5] rounded-full bg-[#f7fafc] box-border text-[#1d2a3a] ${
                isPage
                  ? 'py-1.5 pl-3 pr-1.5 text-[14px]'
                  : 'py-1 pl-2.5 pr-1 text-[13px]'
              }`}
              data-testid={`resource-link-${idx}`}
            >
              <Link2
                className={`${
                  isPage ? 'w-[15px] h-[15px]' : 'w-3.5 h-3.5'
                } text-[#024fff] shrink-0`}
              />
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={`${
                  isPage ? 'max-w-[320px]' : 'max-w-[260px]'
                } truncate text-[#1d2a3a] hover:text-[#024fff]`}
              >
                {link}
              </a>
              <button
                type="button"
                onClick={() => onRemoveLink(idx)}
                title="Quitar"
                aria-label={`Quitar link ${link}`}
                className={`border-0 bg-transparent cursor-pointer text-[#8c96a3] shrink-0 rounded-full flex items-center justify-center hover:bg-[#d6dde5] hover:text-[#0d0d0d] ${
                  isPage ? 'w-6 h-6' : 'w-5 h-5'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {attachedFiles.map(file => (
            <span
              key={`file-${file.id}`}
              className={`flex items-center gap-1.5 max-w-full border border-[#d6dde5] rounded-full bg-[#f7fafc] box-border text-[#1d2a3a] ${
                isPage
                  ? 'py-1.5 pl-3 pr-1.5 text-[14px] gap-2'
                  : 'py-1 pl-2.5 pr-1 text-[13px]'
              }`}
              data-testid={`resource-file-${file.id}`}
            >
              <Paperclip
                className={`${
                  isPage ? 'w-[15px] h-[15px]' : 'w-3.5 h-3.5'
                } text-[#024fff] shrink-0`}
              />
              <span
                className={`${
                  isPage ? 'max-w-[240px]' : 'max-w-[200px]'
                } truncate text-[#1d2a3a]`}
              >
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveFile(file.id)}
                title="Quitar"
                aria-label={`Quitar archivo ${file.name}`}
                className={`border-0 bg-transparent cursor-pointer text-[#8c96a3] shrink-0 rounded-full flex items-center justify-center hover:bg-[#d6dde5] hover:text-[#0d0d0d] ${
                  isPage ? 'w-6 h-6' : 'w-5 h-5'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Resource input row */}
      <div
        className={`flex items-center border-t border-[#eef3f7] bg-[#f7fafc] ${
          isPage ? 'gap-2 p-2 px-3' : 'gap-1.5 p-1.5 px-2'
        }`}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Adjuntar archivo"
          aria-label="Adjuntar archivo"
          className={`shrink-0 border-0 bg-transparent rounded-md cursor-pointer text-[#3a4655] flex items-center justify-center hover:bg-[#eef3f7] ${
            isPage ? 'w-9 h-9' : 'w-7 h-7'
          }`}
        >
          <Paperclip className={isPage ? 'w-[18px] h-[18px]' : 'w-4 h-4'} />
        </button>

        <input
          value={recursoInput}
          onChange={e => setRecursoInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddLink();
            }
          }}
          placeholder={placeholder}
          className={`flex-1 min-w-0 font-anek border-0 outline-none bg-transparent placeholder:text-[#8c96a3] ${
            isPage ? 'h-9 text-[15px] px-2' : 'h-7 text-[13px] px-1.5'
          }`}
        />

        {recursoInput.trim().length > 0 && (
          <button
            type="button"
            onClick={handleAddLink}
            className={`border-0 bg-[#024fff] rounded-md cursor-pointer font-anek font-bold text-white hover:bg-[#0c57d3] transition-colors ${
              isPage ? 'h-[34px] px-3.5 text-[14px]' : 'h-6 px-2.5 text-[12px]'
            }`}
          >
            Agregar
          </button>
        )}

        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFiles}
          className="hidden"
          data-testid="file-upload-input"
        />
      </div>
    </div>
  );
};
