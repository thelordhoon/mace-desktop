import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Header from './components/header'
import Sidebar from './components/Sidebar'
import LoginForm from './components/LoginForm'
import CompanyManagement from './components/CompanyManagement'
import PartManagement from './components/PartManagement'
import EstimateForm from './components/EstimateForm'
import ServiceManagement from './components/ServiceManagement' // 💡 임포트 추가
import UserManagement from './components/UserManagement'
import DeliveryHistory from './components/DeliveryHistory'

export default function App() {
  const [user, setUser] = useState(null)
  const [currentMenu, setCurrentMenu] = useState('companies')
  const [partsList, setPartsList] = useState([])

  useEffect(() => {
    checkUserSession()
    fetchParts()
  }, [])

  const checkUserSession = async () => {
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

  if (!user) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />
  }

  const isAdmin = user.role === 'admin' || user.username === 'bae'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F1F5F9', fontFamily: '-apple-system, sans-serif', overflow: 'hidden' }}>
      
      <Header user={user} onLogout={handleLogout} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        <Sidebar 
          currentMenu={currentMenu} 
          setCurrentMenu={setCurrentMenu} 
          isAdmin={isAdmin} 
        />

        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
          {currentMenu === 'companies' && <CompanyManagement partsList={partsList} />}
          {currentMenu === 'parts' && <PartManagement />}
          {currentMenu === 'estimate' && <EstimateForm user={user} />}
          {/* 💡 신규 메뉴 분기 추가 */}
          {currentMenu === 'service_management' && <ServiceManagement />}
          {currentMenu === 'delivery_history' && <DeliveryHistory partsList={partsList} />}
          {currentMenu === 'users' && isAdmin && <UserManagement />}
        </main>
      </div>

    </div>
  )
}