import React from 'react'

export default function Header({ user, onLogout }) {
  return (
    <header style={{ width: '100%', height: '60px', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box', zIndex: 10 }}>
      <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#2563EB' }}>MACE</span> DESK 대시보드
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
          👤 환영합니다. <strong>{user.full_name || user.username}</strong> 님
        </div>
        <button onClick={onLogout} style={{ padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>
          로그아웃
        </button>
      </div>
    </header>
  )
}