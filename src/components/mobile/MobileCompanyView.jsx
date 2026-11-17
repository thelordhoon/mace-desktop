import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'

export default function MobileCompanyView({ user, companies, allHistories, partsList, initialSearchTerm = '', onRefreshData, onBackToCalendar }) {
  const [viewMode, setViewMode] = useState('list') // 'list' | 'detail' | 'report'
  const [selectedCompany, setSelectedCompany] = useState(null)
  
  // 검색 및 정렬 상태
  const [companySearchTerm, setCompanySearchTerm] = useState(initialSearchTerm)
  const [companySortType, setCompanySortType] = useState('recent_history')
  const [detailSnSearchTerm, setDetailSnSearchTerm] = useState('')

  // 업체 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ name: '', managers: [], address: '', note: '', ink: '', solvent: '' })

  // 신규 업체 등록 상태
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState('')
  const [managers, setManagers] = useState([{ name: '', phone: '', role: '', email: '' }])
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [ink, setInk] = useState('')
  const [solvent, setSolvent] = useState('')

  // 서비스 리포트 작성 상태
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().split('T')[0])
  const [startHour, setStartHour] = useState('09')
  const [startMin, setStartMin] = useState('00')
  const [endHour, setEndHour] = useState('18')
  const [endMin, setEndMin] = useState('00')
  const [sn, setSn] = useState('')
  const [modelName, setModelName] = useState('JET2Neo')
  const [workContent, setWorkContent] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  
  // 교체 부품 상태 (2줄 레이아웃 및 S/N 직접 입력 모드 포함)
  const [usedParts, setUsedParts] = useState([{ partId: '', name: '', quantity: 1, selectedSn: '', isCustomSn: false }])
  
  // 부품 검색 드롭다운 관리 상태
  const [activePartIndex, setActivePartIndex] = useState(null)
  const [partSearchQuery, setPartSearchQuery] = useState('')

  const [confirmor, setConfirmor] = useState(user?.full_name || '배진철')
  const [historyList, setHistoryList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedReportImage, setSelectedReportImage] = useState(null)
  
  const sigCanvas = useRef({})
  const reportFormRef = useRef(null)

  useEffect(() => {
    if (initialSearchTerm) {
      setCompanySearchTerm(initialSearchTerm)
      const matched = companies.find(c => c.name.toLowerCase() === initialSearchTerm.toLowerCase())
      if (matched) {
        handleSelectCompany(matched)
      }
    }
  }, [initialSearchTerm, companies])

  const parseManagers = (managerData, phoneData, defaultEmail) => {
    if (!managerData) return [{ name: '', phone: '', role: '', email: defaultEmail || '' }]
    try {
      const parsed = typeof managerData === 'string' ? JSON.parse(managerData) : managerData
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch (e) {}
    return [{ name: managerData || '', phone: phoneData || '', role: '', email: defaultEmail || '' }]
  }

  const fetchServiceHistory = async (companyId) => {
    const { data } = await supabase.from('service_history').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setHistoryList(data || [])
  }

  const handleSelectCompany = (company) => {
    const parsedManagers = parseManagers(company.manager, company.phone, company.email)
    setSelectedCompany({ ...company, managersList: parsedManagers })
    setSelectedManager(parsedManagers[0]?.name || '')
    setIsEditing(false)
    setDetailSnSearchTerm('')
    setEditData({
      name: company.name || '',
      managers: parsedManagers,
      address: company.address || '',
      note: company.card_url || '',
      ink: company.ink || '',
      solvent: company.solvent || ''
    })
    setViewMode('detail')
    fetchServiceHistory(company.id)
  }

  const handleAddCompany = async (e) => {
    e.preventDefault()
    if (!name) return alert('업체명을 입력해주세요!')
    setUploading(true)

    const primaryPhone = managers[0]?.phone || ''
    const primaryEmail = managers[0]?.email || ''

    const { error } = await supabase.from('companies').insert([{
      name,
      manager: JSON.stringify(managers),
      phone: primaryPhone,
      email: primaryEmail,
      address,
      card_url: note,
      ink,
      solvent
    }])

    setUploading(false)
    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      alert('업체가 등록되었습니다.')
      setName(''); setAddress(''); setNote(''); setInk(''); setSolvent('')
      setManagers([{ name: '', phone: '', role: '', email: '' }])
      setShowAddForm(false)
      onRefreshData()
    }
  }

  const handleSaveCompanyEdit = async () => {
    if (!editData.name.trim()) return alert('업체명을 입력해주세요.')
    setUploading(true)

    const primaryPhone = editData.managers[0]?.phone || ''
    const primaryEmail = editData.managers[0]?.email || ''

    const { data, error } = await supabase.from('companies').update({
      name: editData.name,
      manager: JSON.stringify(editData.managers),
      phone: primaryPhone,
      email: primaryEmail,
      address: editData.address,
      card_url: editData.note,
      ink: editData.ink,
      solvent: editData.solvent
    }).eq('id', selectedCompany.id).select()

    setUploading(false)
    if (error) {
      alert('수정 실패: ' + error.message)
    } else {
      alert('업체 정보가 수정되었습니다.')
      const updated = data && data[0] ? data[0] : { ...selectedCompany, ...editData, card_url: editData.note }
      const updatedManagers = parseManagers(updated.manager, updated.phone, updated.email)
      setSelectedCompany({ ...updated, managersList: updatedManagers })
      setIsEditing(false)
      onRefreshData()
    }
  }

  const handleFillCurrentTime = () => {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, '0')
    setEndHour(hh)
    setEndMin(mm)
  }

  const handleSaveReport = async (e) => {
    e.preventDefault()
    if (!selectedCompany) return
    if (!selectedManager) return alert('담당자를 선택해주세요.')

    // S/N 관리품 필수값 체크
    for (let i = 0; i < usedParts.length; i++) {
      const p = usedParts[i]
      if (!p.name || !p.name.trim()) continue
      const matchedPart = (partsList || []).find(item => String(item.id) === String(p.partId))
      if (matchedPart) {
        let currentSerials = []
        try {
          currentSerials = matchedPart.serials ? (typeof matchedPart.serials === 'string' ? JSON.parse(matchedPart.serials) : matchedPart.serials) : []
        } catch (err) {}
        const isSerialItem = matchedPart.is_serial_managed || currentSerials.length > 0
        if (isSerialItem && !p.selectedSn.trim()) {
          return alert(`[${matchedPart.name}] 부품의 S/N를 선택하거나 직접 입력해주세요.`)
        }
      }
    }

    setUploading(true)
    try {
      let reportImageUrl = ''
      if (reportFormRef.current) {
        const canvas = await html2canvas(reportFormRef.current, { scale: 2, useCORS: true, width: 440 })
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) {
          const fileName = `report_${selectedCompany.id}_${Date.now()}.png`
          const { error: uploadError } = await supabase.storage.from('reports').upload(fileName, blob, { contentType: 'image/png' })
          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage.from('reports').getPublicUrl(fileName)
            reportImageUrl = publicUrlData.publicUrl
          }
        }
      }

      let summaryParts = []

      // 부품 재고 및 S/N 자동 차감 처리
      for (const p of usedParts) {
        if (!p.name || !p.name.trim()) continue
        
        let matchedPart = null
        if (p.partId) {
          matchedPart = (partsList || []).find(item => String(item.id) === String(p.partId))
        }
        if (!matchedPart) {
          const query = p.name.trim().toLowerCase()
          matchedPart = (partsList || []).find(item => (item.name && item.name.toLowerCase() === query) || (item.code && item.code.toLowerCase() === query))
        }

        if (matchedPart) {
          let currentSerials = []
          try {
            currentSerials = matchedPart.serials ? (typeof matchedPart.serials === 'string' ? JSON.parse(matchedPart.serials) : matchedPart.serials) : []
          } catch (err) { currentSerials = [] }

          const isSerialItem = matchedPart.is_serial_managed || currentSerials.length > 0

          if (isSerialItem) {
            const targetSn = p.selectedSn.trim()
            summaryParts.push(`${matchedPart.name} (S/N: ${targetSn})`)

            const existsInStock = currentSerials.some(s => s.sn === targetSn)
            if (existsInStock) {
              const updatedSerials = currentSerials.filter(s => s.sn !== targetSn)
              await supabase.from('parts').update({
                serials: JSON.stringify(updatedSerials),
                stock: updatedSerials.length
              }).eq('id', matchedPart.id)
            }
          } else {
            const qty = Number(p.quantity) || 1
            summaryParts.push(`${matchedPart.name} (${qty}개)`)
            const newStock = Math.max(0, (Number(matchedPart.stock) || 0) - qty)
            await supabase.from('parts').update({ stock: newStock }).eq('id', matchedPart.id)
          }
        } else {
          if (p.selectedSn && p.selectedSn.trim()) {
            summaryParts.push(`${p.name.trim()} (S/N: ${p.selectedSn.trim()})`)
          } else {
            summaryParts.push(`${p.name.trim()} (${p.quantity || 1}개)`)
          }
        }
      }

      const validParts = usedParts.filter(p => p.name && p.name.trim())

      const { error } = await supabase.from('service_history').insert([{
        company_id: selectedCompany.id,
        work_date: workDate,
        start_time: `${startHour}:${startMin}`,
        end_time: `${endHour}:${endMin}`,
        model_name: modelName,
        equipment_sn: sn,
        manager_name: selectedManager, // 고객사 담당자 이름
        work_content: workContent,
        used_parts: JSON.stringify(validParts),
        confirmor: confirmor, // 로그인한 작성자 (엔지니어) 이름
        report_image_url: reportImageUrl
      }])

      if (error) throw error

      if (summaryParts.length > 0) {
        await supabase.from('delivery_history').insert([{
          date: workDate,
          company_name: selectedCompany.name,
          equipment_sn: sn || '-',
          summary: summaryParts.join(', '),
          author: confirmor,
          note: `서비스 리포트 연동 출고 (${modelName})`,
          type: 'OUTBOUND'
        }])
      }

      alert('서비스 리포트가 저장되었습니다.')
      setWorkContent('')
      setSn('')
      setUsedParts([{ partId: '', name: '', quantity: 1, selectedSn: '', isCustomSn: false }])
      if (sigCanvas.current && typeof sigCanvas.current.clear === 'function') {
        sigCanvas.current.clear()
      }
      fetchServiceHistory(selectedCompany.id)
      onRefreshData()
      setViewMode('detail')
    } catch (err) {
      alert('저장 중 오류가 발생했습니다: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // 정렬 및 검색된 업체 목록
  const filteredCompanies = (companies || []).filter(c => {
    if (!companySearchTerm.trim()) return true
    const q = companySearchTerm.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.address?.toLowerCase().includes(q) || c.manager?.toLowerCase().includes(q)
  }).sort((a, b) => {
    if (companySortType === 'name') return (a.name || '').localeCompare(b.name || '', 'ko-KR')
    const aLatest = (allHistories || []).find(h => h.company_id === a.id)?.created_at || ''
    const bLatest = (allHistories || []).find(h => h.company_id === b.id)?.created_at || ''
    return bLatest.localeCompare(aLatest)
  })

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '10px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }

  // =========================================================================
  // 1. 서비스 리포트 작성 뷰
  // =========================================================================
  if (viewMode === 'report' && selectedCompany) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <button type="button" onClick={() => setViewMode('detail')} style={{ border: 'none', background: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', color: '#334155', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            ← 뒤로
          </button>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>📝 서비스 리포트 작성</h3>
          <div style={{ width: '50px' }} />
        </div>

        <form onSubmit={handleSaveReport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div ref={reportFormRef} style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#2563EB', fontWeight: '800' }}>(주)메이쓰 기술지원부</div>
                <div style={{ fontSize: '17px', fontWeight: '900', color: '#0F172A' }}>{selectedCompany.name}</div>
              </div>
              <input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', fontWeight: '700' }} />
            </div>

            {/* 작업 시간 */}
            <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>⏱️ 작업 시간</span>
                <button type="button" onClick={handleFillCurrentTime} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                  ⚡ 현재 시간으로 채우기
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>시작 시간</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select value={startHour} onChange={e => setStartHour(e.target.value)} style={{ ...inputStyle, padding: '8px' }}>
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
                    </select>
                    <select value={startMin} onChange={e => setStartMin(e.target.value)} style={{ ...inputStyle, padding: '8px' }}>
                      {['00', '10', '20', '30', '40', '50'].map(m => <option key={m} value={m}>{m}분</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748B', display: 'block', marginBottom: '4px' }}>종료 시간</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <select value={endHour} onChange={e => setEndHour(e.target.value)} style={{ ...inputStyle, padding: '8px' }}>
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <option key={h} value={h}>{h}시</option>)}
                    </select>
                    <select value={endMin} onChange={e => setEndMin(e.target.value)} style={{ ...inputStyle, padding: '8px' }}>
                      {['00', '10', '20', '30', '40', '50'].map(m => <option key={m} value={m}>{m}분</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 모델명 & 장비 S/N */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={labelStyle}>모델명</label>
                <select value={modelName} onChange={e => setModelName(e.target.value)} style={inputStyle}>
                  <option value="JET1Neo">JET1Neo</option>
                  <option value="JET2Neo">JET2Neo</option>
                  <option value="JET3">JET3</option>
                  <option value="JET3up">JET3up</option>
                  <option value="JET3pi">JET3pi</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>시리얼 번호 (S/N)</label>
                <input type="text" placeholder="S/N 입력" value={sn} onChange={e => setSn(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* 작업 담당자 */}
            <div>
              <label style={labelStyle}>작업 담당자 선택</label>
              <select value={selectedManager} onChange={e => setSelectedManager(e.target.value)} style={inputStyle}>
                {(selectedCompany.managersList || []).map((m, i) => (
                  <option key={i} value={m.name}>{m.name} {m.role ? `(${m.role})` : ''}</option>
                ))}
              </select>
            </div>

            {/* 작업 내용 */}
            <div>
              <label style={labelStyle}>작업 내용</label>
              <textarea rows="3" placeholder="수리 및 점검 내용 입력" value={workContent} onChange={e => setWorkContent(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} required />
            </div>

            {/* 교체 부품 및 수량 / S/N */}
            <div>
              <label style={labelStyle}>교체 부품 및 수량 / S/N</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {usedParts.map((part, idx) => {
                  const matchedPart = (partsList || []).find(item => String(item.id) === String(part.partId))
                  let availableSerials = []
                  if (matchedPart) {
                    try {
                      availableSerials = matchedPart.serials ? (typeof matchedPart.serials === 'string' ? JSON.parse(matchedPart.serials) : matchedPart.serials) : []
                    } catch (err) {}
                  }
                  const isSerialItem = matchedPart ? (matchedPart.is_serial_managed || availableSerials.length > 0) : false

                  const filteredDropdownParts = (partsList || []).filter(item => {
                    const q = (activePartIndex === idx ? partSearchQuery : part.name).toLowerCase().trim()
                    if (!q) return true
                    return (item.name && item.name.toLowerCase().includes(q)) || (item.code && item.code.toLowerCase().includes(q))
                  })

                  return (
                    <div key={idx} style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '12px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                      
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="🔍 부품명 또는 품번(Ident No.) 검색/입력"
                          value={activePartIndex === idx ? partSearchQuery : part.name}
                          onFocus={() => {
                            setActivePartIndex(idx)
                            setPartSearchQuery(part.name)
                          }}
                          onChange={e => {
                            const val = e.target.value
                            setPartSearchQuery(val)
                            const updated = [...usedParts]
                            updated[idx].name = val
                            if (!val.trim()) {
                              updated[idx].partId = ''
                              updated[idx].selectedSn = ''
                              updated[idx].isCustomSn = false
                            }
                            setUsedParts(updated)
                          }}
                          style={{ ...inputStyle, backgroundColor: '#ffffff', fontWeight: '700', color: '#0F172A', flex: 1 }}
                        />

                        {usedParts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setUsedParts(usedParts.filter((_, i) => i !== idx))
                              if (activePartIndex === idx) setActivePartIndex(null)
                            }}
                            style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', width: '36px', height: '38px', borderRadius: '8px', fontWeight: '800', fontSize: '14px', flexShrink: 0 }}
                          >
                            ✕
                          </button>
                        )}

                        {activePartIndex === idx && (
                          <div style={{
                            position: 'absolute', top: '42px', left: 0, right: 0, backgroundColor: '#ffffff',
                            border: '1px solid #CBD5E1', borderRadius: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
                            maxHeight: '190px', overflowY: 'auto', zIndex: 100
                          }}>
                            {filteredDropdownParts.length === 0 ? (
                              <div
                                onMouseDown={() => setActivePartIndex(null)}
                                style={{ padding: '12px', fontSize: '12px', color: '#64748B', textAlign: 'center' }}
                              >
                                일치하는 재고 품목이 없습니다. (입력한 이름으로 수기 등록됨)
                              </div>
                            ) : (
                              filteredDropdownParts.map(item => {
                                let sList = []
                                try {
                                  sList = item.serials ? (typeof item.serials === 'string' ? JSON.parse(item.serials) : item.serials) : []
                                } catch (err) {}
                                const isSn = item.is_serial_managed || sList.length > 0
                                const cnt = isSn ? sList.length : (Number(item.stock) || 0)
                                return (
                                  <div
                                    key={item.id}
                                    onMouseDown={() => {
                                      const updated = [...usedParts]
                                      updated[idx] = {
                                        partId: item.id,
                                        name: item.name,
                                        quantity: 1,
                                        selectedSn: '',
                                        isCustomSn: false
                                      }
                                      setUsedParts(updated)
                                      setActivePartIndex(null)
                                    }}
                                    style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: '700', color: '#0F172A' }}>{item.name}</div>
                                      <div style={{ fontSize: '11px', color: '#64748B' }}>{item.code}</div>
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: isSn ? '#2563EB' : '#059669' }}>
                                      재고: {cnt}개 {isSn ? '[S/N]' : ''}
                                    </span>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>

                      {isSerialItem ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {!part.isCustomSn ? (
                            <select
                              value={part.selectedSn}
                              onChange={e => {
                                const val = e.target.value
                                const updated = [...usedParts]
                                if (val === '__CUSTOM__') {
                                  updated[idx].isCustomSn = true
                                  updated[idx].selectedSn = ''
                                } else {
                                  updated[idx].selectedSn = val
                                }
                                setUsedParts(updated)
                              }}
                              style={{ ...inputStyle, backgroundColor: '#ffffff', border: '1.5px solid #2563EB', fontWeight: '700', color: '#0F172A' }}
                            >
                              <option value="">-- 보유 S/N 선택 ({availableSerials.length}개 보유) --</option>
                              {availableSerials.map((s, sIdx) => (
                                <option key={sIdx} value={s.sn}>S/N: {s.sn} ({s.condition})</option>
                              ))}
                              <option value="__CUSTOM__">✏️ 직접 입력 (목록에 없는 S/N)</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="S/N 번호 직접 입력 (예: LJ-9999)"
                                value={part.selectedSn}
                                onChange={e => {
                                  const updated = [...usedParts]
                                  updated[idx].selectedSn = e.target.value
                                  setUsedParts(updated)
                                }}
                                style={{ ...inputStyle, backgroundColor: '#ffffff', border: '1.5px solid #059669', fontWeight: '700', flex: 1 }}
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = [...usedParts]
                                  updated[idx].isCustomSn = false
                                  updated[idx].selectedSn = ''
                                  setUsedParts(updated)
                                }}
                                style={{ border: '1px solid #CBD5E1', background: '#ffffff', color: '#475569', padding: '9px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}
                              >
                                목록 선택
                              </button>
                            </div>
                          )}

                          <div style={{ fontSize: '11px', fontWeight: '700', color: part.isCustomSn ? '#059669' : '#2563EB' }}>
                            {part.isCustomSn
                              ? '✏️ 수기 입력 모드 (리포트에만 기록되며 보유 재고는 차감되지 않습니다)'
                              : '🏷️ S/N 관리 품목 (선택 시 해당 S/N가 재고에서 자동 차감됩니다)'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>교체 수량 (개)</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...usedParts]
                                updated[idx].quantity = Math.max(1, (Number(updated[idx].quantity) || 1) - 1)
                                setUsedParts(updated)
                              }}
                              style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: '800', fontSize: '15px' }}
                            >
                              -
                            </button>
                            <span style={{ fontWeight: '800', fontSize: '14px', minWidth: '24px', textAlign: 'center' }}>{part.quantity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...usedParts]
                                updated[idx].quantity = (Number(updated[idx].quantity) || 1) + 1
                                setUsedParts(updated)
                              }}
                              style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: '800', fontSize: '15px' }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => setUsedParts([...usedParts, { partId: '', name: '', quantity: 1, selectedSn: '', isCustomSn: false }])}
                style={{ width: '100%', marginTop: '10px', padding: '10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px dashed #93C5FD', borderRadius: '10px', fontWeight: '800', fontSize: '13px' }}
              >
                + 부품 추가
              </button>
            </div>

            {/* 고객 서명 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>고객 서명</label>
                <button type="button" onClick={() => sigCanvas.current?.clear()} style={{ border: 'none', background: '#F1F5F9', color: '#475569', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                  초기화
                </button>
              </div>
              <div style={{ border: '1px solid #CBD5E1', borderRadius: '10px', backgroundColor: '#ffffff', overflow: 'hidden' }}>
                <SignatureCanvas ref={sigCanvas} penColor="#0F172A" canvasProps={{ width: 380, height: 140, className: 'sigCanvas', style: { width: '100%', height: '140px', display: 'block' } }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475569', paddingTop: '6px', borderTop: '1px solid #F1F5F9' }}>
              <span>작성 엔지니어:</span>
              <input type="text" value={confirmor} onChange={e => setConfirmor(e.target.value)} style={{ border: '1px solid #CBD5E1', borderRadius: '6px', padding: '4px 8px', width: '100px', textAlign: 'right', fontWeight: '700' }} />
            </div>
          </div>

          <button type="submit" disabled={uploading} style={{ width: '100%', padding: '14px', backgroundColor: '#2563EB', color: '#ffffff', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '800', boxShadow: '0 4px 6px rgba(37, 99, 235, 0.25)' }}>
            {uploading ? '저장 및 이미지 생성 중...' : '✅ 서비스 리포트 저장 완료'}
          </button>
        </form>
      </div>
    )
  }

  // =========================================================================
  // 2. 업체 상세 보기 및 A/S 이력 뷰
  // =========================================================================
  if (viewMode === 'detail' && selectedCompany) {
    const filteredHistory = historyList.filter(h => {
      if (!detailSnSearchTerm.trim()) return true
      const q = detailSnSearchTerm.toLowerCase()
      return h.equipment_sn?.toLowerCase().includes(q) || h.work_content?.toLowerCase().includes(q)
    })

    return (
      <div style={{ padding: '16px', backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button type="button" onClick={() => setViewMode('list')} style={{ border: 'none', background: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', color: '#334155', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            ← 목록으로
          </button>
          <button type="button" onClick={() => setViewMode('report')} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '9px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>
            📝 리포트 작성
          </button>
        </div>

        {/* 업체 기본 정보 카드 */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
          {!isEditing ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>{selectedCompany.name}</h2>
                <button type="button" onClick={() => setIsEditing(true)} style={{ border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
                  정보 수정
                </button>
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '8px' }}>📍 {selectedCompany.address || '주소 미등록'}</div>
              
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>잉크: {selectedCompany.ink || '-'}</span>
                <span style={{ backgroundColor: '#F0FDF4', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>희석제: {selectedCompany.solvent || '-'}</span>
              </div>

              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(selectedCompany.managersList || []).map((m, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ fontWeight: '700', color: '#1E293B' }}>👤 {m.name} {m.role ? `(${m.role})` : ''}</span>
                    {m.phone && (
                      <a href={`tel:${m.phone}`} style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none', fontWeight: '700', fontSize: '12px' }}>
                        📞 {m.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>업체 정보 수정</h4>
              <input value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} placeholder="업체명" style={inputStyle} />
              <input value={editData.address} onChange={e => setEditData({ ...editData, address: e.target.value })} placeholder="주소" style={inputStyle} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input value={editData.ink} onChange={e => setEditData({ ...editData, ink: e.target.value })} placeholder="사용 잉크" style={inputStyle} />
                <input value={editData.solvent} onChange={e => setEditData({ ...editData, solvent: e.target.value })} placeholder="사용 희석제" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#fff', fontSize: '12px' }}>취소</button>
                <button type="button" onClick={handleSaveCompanyEdit} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#fff', fontWeight: '700', fontSize: '12px' }}>저장</button>
              </div>
            </div>
          )}
        </div>

        {/* A/S 작업 이력 리스트 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>📋 A/S 작업 이력 ({filteredHistory.length})</h3>
            <input type="text" placeholder="S/N 또는 내용 검색" value={detailSnSearchTerm} onChange={e => setDetailSnSearchTerm(e.target.value)} style={{ ...inputStyle, width: '150px', padding: '6px 10px', fontSize: '12px', backgroundColor: '#fff' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredHistory.length === 0 ? (
              <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>등록된 작업 이력이 없습니다.</div>
            ) : (
              filteredHistory.map(h => {
                let parsedUsedParts = []
                try {
                  parsedUsedParts = h.used_parts ? (typeof h.used_parts === 'string' ? JSON.parse(h.used_parts) : h.used_parts) : []
                } catch (err) {}

                return (
                  <div key={h.id} style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563EB' }}>{h.work_date} ({h.start_time}~{h.end_time})</span>
                      <span style={{ fontSize: '11px', backgroundColor: '#F1F5F9', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', color: '#334155' }}>
                        {h.model_name} {h.equipment_sn ? `/ S/N: ${h.equipment_sn}` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#0F172A', whiteSpace: 'pre-line', marginBottom: '8px', lineHeight: '1.4' }}>{h.work_content}</div>
                    
                    {parsedUsedParts.length > 0 && (
                      <div style={{ backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: '#475569', marginBottom: '8px' }}>
                        <strong>교체 부품:</strong> {parsedUsedParts.map(up => up.selectedSn ? `${up.name} [S/N: ${up.selectedSn}]` : `${up.name} (${up.quantity}개)`).join(', ')}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748B' }}>
                      {/* 💡 수정된 부분: 담당(고객사 담당자: h.manager_name) / 작성(로그인한 작성자: h.confirmor 또는 user.full_name) */}
                      <span>담당: {h.manager_name || '-'} / 작성: {h.confirmor || user?.full_name || '배진철'}</span>
                      {h.report_image_url && (
                        <button type="button" onClick={() => setSelectedReportImage(h.report_image_url)} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '6px', fontWeight: '700' }}>
                          리포트 보기
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* 리포트 이미지 미리보기 모달 */}
        {selectedReportImage && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '16px' }} onClick={() => setSelectedReportImage(null)}>
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
              <button type="button" onClick={() => setSelectedReportImage(null)} style={{ position: 'absolute', top: '-36px', right: 0, border: 'none', background: '#EF4444', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', fontWeight: '800' }}>✕</button>
              <img src={selectedReportImage} alt="Service Report" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '10px' }} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // =========================================================================
  // 3. 기본 거래처 목록 뷰
  // =========================================================================
  return (
    <div style={{ padding: '16px', backgroundColor: '#F1F5F9', minHeight: '100vh', paddingBottom: '40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        {onBackToCalendar ? (
          <button type="button" onClick={onBackToCalendar} style={{ border: 'none', background: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', color: '#334155', fontSize: '13px' }}>
            ← 일정표
          </button>
        ) : <div />}
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '900', color: '#0F172A' }}>🏢 거래처 및 현장 리포트</h2>
        <button type="button" onClick={() => setShowAddForm(!showAddForm)} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', fontSize: '12px' }}>
          + 업체등록
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCompany} style={{ backgroundColor: '#ffffff', padding: '16px', borderRadius: '14px', border: '1px solid #CBD5E1', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800' }}>신규 거래처 등록</h4>
          <input placeholder="업체명 *" value={name} onChange={e => setName(e.target.value)} style={inputStyle} required />
          <input placeholder="담당자 이름" value={managers[0].name} onChange={e => setManagers([{ ...managers[0], name: e.target.value }])} style={inputStyle} />
          <input placeholder="연락처 (010-0000-0000)" value={managers[0].phone} onChange={e => setManagers([{ ...managers[0], phone: e.target.value }])} style={inputStyle} />
          <input placeholder="주소" value={address} onChange={e => setAddress(e.target.value)} style={inputStyle} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <input placeholder="사용 잉크" value={ink} onChange={e => setInk(e.target.value)} style={inputStyle} />
            <input placeholder="사용 희석제" value={solvent} onChange={e => setSolvent(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#fff', fontSize: '12px' }}>취소</button>
            <button type="submit" disabled={uploading} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#fff', fontWeight: '700', fontSize: '12px' }}>등록 완료</button>
          </div>
        </form>
      )}

      {/* 검색 및 정렬 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <input type="text" placeholder="🔍 거래처명, 담당자, 주소 검색..." value={companySearchTerm} onChange={e => setCompanySearchTerm(e.target.value)} style={{ ...inputStyle, backgroundColor: '#ffffff', flex: 1 }} />
        <select value={companySortType} onChange={e => setCompanySortType(e.target.value)} style={{ ...inputStyle, backgroundColor: '#ffffff', width: '115px', fontSize: '12px', fontWeight: '700' }}>
          <option value="recent_history">최근 작업순</option>
          <option value="name">가나다순</option>
        </select>
      </div>

      {/* 거래처 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredCompanies.map(c => (
          <div key={c.id} onClick={() => handleSelectCompany(c)} style={{ backgroundColor: '#ffffff', padding: '14px 16px', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{c.name}</span>
              <span style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700' }}>상세보기 ›</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>{c.address || '주소 미등록'}</div>
            <div style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
              {c.ink && <span style={{ backgroundColor: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>잉크: {c.ink}</span>}
              {c.solvent && <span style={{ backgroundColor: '#F0FDF4', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>희석제: {c.solvent}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}