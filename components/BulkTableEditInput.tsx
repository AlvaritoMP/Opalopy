import React, { useEffect, useRef } from 'react';

interface BulkTableEditInputProps {
    initialValue: string;
    type?: React.HTMLInputTypeAttribute;
    className?: string;
    placeholder?: string;
    onSave: (value: string) => void;
    onCancel: () => void;
}

/** Input no controlado: evita re-renderizar toda la tabla en cada tecla. */
export const BulkTableEditInput: React.FC<BulkTableEditInputProps> = ({
    initialValue,
    type = 'text',
    className,
    placeholder,
    onSave,
    onCancel,
}) => {
    const ref = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        el.select();
    }, []);

    return (
        <input
            ref={ref}
            type={type}
            defaultValue={initialValue}
            placeholder={placeholder}
            className={className}
            onClick={e => e.stopPropagation()}
            onBlur={() => onSave(ref.current?.value ?? '')}
            onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onSave(ref.current?.value ?? '');
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onCancel();
                }
            }}
        />
    );
};
