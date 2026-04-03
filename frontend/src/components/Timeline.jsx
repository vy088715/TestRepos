import dayjs from 'dayjs'

export default function Timeline({ messages, currentUserId }) {
  if (!messages || messages.length === 0) return null

  return (
    <div style={styles.container}>
      {messages.map((msg, idx) => {
        const isMe = msg.authorId === currentUserId
        const isIt = msg.isItReply

        return (
          <div key={msg.id} style={{
            ...styles.item,
            flexDirection: isIt ? 'row-reverse' : 'row'
          }}>
            <div style={{
              ...styles.avatar,
              background: isIt ? '#1a56db' : '#e5e7eb',
              color: isIt ? '#fff' : '#555'
            }}>
              {isIt ? 'IT' : msg.authorName.charAt(0).toUpperCase()}
            </div>

            <div style={{
              ...styles.bubble,
              background: isIt ? '#e8f0fe' : '#fff',
              borderColor: isIt ? '#a8c4f8' : '#e5e7eb',
              borderRadius: isIt ? '12px 4px 12px 12px' : '4px 12px 12px 12px'
            }}>
              <div style={styles.bubbleHeader}>
                <span style={{
                  ...styles.authorName,
                  color: isIt ? '#1a56db' : '#555'
                }}>
                  {msg.authorName}
                  {isIt && <span style={styles.itBadge}>IT</span>}
                </span>
                <span style={styles.time}>{dayjs(msg.createdAt).format('MM/DD HH:mm')}</span>
              </div>
              <p style={styles.content}>{msg.content}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: 16 },
  item: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start'
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0
  },
  bubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    border: '1px solid',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
  },
  bubbleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  authorName: {
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  itBadge: {
    background: '#1a56db',
    color: '#fff',
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 10,
    fontWeight: 700
  },
  time: { fontSize: 12, color: '#aaa', marginLeft: 'auto' },
  content: {
    fontSize: 14,
    color: '#333',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
}
