import { useEffect, useMemo, useRef, useState } from 'react';

type Size = 'sm' | 'md' | 'lg';

export type GlobalSearchProps = {
  onSearch: (term: string) => void; // dispara tras debounce
  value?: string; // si se pasa, el componente se sincroniza
  placeholder?: string;
  minChars?: number; // default 2
  delay?: number; // default 500ms
  autoFocus?: boolean;
  size?: Size; // controla altura/padding tipográficos
  clearable?: boolean; // default true
  className?: string; // estilos extra
};

export default function GlobalSearch({
  onSearch,
  value,
  placeholder = 'Buscar…',
  minChars = 2,
  delay = 500,
  autoFocus = false,
  size = 'md',
  clearable = true,
  className = '',
}: GlobalSearchProps) {
  const [input, setInput] = useState(value ?? '');
  const [debounced, setDebounced] = useState(input);
  const inputRef = useRef<HTMLInputElement>(null);

  // sincroniza si viene value controlado desde afuera
  useEffect(() => {
    if (value !== undefined && value !== input) setInput(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), delay);
    return () => clearTimeout(t);
  }, [input, delay]);

  const lastSentRef = useRef('');
  useEffect(() => {
    const term = debounced.trim();
    if (term === lastSentRef.current) return;
    lastSentRef.current = term;
    if (term.length === 0 || term.length >= minChars) onSearch(term);
  }, [debounced, minChars, onSearch]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const sizeCls = useMemo(() => {
    switch (size) {
      case 'sm':
        return 'h-9 text-sm';
      case 'lg':
        return 'h-12 text-base';
      default:
        return 'h-11 text-sm';
    }
  }, [size]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Icono */}
      <svg
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.387a1 1 0 01-1.414 1.414l-4.387-4.387zM14 8a6 6 0 11-12 0 6 6 0 0112 0z"
          clipRule="evenodd"
        />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="search"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-gray-200 bg-white pr-10 pl-10 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${sizeCls}`}
        aria-label="Buscar"
      />

      {/* Clear */}
      {clearable && input.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setInput('');
            // Forzar disparo inmediato para limpiar resultados
            onSearch('');
            inputRef.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:text-gray-600"
          aria-label="Limpiar búsqueda"
          title="Limpiar"
        >
          ✕
        </button>
      )}
    </div>
  );
}
