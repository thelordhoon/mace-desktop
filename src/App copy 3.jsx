import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Header from './components/header'
import Sidebar from './components/Sidebar'
import LoginForm from './components/LoginForm'
import CompanyManagement from './components/CompanyManagement'
import PartManagement from './components/PartManagement'
import UserManagement from './components/UserManagement'

export default function App() {
  const [user, setUser] = useState(null)
  const [currentMenu, setCurrentMenu] = useState('companies')
  const [partsList, setPartsList] = useState([])
  
  // 💡 로딩 상태 및 프로그레스 바 관련 상태 추가
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [loadingStepText, setLoadingStepText] = useState('시스템 초기화 중...')

  // 앱 실행 시 세션 체크 및 부품 목록 선행 로드 (단가 계산용)
  useEffect(() => {
    initializeApp()
  }, [])

  const initializeApp = async () => {
    try {
      setLoading(true)
      setLoadingProgress(15)
      setLoadingStepText('사용자 세션 확인 중...')

      // 1. 세션 체크
      const savedUser = localStorage.getItem('mace_desk_user')
      if (savedUser) {
        setUser(JSON.parse(savedUser))
      }
      setLoadingProgress(50)
      setLoadingStepText('부품 및 자재 데이터 동기화 중 (50%)')

      // 2. 부품 목록 로드
      const { data, error } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setPartsList(data || [])

      setLoadingProgress(90)
      setLoadingStepText('대시보드 UI 구성 중...')

      setLoadingProgress(100)
      setLoadingStepText('로딩 완료!')
    } catch (error) {
      console.error('초기화 에러:', error.message)
      setLoadingStepText('데이터 로딩 실패')
    } finally {
      // 로딩 바가 100%까지 매끄럽게 보인 뒤 화면 전환
      setTimeout(() => {
        setLoading(false)
      }, 350)
    }
  }

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('mace_desk_user', JSON.stringify(loggedInUser))
  }

  const handleLogout = () => {
    localStorage.removeItem('mace_desk_user')
    setUser(null)
  }

  // 💡 초기 데이터 로딩 중일 때 보여줄 프로그레스 바 화면
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', color: 'white', fontFamily: '-apple-system, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '340px', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', padding: '12px', backgroundColor: 'rgba(37,99,235,0.2)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '16px', marginBottom: '12px' }}>
            <span style={{ fontSize: '24px' }}>⚡</span>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px 0', color: '#F8FAFC' }}>MACE DESK 대시보드 로딩 중</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', margin: '0 0 20px 0', fontWeight: '500' }}>{loadingStepText}</p>
          
          {/* 프로그레스 바 트랙 */}
          <div style={{ width: '100%', backgroundColor: '#1E293B', height: '10px', borderRadius: '9999px', overflow: 'hidden', padding: '2px', border: '1px solid #334155', boxSizing: 'border-box' }}>
            <div 
              style={{ width: `${loadingProgress}%`, height: '100%', backgroundColor: '#2563EB', borderRadius: '9999px', transition: 'width 0.3s ease-out' }}
            ></div>
          </div>
          
          <div style={{ textAlign: 'right', fontSize: '12px', fontFamily: 'monospace', fontWeight: '700', color: '#60A5FA', marginTop: '8px' }}>
            {loadingProgress}%
          </div>
        </div>
      </div>
    )
  }

  // 로그인하지 않은 경우 로그인 화면 출력
  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />
  }

  const isAdmin = user.role === 'admin' || user.username === 'bae'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F1F5F9', fontFamily: '-apple-system, sans-serif', overflow: 'hidden' }}>
      
      {/* 1. 상단 헤더 */}
      <Header user={user} onLogout={handleLogout} />

      {/* 2. 메인 바디 (사이드바 + 컨텐츠 영역) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* 사이드바 메뉴 */}
        <Sidebar 
          currentMenu={currentMenu} 
          setCurrentMenu={setCurrentMenu} 
          isAdmin={isAdmin} 
        />

        {/* 우측 메인 콘텐츠 뷰어 */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
          {currentMenu === 'companies' && <CompanyManagement partsList={partsList} />}
          {currentMenu === 'parts' && <PartManagement />}
          {currentMenu === 'users' && isAdmin && <UserManagement />}
        </main>
      </div>

    </div>
  )
}