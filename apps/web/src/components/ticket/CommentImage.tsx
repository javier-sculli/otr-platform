import React, { useState } from 'react';
import { resolveAttachmentUrl } from '../../lib/api';

export interface CommentImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  loading?: 'lazy' | 'eager';
}

/**
 * Standard lightweight image renderer for comments and previews.
 * Resolves attachment URLs seamlessly to the backend endpoint.
 */
export const CommentImage: React.FC<CommentImageProps> = ({
  src,
  alt,
  className = '',
  onClick,
  loading = 'lazy',
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedUrl = resolveAttachmentUrl(src);

  if (hasError) {
    return (
      <div className="flex items-center justify-center p-3 bg-[#f7fafc] border border-[#d6dde5] rounded-lg text-xs text-[#8c96a3]">
        <span>No se pudo cargar la imagen</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      className={className}
      onClick={onClick}
      loading={loading}
      onError={() => setHasError(true)}
    />
  );
};
