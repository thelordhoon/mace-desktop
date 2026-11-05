import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import LoginForm from './components/LoginForm'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import CompanyManagement from './components/CompanyManagement'
import PartManagement from './components/PartManagement'
import UserManagement from './components/UserManagement'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentMenu, setCurrentMenu] = useState('companies')
  const [partsList, setPartsList] = useState([])

  useEffect(() => {
    const savedUser = localStorage.getItem('mace_user')
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)) } catch (e) { localStorage.removeItem('mace_user') }
    }
    setLoading(false)
    fetchParts()
  }, [])

  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('*')
    setPartsList(data || [])
  }

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('mace_user', JSON.stringify(loggedInUser))
    setCurrentMenu('companies')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('mace_user')
    setUser(null)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#64748b' }}>시스템 로딩 중...</div>
  if (!user) return <LoginForm onLoginSuccess={handleLoginSuccess} />

  const isAdmin = user.username === 'bae'

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: '#F1F5F9', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', margin: 0, padding: 0 }}>
      <Header user={user} onLogout={handleLogout} />

      <div style={{ display: 'flex', flex: 1, width: '100%', margin: 0, padding: 0 }}>
        <Sidebar currentMenu={currentMenu} setCurrentMenu={setCurrentMenu} isAdmin={isAdmin} />


{/* 🚀 좌우 여백(Padding)을 35px ~ 40px로 넉넉히 주어 너무 극단적으로 퍼지는 현상 방지 */}
        <main style={{ flex: 1, padding: '30px 40px', backgroundColor: '#f8fafc', overflowY: 'auto', minWidth: 0 }}>
          {currentMenu === 'companies' && <CompanyManagement partsList={partsList} />}
          {currentMenu === 'parts' && <PartManagement />}
          {currentMenu === 'users' && isAdmin && <UserManagement />}
        </main>
      </div>
    </div>
  )
}