import React, { useState, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'

export default function MobileCompanyView({ user, companies, allHistories, partsList, onRefreshData, onBackToCalendar }) {
  const [viewMode, setViewMode] = useState('list') // 'list' | 'detail' | 'report'
  const [mainTab, setMainTab] = useState('companies') // 'companies' | 'parts'
  const [selectedCompany, setSelectedCompany] = useState(null)
  
  // 검색 및 정렬 상태
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [snPartSearchTerm, setSnPartSearchTerm] = useState('')
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
  const [usedParts, setUsedParts] = useState([{ name: '', quantity: 1 }])
  const [confirmor, setConfirmor] = useState(user?.full_name || '배진철')
  
  const [historyList, setHistoryList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [selectedReportImage, setSelectedReportImage] = useState(null)
  
  const sigCanvas = useRef({})
  const reportFormRef = useRef(null)

  // 담당자 파싱 유틸
  const parseManagers = (managerData, phoneData, defaultEmail) => {
    if (!managerData) return [{ name: '', phone: '', role: '', email: defaultEmail || '' }]
    try {
      const parsed = typeof managerData === 'string' ? JSON.parse(managerData) : managerData
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch (e) {}
    return [{ name: managerData || '', phone: phoneData || '', role: '', email: defaultEmail || '' }]
  }

  // 부품 단가 정보 조회
  const getPartPriceInfo = (itemCodeOrName, companyName) => {
    if (!itemCodeOrName || !itemCodeOrName.trim()) return null
    const query = itemCodeOrName.trim().toLowerCase()
    const matchedPart = partsList.find(p => (p.code && p.code.toLowerCase() === query) || (p.name && p.name.toLowerCase() === query))
    if (!matchedPart) return { found: false }

    let companySpecialPrice = null
    try {
      if (matchedPart.company_prices) {
        const cpList = typeof matchedPart.company_prices === 'string' ? JSON.parse(matchedPart.company_prices) : matchedPart.company_prices
        if (Array.isArray(cpList)) {
          const matchedCp = cpList.find(cp => cp.company_name && cp.company_name.toLowerCase() === companyName.toLowerCase())
          if (matchedCp && matchedCp.price) companySpecialPrice = Number(matchedCp.price)
        }
      }
    } catch (e) {}

    return {
      found: true,
      finalPrice: companySpecialPrice !== null ? companySpecialPrice : (matchedPart.customer_price || 0),
      isSpecial: companySpecialPrice !== null
    }
  }

  // 서비스 이력 불러오기
  const fetchServiceHistory = async (companyId) => {
    const { data } = await supabase.from('service_history').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setHistoryList(data || [])
  }

  // 업체 선택 시 상세 화면으로 이동
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

  // 신규 업체 등록
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

  // 업체 정보 수정 저장
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

  // 서비스 리포트 저장 및 재고 차감
  const handleSaveReport = async (e) => {
    e.preventDefault()
    if (!selectedCompany) return
    if (!selectedManager) return alert('담당자를 선택해주세요.')

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

      // 부품 재고 자동 차감
      for (const p of usedParts) {
        if (!p.name || !p.name.trim()) continue
        const usedQty = Number(p.quantity) || 0
        if (usedQty <= 0) continue

        const query = p.name.trim().toLowerCase()
        const matchedPart = partsList.find(item => (item.name && item.name.toLowerCase() === query) || (item.code && item.code.toLowerCase() === query))
        if (matchedPart) {
          const newStock = Math.max(0, (Number(matchedPart.stock) || 0) - usedQty)
          await supabase.from('parts').update({ stock: newStock }).eq('id', matchedPart.id)
        }
      }

      const formattedParts = usedParts.filter(p => p.name && p.name.trim() !== '').map(p => `${p.name.trim()} (${p.quantity}개)`)

      const { error } = await supabase.from('service_history').insert([{
        company_id: selectedCompany.id,
        work_date: workDate,
        start_time: `${startHour}:${startMin}`,
        end_time: `${endHour}:${endMin}`,
        sn,
        model_name: modelName,
        work_content: workContent,
        parts: JSON.stringify(formattedParts),
        confirmor: `${confirmor} (담당자: ${selectedManager})`,
        report_url: reportImageUrl
      }])

      if (error) {
        alert('리포트 저장 실패: ' + error.message)
      } else {
        alert('서비스 리포트가 저장되고 재고가 자동 차감되었습니다!')
        setWorkContent(''); setSn(''); setUsedParts([{ name: '', quantity: 1 }])
        onRefreshData()
        handleSelectCompany(selectedCompany)
        setViewMode('detail')
      }
    } catch (err) {
      alert('저장 중 오류 발생: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  // 필터링 및 정렬
  const cleanCompanyName = (name) => name ? name.replace(/\(주\)|주식회사|\(주|\주/g, '').trim() : ''
  const getLatestHistoryDate = (companyId) => {
    const compHistories = allHistories.filter(h => h.company_id === companyId)
    if (compHistories.length === 0) return 0
    return Math.max(...compHistories.map(h => new Date(h.created_at || h.work_date).getTime()))
  }

  let processedCompanies = [...companies]
  if (companySortType === 'recent_history') {
    processedCompanies.sort((a, b) => getLatestHistoryDate(b.id) - getLatestHistoryDate(a.id))
  } else {
    processedCompanies.sort((a, b) => cleanCompanyName(a.name).localeCompare(cleanCompanyName(b.name), 'ko'))
  }

  const filteredCompanies = companySearchTerm.trim() === '' ? processedCompanies : processedCompanies.filter(c => 
    (c.name && c.name.toLowerCase().includes(companySearchTerm.toLowerCase())) ||
    (c.manager && c.manager.toLowerCase().includes(companySearchTerm.toLowerCase()))
  )

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* 뒤로 가기 / 상단 네비게이션 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBackToCalendar} style={{ border: 'none', background: '#E2E8F0', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
          ← 캘린더로 돌아가기
        </button>
        <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>🏢 현장 업체 관리</span>
      </div>

      {/* 1. 목록 화면 */}
      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* 검색바 */}
          <div style={{ position: 'relative' }}>
            <input 
              type="text"
              placeholder="업체명, 담당자명 검색..." 
              value={companySearchTerm}
              onChange={(e) => setCompanySearchTerm(e.target.value)}
              style={{ ...inputStyle, backgroundColor: '#FFFFFF', boxShadow: '0 2px 6px rgba(0,0,0,0.05)', height: '40px' }}
            />
            {companySearchTerm && (
              <span onClick={() => setCompanySearchTerm('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50körper)', cursor: 'pointer', color: '#94A3B8' }}>✕</span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setShowAddForm(!showAddForm)} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
              {showAddForm ? '✕ 등록 닫기' : '+ 신규 업체 등록'}
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setCompanySortType('recent_history')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: 'none', background: companySortType === 'recent_history' ? '#2563EB' : '#E2E8F0', color: companySortType === 'recent_history' ? '#fff' : '#64748B', fontWeight: 'bold' }}>최근이력순</button>
              <button onClick={() => setCompanySortType('name_korean')} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: 'none', background: companySortType === 'name_korean' ? '#2563EB' : '#E2E8F0', color: companySortType === 'name_korean' ? '#fff' : '#64748B', fontWeight: 'bold' }}>가나다순</button>
            </div>
          </div>

          {/* 신규 업체 등록 폼 */}
          {showAddForm && (
            <form onSubmit={handleAddCompany} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: '800' }}>➕ 신규 업체 등록</h4>
              <div>
                <label style={labelStyle}>업체명*</label>
                <input placeholder="업체명 입력" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>담당자 이름 / 연락처</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <input placeholder="이름" value={managers[0].name} onChange={(e) => { const n = [...managers]; n[0].name = e.target.value; setManagers(n); }} style={inputStyle} />
                  <input placeholder="연락처" value={managers[0].phone} onChange={(e) => { const n = [...managers]; n[0].phone = e.target.value; setManagers(n); }} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>주소</label>
                <input placeholder="주소 입력" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>비고</label>
                <textarea rows="2" placeholder="비고 입력" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
              </div>
              <button type="submit" disabled={uploading} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                {uploading ? '저장 중...' : '등록 완료'}
              </button>
            </form>
          )}

          {/* 업체 리스트 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredCompanies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8', backgroundColor: '#fff', borderRadius: '12px' }}>등록된 업체가 없습니다.</div>
            ) : (
              filteredCompanies.map(c => {
                const mList = parseManagers(c.manager, c.phone, c.email)
                const displayManager = mList.map(m => m.name ? `${m.name}${m.role ? `(${m.role})` : ''}` : '').filter(Boolean).join(', ') || '미등록'

                return (
                  <div key={c.id} onClick={() => handleSelectCompany(c)} style={{ backgroundColor: '#fff', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '800', color: '#1E293B' }}>{c.name}</h4>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>👤 {displayManager}</span>
                    </div>
                    <span style={{ color: '#CBD5E1', fontSize: '16px' }}>›</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* 2. 업체 상세 화면 */}
      {viewMode === 'detail' && selectedCompany && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setViewMode('list')} style={{ border: 'none', background: 'none', fontWeight: 'bold', color: '#2563EB', cursor: 'pointer' }}>← 목록으로</button>
            <button onClick={() => setViewMode('report')} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>📄 서비스 리포트 작성</button>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            {!isEditing ? (
              <div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>{selectedCompany.name}</h3>
                <div style={{ fontSize: '13px', color: '#334155', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                  <div>📍 <b>주소:</b> {selectedCompany.address || '-'}</div>
                  <div>📌 <b>비고:</b> {selectedCompany.card_url || '없음'}</div>
                </div>

                <h4 style={{ margin: '10px 0 6px 0', fontSize: '14px', color: '#1E293B' }}>👤 담당자 목록</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                  {selectedCompany.managersList.map((m, idx) => (
                    <div key={idx} style={{ backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '8px', fontSize: '12px' }}>
                      <b>{m.name}</b> ({m.role || '직책 없음'}) - 📞 {m.phone || '-'}
                    </div>
                  ))}
                </div>

                <button onClick={() => setIsEditing(true)} style={{ width: '100%', padding: '8px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                  업체 정보 수정 및 담당자 추가
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '15px' }}>✏️ 업체 정보 수정</h4>
                <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} style={inputStyle} />
                <input placeholder="주소" value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} style={inputStyle} />
                <textarea rows="3" placeholder="비고" value={editData.note} onChange={(e) => setEditData({ ...editData, note: e.target.value })} style={inputStyle} />
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '8px', background: '#E2E8F0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>취소</button>
                  <button onClick={handleSaveCompanyEdit} style={{ flex: 1, padding: '8px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>저장</button>
                </div>
              </div>
            )}
          </div>

          {/* 최근 서비스 이력 */}
          <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '15px' }}>📋 최근 서비스 이력</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {historyList.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', padding: '10px' }}>이력이 없습니다.</div>
              ) : (
                historyList.map(h => (
                  <div key={h.id} onClick={() => h.report_url && setSelectedReportImage(h.report_url)} style={{ padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: h.report_url ? 'pointer' : 'default', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#2563EB', marginBottom: '4px' }}>
                      <span>{h.work_date} {h.report_url && '📄 [리포트 보기]'}</span>
                    </div>
                    <div><b>S/N:</b> {h.sn || '-'} | <b>작업:</b> {h.work_content || '-'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. 서비스 리포트 작성 화면 */}
      {viewMode === 'report' && selectedCompany && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => setViewMode('detail')} style={{ border: 'none', background: 'none', fontWeight: 'bold', color: '#2563EB', cursor: 'pointer', textAlign: 'left' }}>← 상세로 돌아가기</button>

          <div ref={reportFormRef} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <form onSubmit={handleSaveReport} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>서비스 리포트 작성 ({selectedCompany.name})</h3>

              <div>
                <label style={labelStyle}>작업일자</label>
                <input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} style={inputStyle} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>모델명</label>
                  <select value={modelName} onChange={(e) => setModelName(e.target.value)} style={inputStyle}>
                    <option value="JET1Neo">JET1Neo</option>
                    <option value="JET2Neo">JET2Neo</option>
                    <option value="JET3">JET3</option>
                    <option value="JET3up">JET3up</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>시리얼 번호 (S/N)</label>
                  <input placeholder="S/N 입력" value={sn} onChange={(e) => setSn(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>작업 담당자 선택</label>
                <select value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)} style={inputStyle}>
                  {selectedCompany.managersList.map((m, idx) => (
                    <option key={idx} value={m.name}>{m.name} {m.role ? `(${m.role})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>작업 내용</label>
                <textarea rows="3" placeholder="수리 및 점검 내용 입력" value={workContent} onChange={(e) => setWorkContent(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>교체 부품 및 수량</label>
                {usedParts.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input placeholder="부품명 또는 품번" value={p.name} onChange={(e) => { const n = [...usedParts]; n[idx].name = e.target.value; setUsedParts(n); }} style={{ ...inputStyle, flex: 2 }} />
                    <input type="number" min="1" value={p.quantity} onChange={(e) => { const n = [...usedParts]; n[idx].quantity = e.target.value; setUsedParts(n); }} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                ))}
                <button type="button" onClick={() => setUsedParts([...usedParts, { name: '', quantity: 1 }])} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>+ 부품 추가</button>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={labelStyle}>고객 서명</label>
                  <button type="button" onClick={() => sigCanvas.current.clear()} style={{ border: 'none', background: '#F1F5F9', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer' }}>초기화</button>
                </div>
                <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', backgroundColor: '#fff' }}>
                  <SignatureCanvas ref={sigCanvas} canvasProps={{ width: 400, height: 150, className: 'sigCanvas' }} />
                </div>
              </div>

              <button type="submit" disabled={uploading} style={{ padding: '12px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>
                {uploading ? '저장 중...' : '서비스 리포트 저장 및 재고 차감'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 리포트 이미지 팝업 모달 */}
      {selectedReportImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <button onClick={() => setSelectedReportImage(null)} style={{ position: 'absolute', top: '20px', right: '20px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
          <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '12px', maxWidth: '440px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <img src={selectedReportImage} alt="리포트" style={{ width: '100%', borderRadius: '8px' }} />
          </div>
        </div>
      )}

    </div>
  )
}