import React from 'react'

/**
 * Displays a 3x3 Severity × Urgency priority matrix.
 * 1 = highest, 3 = lowest for both axes.
 * Priority formula: CEILING((s + u - 1) / 2)
 *   P1 (Critical): (1,1),(1,2),(2,1)
 *   P2 (High):     (1,3),(2,2),(3,1)
 *   P3 (Normal):   (2,3),(3,2),(3,3)
 */

const PRIORITY_COLORS = {
  1: { bg: '#dc3545', label: 'P1 緊急' },
  2: { bg: '#fd7e14', label: 'P2 高'   },
  3: { bg: '#20c997', label: 'P3 一般' },
}

function getPriority(s, u) {
  return Math.ceil((s + u - 1) / 2)
}

export function PriorityMatrix({ severity, urgency, onSelect, readOnly = false }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: '#6c757d' }}>
          ← 緊急度 (1最高 → 3最低)
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 3 }}>
        {/* header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                      fontSize: 11, color: '#6c757d', paddingRight: 6 }}>嚴重度</div>
        {[1, 2, 3].map(u => (
          <div key={u} style={{ textAlign: 'center', fontSize: 11, color: '#6c757d', fontWeight: 600 }}>
            U{u}
          </div>
        ))}

        {/* data rows */}
        {[1, 2, 3].map(s => (
          <React.Fragment key={s}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          fontSize: 11, color: '#6c757d', fontWeight: 600, paddingRight: 6 }}>
              S{s}
            </div>
            {[1, 2, 3].map(u => {
              const p = getPriority(s, u)
              const { bg, label } = PRIORITY_COLORS[p]
              const isSelected = severity === s && urgency === u
              return (
                <div
                  key={u}
                  onClick={() => !readOnly && onSelect && onSelect(s, u)}
                  style={{
                    background: bg,
                    borderRadius: 4,
                    padding: '6px 4px',
                    textAlign: 'center',
                    cursor: readOnly ? 'default' : 'pointer',
                    opacity: severity && urgency ? (isSelected ? 1 : 0.35) : 0.8,
                    border: isSelected ? '2px solid #212529' : '2px solid transparent',
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    transition: 'opacity 0.15s',
                  }}
                  title={`嚴重度 ${s} × 緊急度 ${u} = ${label}`}
                >
                  {label}
                </div>
              )
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {Object.entries(PRIORITY_COLORS).map(([p, { bg, label }]) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, background: bg, borderRadius: 2 }} />
            <span style={{ color: '#495057' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default PriorityMatrix
