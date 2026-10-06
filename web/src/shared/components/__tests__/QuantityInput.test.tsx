import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuantityInput } from '../QuantityInput'

describe('QuantityInput Component', () => {
  it('renders input with default unit and label', () => {
    const handleChange = vi.fn()
    render(
      <QuantityInput
        label="Số lượng"
        value=""
        onChange={handleChange}
        unit="van"
        onUnitChange={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Số lượng/)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Đơn vị tính số lượng/ })).toHaveValue('van')
    expect(screen.getByText('1 vạn')).toBeInTheDocument()
    expect(screen.getByText('10 vạn')).toBeInTheDocument()
  })

  it('renders live normalized preview for valid number input', () => {
    const handleChange = vi.fn()
    render(
      <QuantityInput
        label="Số lượng"
        value="3"
        onChange={handleChange}
        unit="van"
      />
    )

    // With unit='van', 3 is parsed as 30000
    expect(screen.getByText('= 30.000 cây')).toBeInTheDocument()
  })

  it('handles Vietnamese forestry input variants: "30.000", "4,52 vạn", "3v"', () => {
    const handleChange = vi.fn()
    const { rerender } = render(
      <QuantityInput
        value="30.000"
        onChange={handleChange}
        unit="cay"
      />
    )
    expect(screen.getByText('= 30.000 cây')).toBeInTheDocument()

    rerender(
      <QuantityInput
        value="4,52 vạn"
        onChange={handleChange}
        unit="van"
      />
    )
    expect(screen.getByText('= 45.200 cây')).toBeInTheDocument()

    rerender(
      <QuantityInput
        value="3v"
        onChange={handleChange}
        unit="van"
      />
    )
    expect(screen.getByText('= 30.000 cây')).toBeInTheDocument()
  })

  it('displays error message when invalid input is typed', () => {
    const handleChange = vi.fn()
    render(
      <QuantityInput
        value="không phải số"
        onChange={handleChange}
        unit="van"
      />
    )

    expect(
      screen.getByText('Không đọc được số lượng. Bạn có thể nhập 30000, 3 vạn hoặc 3v.')
    ).toBeInTheDocument()
  })

  it('calls onChange with raw and parsed values when user types', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    render(
      <QuantityInput
        value=""
        onChange={handleChange}
        unit="van"
      />
    )

    const input = screen.getByRole('textbox')
    await user.type(input, '5')

    expect(handleChange).toHaveBeenCalledWith('5', 50000)
  })

  it('calls onUnitChange and updates calculation when unit changes', () => {
    const handleChange = vi.fn()
    const handleUnitChange = vi.fn()
    render(
      <QuantityInput
        value="5"
        onChange={handleChange}
        unit="van"
        onUnitChange={handleUnitChange}
      />
    )

    const unitSelect = screen.getByRole('combobox', { name: /Đơn vị tính số lượng/ })
    fireEvent.change(unitSelect, { target: { value: 'cay' } })

    expect(handleUnitChange).toHaveBeenCalledWith('cay')
    expect(handleChange).toHaveBeenCalledWith('5', 5)
  })

  it('sets value when quick chips are clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    const handleUnitChange = vi.fn()
    render(
      <QuantityInput
        value=""
        onChange={handleChange}
        unit="cay"
        onUnitChange={handleUnitChange}
      />
    )

    const chip5 = screen.getByRole('button', { name: '5 vạn' })
    await user.click(chip5)

    expect(handleUnitChange).toHaveBeenCalledWith('van')
    expect(handleChange).toHaveBeenCalledWith('5', 50000)
  })
})
