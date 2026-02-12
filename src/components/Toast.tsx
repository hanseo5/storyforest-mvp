import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

let toastId = 0;
const listeners: Set<(toast: ToastItem) => void> = new Set();

export const toast = {
    success: (message: string) => notify(message, 'success'),
    error: (message: string) => notify(message, 'error'),
    warning: (message: string) => notify(message, 'warning'),
    info: (message: string) => notify(message, 'info'),
};

function notify(message: string, type: ToastType) {
    const item: ToastItem = { id: ++toastId, message, type };
    listeners.forEach(fn => fn(item));
}

const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
};

const bgColors: Record<ToastType, string> = {
    success: 'bg-emerald-50 border-emerald-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
};

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((item: ToastItem) => {
        setToasts(prev => [...prev.slice(-4), item]); // Keep max 5
    }, []);

    useEffect(() => {
        listeners.add(addToast);
        return () => { listeners.delete(addToast); };
    }, [addToast]);

    const remove = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Auto-dismiss
    useEffect(() => {
        if (toasts.length === 0) return;
        const timer = setTimeout(() => {
            setToasts(prev => prev.slice(1));
        }, 3500);
        return () => clearTimeout(timer);
    }, [toasts]);

    return (
        <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: 80, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 80, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${bgColors[t.type]}`}
                    >
                        <div className="mt-0.5 flex-shrink-0">{icons[t.type]}</div>
                        <p className="text-sm font-medium text-gray-800 flex-1">{t.message}</p>
                        <button onClick={() => remove(t.id)} className="mt-0.5 text-gray-400 hover:text-gray-600 flex-shrink-0">
                            <X size={14} />
                        </button>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
