import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'loading' | 'info';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number; // Duración en ms, 0 = no auto-close
}

interface ToastProps {
    toast: Toast;
    onClose: () => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onClose }) => {
    const icons = {
        success: CheckCircle,
        error: AlertCircle,
        loading: Loader2,
        info: Info,
    };

    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        loading: 'bg-blue-50 border-blue-200 text-blue-800',
        info: 'bg-gray-50 border-gray-200 text-gray-800',
    };

    const Icon = icons[toast.type];
    const isSpinning = toast.type === 'loading';

    useEffect(() => {
        if (toast.type !== 'loading' && toast.duration !== 0) {
            const timer = setTimeout(() => {
                onClose();
            }, toast.duration || 3000);
            return () => clearTimeout(timer);
        }
    }, [toast, onClose]);

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-[500px] ${colors[toast.type]}`}
        >
            <Icon
                className={`w-5 h-5 flex-shrink-0 ${isSpinning ? 'animate-spin' : ''}`}
            />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            {toast.type !== 'loading' && (
                <button
                    onClick={onClose}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

interface ToastContainerProps {
    toasts: Toast[];
    onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
    // Verificación defensiva: asegurar que toasts es un array
    if (!toasts || !Array.isArray(toasts) || toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastComponent toast={toast} onClose={() => onClose(toast.id)} />
                </div>
            ))}
        </div>
    );
};

