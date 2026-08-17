import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  min = 1,
  max = 100,
  step = 1,
  unit = 'members',
  className = ''
}) => {
  const handleDecrement = () => {
    const next = Math.max(min, value - step);
    onChange(next);
  };

  const handleIncrement = () => {
    const next = Math.min(max, value + step);
    onChange(next);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10);
    if (isNaN(parsed)) return;
    onChange(Math.max(min, Math.min(max, parsed)));
  };

  return (
    <div className={`flex items-center justify-between bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-xs select-none ${className}`}>
      {/* Decrement Button */}
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center transition cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        title="Decrease"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      {/* Value Display / Direct Input */}
      <div className="flex-1 flex items-center justify-center space-x-1 px-2">
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          className="w-12 text-center bg-transparent font-bold text-sm text-zinc-950 dark:text-white focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {unit && (
          <span className="text-xs text-zinc-400 font-medium">
            {unit}
          </span>
        )}
      </div>

      {/* Increment Button */}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-800/80 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center transition cursor-pointer active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        title="Increase"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
