export default function Modal({ show, onClose, title, children }) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 relative">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">{title}</h2>
                {children}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
