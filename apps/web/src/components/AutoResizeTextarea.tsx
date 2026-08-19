import React, { useLayoutEffect, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface AutoResizeTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
}

export const AutoResizeTextarea = forwardRef<
  HTMLTextAreaElement,
  AutoResizeTextareaProps
>(({ value, minRows = 3, onChange, className = '', style, ...props }, ref) => {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  useImperativeHandle(ref, () => innerRef.current!);

  const adjustHeight = () => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
    if (onChange) {
      onChange(e);
    }
  };

  const computedStyle: React.CSSProperties = {
    minHeight: minRows ? `${minRows * 1.6}rem` : undefined,
    ...style,
  };

  return (
    <textarea
      ref={innerRef}
      value={value ?? ''}
      onChange={handleChange}
      onFocus={(e) => {
        adjustHeight();
        props.onFocus?.(e);
      }}
      rows={minRows}
      className={`resize-y overflow-y-auto ${className}`}
      style={computedStyle}
      {...props}
    />
  );
});

AutoResizeTextarea.displayName = 'AutoResizeTextarea';
