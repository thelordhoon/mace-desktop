import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import LoginForm from './components/LoginForm'
import UserManagement from './components/UserManagement'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // 현재 선택된 메뉴 ('main' 또는 'users')
  const [currentMenu, setCurrentMenu] = useState('main')

  useEffect(() => {
    const savedUser = localStorage.getItem('mace_user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        localStorage.removeItem('mace_user')
      }
    }
    setLoading(false)
  }, [])

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('mace_user', JSON.stringify(loggedInUser))
    setCurrentMenu('main')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('mace_user')
    setUser(null)
    setCurrentMenu('main')
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>
        시스템 로딩 중...
      </div>
    )
  }

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />
  }

  const isAdmin = user.username === 'bae'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, sans-serif', margin: 0 }}>
      
      {/* 🚀 1. TOP 바 (상단 헤더) */}
      <header style={{ 
        width: '100%', 
        height: '60px',
        backgroundColor: '#ffffff', 
        borderBottom: '1px solid #e2e8f0', 
        padding: '0 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxSizing: 'border-box',
        zIndex: 10
      }}>
        <div style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
          MACE DESK SYSTEM
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
            환영합니다. <strong>{user.full_name || user.username}</strong> 님
          </div>
          <button 
            onClick={handleLogout} 
            style={{ 
              padding: '6px 12px', 
              background: '#f1f5f9', 
              color: '#475569', 
              border: '1px solid #cbd5e1', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: '600', 
              fontSize: '12px' 
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 🚀 2단 영역 (SIDE + MAIN) */}
      <div style={{ display: 'flex', flex: 1, width: '100%', boxSizing: 'border-box' }}>
        
        {/* 🚀 2. SIDE 바 (좌측 메뉴) */}
        <aside style={{ 
          width: '240px', 
          backgroundColor: '#1e293b', 
          color: '#cbd5e1', 
          padding: '20px 14px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', padding: '0 10px 6px 10px', textTransform: 'uppercase' }}>
            메뉴 목록
          </div>

          <button 
            onClick={() => setCurrentMenu('main')}
            style={{
              width: '100%',
              padding: '10px 14px',
              backgroundColor: currentMenu === 'main' ? '#2563eb' : 'transparent',
              color: currentMenu === 'main' ? '#ffffff' : '#cbd5e1',
              border: 'none',
              borderRadius: '6px',
              textAlign: 'left',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            📦 자재 재고 대시보드
          </button>

          {/* 관리자(bae)에게만 사이드바에 직원 관리 메뉴 노출 */}
          {isAdmin && (
            <button 
              onClick={() => setCurrentMenu('users')}
              style={{
                width: '100%',
                padding: '10px 14px',
                backgroundColor: currentMenu === 'users' ? '#2563eb' : 'transparent',
                color: currentMenu === 'users' ? '#ffffff' : '#cbd5e1',
                border: 'none',
                borderRadius: '6px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              👥 직원 가입 승인 관리
            </button>
          )}
        </aside>

        {/* 🚀 3. MAIN 영역 (우측 화면 가득 쓰는 메인 컨텐츠 공간) */}
        <main style={{ flex: 1, padding: '24px', boxSizing: 'border-box', backgroundColor: '#f8fafc', overflowY: 'auto' }}>
          {isAdmin && currentMenu === 'users' ? (
            <UserManagement />
          ) : (
            <div style={{ 
              width: '100%', 
              minHeight: 'calc(100vh - 110px)', 
              backgroundColor: '#ffffff', 
              borderRadius: '12px', 
              border: '1px solid #e2e8f0', 
              padding: '40px', 
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              <h2 style={{ fontSize: '24px', color: '#0f172a', margin: '0 0 10px 0' }}>📦 자재 재고 대시보드 메인 화면</h2>
              <p style={{ fontSize: '15px', color: '#64748b', margin: 0 }}>
                좌측 사이드바와 상단 Top 바가 고정된 화면 가득 쓰는 넓은 업무 공간입니다.
              </p>
            </div>
          )}
        </main>

      </div>
    </div>
  )
}