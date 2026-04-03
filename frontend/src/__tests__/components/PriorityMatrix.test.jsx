import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriorityMatrix } from '../../components/PriorityMatrix.jsx'

/**
 * Unit tests for PriorityMatrix component.
 * Verifies the 3×3 grid, selection interaction, and legend.
 */
describe('PriorityMatrix', () => {
  // ──────────────────────────────────────────────────────────────────────
  //  Rendering
  // ──────────────────────────────────────────────────────────────────────

  it('renders 9 priority cells (3×3 grid)', () => {
    const { container } = render(<PriorityMatrix />)
    // Row labels S1, S2, S3
    expect(screen.getByText('S1')).toBeInTheDocument()
    expect(screen.getByText('S2')).toBeInTheDocument()
    expect(screen.getByText('S3')).toBeInTheDocument()
    // Col labels U1, U2, U3
    expect(screen.getByText('U1')).toBeInTheDocument()
    expect(screen.getByText('U2')).toBeInTheDocument()
    expect(screen.getByText('U3')).toBeInTheDocument()
  })

  it('renders the legend with P1, P2, P3 labels', () => {
    render(<PriorityMatrix />)
    // Each label appears in both the grid cells AND the legend
    expect(screen.getAllByText('P1 緊急').length).toBeGreaterThan(0)
    expect(screen.getAllByText('P2 高').length).toBeGreaterThan(0)
    expect(screen.getAllByText('P3 一般').length).toBeGreaterThan(0)
  })

  it('renders P1 cells at (S1,U1), (S1,U2), (S2,U1)', () => {
    render(<PriorityMatrix />)
    const p1Cells = screen.getAllByText('P1 緊急')
    // 3 cells + 1 legend entry = 4 total occurrences
    expect(p1Cells.length).toBe(4)
  })

  it('renders P3 cell only at (S3,U3)', () => {
    render(<PriorityMatrix />)
    const p3Cells = screen.getAllByText('P3 一般')
    // 1 cell + 1 legend entry = 2 total
    expect(p3Cells.length).toBe(2)
  })

  // ──────────────────────────────────────────────────────────────────────
  //  Interaction
  // ──────────────────────────────────────────────────────────────────────

  it('calls onSelect with correct severity and urgency when cell clicked', async () => {
    const onSelect = vi.fn()
    render(<PriorityMatrix onSelect={onSelect} />)

    // Click the cell with title "嚴重度 1 × 緊急度 1 = P1 緊急"
    const cell = screen.getByTitle('嚴重度 1 × 緊急度 1 = P1 緊急')
    await userEvent.click(cell)

    expect(onSelect).toHaveBeenCalledWith(1, 1)
  })

  it('calls onSelect with S3/U3 for P3 cell', async () => {
    const onSelect = vi.fn()
    render(<PriorityMatrix onSelect={onSelect} />)

    const cell = screen.getByTitle('嚴重度 3 × 緊急度 3 = P3 一般')
    await userEvent.click(cell)

    expect(onSelect).toHaveBeenCalledWith(3, 3)
  })

  it('does NOT call onSelect when readOnly=true', async () => {
    const onSelect = vi.fn()
    render(<PriorityMatrix onSelect={onSelect} readOnly={true} />)

    const cell = screen.getByTitle('嚴重度 1 × 緊急度 1 = P1 緊急')
    await userEvent.click(cell)

    expect(onSelect).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────────────────────────
  //  Selection highlight
  // ──────────────────────────────────────────────────────────────────────

  it('highlights selected cell with full opacity and dark border', () => {
    const { container } = render(
      <PriorityMatrix severity={2} urgency={2} />
    )
    // The selected cell (S2, U2) should have opacity: 1 and border with colour
    const selected = screen.getByTitle('嚴重度 2 × 緊急度 2 = P2 高')
    expect(selected.style.opacity).toBe('1')
    expect(selected.style.border).toContain('2px solid')
  })

  it('dims non-selected cells when a selection is active', () => {
    render(<PriorityMatrix severity={1} urgency={1} />)
    // A non-selected cell should have opacity 0.35
    const nonSelected = screen.getByTitle('嚴重度 3 × 緊急度 3 = P3 一般')
    expect(nonSelected.style.opacity).toBe('0.35')
  })
})
