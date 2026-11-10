import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function EngineerCalendar({ user }) {
  const [schedules, setSchedules] = useState([])
  const [companies, setCompanies] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEngineerFilter, setSelectedEngineerFilter] = useState('ALL')
  
  // 💡 엔지니어 3명 + 관리부 추가
  const engineerList = ['배진철', '진희찬', '국민석', '관리부']
  const workTypes = ['출장/AS', '정기점검', '장비설치', '내부업무']

  // 게시판 상태 (공지사항, 영업부, 기술부)
  const [notices, setNotices] = useState([])
  const [salesNotes, setSalesNotes] = useState([])
  const [techNotes, setTechNotes] = useState([])
  
  // 공지/영업/기술 작성 모달 상태
  const [showBoardModal, setShowBoardModal] = useState(false)
  const [boardCategory, setBoardCategory] = useState('NOTICE') // NOTICE | SALES | TECH
  const [boardForm, setBoardForm] = useState({ author: '이현희', content: '' })

  // 달력 일정 모달 및 폼 상태
  const [showModal, setShowModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentScheduleId, setCurrentScheduleId] = useState(null)
  
  const [form, setForm] = useState({
    title: '',
    engineer_name: '배진철',
    company_name: '',
    work_type: '출장/AS',
    start_date: new Date().toISOString().substring(0, 10),
    end_date: new Date().toISOString().substring(0, 10),
    note: ''
  })

  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  useEffect(() => {
    const myName = user?.full_name || user?.username || '배진철'
    const defaultName = engineerList.includes(myName) ? myName : '배진철'
    
    setForm(prev => ({ ...prev, engineer_name: defaultName }))
    fetchCompanies()
    fetchBulletins()
  }, [])

  useEffect(() => {
    fetchSchedules()
  }, [currentDate])

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // 게시판(공지, 영업, 기술) 불러오기
  const fetchBulletins = async () => {
    const { data, error } = await supabase
      .from('bulletin_boards')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setNotices(data.filter(b => b.category === 'NOTICE'))
      setSalesNotes(data.filter(b => b.category === 'SALES'))
      setTechNotes(data.filter(b => b.category === 'TECH'))
    }
  }

  // 게시판 항목 작성 저장
  const handleSaveBoardItem = async (e) => {
    e.preventDefault()
    if (!boardForm.content.trim()) return alert('내용을 입력해주세요!')

    const { error } = await supabase.from('bulletin_boards').insert([{
      category: boardCategory,
      author: boardForm.author,
      content: boardForm.content,
      is_active: true
    }])

    if (error) {
      alert('등록 실패: ' + error.message)
    } else {
      alert('성공적으로 등록되었습니다.')
      setShowBoardModal(false)
      fetchBulletins()
    }
  }

  // 게시판 항목 삭제
  const handleDeleteBoardItem = async (id) => {
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('bulletin_boards').delete().eq('id', id)
    if (!error) fetchBulletins()
  }

  const fetchSchedules = async () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).toISOString().substring(0, 10)

    const { data, error } = await supabase
      .from('engineer_schedules')
      .select('*')
      .gte('start_date', firstDay)
      .lte('start_date', lastDay)
      .order('start_date', { ascending: true })

    if (!error) {
      setSchedules(data || [])
    }
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const handleOpenAddModal = (dateStr = null) => {
    setIsEditMode(false)
    setCurrentScheduleId(null)
    const targetDate = dateStr || new Date().toISOString().substring(0, 10)
    
    const myName = user?.full_name || user?.username || '배진철'
    const defaultName = engineerList.includes(myName) ? myName : '배진철'

    setForm({
      title: '',
      engineer_name: defaultName,
      company_name: '',
      work_type: '출장/AS',
      start_date: targetDate,
      end_date: targetDate,
      note: ''
    })
    setCompanySearchTerm('')
    setShowModal(true)
  }

  const handleOpenEditModal = (sch) => {
    setIsEditMode(true)
    setCurrentScheduleId(sch.id)
    setForm({
      title: sch.title || '',
      engineer_name: sch.engineer_name || engineerList[0],
      company_name: sch.company_name || '',
      work_type: sch.work_type || '출장/AS',
      start_date: sch.start_date || '',
      end_date: sch.end_date || sch.start_date || '',
      note: sch.note || ''
    })
    setCompanySearchTerm(sch.company_name || '')
    setShowModal(true)
  }

  const handleSubmitSchedule = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return alert('작업 제목을 입력해주세요!')
    if (!form.start_date) return alert('시작일을 입력해주세요!')

    const payload = {
      title: form.title,
      engineer_name: form.engineer_name,
      company_name: form.company_name,
      work_type: form.work_type,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      note: form.note
    }

    if (isEditMode) {
      const { error } = await supabase.from('engineer_schedules').update(payload).eq('id', currentScheduleId)
      if (error) alert('일정 수정 실패: ' + error.message)
      else {
        alert('일정이 수정되었습니다.')
        setShowModal(false)
        fetchSchedules()
      }
    } else {
      const { error } = await supabase.from('engineer_schedules').insert([payload])
      if (error) alert('일정 등록 실패: ' + error.message)
      else {
        alert('신규 일정이 등록되었습니다.')
        setShowModal(false)
        fetchSchedules()
      }
    }
  }

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('engineer_schedules').delete().eq('id', id)
    if (!error) {
      alert('일정이 삭제되었습니다.')
      setShowModal(false)
      fetchSchedules()
    } else {
      alert('삭제 실패: ' + error.message)
    }
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

  const calendarCells = []
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null)
  }
  for (let d = 1; d <= totalDays; d++) {
    const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    calendarCells.push(formattedDate)
  }

  // 💡 배지 스타일: 관리부는 은은한 연보라색(#f3e8ff)으로 다르게 지정
  const getBadgeStyle = (type, engineerName) => {
    if (engineerName === '관리부') {
      return { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' }
    }

    switch (type) {
      case '출장/AS': return { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' }
      case '정기점검': return { bg: '#dcfce7', color: '#166534', border: '#86efac' }
      case '장비설치': return { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' }
      default: return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
    }
  }

  const filteredSchedules = schedules.filter(sch => {
    if (selectedEngineerFilter === 'ALL') return true
    return sch.engineer_name === selectedEngineerFilter
  })

  const filteredCompanies = companies.filter(c => 
    c.name && c.name.toLowerCase().includes((companySearchTerm || '').toLowerCase())
  )

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 상단 컨트롤 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '800' }}>📅 현장 출장 및 작업 캘린더</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setSelectedEngineerFilter('ALL')}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: 'none',
                backgroundColor: selectedEngineerFilter === 'ALL' ? '#2563EB' : 'transparent',
                color: selectedEngineerFilter === 'ALL' ? '#FFFFFF' : '#475569',
                fontWeight: '700', fontSize: '13px', cursor: 'pointer'
              }}
            >
              전체
            </button>
            {engineerList.map((eng) => (
              <button
                key={eng}
                onClick={() => setSelectedEngineerFilter(eng)}
                style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  backgroundColor: selectedEngineerFilter === eng ? '#2563EB' : 'transparent',
                  color: selectedEngineerFilter === eng ? '#FFFFFF' : '#475569',
                  fontWeight: '700', fontSize: '13px', cursor: 'pointer'
                }}
              >
                {eng}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handlePrevMonth} style={{ padding: '6px 12px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>◀</button>
            <span style={{ fontSize: '18px', fontWeight: '800', color: '#1E293B', minWidth: '120px', textAlign: 'center' }}>
              {year}년 {month + 1}월
            </span>
            <button onClick={handleNextMonth} style={{ padding: '6px 12px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>▶</button>
          </div>

          <button 
            onClick={() => handleOpenAddModal()}
            style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}
          >
            + 일정 등록
          </button>
        </div>
      </div>

      {/* 메인 2단 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* 👈 좌측 패널 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 1. 중요 공지사항 Box */}
          <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px dashed #FDE68A', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>📢</span>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#92400E', fontWeight: '800' }}>주요 공지사항</h3>
              </div>
              <button 
                onClick={() => {
                  setBoardCategory('NOTICE')
                  setBoardForm({ author: '이현희', content: '' })
                  setShowBoardModal(true)
                }}
                style={{ background: '#F59E0B', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                + 등록
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#B45309', marginBottom: '8px', fontWeight: '600' }}>
              📌 택배 마감, 미지급/선입금 업체 고지
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {notices.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#D97706', textAlign: 'center', padding: '10px 0' }}>등록된 공지가 없습니다.</div>
              ) : (
                notices.map(item => (
                  <div key={item.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #FDE68A', borderRadius: '6px', padding: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800', color: '#B45309', fontSize: '11px' }}>[{item.author}]</span>
                      <button onClick={() => handleDeleteBoardItem(item.id)} style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                    </div>
                    <div style={{ color: '#1F2937', whiteSpace: 'pre-wrap', lineHeight: '1.3', wordBreak: 'break-all' }}>{item.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. 영업부 전달사항 Box */}
          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px dashed #BFDBFE', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>💼</span>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#1E40AF', fontWeight: '800' }}>영업부 전달사항</h3>
              </div>
              <button 
                onClick={() => {
                  setBoardCategory('SALES')
                  setBoardForm({ author: '서주섭', content: '' })
                  setShowBoardModal(true)
                }}
                style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                + 등록
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#1D4ED8', marginBottom: '8px', fontWeight: '600' }}>
              🔍 업체 소통 일정 & 장비 S/N 지정
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {salesNotes.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#3B82F6', textAlign: 'center', padding: '10px 0' }}>등록된 전달사항이 없습니다.</div>
              ) : (
                salesNotes.map(item => (
                  <div key={item.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800', color: '#1D4ED8', fontSize: '11px' }}>[{item.author}]</span>
                      <button onClick={() => handleDeleteBoardItem(item.id)} style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                    </div>
                    <div style={{ color: '#1F2937', whiteSpace: 'pre-wrap', lineHeight: '1.3', wordBreak: 'break-all' }}>{item.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3. 기술부 공지사항 Box */}
          <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px dashed #BBF7D0', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>🔧</span>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#166534', fontWeight: '800' }}>기술부 공지사항</h3>
              </div>
              <button 
                onClick={() => {
                  setBoardCategory('TECH')
                  const myName = user?.full_name || user?.username || '배진철'
                  setBoardForm({ author: engineerList.includes(myName) ? myName : '배진철', content: '' })
                  setShowBoardModal(true)
                }}
                style={{ background: '#16A34A', color: '#fff', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                + 등록
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#15803D', marginBottom: '8px', fontWeight: '600' }}>
              🛠️ 부품/장비 수리, 작업 관련 기술 공지
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
              {techNotes.length === 0 ? (
                <div style={{ fontSize: '12px', color: '#22C55E', textAlign: 'center', padding: '10px 0' }}>등록된 기술 공지가 없습니다.</div>
              ) : (
                techNotes.map(item => (
                  <div key={item.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800', color: '#15803D', fontSize: '11px' }}>[{item.author}]</span>
                      <button onClick={() => handleDeleteBoardItem(item.id)} style={{ border: 'none', background: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '10px' }}>✕</button>
                    </div>
                    <div style={{ color: '#1F2937', whiteSpace: 'pre-wrap', lineHeight: '1.3', wordBreak: 'break-all' }}>{item.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* 👉 우측 메인 달력 그리드 */}
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'center', fontWeight: '700', fontSize: '13px', color: '#64748B' }}>
            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
              <div key={day} style={{ padding: '12px 0', color: idx === 0 ? '#EF4444' : idx === 6 ? '#2563EB' : '#475569' }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', autoRows: 'minmax(200px, auto)' }}>
            {calendarCells.map((dateStr, index) => {
              if (!dateStr) {
                return <div key={`empty-${index}`} style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #F1F5F9', borderRight: '1px solid #F1F5F9' }} />
              }

              const daySchedules = filteredSchedules.filter(sch => sch.start_date <= dateStr && sch.end_date >= dateStr)
              const dayNum = dateStr.split('-')[2]
              const isToday = dateStr === new Date().toISOString().substring(0, 10)

              return (
                <div 
                  key={dateStr}
                  onClick={() => handleOpenAddModal(dateStr)}
                  style={{ 
                    borderBottom: '1px solid #F1F5F9', 
                    borderRight: '1px solid #F1F5F9', 
                    padding: '8px', 
                    backgroundColor: isToday ? '#EFF6FF' : '#FFFFFF',
                    cursor: 'pointer',
                    minHeight: '200px',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '13px', 
                      fontWeight: '700', 
                      width: '24px', 
                      height: '24px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      borderRadius: '50%',
                      backgroundColor: isToday ? '#2563EB' : 'transparent',
                      color: isToday ? '#FFFFFF' : '#334155'
                    }}>
                      {Number(dayNum)}
                    </span>
                    {daySchedules.length > 0 && (
                      <span style={{ fontSize: '10px', backgroundColor: '#E2E8F0', color: '#475569', padding: '1px 5px', borderRadius: '10px', fontWeight: '700' }}>
                        {daySchedules.length}건
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', maxHeight: '165px', paddingRight: '2px' }}>
                    {daySchedules.map((sch) => {
                      // 💡 두 번째 인자로 sch.engineer_name 전달
                      const badge = getBadgeStyle(sch.work_type, sch.engineer_name)
                      return (
                        <div 
                          key={sch.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditModal(sch)
                          }}
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            borderRadius: '6px',
                            padding: '4px 6px',
                            fontSize: '11px',
                            fontWeight: '600',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '800' }}>[{sch.engineer_name}]</span>
                            <span style={{ fontSize: '10px', opacity: 0.85 }}>{sch.work_type}</span>
                          </div>
                          <div style={{ wordBreak: 'break-all', lineHeight: '1.2' }}>
                            {sch.company_name ? `${sch.company_name} - ` : ''}{sch.title}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 공지사항 / 영업부 / 기술부 통합 등록 모달 */}
      {showBoardModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>
                {boardCategory === 'NOTICE' ? '📢 주요 공지사항 등록' : boardCategory === 'SALES' ? '💼 영업부 전달사항 등록' : '🔧 기술부 공지사항 등록'}
              </h3>
              <button onClick={() => setShowBoardModal(false)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSaveBoardItem} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>작성자*</label>
                <select 
                  value={boardForm.author} 
                  onChange={(e) => setBoardForm({ ...boardForm, author: e.target.value })}
                  style={inputStyle}
                >
                  {boardCategory === 'NOTICE' && (
                    <>
                      <option value="이현희">이현희</option>
                      <option value="김우연">김우연</option>
                    </>
                  )}
                  {boardCategory === 'SALES' && (
                    <>
                      <option value="서주섭">서주섭 (영업부)</option>
                      <option value="영업부">영업부 전체</option>
                    </>
                  )}
                  {boardCategory === 'TECH' && (
                    <>
                      <option value="배진철">배진철</option>
                      <option value="진희찬">진희찬</option>
                      <option value="국민석">국민석</option>
                      <option value="기술부">기술부 전체</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label style={labelStyle}>내용*</label>
                <textarea 
                  rows="4" 
                  placeholder={
                    boardCategory === 'NOTICE' ? '예: 오늘 16시 택배 마감입니다.' : 
                    boardCategory === 'SALES' ? '예: 한국몰렉스 수리장비 S/N: LJ-392171 지정건' :
                    '예: 잉크 펌프 테스트용 장비 출고 전 세팅 확인 필요'
                  }
                  value={boardForm.content} 
                  onChange={(e) => setBoardForm({ ...boardForm, content: e.target.value })} 
                  style={inputStyle} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowBoardModal(false)} style={{ padding: '8px 14px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button 
                  type="submit" 
                  style={{ 
                    padding: '8px 16px', 
                    background: boardCategory === 'NOTICE' ? '#F59E0B' : boardCategory === 'SALES' ? '#2563EB' : '#16A34A', 
                    color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' 
                  }}
                >
                  등록하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 일정 등록 / 수정 모달 */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                {isEditMode ? '✏️ 현장 일정 수정' : '📅 신규 현장 일정 등록'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleSubmitSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>담당 엔지니어*</label>
                  <select 
                    name="engineer_name"
                    value={form.engineer_name} 
                    onChange={handleFormChange} 
                    style={inputStyle}
                  >
                    {engineerList.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>업무 구분*</label>
                  <select 
                    name="work_type"
                    value={form.work_type} 
                    onChange={handleFormChange} 
                    style={inputStyle}
                  >
                    {workTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>관련 거래처 (선택)</label>
                <input 
                  type="text"
                  placeholder="거래처 검색..."
                  value={companySearchTerm}
                  onChange={(e) => {
                    const val = e.target.value
                    setCompanySearchTerm(val)
                    setForm(prev => ({ ...prev, company_name: val }))
                    setShowCompanyDropdown(true)
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  style={inputStyle}
                />
                {showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0 && (
                  <ul style={{ 
                    position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 50, 
                    maxHeight: '140px', overflowY: 'auto', backgroundColor: '#fff', 
                    border: '1px solid #CBD5E1', borderRadius: '8px', listStyle: 'none', padding: 0, margin: '2px 0 0 0',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}>
                    {filteredCompanies.map(c => (
                      <li 
                        key={c.id}
                        onClick={() => {
                          setForm(prev => ({ ...prev, company_name: c.name }))
                          setCompanySearchTerm(c.name)
                          setShowCompanyDropdown(false)
                        }}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', fontSize: '13px' }}
                      >
                        {c.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label style={labelStyle}>작업 제목 / 이슈 요약*</label>
                <input 
                  type="text" 
                  name="title"
                  placeholder="예: 잉크 공급 장치 점검 및 노즐 교체" 
                  value={form.title} 
                  onChange={handleFormChange} 
                  style={inputStyle} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>시작일*</label>
                  <input type="date" name="start_date" value={form.start_date} onChange={handleFormChange} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>종료일</label>
                  <input type="date" name="end_date" value={form.end_date} onChange={handleFormChange} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>상세 메모 및 특이사항</label>
                <textarea rows="3" name="note" placeholder="메모 입력..." value={form.note} onChange={handleFormChange} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px' }}>
                {isEditMode ? (
                  <button type="button" onClick={() => handleDeleteSchedule(currentScheduleId)} style={{ padding: '10px 16px', background: '#FEE2E2', color: '#EF4444', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                    삭제
                  </button>
                ) : <div />}
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setShowModal(false)} style={{ padding: '10px 16px', background: '#F1F5F9', color: '#64748B', border: '1px solid #CBD5E1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                    취소
                  </button>
                  <button type="submit" style={{ padding: '10px 20px', background: '#2563EB', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                    {isEditMode ? '수정 사항 저장' : '일정 등록 저장'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}