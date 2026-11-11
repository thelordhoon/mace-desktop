import React from 'react'

export default function Sidebar({ currentMenu, setCurrentMenu, isAdmin, resetViewMode }) {
  const handleMenuClick = (menu) => {
    setCurrentMenu(menu)
    if (resetViewMode) resetViewMode('list')
  }

  return (
    <aside style={{ width: '240px', backgroundColor: '#1e293b', color: '#cbd5e1', padding: '24px 14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', padding: '0 10px 6px 10px', textTransform: 'uppercase' }}>시스템 메뉴</div>
      
      <button 
        onClick={() => handleMenuClick('calendar')}
        style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'calendar' ? '#2563eb' : 'transparent', color: currentMenu === 'calendar' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        📅 현장 출장 및 작업 캘린더
      </button>

      <button 
        onClick={() => handleMenuClick('companies')}
        style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'companies' ? '#2563eb' : 'transparent', color: currentMenu === 'companies' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        🏢 거래처 관리
      </button>

      <button 
        onClick={() => handleMenuClick('parts')}
        style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'parts' ? '#2563eb' : 'transparent', color: currentMenu === 'parts' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        🔧 자재 및 부품 관리
      </button>

      <button 
        onClick={() => handleMenuClick('estimate')}
        style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'estimate' ? '#2563eb' : 'transparent', color: currentMenu === 'estimate' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        📝 견적서 작성
      </button>

      <button 
        onClick={() => handleMenuClick('service_management')}
        style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'service_management' ? '#2563eb' : 'transparent', color: currentMenu === 'service_management' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        📊 기술 서비스 내용 및 관리
      </button>

      <button 
        onClick={() => handleMenuClick('delivery_history')}
        style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'delivery_history' ? '#2563eb' : 'transparent', color: currentMenu === 'delivery_history' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        📦 입·출고증 이력관리
      </button>

      {isAdmin && (
        <button 
          onClick={() => handleMenuClick('users')}
          style={{ width: '100%', padding: '12px 14px', backgroundColor: currentMenu === 'users' ? '#2563eb' : 'transparent', color: currentMenu === 'users' ? '#ffffff' : '#cbd5e1', border: 'none', borderRadius: '8px', textAlign: 'left', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
        >
          👥 직원 승인 관리
        </button>
      )}
    </aside>
  )
}