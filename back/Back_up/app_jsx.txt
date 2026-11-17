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
import MobileCompanyView from './components/mobile/MobileCompanyView'

export default function App() {
  const [user, setUser] = useState(null)
  const [currentMenu, setCurrentMenu] = useState('calendar')
  const [partsList, setPartsList] = useState([])
  const [purchaseAlerts, setPurchaseAlerts] = useState([])
  
  // 💡 모바일 화면 여부 및 모바일 내부 뷰 상태 ('calendar' | 'companies')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const [mobileSubView, setMobileSubView] = useState('calendar') 
  const [initialCompanySearch, setInitialCompanySearch] = useState('')
  const [companies, setCompanies] = useState([])
  const [allHistories, setAllHistories] = useState([])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    checkUserSession()
    fetchParts()
    fetchPurchaseAlerts()
    fetchCompanies()
    fetchAllServiceHistories()
  }, [])

  const checkUserSession = async () => {
    const savedUser = localStorage.getItem('mace_desk_user')
    if (savedUser) setUser(JSON.parse(savedUser))
  }

  const fetchParts = async () => {
    const { data } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
    setPartsList(data || [])
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    setCompanies(data || [])
  }

  const fetchAllServiceHistories = async () => {
    const { data } = await supabase.from('service_history').select('*').order('created_at', { ascending: false })
    setAllHistories(data || [])
  }

  const fetchPurchaseAlerts = async () => {
    try {
      const { data: reqData } = await supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(5)
      if (!reqData || reqData.length === 0) { setPurchaseAlerts([]); return; }
      const reqIds = reqData.map(r => r.id)
      const { data: itemData } = await supabase.from('purchase_request_items').select('*').in('request_id', reqIds)
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

  // 💡 모바일 접속 시 440px 고정 프레임
  if (isMobile) {
  return (
    <div style={{ maxWidth: '440px', width: '100%', margin: '0 auto', minHeight: '100vh', backgroundColor: '#F1F5F9', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowX: 'hidden' }}>
      <Header 
        user={user} 
        onLogout={handleLogout} 
        purchaseAlerts={purchaseAlerts}
        onNavigatePurchase={() => setCurrentMenu('purchase_request')}
        isMobileView={true}
      />
      
      <div style={{ display: 'flex', backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0', padding: '8px 12px', gap: '8px' }}>
        <button 
          onClick={() => { setInitialCompanySearch(''); setMobileSubView('calendar'); }}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: mobileSubView === 'calendar' ? '#2563EB' : '#F1F5F9', color: mobileSubView === 'calendar' ? '#fff' : '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
        >
          📅 출장 캘린더
        </button>
        <button 
          onClick={() => setMobileSubView('companies')}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', backgroundColor: mobileSubView === 'companies' ? '#2563EB' : '#F1F5F9', color: mobileSubView === 'companies' ? '#fff' : '#475569', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
        >
          🏢 전체 업체 관리
        </button>
      </div>

      <div style={{ flex: 1, padding: '12px', boxSizing: 'border-box' }}>
        {mobileSubView === 'calendar' ? (
          <EngineerCalendar 
            user={user} 
            isMobileView={true} 
            companies={companies}
            onNavigateToCompany={(companyName) => {
              // 💡 캘린더에서 업체명을 받아와 저장하고 업체 관리 뷰로 전환
              setInitialCompanySearch(companyName)
              setMobileSubView('companies')
            }}
          />
        ) : (
          <MobileCompanyView 
            user={user}
            companies={companies}
            allHistories={allHistories}
            partsList={partsList}
            initialSearchTerm={initialCompanySearch} // 💡 검색어 전달
            onRefreshData={() => {
              fetchCompanies()
              fetchAllServiceHistories()
              fetchParts()
            }}
            onBackToCalendar={() => {
              setInitialCompanySearch('')
              setMobileSubView('calendar')
            }}
          />
        )}
      </div>
    </div>
  )
}

  // 🖥️ 데스크탑 버전 기존 레이아웃 유지
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#F1F5F9', fontFamily: '-apple-system, sans-serif', overflow: 'hidden' }}>
      <Header user={user} onLogout={handleLogout} purchaseAlerts={purchaseAlerts} onNavigatePurchase={() => setCurrentMenu('purchase_request')} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar currentMenu={currentMenu} setCurrentMenu={setCurrentMenu} isAdmin={isAdmin} />
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto', boxSizing: 'border-box' }}>
          {currentMenu === 'calendar' && <EngineerCalendar user={user} isMobileView={false} />}
          {currentMenu === 'companies' && <CompanyManagement partsList={partsList} />}
          {currentMenu === 'parts' && <PartManagement />}
          {currentMenu === 'estimate' && <EstimateForm user={user} />}
          {currentMenu === 'service_management' && <ServiceManagement />}
          {currentMenu === 'delivery_history' && <DeliveryHistory partsList={partsList} />}
          {currentMenu === 'users' && isAdmin && <UserManagement />}
          {currentMenu === 'purchase_request' && <PurchaseRequest user={user} isAdmin={isAdmin} onUpdateRequests={fetchPurchaseAlerts} />}
        </main>
      </div>
    </div>
  )
}