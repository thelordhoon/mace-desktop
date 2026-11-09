import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function CompanyManagement({ partsList }) {
  const [companies, setCompanies] = useState([])
  const [allHistories, setAllHistories] = useState([])
  const [searchName, setSearchName] = useState('')
  const [sortOrder, setSortOrder] = useState('recent_history')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [selectedReportImage, setSelectedReportImage] = useState(null)

  // 출고증 작성/조회 모달 상태
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [deliveryTargetHistory, setDeliveryTargetHistory] = useState(null)
  
  const [deliveryIssuer, setDeliveryIssuer] = useState('배진철')
  const [customIssuer, setCustomIssuer] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliverySnList, setDeliverySnList] = useState([''])
  
  const [deliveryItems, setDeliveryItems] = useState([
    { partId: '', partSn: '', name: '', qty: 1 }
  ])
  const [deliveryNote, setDeliveryNote] = useState('')

  const [issuerOptions, setIssuerOptions] = useState(['배진철', '직접 입력'])

  const [name, setName] = useState('')
  const [managers, setManagers] = useState([{ name: '', phone: '', role: '', email: '' }])
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [inks, setInks] = useState([''])
  const [solvents, setSolvents] = useState([''])

  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ 
    name: '', 
    managers: [], 
    address: '', 
    note: '', 
    inks: [''], 
    solvents: [''] 
  })

  const [historyList, setHistoryList] = useState([])
  const [detailSnSearchTerm, setDetailSnSearchTerm] = useState('')

  useEffect(() => {
    fetchCompanies()
    fetchAllServiceHistories()
    fetchProfiles()
  }, [])

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from('profiles').select('full_name')
    if (!error && data) {
      const names = data.map(p => p.full_name).filter(Boolean)
      if (names.length > 0) {
        const uniqueNames = Array.from(new Set(['배진철', ...names]))
        setIssuerOptions([...uniqueNames, '직접 입력'])
      }
    }
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('created_at', { ascending: false })
    setCompanies(data || [])
  }

  const fetchAllServiceHistories = async () => {
    const { data } = await supabase.from('service_history').select('*').order('created_at', { ascending: false })
    setAllHistories(data || [])
  }

  const fetchServiceHistory = async (companyId) => {
    const { data } = await supabase.from('service_history').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setHistoryList(data || [])
  }

  const parseManagers = (managerData, phoneData, defaultEmail) => {
    if (!managerData) return [{ name: '', phone: '', role: '', email: defaultEmail || '' }]
    try {
      const parsed = typeof managerData === 'string' ? JSON.parse(managerData) : managerData
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch (e) {}
    return [{ name: managerData || '', phone: phoneData || '', role: '', email: defaultEmail || '' }]
  }

  const parseItemList = (itemData) => {
    if (!itemData) return ['']
    if (Array.isArray(itemData)) return itemData.length > 0 ? itemData : ['']
    const splitArr = String(itemData).split(',').map(s => s.trim()).filter(Boolean)
    return splitArr.length > 0 ? splitArr : ['']
  }

  const getPartPriceInfo = (itemCodeOrName, companyName) => {
    if (!partsList || !itemCodeOrName || !itemCodeOrName.trim()) return null
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

  const handleAddCompany = async (e) => {
    e.preventDefault()
    if (!name) return alert('업체명을 입력해주세요!')
    setUploading(true)

    const cleanInks = inks.map(i => i.trim()).filter(Boolean).join(', ')
    const cleanSolvents = solvents.map(s => s.trim()).filter(Boolean).join(', ')

    const { error } = await supabase.from('companies').insert([{
      name, 
      manager: JSON.stringify(managers), 
      phone: managers[0]?.phone || '', 
      email: managers[0]?.email || '', 
      address, 
      card_url: note, 
      ink: cleanInks, 
      solvent: cleanSolvents
    }])
    setUploading(false)

    if (error) alert('등록 실패: ' + error.message)
    else {
      alert('업체가 등록되었습니다.')
      setName(''); setAddress(''); setNote('');
      setInks(['']); setSolvents(['']); setManagers([{ name: '', phone: '', role: '', email: '' }])
      setShowAddForm(false); fetchCompanies()
    }
  }

  const handleOpenModal = (company) => {
    const parsedManagers = parseManagers(company.manager, company.phone, company.email)
    const parsedInks = parseItemList(company.ink)
    const parsedSolvents = parseItemList(company.solvent)

    setSelectedCompany({ 
      ...company, 
      managersList: parsedManagers,
      inkList: parsedInks,
      solventList: parsedSolvents
    })
    setIsEditing(false)
    setDetailSnSearchTerm('')

    setEditData({ 
      name: company.name || '', 
      managers: parsedManagers, 
      address: company.address || '', 
      note: company.card_url || '', 
      inks: parsedInks, 
      solvents: parsedSolvents 
    })

    setIsModalOpen(true)
    fetchServiceHistory(company.id)
  }

  const handleSaveCompanyEdit = async () => {
    if (!editData.name.trim()) return alert('업체명을 입력해주세요.')
    setUploading(true)

    const cleanInks = editData.inks.map(i => i.trim()).filter(Boolean).join(', ')
    const cleanSolvents = editData.solvents.map(s => s.trim()).filter(Boolean).join(', ')

    const { data, error } = await supabase.from('companies').update({
      name: editData.name, 
      manager: JSON.stringify(editData.managers), 
      phone: editData.managers[0]?.phone || '', 
      email: editData.managers[0]?.email || '',
      address: editData.address, 
      card_url: editData.note, 
      ink: cleanInks, 
      solvent: cleanSolvents
    }).eq('id', selectedCompany.id).select()

    setUploading(false)

    if (error) alert('수정 실패: ' + error.message)
    else {
      alert('업체 정보가 수정되었습니다.')
      const updated = data && data[0] ? data[0] : { ...selectedCompany, ...editData, card_url: editData.note, ink: cleanInks, solvent: cleanSolvents }
      const updatedManagers = parseManagers(updated.manager, updated.phone, updated.email)
      const updatedInks = parseItemList(updated.ink)
      const updatedSolvents = parseItemList(updated.solvent)

      setSelectedCompany({ 
        ...updated, 
        managersList: updatedManagers,
        inkList: updatedInks,
        solventList: updatedSolvents
      })
      setIsEditing(false)
      fetchCompanies()
    }
  }

  const handleDeleteCompany = async (id) => {
    if (!window.confirm('해당 업체의 모든 정보와 서비스 이력이 삭제됩니다. 정말 삭제하시겠습니까?')) return
    await supabase.from('service_history').delete().eq('company_id', id)
    await supabase.from('companies').delete().eq('id', id)
    alert('삭제되었습니다.')
    setIsModalOpen(false); setSelectedCompany(null); fetchCompanies(); fetchAllServiceHistories()
  }

  const handleDeleteHistoryItem = async (historyId) => {
    if (!window.confirm('선택한 서비스 이력을 삭제하시겠습니까?')) return

    const { data: targetHistory } = await supabase
      .from('service_history')
      .select('report_url')
      .eq('id', historyId)
      .single()

    if (targetHistory && targetHistory.report_url) {
      try {
        const urlParts = targetHistory.report_url.split('/')
        const fileName = urlParts[urlParts.length - 1]
        if (fileName) {
          await supabase.storage.from('reports').remove([fileName])
        }
      } catch (err) {
        console.error('스토리지 파일 삭제 오류:', err)
      }
    }

    const { error } = await supabase.from('service_history').delete().eq('id', historyId)
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      alert('서비스 이력이 삭제되었습니다.')
      fetchAllServiceHistories()
      if (selectedCompany) fetchServiceHistory(selectedCompany.id)
    }
  }

  const handleOpenDeliveryModal = (history) => {
    setDeliveryTargetHistory(history)
    setDeliveryDate(history.work_date || new Date().toISOString().split('T')[0])
    
    const matchedComp = companies.find(c => c.id === history.company_id)
    if (matchedComp) {
      const parsedManagers = parseManagers(matchedComp.manager, matchedComp.phone, matchedComp.email)
      setSelectedCompany({
        ...matchedComp,
        managersList: parsedManagers,
        inkList: parseItemList(matchedComp.ink),
        solventList: parseItemList(matchedComp.solvent)
      })
    }
    
    if (history.delivery_data) {
      try {
        const savedData = typeof history.delivery_data === 'string' ? JSON.parse(history.delivery_data) : history.delivery_data
        setDeliveryIssuer(savedData.issuer || '배진철')
        setCustomIssuer(savedData.customIssuer || '')
        setDeliverySnList(savedData.snList || (history.sn ? history.sn.split(',').map(s => s.trim()) : ['']))
        setDeliveryItems(savedData.items || [])
        setDeliveryNote(savedData.note || history.work_content || '')
        setIsDeliveryModalOpen(true)
        return
      } catch (e) {}
    }

    setDeliveryIssuer('배진철')
    setCustomIssuer('')
    setDeliverySnList(history.sn ? history.sn.split(',').map(s => s.trim()) : [''])
    setDeliveryNote(history.work_content || '')

    let parsedParts = []
    try {
      if (history.parts) {
        const temp = typeof history.parts === 'string' ? JSON.parse(history.parts) : history.parts
        if (Array.isArray(temp)) {
          parsedParts = temp.map(p => {
            let rawStr = ''
            let qtyVal = 1
            if (typeof p === 'object') {
              rawStr = p.name || p.code || p.part_id || ''
              qtyVal = p.qty || 1
            } else {
              rawStr = String(p).replace(/\(\d+개\)/g, '').trim()
            }

            let matched = null
            if (partsList && partsList.length > 0) {
              const query = rawStr.toLowerCase()
              matched = partsList.find(pt => (pt.code && pt.code.toLowerCase() === query) || (pt.name && pt.name.toLowerCase() === query))
              if (!matched) {
                matched = partsList.find(pt => (pt.name && pt.name.toLowerCase().includes(query)) || (query.includes(pt.name && pt.name.toLowerCase())))
              }
            }

            if (matched) {
              return { partId: matched.code || '', partSn: '', name: matched.name || '', qty: qtyVal }
            } else {
              return { partId: '', partSn: '', name: rawStr, qty: qtyVal }
            }
          })
        }
      }
    } catch (e) {}

    if (parsedParts.length === 0) {
      parsedParts = [{ partId: '', partSn: '', name: '', qty: 1 }]
    }

    setDeliveryItems(parsedParts)
    setIsDeliveryModalOpen(true)
  }

  const handleSaveDeliveryNote = async () => {
    if (!deliveryTargetHistory) return
    const finalIssuer = deliveryIssuer === '직접 입력' ? customIssuer : deliveryIssuer
    if (!finalIssuer.trim()) return alert('발행자(작성자)명을 입력해주세요.')

    const payload = {
      issuer: finalIssuer,
      customIssuer,
      snList: deliverySnList.filter(s => s.trim() !== ''),
      items: deliveryItems,
      note: deliveryNote,
      issuedAt: new Date().toISOString()
    }

    const { error } = await supabase.from('service_history').update({
      delivery_issued: true,
      delivery_data: JSON.stringify(payload)
    }).eq('id', deliveryTargetHistory.id)

    if (error) {
      alert('출고증 발행 상태 저장 실패: ' + error.message)
    } else {
      alert('출고증이 성공적으로 저장 및 발행 완료 처리되었습니다!')
      setIsDeliveryModalOpen(false)
      fetchAllServiceHistories()
      if (selectedCompany) fetchServiceHistory(selectedCompany.id)
    }
  }

  const handleSendOutlookMail = () => {
    if (!selectedCompany) return
    const primaryManager = selectedCompany.managersList[0] || {}
    const recipientEmail = primaryManager.email || selectedCompany.email || ''
    const subject = `[출고증] (주)메이쓰 - ${selectedCompany.name} 자재/부품 출고명세`
    
    const finalIssuer = deliveryIssuer === '직접 입력' ? customIssuer : deliveryIssuer
    const bodyText = `안녕하세요, (주)메이쓰입니다.

요청하신 장비 서비스 교체 부품에 대한 출고증 정보 발송드립니다.

- 업체명: ${selectedCompany.name}
- 발행일자: ${deliveryDate}
- 작성자: ${finalIssuer}
- 장비 S/N: ${deliverySnList.join(', ')}
- 출고 부품: ${deliveryItems.map(i => `${i.name || i.partId} (${i.qty}개)`).join(', ')}

자세한 내용은 첨부 및 전달드린 출고 명세서를 참고해주시기 바랍니다.
감사합니다.
`

    navigator.clipboard.writeText(bodyText).catch(() => {})
    const mailtoUrl = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
    window.location.href = mailtoUrl
    alert('메일 내용이 클립보드에 복사되었으며, Outlook 메일 창을 호출합니다.')
  }

  const cleanCompanyName = (name) => {
    if (!name) return ''
    return name.replace(/\(주\)|주식회사|\(유\)|유한회사/g, '').trim()
  }

  const getLatestHistoryDate = (companyId) => {
    const compHistories = allHistories.filter(h => h.company_id === companyId)
    if (compHistories.length === 0) return 0
    return Math.max(...compHistories.map(h => new Date(h.created_at || h.work_date).getTime()))
  }

  // 💡 [수정됨] 업체명 또는 장비 S/N 포함 여부로 필터링하도록 수정
  let processedCompanies = companies.filter(c => {
    const query = searchName.trim().toLowerCase()
    if (!query) return true

    // 1. 업체명 매칭 검사
    const matchName = c.name && c.name.toLowerCase().includes(query)

    // 2. 해당 업체의 서비스 이력에 등록된 S/N 매칭 검사
    const compHistories = allHistories.filter(h => h.company_id === c.id)
    const matchSn = compHistories.some(h => h.sn && h.sn.toLowerCase().includes(query))

    return matchName || matchSn
  })

  if (sortOrder === 'alphabet') {
    processedCompanies.sort((a, b) => cleanCompanyName(a.name).localeCompare(cleanCompanyName(b.name), 'ko-KR'))
  } else {
    processedCompanies.sort((a, b) => {
      const timeA = getLatestHistoryDate(a.id)
      const timeB = getLatestHistoryDate(b.id)
      if (timeA !== timeB) {
        return timeB - timeA
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }

  const filteredDetailHistory = detailSnSearchTerm.trim() === ''
    ? historyList
    : historyList.filter(h => h.sn && h.sn.toLowerCase().includes(detailSnSearchTerm.toLowerCase()))

  const inputStyle = { width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-delivery-area, .printable-delivery-area * {
            visibility: visible;
          }
          .printable-delivery-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 10px !important;
            background: #FFFFFF !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm 15mm;
          }
        }
      `}</style>

      {/* 상단 컨트롤 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => setSortOrder('recent_history')}
            style={{ 
              padding: '8px 16px', 
              background: sortOrder === 'recent_history' ? '#2563EB' : '#FFFFFF', 
              color: sortOrder === 'recent_history' ? '#FFFFFF' : '#475569', 
              border: sortOrder === 'recent_history' ? 'none' : '1px solid #CBD5E1', 
              borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' 
            }}
          >
            서비스 이력 최근순
          </button>

          <button 
            onClick={() => setSortOrder('alphabet')}
            style={{ 
              padding: '8px 16px', 
              background: sortOrder === 'alphabet' ? '#2563EB' : '#FFFFFF', 
              color: sortOrder === 'alphabet' ? '#FFFFFF' : '#475569', 
              border: sortOrder === 'alphabet' ? 'none' : '1px solid #CBD5E1', 
              borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' 
            }}
          >
            ㄱㄴㄷ순 정렬
          </button>

          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            style={{ padding: '8px 16px', background: '#0F172A', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
          >
            {showAddForm ? '✕ 닫기' : '+ 신규 거래처 등록'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* 💡 [수정됨] 플레이스홀더를 S/N 검색도 가능함을 알리도록 변경 */}
          <input 
            type="text" 
            placeholder="업체명 또는 S/N 검색..." 
            value={searchName} 
            onChange={(e) => setSearchName(e.target.value)} 
            style={{ ...inputStyle, width: '200px' }} 
          />
        </div>
      </div>

      {/* 신규 거래처 등록 폼 */}
      {showAddForm && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '24px', border: '1px solid #CBD5E1', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B', fontWeight: '700' }}>신규 거래처 등록</h4>
          <form onSubmit={handleAddCompany} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px', display: 'block' }}>업체명*</label>
                <input placeholder="업체명" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px', display: 'block' }}>주소</label>
                <input placeholder="주소" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: 0 }}>담당자 목록</label>
                <button type="button" onClick={() => setManagers([...managers, { name: '', phone: '', role: '', email: '' }])} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ 담당자 추가</button>
              </div>
              {managers.map((m, idx) => (
                <div key={idx} style={{ padding: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.8fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                  <input placeholder="이름" value={m.name} onChange={(e) => { const n = [...managers]; n[idx].name = e.target.value; setManagers(n); }} style={inputStyle} />
                  <input placeholder="부서/직책" value={m.role} onChange={(e) => { const n = [...managers]; n[idx].role = e.target.value; setManagers(n); }} style={inputStyle} />
                  <input placeholder="연락처" value={m.phone} onChange={(e) => { const n = [...managers]; n[idx].phone = e.target.value; setManagers(n); }} style={inputStyle} />
                  <input placeholder="이메일" value={m.email} onChange={(e) => { const n = [...managers]; n[idx].email = e.target.value; setManagers(n); }} style={inputStyle} />
                  {managers.length > 1 && <button type="button" onClick={() => setManagers(managers.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>✕</button>}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: 0 }}>잉크 품번 목록</label>
                  <button type="button" onClick={() => setInks([...inks, ''])} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ 잉크 추가</button>
                </div>
                {inks.map((ik, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input placeholder="예: 70000-00030" value={ik} onChange={(e) => { const newI = [...inks]; newI[idx] = e.target.value; setInks(newI); }} style={inputStyle} />
                    {inks.length > 1 && <button type="button" onClick={() => setInks(inks.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>}
                  </div>
                ))}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: 0 }}>희석제 품번 목록</label>
                  <button type="button" onClick={() => setSolvents([...solvents, ''])} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>+ 희석제 추가</button>
                </div>
                {solvents.map((sv, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                    <input placeholder="예: 77001-00030" value={sv} onChange={(e) => { const newS = [...solvents]; newS[idx] = e.target.value; setSolvents(newS); }} style={inputStyle} />
                    {solvents.length > 1 && <button type="button" onClick={() => setSolvents(solvents.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '6px', display: 'block' }}>비고</label>
              <textarea rows="5" placeholder="비고 입력" value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} />
            </div>

            <button type="submit" disabled={uploading} style={{ padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', marginTop: '6px' }}>
              등록 완료
            </button>
          </form>
        </div>
      )}

      {/* 거래처 목록 테이블 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#64748B', color: '#FFFFFF', borderBottom: '1px solid #475569' }}>
              <th style={{ padding: '12px 18px', width: '25%' }}>업체명</th>
              <th style={{ padding: '12px 16px', width: '15%' }}>대표 담당자</th>
              <th style={{ padding: '12px 16px', width: '20%' }}>연락처</th>
              <th style={{ padding: '12px 16px', width: '30%' }}>주소 (상세)</th>
              <th style={{ padding: '12px 16px', width: '10%', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {processedCompanies.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  등록되었거나 검색 조건에 맞는 거래처가 없습니다.
                </td>
              </tr>
            ) : (
              processedCompanies.map((c, index) => {
                const mList = parseManagers(c.manager, c.phone, c.email)
                const primaryManager = mList[0] || {}

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                    <td 
                      onClick={() => handleOpenModal(c)}
                      style={{ padding: '12px 18px', fontWeight: '700', color: '#2563EB', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline' }}
                      title="클릭하여 상세 정보 팝업 열기"
                    >
                      {c.name}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {primaryManager.name || '-'} {primaryManager.role ? `(${primaryManager.role})` : ''}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: '600', fontFamily: 'monospace' }}>
                      {primaryManager.phone || c.phone || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.address || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleOpenModal(c)} 
                        style={{ padding: '5px 12px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
                      >
                        상세/수정
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 거래처 상세 모달 */}
      {isModalOpen && selectedCompany && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '950px',
            maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#0F172A' }}>
                {selectedCompany.name} 상세 정보
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                <button onClick={() => setIsEditing(!isEditing)} style={{ padding: '8px 14px', background: isEditing ? '#64748B' : '#0F172A', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                  {isEditing ? '수정 취소' : '업체 정보 수정'}
                </button>
                <button onClick={() => handleDeleteCompany(selectedCompany.id)} style={{ padding: '8px 14px', background: '#FEE2E2', color: '#EF4444', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>
                  삭제
                </button>
              </div>

              {!isEditing ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>담당자 정보</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                        {selectedCompany.managersList.map((m, idx) => (
                          <div key={idx} style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '13px' }}>
                            <div style={{ fontWeight: '700', color: '#0F172A' }}>{m.name || '미입력'} ({m.role || '직책 없음'})</div>
                            <div style={{ color: '#64748B', marginTop: '4px' }}>연락처: {m.phone || '-'}</div>
                            <div style={{ color: '#64748B' }}>이메일: {m.email || '-'}</div>
                          </div>
                        ))}
                      </div>

                      <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>주소 정보</h4>
                      <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#334155', marginBottom: '16px' }}>
                        {selectedCompany.address || '등록된 주소가 없습니다.'}
                      </div>

                      <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>비고 사항</h4>
                      <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', color: '#1E293B', minHeight: '110px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                        {selectedCompany.card_url || '등록된 비고 내용이 없습니다.'}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ margin: '0 0 10px 0', color: '#334155' }}>지정 소모품 정보</h4>
                      <div style={{ backgroundColor: '#EFF6FF', padding: '16px', borderRadius: '8px', border: '1px solid #DBEAFE', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        
                        <div>
                          <span style={{ color: '#1E40AF', fontWeight: '700', display: 'block', marginBottom: '6px' }}>잉크 목록</span>
                          {selectedCompany.inkList.map((ik, iIdx) => {
                            const info = getPartPriceInfo(ik, selectedCompany.name)
                            return (
                              <div key={iIdx} style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', border: '1px solid #BFDBFE' }}>
                                <div style={{ fontWeight: '700', color: '#1E3A8A' }}>{ik || '미등록'}</div>
                                <div style={{ fontSize: '12px', color: info?.isSpecial ? '#D97706' : '#2563EB', fontWeight: '800', marginTop: '2px' }}>
                                  {info && info.found ? `${info.finalPrice.toLocaleString()} 원 ${info.isSpecial ? '(특별가)' : ''}` : '단가 정보 없음'}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ borderTop: '1px solid #BFDBFE', paddingTop: '8px' }}>
                          <span style={{ color: '#1E40AF', fontWeight: '700', display: 'block', marginBottom: '6px' }}>희석제 목록</span>
                          {selectedCompany.solventList.map((sv, sIdx) => {
                            const info = getPartPriceInfo(sv, selectedCompany.name)
                            return (
                              <div key={sIdx} style={{ backgroundColor: '#FFFFFF', padding: '8px 10px', borderRadius: '6px', marginBottom: '4px', border: '1px solid #BFDBFE' }}>
                                <div style={{ fontWeight: '700', color: '#1E3A8A' }}>{sv || '미등록'}</div>
                                <div style={{ fontSize: '12px', color: info?.isSpecial ? '#D97706' : '#2563EB', fontWeight: '800', marginTop: '2px' }}>
                                  {info && info.found ? `${info.finalPrice.toLocaleString()} 원 ${info.isSpecial ? '(특별가)' : ''}` : '단가 정보 없음'}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '20px', marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                      <h4 style={{ margin: 0, color: '#1E293B', fontSize: '16px', fontWeight: '700' }}>
                        최근 서비스 이력 ({filteredDetailHistory.length})
                      </h4>
                      <div style={{ position: 'relative', width: '180px' }}>
                        <input 
                          type="text" 
                          placeholder="S/N 검색..." 
                          value={detailSnSearchTerm}
                          onChange={(e) => setDetailSnSearchTerm(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 28px 6px 10px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#F8FAFC',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                        {detailSnSearchTerm ? (
                          <span onClick={() => setDetailSnSearchTerm('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#94A3B8', cursor: 'pointer' }}>✕</span>
                        ) : (
                          <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#94A3B8' }}>🔍</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto' }}>
                      {filteredDetailHistory.length === 0 ? (
                        <p style={{ fontSize: '13px', color: '#94A3B8', textAlign: 'center', margin: '20px 0' }}>
                          {detailSnSearchTerm ? '검색된 S/N 이력이 없습니다.' : '등록된 서비스 이력이 없습니다.'}
                        </p>
                      ) : (
                        filteredDetailHistory.map((h) => {
                          let parsedParts = []
                          try {
                            if (h.parts) {
                              const temp = typeof h.parts === 'string' ? JSON.parse(h.parts) : h.parts
                              parsedParts = Array.isArray(temp) ? temp.filter(p => p && (typeof p === 'string' ? p.trim() !== '' : true)) : []
                            }
                          } catch (e) {}

                          const hasReplacementParts = parsedParts.length > 0
                          const isDeliveryIssued = h.delivery_issued === true

                          return (
                            <div 
                              key={h.id} 
                              onClick={() => {
                                if (h.report_url) setSelectedReportImage(h.report_url)
                              }}
                              style={{ 
                                border: '1px solid #E2E8F0', 
                                padding: '12px 16px', 
                                borderRadius: '8px', 
                                backgroundColor: '#F8FAFC', 
                                cursor: h.report_url ? 'pointer' : 'default',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700' }}>
                                    {h.work_date} ({h.start_time || '09:00'} ~ {h.end_time || '18:00'}) 
                                    {h.report_url && <span style={{ marginLeft: '8px', padding: '2px 6px', backgroundColor: '#EFF6FF', borderRadius: '4px', fontSize: '11px', border: '1px solid #BFDBFE' }}>리포트 보기</span>}
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 2fr', gap: '10px', fontSize: '13px', color: '#334155' }}>
                                  <div><b>S/N:</b> <span style={{ color: '#0284C7', fontWeight: '600' }}>{h.sn || '없음'}</span></div>
                                  <div><b>작업:</b> {h.work_content || '-'}</div>
                                  <div><b>교체 파트:</b> {hasReplacementParts ? parsedParts.map(p => typeof p === 'object' ? (p.name || p.part_id) : p).join(', ') : '없음'}</div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                                {hasReplacementParts && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenDeliveryModal(h)
                                    }}
                                    style={{
                                      border: 'none',
                                      background: isDeliveryIssued ? '#E2E8F0' : '#10B981',
                                      color: isDeliveryIssued ? '#475569' : '#FFFFFF',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      fontWeight: '700'
                                    }}
                                  >
                                    {isDeliveryIssued ? '출고증 발행 완료' : '출고증 작성'}
                                  </button>
                                )}

                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteHistoryItem(h.id)
                                  }}
                                  style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', cursor: 'pointer', fontSize: '12px', padding: '6px 10px', borderRadius: '6px', fontWeight: '600' }}
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                /* 수정 모드 */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>업체명*</label>
                    <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} style={inputStyle} />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>주소</label>
                    <input value={editData.address} onChange={(e) => setEditData({ ...editData, address: e.target.value })} style={inputStyle} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: 0 }}>담당자 목록</label>
                      <button 
                        type="button" 
                        onClick={() => setEditData({ ...editData, managers: [...editData.managers, { name: '', phone: '', role: '', email: '' }] })} 
                        style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        + 담당자 추가
                      </button>
                    </div>
                    {editData.managers.map((m, idx) => (
                      <div key={idx} style={{ padding: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.8fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                        <input placeholder="이름" value={m.name} onChange={(e) => { const n = [...editData.managers]; n[idx].name = e.target.value; setEditData({ ...editData, managers: n }); }} style={inputStyle} />
                        <input placeholder="부서/직책" value={m.role} onChange={(e) => { const n = [...editData.managers]; n[idx].role = e.target.value; setEditData({ ...editData, managers: n }); }} style={inputStyle} />
                        <input placeholder="연락처" value={m.phone} onChange={(e) => { const n = [...editData.managers]; n[idx].phone = e.target.value; setEditData({ ...editData, managers: n }); }} style={inputStyle} />
                        <input placeholder="이메일" value={m.email} onChange={(e) => { const n = [...editData.managers]; n[idx].email = e.target.value; setEditData({ ...editData, managers: n }); }} style={inputStyle} />
                        {editData.managers.length > 1 && (
                          <button type="button" onClick={() => setEditData({ ...editData, managers: editData.managers.filter((_, i) => i !== idx) })} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: 0 }}>잉크 품번 목록</label>
                        <button 
                          type="button" 
                          onClick={() => setEditData({ ...editData, inks: [...editData.inks, ''] })} 
                          style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          + 잉크 추가
                        </button>
                      </div>
                      {editData.inks.map((ik, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                          <input placeholder="예: 70000-00030" value={ik} onChange={(e) => { const newI = [...editData.inks]; newI[idx] = e.target.value; setEditData({ ...editData, inks: newI }); }} style={inputStyle} />
                          {editData.inks.length > 1 && (
                            <button type="button" onClick={() => setEditData({ ...editData, inks: editData.inks.filter((_, i) => i !== idx) })} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', margin: 0 }}>희석제 품번 목록</label>
                        <button 
                          type="button" 
                          onClick={() => setEditData({ ...editData, solvents: [...editData.solvents, ''] })} 
                          style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          + 희석제 추가
                        </button>
                      </div>
                      {editData.solvents.map((sv, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                          <input placeholder="예: 77001-00030" value={sv} onChange={(e) => { const newS = [...editData.solvents]; newS[idx] = e.target.value; setEditData({ ...editData, solvents: newS }); }} style={inputStyle} />
                          {editData.solvents.length > 1 && (
                            <button type="button" onClick={() => setEditData({ ...editData, solvents: editData.solvents.filter((_, i) => i !== idx) })} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }}>비고 (엔터키로 줄바꿈 가능)</label>
                    <textarea rows="5" value={editData.note} onChange={(e) => setEditData({ ...editData, note: e.target.value })} style={inputStyle} />
                  </div>

                  <button onClick={handleSaveCompanyEdit} disabled={uploading} style={{ padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', marginTop: '6px' }}>
                    {uploading ? '저장 중...' : '수정 사항 저장'}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 출고증 발행 및 조회 모달 */}
      {isDeliveryModalOpen && selectedCompany && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 2000, padding: '20px'
        }}>
          <div className="printable-delivery-area" style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '950px',
            maxHeight: '92vh', overflowY: 'auto', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '2px solid #0F172A', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '800' }}>
                출 고 증 (DELIVERY NOTE)
              </h3>
              <button className="no-print" onClick={() => setIsDeliveryModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>공급받는 자 (업체명)</label>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A', padding: '8px 0' }}>{selectedCompany.name}</div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>발행 일자</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>발행자 (작성자)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select value={deliveryIssuer} onChange={(e) => setDeliveryIssuer(e.target.value)} style={inputStyle}>
                    {issuerOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                  </select>
                  {deliveryIssuer === '직접 입력' && (
                    <input placeholder="이름" value={customIssuer} onChange={(e) => setCustomIssuer(e.target.value)} style={inputStyle} />
                  )}
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', margin: 0 }}>장비 S/N 목록</label>
                <button className="no-print" onClick={() => setDeliverySnList([...deliverySnList, ''])} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}>+ S/N 추가</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {deliverySnList.map((snVal, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <input placeholder="S/N" value={snVal} onChange={(e) => { const newS = [...deliverySnList]; newS[sIdx] = e.target.value; setDeliverySnList(newS); }} style={{ ...inputStyle, width: '150px' }} />
                    {deliverySnList.length > 1 && <button className="no-print" onClick={() => setDeliverySnList(deliverySnList.filter((_, i) => i !== sIdx))} style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer' }}>✕</button>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ border: '1px solid #0F172A', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#F1F5F9', padding: '10px 14px', borderBottom: '1px solid #CBD5E1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>출고 부품 품목 명세</span>
                <button 
                  className="no-print"
                  onClick={() => setDeliveryItems([...deliveryItems, { partId: '', partSn: '', name: '', qty: 1 }])} 
                  style={{ padding: '4px 10px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  + 부품 추가
                </button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '45px', textAlign: 'center' }}>NO</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '160px' }}>부품 ID / 코드</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '130px' }}>부품 S/N</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0' }}>품명 / 규격</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '75px', textAlign: 'center' }}>수량</th>
                    <th className="no-print" style={{ padding: '8px', width: '50px', textAlign: 'center' }}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryItems.map((item, idx) => {
                    const codeQuery = (item.partId || '').toLowerCase()
                    const nameQuery = (item.name || '').toLowerCase()
                    
                    const matchedCodeSuggestions = partsList && codeQuery.trim() !== '' 
                      ? partsList.filter(p => p.code && p.code.toLowerCase().includes(codeQuery) && p.code.toLowerCase() !== codeQuery).slice(0, 5)
                      : []

                    const matchedNameSuggestions = partsList && nameQuery.trim() !== '' 
                      ? partsList.filter(p => p.name && p.name.toLowerCase().includes(nameQuery) && p.name.toLowerCase() !== nameQuery).slice(0, 5)
                      : []

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #E2E8F0', fontWeight: '700' }}>{idx + 1}</td>
                        
                        <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0', position: 'relative' }}>
                          <input 
                            value={item.partId} 
                            onChange={(e) => { 
                              const val = e.target.value
                              const newI = [...deliveryItems]
                              newI[idx].partId = val
                              const found = partsList?.find(p => p.code && p.code.toLowerCase() === val.toLowerCase())
                              if (found) {
                                newI[idx].name = found.name || ''
                              }
                              setDeliveryItems(newI) 
                            }} 
                            style={inputStyle} 
                            placeholder="코드 입력" 
                          />
                          {matchedCodeSuggestions.length > 0 && (
                            <div className="no-print" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '4px', zIndex: 3000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '150px', overflowY: 'auto' }}>
                              {matchedCodeSuggestions.map((sPart, sIdx) => (
                                <div 
                                  key={sIdx}
                                  onClick={() => {
                                    const newI = [...deliveryItems]
                                    newI[idx].partId = sPart.code || ''
                                    newI[idx].name = sPart.name || ''
                                    setDeliveryItems(newI)
                                  }}
                                  style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFF' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#EFF6FF'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = '#FFF'}
                                >
                                  <b>{sPart.code}</b> ({sPart.name})
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0' }}>
                          <input 
                            value={item.partSn} 
                            onChange={(e) => { const newI = [...deliveryItems]; newI[idx].partSn = e.target.value; setDeliveryItems(newI); }} 
                            style={inputStyle} 
                            placeholder="부품 S/N" 
                          />
                        </td>

                        <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0', position: 'relative' }}>
                          <input 
                            value={item.name} 
                            onChange={(e) => { 
                              const val = e.target.value
                              const newI = [...deliveryItems]
                              newI[idx].name = val
                              const found = partsList?.find(p => p.name && p.name.toLowerCase() === val.toLowerCase())
                              if (found) {
                                newI[idx].partId = found.code || ''
                              }
                              setDeliveryItems(newI) 
                            }} 
                            style={inputStyle} 
                            placeholder="품명 및 규격" 
                          />
                          {matchedNameSuggestions.length > 0 && (
                            <div className="no-print" style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '4px', zIndex: 3000, boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxHeight: '150px', overflowY: 'auto' }}>
                              {matchedNameSuggestions.map((sPart, sIdx) => (
                                <div 
                                  key={sIdx}
                                  onClick={() => {
                                    const newI = [...deliveryItems]
                                    newI[idx].partId = sPart.code || ''
                                    newI[idx].name = sPart.name || ''
                                    setDeliveryItems(newI)
                                  }}
                                  style={{ padding: '6px 10px', fontSize: '11px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FFF' }}
                                  onMouseEnter={(e) => e.target.style.backgroundColor = '#EFF6FF'}
                                  onMouseLeave={(e) => e.target.style.backgroundColor = '#FFF'}
                                >
                                  <b>{sPart.name}</b> ({sPart.code})
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0' }}>
                          <input 
                            type="number" 
                            value={item.qty} 
                            onChange={(e) => { const newI = [...deliveryItems]; newI[idx].qty = Number(e.target.value); setDeliveryItems(newI); }} 
                            style={{ ...inputStyle, textAlign: 'center' }} 
                          />
                        </td>

                        <td className="no-print" style={{ padding: '6px', textAlign: 'center' }}>
                          <button 
                            onClick={() => setDeliveryItems(deliveryItems.filter((_, i) => i !== idx))} 
                            style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                            title="행 삭제"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '4px' }}>특이사항 및 작업 내용</label>
              <textarea rows="4" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} style={inputStyle} />
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button onClick={() => window.print()} style={{ padding: '10px 18px', background: '#475569', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                바로 인쇄 / PDF
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSaveDeliveryNote} style={{ padding: '10px 20px', background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                  발행 완료 처리 및 저장
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 서비스 리포트 이미지 확대 보기 모달 */}
      {selectedReportImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          <button 
            onClick={() => setSelectedReportImage(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              backgroundColor: '#EF4444',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            ✕
          </button>

          <div style={{
            width: '100%',
            maxWidth: '480px',
            maxHeight: '80vh',
            overflowY: 'auto',
            borderRadius: '12px',
            backgroundColor: 'white',
            padding: '12px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            boxSizing: 'border-box'
          }}>
            <img 
              src={selectedReportImage} 
              alt="서비스 리포트 출고증" 
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} 
            />
          </div>
        </div>
      )}

    </div>
  )
}