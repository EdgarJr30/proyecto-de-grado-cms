import AppVersion from './AppVersion';
export default function Footer() {
    return (
        <footer className="bg-white border-t border-gray-200">
            <div className="mx-auto max-w-7xl px-4 py-3 md:flex md:items-center md:justify-between lg:px-8">
                <p className="mb-2 text-center text-xs text-gray-500 md:mb-0 md:order-1">
                    &copy; 2025 CILM. All rights reserved.
                </p>
                <div className="flex justify-center md:order-2">
                    <AppVersion />
                </div>
            </div>
        </footer>
    )
}
