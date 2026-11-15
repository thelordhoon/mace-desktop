import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Header from './components/header'
import Sidebar from './components/Sidebar'
import LoginForm from './components/LoginForm'
import CompanyManagement from './components/CompanyManagement'
import PartManagement from './components/parts/PartManagement'
import EstimateForm from './components/EstimateForm'
import ServiceManagement from './components/ServiceManagement'
import UserManagement from './components/UserManagement'
import DeliveryHistory from './components/DeliveryHistory'
import EngineerCalendar from './components/EngineerCalendar'
import PurchaseRequest from './components/PurchaseRequest'

export default function App() {
  const [user, setUser] = useState(null)
  const [currentMenu, setCurrentMenu] = useState('calendar')
  const [partsList, setPartsList] = useState([])
  const [purchaseAlerts, setPurchaseAlerts] = useState([]) // 헤더 알림용 상태

  useEffect(() => {
    checkUserSession()
    fetchParts()
    fetchPurchaseAlerts()
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

  // 헤더 표시용 최근 구매요청 상태 조회
  const fetchPurchaseAlerts = async () => {
    try {
      const { data: reqData } = await supabase
        .from('purchase_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!reqData || reqData.length === 0) {
        setPurchaseAlerts([])
        return
      }

      const reqIds = reqData.map(r => r.id)
      const { data: itemData } = await supabase
        .from('purchase_request_items')
        .select('*')
        .in('request_id', reqIds)

      const combined = reqData.map(req => ({
        ...req,
        items: (itemData || []).filter(item => item.request_id === req.id)
      }))

      setPurchaseAlerts(combined)
    } catch (err) {
      console.error('헤더 알림 조회 오류:', err)
    }
  }

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser)
    localStorage.setItem('mace_desk_user', JSON.stringify(loggedInUser))
    fetchPurchaseAlerts()
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
      
      <Header 
        user={user} 
        onLogout={handleLogout} 
        purchaseAlerts={purchaseAlerts}
        onNavigatePurchase={() => setCurrentMenu('purchase_request')}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar 
          currentMenu={currentMenu} 
          setCurrentMenu={setCurrentMenu} 
          isAdmin={isAdmin} 
        />

        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
          {currentMenu === 'calendar' && <EngineerCalendar user={user} />}
          {currentMenu === 'companies' && <CompanyManagement partsList={partsList} />}
          {currentMenu === 'parts' && <PartManagement />}
          {currentMenu === 'estimate' && <EstimateForm user={user} />}
          {currentMenu === 'service_management' && <ServiceManagement />}
          {currentMenu === 'delivery_history' && <DeliveryHistory partsList={partsList} />}
          {currentMenu === 'users' && isAdmin && <UserManagement />}
          {currentMenu === 'purchase_request' && (
            <PurchaseRequest 
              user={user} 
              isAdmin={isAdmin} 
              onUpdateRequests={fetchPurchaseAlerts} 
            />
          )}
        </main>
      </div>

    </div>
  )
}