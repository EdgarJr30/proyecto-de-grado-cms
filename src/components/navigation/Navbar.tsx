import { useState, useEffect, useRef } from 'react';
import { Disclosure } from '@headlessui/react';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { LOCATIONS } from '../../constants/locations';
import GlobalAnnouncementBanner from '../common/GlobalAnnouncementBanner';

function FilterIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="w-6 h-6"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
      />
    </svg>
  );
}

interface NavbarProps {
  onSearch: (term: string) => void;
  onFilterLocation: (location: string) => void;
  selectedLocation: string;
}

export default function Navbar({
  onSearch,
  selectedLocation,
  onFilterLocation,
}: NavbarProps) {
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedInput(input);
    }, 500);
    return () => clearTimeout(timeout);
  }, [input]);

  useEffect(() => {
    if (debouncedInput.length >= 2 || debouncedInput.length === 0) {
      onSearch(debouncedInput);
    }
  }, [debouncedInput, onSearch]);

  return (
    <>
      {/* 🔹 Banner global arriba */}
      <GlobalAnnouncementBanner />

      {/* 🔹 Navbar principal */}
      <Disclosure as="nav" className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
          <div className="flex h-16 justify-between items-center relative">
            {/* Filtro ubicaciones SOLO EN DESKTOP */}
            <div className="mr-3 w-[180px] hidden md:block">
              <select
                value={selectedLocation}
                onChange={(e) => onFilterLocation(e.target.value)}
                className="block w-full rounded-md bg-white border border-gray-300 py-1.5 pl-2 pr-8 text-base text-gray-900 focus:outline-2 focus:outline-indigo-600 sm:text-sm"
              >
                <option value="">Todas las ubicaciones</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            {/* Buscador */}
            <div className="flex flex-1 items-center justify-center px-2 lg:ml-6 lg:justify-end">
              <div className="grid w-[120px] xs:w-[160px] sm:w-[200px] md:w-full max-w-xs grid-cols-1 pl-0">
                <input
                  name="search"
                  type="search"
                  placeholder="Buscar por título o solicitante"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="col-start-1 row-start-1 block w-full rounded-md bg-white py-1.5 pr-3 pl-10 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6"
                />
                <MagnifyingGlassIcon
                  aria-hidden="true"
                  className="pointer-events-none col-start-1 row-start-1 ml-3 size-5 self-center text-gray-400"
                />
              </div>
            </div>

            {/* Botón filtro solo en móvil */}
            <div
              className="flex items-center md:hidden relative"
              ref={dropdownRef}
            >
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="ml-2 p-2 rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Filtrar por ubicación"
                type="button"
              >
                <FilterIcon />
              </button>
              {showDropdown && (
                <div className="absolute top-12 right-0 z-20 bg-white rounded shadow-lg w-48 border border-gray-200 animate-fade-in-down">
                  <button
                    className={`w-full px-4 py-2 text-left hover:bg-indigo-50 ${
                      selectedLocation === ''
                        ? 'font-semibold text-indigo-600'
                        : 'text-gray-700'
                    }`}
                    onClick={() => {
                      onFilterLocation('');
                      setShowDropdown(false);
                    }}
                  >
                    Todas las ubicaciones
                  </button>
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      className={`w-full px-4 py-2 text-left hover:bg-indigo-50 ${
                        selectedLocation === loc
                          ? 'font-semibold text-indigo-600'
                          : 'text-gray-700'
                      }`}
                      onClick={() => {
                        onFilterLocation(loc);
                        setShowDropdown(false);
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Disclosure>
    </>
  );
}
