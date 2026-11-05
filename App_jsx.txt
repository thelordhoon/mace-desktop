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

  // 앱 실행 시 세션 체크 및 부품 목록 선행 로드 (단가 계산용)
  useEffect(() => {
    checkUserSession()
    fetchParts()
  }, [])

  const checkUserSession = async () => {
    // 로컬 스토리지나 Supabase 세션 연동 관리
    const savedUser = localStorage.getItem('mace_desk_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
  }

  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
    setPartsList(data || [])
  }

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('mace_desk_user', JSON.stringify(loggedInUser))
  }

  const handleLogout = () => {
    localStorage.removeItem('mace_desk_user')
    setUser(null)
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