import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from '../../components/StatusBadge.jsx'

/**
 * Unit tests for StatusBadge component.
 * Verifies label text and rendering for each ticket status.
 */
describe('StatusBadge', () => {
  const statuses = [
    { status: '新建立',      label: '新建立' },
    { status: '處理中',      label: '處理中' },
    { status: '待使用者補充', label: '待補充' },
    { status: '已解決',      label: '已解決' },
    { status: '已結案',      label: '已結案' },
  ]

  it.each(statuses)(
    'renders correct label for status "$status"',
    ({ status, label }) => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  )

  it('renders unknown status as-is', () => {
    render(<StatusBadge status="未知狀態" />)
    expect(screen.getByText('未知狀態')).toBeInTheDocument()
  })

  it('renders a span element', () => {
    const { container } = render(<StatusBadge status="新建立" />)
    expect(container.querySelector('span')).toBeInTheDocument()
  })

  it('applies inline styles', () => {
    const { container } = render(<StatusBadge status="新建立" />)
    const span = container.querySelector('span')
    expect(span?.style.background).toBeTruthy()
    expect(span?.style.color).toBeTruthy()
  })

  it('uses fallback style for unrecognized status', () => {
    const { container } = render(<StatusBadge status="random_status" />)
    const span = container.querySelector('span')
    // fallback uses grey palette
    expect(span?.style.background).toBe('rgb(243, 244, 246)')
    expect(span?.style.color).toBe('rgb(107, 114, 128)')
  })
})
