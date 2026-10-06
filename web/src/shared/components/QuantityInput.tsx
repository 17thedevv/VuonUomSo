import React from 'react'
import { parseQuantity, formatQuantity } from '../../domain/quantity'
import { Check, AlertCircle } from 'lucide-react'

export interface QuantityInputProps {
  id?: string
  name?: string
  label?: string
  value: string
  onChange: (rawValue: string, parsedValue: number | null) => void
  unit?: 'cay' | 'van'
  onUnitChange?: (unit: 'cay' | 'van') => void
  placeholder?: string
  required?: boolean
  error?: string | null
  helperText?: string
  disabled?: boolean
  showQuickChips?: boolean
  autoFocus?: boolean
  className?: string
}

export const QuantityInput: React.FC<QuantityInputProps> = ({
  id = 'quantity-input',
  name = 'quantity',
  label,
  value,
  onChange,
  unit = 'van',
  onUnitChange,
  placeholder = 'VD: 3 vạn, 30.000 hoặc 5',
  required = false,
  error,
  helperText,
  disabled = false,
  showQuickChips = true,
  autoFocus = false,
  className = ''
}) => {
  const parsedValue = parseQuantity(value, unit)
  const isInvalidFormat = value.trim().length > 0 && parsedValue === null

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const parsed = parseQuantity(raw, unit)
    onChange(raw, parsed)
  }

  const handleUnitToggle = (newUnit: 'cay' | 'van') => {
    if (onUnitChange) {
      onUnitChange(newUnit)
      const parsed = parseQuantity(value, newUnit)
      onChange(value, parsed)
    }
  }

  const handleQuickChipClick = (amount: number, chipUnit: 'van') => {
    const raw = `${amount}`
    if (onUnitChange && unit !== chipUnit) {
      onUnitChange(chipUnit)
    }
    const parsed = amount * 10000
    onChange(raw, parsed)
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-bold text-slate-800">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}

      {/* Input container with unit selector */}
      <div className="flex rounded-xl border border-slate-300 focus-within:ring-2 focus-within:ring-emerald-600 focus-within:border-emerald-600 bg-white transition-all overflow-hidden shadow-2xs">
        <input
          id={id}
          name={name}
          type="text"
          inputMode="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`flex-1 px-3.5 py-3 text-base text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-hidden min-h-[48px] font-semibold ${
            error || isInvalidFormat ? 'text-rose-900' : ''
          }`}
        />

        {/* Unit Selector */}
        {onUnitChange && (
          <div className="flex items-center pr-1.5 pl-1 bg-slate-50 border-l border-slate-200">
            <select
              value={unit}
              onChange={(e) => handleUnitToggle(e.target.value as 'cay' | 'van')}
              disabled={disabled}
              aria-label="Đơn vị tính số lượng"
              className="text-xs font-bold text-slate-700 bg-transparent py-2 px-2 cursor-pointer focus:outline-hidden"
            >
              <option value="van">vạn</option>
              <option value="cay">cây</option>
            </select>
          </div>
        )}
      </div>

      {/* Normalized Live Preview or Error */}
      <div className="min-h-[22px] flex items-center text-xs">
        {parsedValue !== null && parsedValue > 0 ? (
          <div className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200">
            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
            <span>= {formatQuantity(parsedValue)} cây</span>
          </div>
        ) : isInvalidFormat ? (
          <div className="flex items-center gap-1 text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded-md">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Không đọc được số lượng. Bạn có thể nhập 30000, 3 vạn hoặc 3v.</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-1 text-rose-700 font-medium">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : helperText ? (
          <span className="text-slate-500">{helperText}</span>
        ) : null}
      </div>

      {/* Quick buttons */}
      {showQuickChips && !disabled && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-slate-400 font-medium">Chọn nhanh:</span>
          {[1, 2, 5, 10].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleQuickChipClick(num, 'van')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200/80 text-xs font-bold text-slate-700 active:scale-95 transition-all min-h-[32px]"
            >
              {num} vạn
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
