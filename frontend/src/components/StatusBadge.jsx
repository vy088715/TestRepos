const STATUS_CONFIG = {
  '新建立': { bg: '#dbeafe', color: '#1d4ed8', label: '新建立' },
  '處理中': { bg: '#fed7aa', color: '#c2410c', label: '處理中' },
  '待使用者補充': { bg: '#fef9c3', color: '#a16207', label: '待補充' },
  '已解決': { bg: '#dcfce7', color: '#15803d', label: '已解決' },
  '已結案': { bg: '#f3f4f6', color: '#6b7280', label: '已結案' }
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span style={{
      display: 'inline-block',
      background: config.bg,
      color: config.color,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap'
    }}>
      {config.label}
    </span>
  )
}
