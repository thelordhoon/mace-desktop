import React from 'react'

export default function Sidebar({ currentMenu, setCurrentMenu, isAdmin, resetViewMode }) {
  const handleMenuClick = (menu) => {
    setCurrentMenu(menu)
    if (resetViewMode) resetViewMode('list')
  }

  // 모든 메뉴 버튼에 공통으로 적용할 스타일
  const getButtonStyle = (menuName) => ({
    width: '100%',
    padding: '12px 14px',
    backgroundColor: currentMenu === menuName ? '#2563eb' : 'transparent',
    color: currentMenu === menuName ? '#ffffff' : '#cbd5e1',
    border: 'none',
    borderRadius: '8px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer'
  })

  return (
    <aside style={{ width: '240px', backgroundColor: '#1e293b', color: '#cbd5e1', padding: '24px 14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', padding: '0 10px 6px 10px', textTransform: 'uppercase' }}>시스템 메뉴</div>
      
      <button 
        onClick={() => handleMenuClick('calendar')}
        style={getButtonStyle('calendar')}
      >
        📅 현장 출장 및 작업 캘린더
      </button>

      <button 
        onClick={() => handleMenuClick('companies')}
        style={getButtonStyle('companies')}
      >
        🏢 거래처 관리
      </button>

      <button 
        onClick={() => handleMenuClick('parts')}
        style={getButtonStyle('parts')}
      >
        🔧 자재 및 부품 관리
      </button>

      <button
        onClick={() => handleMenuClick('purchase_request')}
        style={getButtonStyle('purchase_request')}
      >
        🛒 구매요청
      </button>

      <button 
        onClick={() => handleMenuClick('estimate')}
        style={getButtonStyle('estimate')}
      >
        📝 견적서 작성
      </button>

      <button 
        onClick={() => handleMenuClick('service_management')}
        style={getButtonStyle('service_management')}
      >
        📊 기술 서비스 내용 및 관리
      </button>

      {isAdmin && (
        <button 
          onClick={() => handleMenuClick('users')}
          style={getButtonStyle('users')}
        >
          👥 직원 승인 관리
        </button>
      )}
    </aside>
  )
}
