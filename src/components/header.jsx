import React from 'react'

export default function Header({ user, onLogout, purchaseAlerts = [], onNavigatePurchase }) {
  // 💡 1순위: user.author, 2순위: user.full_name, 3순위: user.username (단, 'admin'이나 'bae'인 경우 실제 이름으로 매핑하거나 그대로 출력)
  const displayName = user?.author || user?.full_name || user?.username || '사용자'

  const visibleAlerts = purchaseAlerts.filter(req => {
    if (req.status === 'requested' || req.status === 'purchased') {
      return true
    }
    if (req.status === 'received' && req.received_at) {
      const receivedDate = new Date(req.received_at)
      const nextDayMidnight = new Date(
        receivedDate.getFullYear(),
        receivedDate.getMonth(),
        receivedDate.getDate() + 1,
        0, 0, 0
      )
      return new Date() < nextDayMidnight
    }
    return false
  })

  const latestAlert = visibleAlerts.length > 0 ? visibleAlerts[0] : null

  return (
    <header style={{ width: '100%', height: '60px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', zIndex: 10 }}>
      
      {/* 좌측 영역: 로고 + 알림 배너 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#2563EB' }}>MACE</span> DESK 대시보드
        </div>

        {latestAlert && (
          <div 
            onClick={onNavigatePurchase}
            title="클릭하여 구매요청 페이지로 이동"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '5px 12px', 
              borderRadius: '20px', 
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: latestAlert.status === 'requested' ? '#eff6ff' : latestAlert.status === 'purchased' ? '#fffbeb' : '#f0fdf4',
              border: latestAlert.status === 'requested' ? '1px solid #bfdbfe' : latestAlert.status === 'purchased' ? '1px solid #fde68a' : '1px solid #bbf7d0',
              color: latestAlert.status === 'requested' ? '#1d4ed8' : latestAlert.status === 'purchased' ? '#b45309' : '#15803d',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            {latestAlert.status === 'requested' && (
              <>
                <span>🛒 신규 구매요청이 있습니다</span>
                <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '9px', fontWeight: '800', padding: '2px 5px', borderRadius: '8px' }}>
                  NEW
                </span>
              </>
            )}

            {latestAlert.status === 'purchased' && latestAlert.items?.length > 0 && (
              <>
                <span>🚚</span>
                <span>
                  <strong>{latestAlert.items[0].item_name} ({latestAlert.items[0].quantity}{latestAlert.items[0].unit})</strong>
                  {latestAlert.items.length > 1 ? ` 외 ${latestAlert.items.length - 1}건` : ''} 배송중!
                </span>
              </>
            )}

            {latestAlert.status === 'received' && latestAlert.items?.length > 0 && (
              <>
                <span>✅</span>
                <span>
                  <strong>{latestAlert.items[0].item_name} ({latestAlert.items[0].quantity}{latestAlert.items[0].unit})</strong> 수령완료 ({latestAlert.recipient_name})
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* 우측 사용자 이름 및 로그아웃 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
          👤 환영합니다. <strong>{displayName}</strong> 님
        </div>
        <button onClick={onLogout} style={{ padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>
          로그아웃
        </button>
      </div>

    </header>
  )
}