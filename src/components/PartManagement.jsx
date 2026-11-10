import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function PartManagement() {
  const [activeTab, setActiveTab] = useState('소모품') // '소모품' | '일반부품'
  const [partsList, setPartsList] = useState([])
  const [companies, setCompanies] = useState([])
  const [partSearchTerm, setPartSearchTerm] = useState('')
  const [showAddPartForm, setShowAddPartForm] = useState(false)

  // 모달 상태
  const [selectedSpecialPrices, setSelectedSpecialPrices] = useState(null)
  const [selectedPartNameForModal, setSelectedPartNameForModal] = useState('')
  const [selectedPartCodeForModal, setSelectedPartCodeForModal] = useState('')
  const [selectedFifoPart, setSelectedFifoPart] = useState(null)
  const [selectedSerialPart, setSelectedSerialPart] = useState(null)

  // 빠른 입고 로트 추가 상태
  const [quickLotPart, setQuickLotPart] = useState(null)
  const [quickLotNo, setQuickLotNo] = useState(`LOT-${Math.floor(1000 + Math.random() * 9000)}`)
  const [quickReceivedDate, setQuickReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [quickExpiry, setQuickExpiry] = useState('')
  const [quickQty, setQuickQty] = useState('')

  // 신규 등록 폼 상태
  const [partName, setPartName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [partCategory, setPartCategory] = useState('잉크')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [dealerPrice, setDealerPrice] = useState(0)
  const [customerPrice, setCustomerPrice] = useState(0)
  const [partNote, setPartNote] = useState('')
  const [companyPrices, setCompanyPrices] = useState([])
  const [lots, setLots] = useState([])
  const [uploading, setUploading] = useState(false)

  // 부품 수정 모드 상태
  const [editingPartId, setEditingPartId] = useState(null)
  const [editPartForm, setEditPartForm] = useState({
    name: '', code: '', category: '잉크', purchase_price: 0, dealer_price: 0, customer_price: 0, note: ''
  })
  const [editCompanyPrices, setEditCompanyPrices] = useState([])
  const [editLots, setEditLots] = useState([])

  useEffect(() => {
    fetchParts()
    fetchCompanies()
  }, [])

  useEffect(() => {
    setPartCategory(activeTab === '소모품' ? '잉크' : '일반부품')
  }, [activeTab])

  const fetchParts = async () => {
    const { data, error } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
    if (!error) setPartsList(data || [])
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  const handleToggleFavorite = async (part) => {
    const newStatus = !part.is_favorite
    setPartsList(prev => prev.map(p => p.id === part.id ? { ...p, is_favorite: newStatus } : p))
    await supabase.from('parts').update({ is_favorite: newStatus }).eq('id', part.id)
  }

  const handleAddCompanyPriceField = () => setCompanyPrices([...companyPrices, { company_name: '', price: 0 }])
  const handleRemoveCompanyPriceField = (i) => setCompanyPrices(companyPrices.filter((_, idx) => idx !== i))
  const handleCompanyPriceChange = (i, field, val) => {
    const updated = [...companyPrices]; updated[i][field] = val; setCompanyPrices(updated)
  }

  const handleAddEditCompanyPriceField = () => setEditCompanyPrices([...editCompanyPrices, { company_name: '', price: 0 }])
  const handleRemoveEditCompanyPriceField = (i) => setEditCompanyPrices(editCompanyPrices.filter((_, idx) => idx !== i))
  const handleEditCompanyPriceChange = (i, field, val) => {
    const updated = [...editCompanyPrices]; updated[i][field] = val; setEditCompanyPrices(updated)
  }

  const handleAddLotField = () => setLots([...lots, { lot_number: `LOT-${Math.floor(1000 + Math.random() * 9000)}`, received_date: new Date().toISOString().split('T')[0], expiry: '', qty: 0 }])
  const handleRemoveLotField = (i) => setLots(lots.filter((_, idx) => idx !== i))
  const handleLotChange = (i, field, val) => {
    const updated = [...lots]; updated[i][field] = val; setLots(updated)
  }

  const handleAddEditLotField = () => setEditLots([...editLots, { lot_number: `LOT-${Math.floor(1000 + Math.random() * 9000)}`, received_date: new Date().toISOString().split('T')[0], expiry: '', qty: 0 }])
  const handleRemoveEditLotField = (i) => setEditLots(editLots.filter((_, idx) => idx !== i))
  const handleEditLotChange = (i, field, val) => {
    const updated = [...editLots]; updated[i][field] = val; setEditLots(updated)
  }

  const handleQuickAddLotSubmit = async (e) => {
    e.preventDefault()
    if (!quickLotPart) return
    if (!quickQty || Number(quickQty) <= 0) return alert('입고 수량을 정확히 입력해주세요!')

    let currentLots = []
    try {
      currentLots = quickLotPart.lots ? (typeof quickLotPart.lots === 'string' ? JSON.parse(quickLotPart.lots) : quickLotPart.lots) : []
    } catch (err) { currentLots = [] }

    const newLot = {
      lot_number: quickLotNo || `LOT-${Math.floor(1000 + Math.random() * 9000)}`,
      received_date: quickReceivedDate || new Date().toISOString().split('T')[0],
      expiry: quickExpiry || '',
      qty: Number(quickQty)
    }

    const updatedLots = [...currentLots, newLot]
    const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

    const { error } = await supabase.from('parts').update({
      lots: JSON.stringify(updatedLots),
      stock: calculatedTotalStock
    }).eq('id', quickLotPart.id)

    if (error) {
      alert('입고 로트 추가 실패: ' + error.message)
    } else {
      alert('입고 로트가 추가되고 총 재고가 자동 반영되었습니다!')
      setQuickLotPart(null)
      setQuickQty('')
      setQuickExpiry('')
      setQuickLotNo(`LOT-${Math.floor(1000 + Math.random() * 9000)}`)
      fetchParts()
    }
  }

  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!partName.trim()) return alert('품명을 입력해주세요!')
    if (!partCode.trim()) return alert('코드/품번을 입력해주세요!')

    setUploading(true)
    const calculatedStock = activeTab === '소모품' ? lots.reduce((sum, l) => sum + Number(l.qty || 0), 0) : 0

    const insertData = {
      name: partName, code: partCode, category: partCategory,
      dealer_price: Number(dealerPrice), customer_price: Number(customerPrice),
      stock: calculatedStock, company_prices: JSON.stringify(companyPrices),
      lots: JSON.stringify(lots), note: partNote, is_favorite: false
    }
    if (activeTab === '일반부품') insertData.purchase_price = Number(purchasePrice)

    const { error } = await supabase.from('parts').insert([insertData])
    setUploading(false)

    if (error) alert('부품 저장 실패: ' + error.message)
    else {
      alert('신규 항목이 등록되었습니다.')
      setPartName(''); setPartCode(''); setPartCategory(activeTab === '소모품' ? '잉크' : '일반부품');
      setPurchasePrice(0); setDealerPrice(0); setCustomerPrice(0); setPartNote('');
      setCompanyPrices([]); setLots([]); setShowAddPartForm(false); fetchParts()
    }
  }

  const handleStartEditPart = (p) => {
    setEditingPartId(p.id)
    setEditPartForm({
      name: p.name || '', code: p.code || '', category: p.category || '일반부품',
      purchase_price: p.purchase_price || 0, dealer_price: p.dealer_price || 0,
      customer_price: p.customer_price || 0, note: p.note || ''
    })
    try {
      const cpTemp = p.company_prices ? (typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices) : []
      setEditCompanyPrices(Array.isArray(cpTemp) ? cpTemp : [])
    } catch (e) { setEditCompanyPrices([]) }
    try {
      let lotTemp = p.lots
      if (typeof lotTemp === 'string') lotTemp = JSON.parse(lotTemp)
      setEditLots(Array.isArray(lotTemp) ? lotTemp : [])
    } catch (e) { setEditLots([]) }
  }

  const handleSavePartEdit = async (partId) => {
    setUploading(true)
    const isConsumableItem = editPartForm.category === '잉크' || editPartForm.category === '희석제' || editPartForm.category === '소모품'
    const calculatedTotalStock = isConsumableItem ? editLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0) : Number(editPartForm.stock || 0)

    const updateData = {
      name: editPartForm.name, code: editPartForm.code, category: editPartForm.category,
      dealer_price: Number(editPartForm.dealer_price), customer_price: Number(editPartForm.customer_price),
      stock: calculatedTotalStock, company_prices: JSON.stringify(editCompanyPrices),
      lots: JSON.stringify(editLots), note: editPartForm.note
    }
    if (!isConsumableItem) updateData.purchase_price = Number(editPartForm.purchase_price)

    const { error } = await supabase.from('parts').update(updateData).eq('id', partId)
    setUploading(false)

    if (error) alert('수정 실패: ' + error.message)
    else {
      alert('정보가 수정되었습니다.')
      setEditingPartId(null)
      fetchParts()
    }
  }

  const handleDeletePart = async (partId) => {
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('parts').delete().eq('id', partId)
    if (!error) { alert('삭제되었습니다.'); fetchParts() }
  }

  const getFifoLots = (p) => {
    let lots = []
    try {
      if (p.lots) lots = typeof p.lots === 'string' ? JSON.parse(p.lots) : p.lots
    } catch (e) {}
    return Array.isArray(lots) ? lots.sort((a, b) => new Date(a.expiry) - new Date(b.expiry)) : []
  }

  const getConditionCounts = (p) => {
    let serials = []
    try {
      if (p.serials) serials = typeof p.serials === 'string' ? JSON.parse(p.serials) : p.serials
    } catch (e) {}
    if (!Array.isArray(serials) || serials.length === 0) return { total: p.stock || 0, bg: p.stock || 0, ex: 0, oh: 0, list: [] }
    const counts = { total: serials.length, bg: 0, ex: 0, oh: 0, list: serials }
    serials.forEach(s => {
      const cond = (s.condition || 'BG').toUpperCase()
      if (cond === 'EX') counts.ex += 1
      else if (cond === 'OH') counts.oh += 1
      else counts.bg += 1
    })
    return counts
  }

  const filteredParts = partsList.filter(p => {
    const cat = p.category || '일반부품'
    const isConsumableCat = cat === '잉크' || cat === '희석제' || cat === '소모품'
    if (activeTab === '소모품' && !isConsumableCat) return false
    if (activeTab === '일반부품' && isConsumableCat) return false
    return !partSearchTerm.trim() || 
      (p.name && p.name.toLowerCase().includes(partSearchTerm.toLowerCase())) ||
      (p.code && p.code.toLowerCase().includes(partSearchTerm.toLowerCase()))
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'))

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '800' }}>🔧 자재 및 부품 재고 관리</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            {activeTab === '소모품' ? '🧪 잉크 & 희석제 선입선출(FIFO) 및 유통기한을 관리합니다.' : '⚙️ 일반 부품 S/N별 보유 상태(BG/EX/OH) 및 매입가·특가를 관리합니다.'}
          </p>
        </div>
        <button onClick={() => setShowAddPartForm(!showAddPartForm)} style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>
          {showAddPartForm ? '✕ 닫기' : `+ 신규 ${activeTab} 등록`}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #E2E8F0', paddingBottom: '2px' }}>
        <button type="button" onClick={() => setActiveTab('소모품')} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', borderBottom: activeTab === '소모품' ? '3px solid #2563EB' : 'none', color: activeTab === '소모품' ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' }}>
          🧪 소모품 관리 (잉크 / 희석제 FIFO)
        </button>
        <button type="button" onClick={() => setActiveTab('일반부품')} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', borderBottom: activeTab === '일반부품' ? '3px solid #2563EB' : 'none', color: activeTab === '일반부품' ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' }}>
          ⚙️ 일반 부품 및 장비 (S/N / 매입가·특가)
        </button>
      </div>

      {showAddPartForm && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '900px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B', fontWeight: '700' }}>🔧 신규 {activeTab} 등록</h4>
          <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>품번 / 코드*</label><input placeholder="예: E55-004891S" value={partCode} onChange={(e) => setPartCode(e.target.value)} style={inputStyle} required /></div>
              <div><label style={labelStyle}>품명*</label><input placeholder="예: 잉크" value={partName} onChange={(e) => setPartName(e.target.value)} style={inputStyle} required /></div>
              <div>
                <label style={labelStyle}>구분 (카테고리)</label>
                <select value={partCategory} onChange={(e) => setPartCategory(e.target.value)} style={inputStyle}>
                  {activeTab === '소모품' ? (<><option value="잉크">잉크</option><option value="희석제">희석제</option></>) : (<><option value="일반부품">일반부품</option><option value="필터류">필터류</option><option value="기타">기타</option></>)}
                </select>
              </div>
            </div>

            {activeTab === '소모품' && (
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>⏳ 입고 로트(Lot) 및 유통기한 관리 (FIFO) - 총 재고 자동 합산</span>
                  <button type="button" onClick={handleAddLotField} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 입고 로트 추가</button>
                </div>
                {lots.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '8px' }}>[+ 입고 로트 추가] 버튼을 눌러 입고일과 유통기한을 입력하세요.</div>
                ) : (
                  lots.map((l, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 30px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <input type="text" placeholder="Lot No" value={l.lot_number} onChange={(e) => handleLotChange(idx, 'lot_number', e.target.value)} style={inputStyle} />
                      <input type="date" placeholder="입고일" value={l.received_date} onChange={(e) => handleLotChange(idx, 'received_date', e.target.value)} style={inputStyle} />
                      <input type="date" placeholder="유통기한" value={l.expiry} onChange={(e) => handleLotChange(idx, 'expiry', e.target.value)} style={inputStyle} />
                      <input type="number" placeholder="수량" value={l.qty} onChange={(e) => handleLotChange(idx, 'qty', e.target.value)} style={inputStyle} />
                      <button type="button" onClick={() => handleRemoveLotField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', textAlign: 'center' }}>✕</button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: activeTab === '일반부품' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px' }}>
              {activeTab === '일반부품' && (<div><label style={labelStyle}>매입 가격 (원)</label><input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} style={inputStyle} /></div>)}
              <div><label style={labelStyle}>소비자 기본가 (원)</label><input type="number" value={customerPrice} onChange={(e) => setCustomerPrice(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>딜러 기본가 (원)</label><input type="number" value={dealerPrice} onChange={(e) => setDealerPrice(e.target.value)} style={inputStyle} /></div>
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 개별 특가 (선택)</span>
                <button type="button" onClick={handleAddCompanyPriceField} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 업체 추가</button>
              </div>
              {companyPrices.map((cp, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <input type="text" placeholder="업체명 검색..." value={cp.company_name} onChange={(e) => handleCompanyPriceChange(idx, 'company_name', e.target.value)} style={{ ...inputStyle, flex: 1.5 }} />
                  <input type="number" placeholder="특가 (원)" value={cp.price} onChange={(e) => handleCompanyPriceChange(idx, 'price', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={() => handleRemoveCompanyPriceField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                </div>
              ))}
            </div>

            <div><label style={labelStyle}>📌 비고</label><textarea rows="3" placeholder="메모 및 특이사항 입력" value={partNote} onChange={(e) => setPartNote(e.target.value)} style={inputStyle} /></div>

            <button type="submit" disabled={uploading} style={{ padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: '6px' }}>
              {uploading ? '저장 중...' : '등록 저장'}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input type="text" placeholder={`🔍 ${activeTab} 품명 또는 품번 검색...`} value={partSearchTerm} onChange={(e) => setPartSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '400px' }} />
      </div>

      {editingPartId !== null ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #2563EB', boxShadow: '0 4px 12px rgba(37,99,235,0.1)', marginBottom: '20px', maxWidth: '900px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#2563EB', fontWeight: '700' }}>✏️ 정보 수정</h4>
            <button type="button" onClick={() => setEditingPartId(null)} style={{ border: 'none', background: 'none', fontSize: '14px', color: '#64748B', cursor: 'pointer', fontWeight: '600' }}>✕ 취소</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>품번/코드</label><input value={editPartForm.code} onChange={(e) => setEditPartForm({ ...editPartForm, code: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>품명</label><input value={editPartForm.name} onChange={(e) => setEditPartForm({ ...editPartForm, name: e.target.value })} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>구분 (카테고리)</label>
                <select value={editPartForm.category} onChange={(e) => setEditPartForm({ ...editPartForm, category: e.target.value })} style={inputStyle}>
                  <option value="잉크">잉크</option><option value="희석제">희석제</option><option value="일반부품">일반부품</option><option value="필터류">필터류</option><option value="기타">기타</option>
                </select>
              </div>
            </div>

            {(editPartForm.category === '잉크' || editPartForm.category === '희석제' || editPartForm.category === '소모품') && (
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>⏳ 입고 로트(Lot) 및 유통기한 관리 (FIFO) - 총 재고 자동 합산</span>
                  <button type="button" onClick={handleAddEditLotField} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 입고 로트 추가</button>
                </div>
                {editLots.map((l, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 30px', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <input type="text" placeholder="Lot No" value={l.lot_number} onChange={(e) => handleEditLotChange(idx, 'lot_number', e.target.value)} style={inputStyle} />
                    <input type="date" placeholder="입고일" value={l.received_date} onChange={(e) => handleEditLotChange(idx, 'received_date', e.target.value)} style={inputStyle} />
                    <input type="date" placeholder="유통기한" value={l.expiry} onChange={(e) => handleEditLotChange(idx, 'expiry', e.target.value)} style={inputStyle} />
                    <input type="number" placeholder="수량" value={l.qty} onChange={(e) => handleEditLotChange(idx, 'qty', e.target.value)} style={inputStyle} />
                    <button type="button" onClick={() => handleRemoveEditLotField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', textAlign: 'center' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>매입 가격</label><input type="number" value={editPartForm.purchase_price} onChange={(e) => setEditPartForm({ ...editPartForm, purchase_price: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>소비자 기본가</label><input type="number" value={editPartForm.customer_price} onChange={(e) => setEditPartForm({ ...editPartForm, customer_price: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>딜러 기본가</label><input type="number" value={editPartForm.dealer_price} onChange={(e) => setEditPartForm({ ...editPartForm, dealer_price: e.target.value })} style={inputStyle} /></div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 특가 관리</span>
                <button type="button" onClick={handleAddEditCompanyPriceField} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 업체 추가</button>
              </div>
              {editCompanyPrices.map((cp, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <input type="text" placeholder="업체 검색..." value={cp.company_name} onChange={(e) => handleEditCompanyPriceChange(idx, 'company_name', e.target.value)} style={{ ...inputStyle, flex: 1.5 }} />
                  <input type="number" placeholder="특가 (원)" value={cp.price} onChange={(e) => handleEditCompanyPriceChange(idx, 'price', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={() => handleRemoveEditCompanyPriceField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                </div>
              ))}
            </div>

            <div><label style={labelStyle}>비고</label><textarea rows="3" value={editPartForm.note} onChange={(e) => setEditPartForm({ ...editPartForm, note: e.target.value })} style={inputStyle} /></div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button type="button" onClick={() => setEditingPartId(null)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>취소</button>
              <button type="button" onClick={() => handleSavePartEdit(editingPartId)} disabled={uploading} style={{ padding: '10px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>{uploading ? '저장 중...' : '수정 사항 저장'}</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '14px 16px', width: '90px' }}>구분</th>
                <th style={{ padding: '14px 16px', width: '150px' }}>품번 / 코드</th>
                <th style={{ padding: '14px 16px', width: '220px' }}>품명</th>
                <th style={{ padding: '14px 16px', width: '220px' }}>{activeTab === '소모품' ? '재고 수량 (FIFO 입고/유통기한)' : '재고 현황 (S/N 상태별)'}</th>
                <th style={{ padding: '14px 16px', width: '150px' }}>업체별 특가</th>
                <th style={{ padding: '14px 16px', width: '110px' }}>소비자 기본가</th>
                <th style={{ padding: '14px 16px', width: '110px' }}>딜러 기본가</th>
                <th style={{ padding: '14px 16px', width: '120px', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 ? (
                <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>등록된 {activeTab} 항목이 없습니다.</td></tr>
              ) : (
                filteredParts.map((p) => {
                  let parsedCompanyPrices = []
                  try {
                    const temp = p.company_prices ? (typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices) : []
                    parsedCompanyPrices = Array.isArray(temp) ? temp.filter(cp => cp && cp.company_name) : []
                  } catch (e) {}

                  const specialPriceCount = parsedCompanyPrices.length
                  const condCounts = getConditionCounts(p)

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '4px 8px', backgroundColor: activeTab === '소모품' ? '#EFF6FF' : '#F1F5F9', color: activeTab === '소모품' ? '#2563EB' : '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                          {(() => {
                            const name = (p.name || '').toUpperCase()
                            if (p.category === '희석제' || name.includes('희석제')) return '희석제'
                            if (p.category === '잉크' || name.includes('잉크') || name.includes('INK')) return '잉크'
                            return p.category || activeTab
                          })()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', wordBreak: 'break-all' }}>{p.code || '-'}</td>
                      
                      {/* 💡 눈이 편안한 파스텔톤/회색빛 스타일로 변경된 [+ 입고 로트 추가] 버튼 */}
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ wordBreak: 'break-all' }}>{p.name}</span>
                          {activeTab === '소모품' && (
                            <button
                              type="button"
                              onClick={() => setQuickLotPart(p)}
                              style={{
                                backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1',
                                padding: '4px 9px', borderRadius: '6px', fontSize: '11px',
                                fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
                              }}
                            >
                              + 입고 로트 추가
                            </button>
                          )}
                        </div>
                      </td>
                      
                      {activeTab === '소모품' ? (
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: '800', color: '#10B981', fontSize: '14px' }}>{p.stock ?? 0} 개</span>
                            <button type="button" onClick={() => setSelectedFifoPart(p)} style={{ border: 'none', background: '#F0FDF4', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                              ⏳ FIFO/유통기한 🔍
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '13px' }}>총 {condCounts.total}개</span>
                              <button type="button" onClick={() => setSelectedSerialPart(p)} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>S/N 목록 🔍</button>
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>BG: {condCounts.bg}</span>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC' }}>EX: {condCounts.ex}</span>
                              <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}>OH: {condCounts.oh}</span>
                            </div>
                          </div>
                        </td>
                      )}

                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {specialPriceCount > 0 ? (
                          <button type="button" onClick={() => { setSelectedSpecialPrices(parsedCompanyPrices); setSelectedPartNameForModal(p.name); setSelectedPartCodeForModal(p.code || '-') }} style={{ fontSize: '11px', fontWeight: '700', color: '#D97706', backgroundColor: '#FEF3C7', border: '1px solid #FCD34D', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🏷️ 지정 특가 {specialPriceCount}개 [보기]
                          </button>
                        ) : (<span style={{ fontSize: '12px', color: '#94A3B8' }}>-</span>)}
                      </td>

                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563EB', whiteSpace: 'nowrap' }}>{p.customer_price ? Number(p.customer_price).toLocaleString() : 0} 원</td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>{p.dealer_price ? Number(p.dealer_price).toLocaleString() : 0} 원</td>
                      
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                          <button type="button" onClick={() => handleToggleFavorite(p)} title="즐겨찾기" style={{ border: '1px solid #CBD5E1', background: p.is_favorite ? '#FEF3C7' : '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', padding: '4px 8px' }}>{p.is_favorite ? '⭐' : '☆'}</button>
                          <button onClick={() => handleStartEditPart(p)} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>수정</button>
                          <button onClick={() => handleDeletePart(p.id)} style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 빠른 입고 로트 추가 모달 */}
      {quickLotPart !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>📦 빠른 입고 로트 추가</h3>
                <div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{quickLotPart.code} - {quickLotPart.name}</div>
              </div>
              <button onClick={() => setQuickLotPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleQuickAddLotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Lot 번호</label>
                <input type="text" value={quickLotNo} onChange={(e) => setQuickLotNo(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>입고일</label>
                <input type="date" value={quickReceivedDate} onChange={(e) => setQuickReceivedDate(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>유통기한</label>
                <input type="date" value={quickExpiry} onChange={(e) => setQuickExpiry(e.target.value)} style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>입고 수량 (개)</label>
                <input type="number" placeholder="예: 50" value={quickQty} onChange={(e) => setQuickQty(e.target.value)} style={inputStyle} required autoFocus />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setQuickLotPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}>추가 및 재고 자동반영</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 모달 1: 특가 */}
      {selectedSpecialPrices !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '440px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div><h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>🏷️ 지정 특가 목록</h3><div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{selectedPartCodeForModal} - {selectedPartNameForModal}</div></div>
              <button onClick={() => setSelectedSpecialPrices(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              {selectedSpecialPrices.map((cp, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '8px' }}>
                  <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '13px' }}>{cp.company_name}</span>
                  <span style={{ fontWeight: '800', color: '#2563EB', fontSize: '13px' }}>{Number(cp.price).toLocaleString()} 원</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}><button type="button" onClick={() => setSelectedSpecialPrices(null)} style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>확인</button></div>
          </div>
        </div>
      )}

      {/* 모달 2: FIFO */}
      {selectedFifoPart !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '520px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div><h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>⏳ 소모품 FIFO 입고 & 유통기한 현황</h3><div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{selectedFifoPart.code} - {selectedFifoPart.name}</div></div>
              <button onClick={() => setSelectedFifoPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {getFifoLots(selectedFifoPart).length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>등록된 상세 입고 로트(Lot)가 없습니다. [+ 입고 로트 추가] 버튼을 눌러 추가해 보세요!</div>
              ) : (
                getFifoLots(selectedFifoPart).map((lot, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: idx === 0 ? '#FEF2F2' : '#F8FAFC', border: idx === 0 ? '1px solid #FCA5A5' : '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>
                        {idx === 0 && <span style={{ color: '#DC2626', fontSize: '11px', marginRight: '4px' }}>[FIFO 1순위 출고]</span>}
                        Lot No: {lot.lot_number}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>입고일: {lot.received_date} | <strong>유통기한: {lot.expiry}</strong></div>
                    </div>
                    <span style={{ fontWeight: '800', color: '#2563EB', fontSize: '13px' }}>{lot.qty || 0} 개</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}><button type="button" onClick={() => setSelectedFifoPart(null)} style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>닫기</button></div>
          </div>
        </div>
      )}

      {/* 모달 3: S/N */}
      {selectedSerialPart !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', width: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div><h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>🔍 시리얼(S/N) 보유 상세 목록</h3><div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{selectedSerialPart.code} - {selectedSerialPart.name}</div></div>
              <button onClick={() => setSelectedSerialPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {getConditionCounts(selectedSerialPart).list.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>등록된 개별 시리얼이 없습니다.</div>
              ) : (
                getConditionCounts(selectedSerialPart).list.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px 14px', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '700', color: '#0F172A', fontSize: '13px' }}>S/N: {s.sn || s.serial_number}</span>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>{s.location || '본사 창고'}</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}><button type="button" onClick={() => setSelectedSerialPart(null)} style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>닫기</button></div>
          </div>
        </div>
      )}
    </div>
  )
}