import React from 'react';
import { StageColorId } from '../types';
import { STAGE_COLOR_OPTIONS, STAGE_COLOR_LABELS, stageColorSwatchClasses } from '../lib/stageColors';

interface StageColorPickerProps {
    value?: StageColorId;
    onChange: (color: StageColorId | undefined) => void;
    compact?: boolean;
}

export const StageColorPicker: React.FC<StageColorPickerProps> = ({ value, onChange, compact = false }) => {
    return (
        <div className={compact ? 'flex items-center gap-1' : 'flex items-center gap-1.5'}>
            {!compact && (
                <span className="text-xs text-gray-500 mr-1 shrink-0">Color:</span>
            )}
            <button
                type="button"
                onClick={() => onChange(undefined)}
                className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded border-2 bg-white border-dashed border-gray-300 hover:border-gray-400 shrink-0 ${
                    !value ? 'ring-2 ring-offset-1 ring-primary-500' : 'opacity-60'
                }`}
                title="Sin color"
            />
            {STAGE_COLOR_OPTIONS.map(colorId => (
                <button
                    key={colorId}
                    type="button"
                    onClick={() => onChange(colorId)}
                    className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} rounded border-2 shrink-0 ${stageColorSwatchClasses[colorId]} ${
                        value === colorId
                            ? 'ring-2 ring-offset-1 ring-gray-700 border-gray-600'
                            : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    title={STAGE_COLOR_LABELS[colorId]}
                />
            ))}
        </div>
    );
};
