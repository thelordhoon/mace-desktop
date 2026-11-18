import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function GeneralPartsTab({ partsList, refreshParts, showAddForm, setShowAddForm, user }) {
  const [currentLoggedInName, setCurrentLoggedInName] = useState(user?.full_name || user?.email?.split('@')[0] || '배진철')

  const [searchTerm, setSearchTerm] = useState('')
  const [companies, setCompanies] = useState([])

  const [partName, setPartName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [partCategory, setPartCategory] = useState('일반부품')
  const [dealerPrice, setDealerPrice] = useState(0)
  const [customerPrice, setCustomerPrice] = useState(0)
  const [partNote, setPartNote] = useState('')
  const [isSerialManaged, setIsSerialManaged] = useState(false)
  const [initialStock, setInitialStock] = useState(0)
  const [serials, setSerials] = useState([])
  const [imageFile, setImageFile] = useState(null)

  const [selectedSerialPart, setSelectedSerialPart] = useState(null)
  const [editableSerials, setEditableSerials] = useState([])

  const [quickSerialPart, setQuickSerialPart] = useState(null)
  const [inputSn, setInputSn] = useState('')
  const [inputCondition, setInputCondition] = useState('BG')
  const [inputReceivedDate, setInputReceivedDate] = useState(new Date().toISOString().split('T')[0])

  const [quantityStockPart, setQuantityStockPart] = useState(null)
  const [qtyChangeAmount, setQtyChangeAmount] = useState(1)
  const [qtyChangeType, setQtyChangeType] = useState('IN')
  const [qtyNote, setQtyNote] = useState('')

  const [previewImage, setPreviewImage] = useState(null)

  const [editingPart, setEditingPart] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', category: '일반부품', customer_price: 0, dealer_price: 0, note: '', is_serial_managed: false, stock: 0 })
  const [editImageFile, setEditImageFile] = useState(null)

  const [isInternalIssueModalOpen, setIsInternalIssueModalOpen] = useState(false)
  const [deliveryCompanyName, setDeliveryCompanyName] = useState('엔지니어실 (내근용)')
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0])
  const [deliveryAuthor, setDeliveryAuthor] = useState('')
  const [equipmentSns, setEquipmentSns] = useState([''])
  const [deliveryItems, setDeliveryItems] = useState([
    { partId: '', searchKeyword: '', selectedSn: '', quantity: 1, note: '', showDropdown: false }
  ])
  const [deliveryNoteText, setDeliveryNoteText] = useState('')

  useEffect(() => {
    fetchCompanies()
    fetchSessionUser()
  }, [user])

  const fetchSessionUser = async () => {
    let resolvedName = '배진철'
    if (user?.full_name) resolvedName = user.full_name
    else if (user?.email) resolvedName = user.email.split('@')[0]
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const meta = session.user.user_metadata
        if (meta?.full_name) resolvedName = meta.full_name
        else if (meta?.name) resolvedName = meta.name
        else if (session.user.email) resolvedName = session.user.email.split('@')[0]
      }
    } catch (e) {
      console.error('세션 유저 조회 실패:', e)
    }
    setCurrentLoggedInName(resolvedName)
    setDeliveryAuthor(resolvedName)
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: '13px', borderRadius: '8px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px', display: 'block' }

  const uploadImageToStorage = async (file) => {
    if (!file) return ''
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('part-images').upload(fileName, file)
      if (uploadError) return ''
      const { data } = supabase.storage.from('part-images').getPublicUrl(fileName)
      return data.publicUrl || ''
    } catch (err) {
      return ''
    }
  }

  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!partName.trim() || !partCode.trim()) return alert('품명과 Ident No.(코드)를 입력해주세요!')

    let imageUrl = ''
    if (imageFile) imageUrl = await uploadImageToStorage(imageFile)

    let calculatedStock = 0
    let validSerials = []

    if (isSerialManaged) {
      validSerials = (serials || []).filter(s => s && s.sn && s.sn.trim() !== '')
      calculatedStock = validSerials.length
    } else {
      calculatedStock = Number(initialStock) || 0
    }

    const { error } = await supabase.from('parts').insert([{
      name: partName.trim(),
      code: partCode.trim(),
      category: partCategory,
      dealer_price: Number(dealerPrice),
      customer_price: Number(customerPrice),
      stock: calculatedStock,
      serials: JSON.stringify(validSerials),
      lots: JSON.stringify([]),
      image_url: imageUrl,
      note: partNote,
      is_serial_managed: isSerialManaged,
      is_favorite: false
    }])

    if (!error) {
      alert('신규 일반 부품이 성공적으로 등록되었습니다.')
      setPartName(''); setPartCode(''); setPartNote(''); setSerials([]); setImageFile(null); setIsSerialManaged(false); setInitialStock(0); setShowAddForm(false)
      refreshParts()
    } else {
      alert('등록 실패: ' + error.message)
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingPart) return

    let imageUrl = editingPart.image_url || ''
    if (editImageFile) {
      const uploadedUrl = await uploadImageToStorage(editImageFile)
      if (uploadedUrl) imageUrl = uploadedUrl
    }

    const updatePayload = {
      name: editForm.name.trim(),
      code: editForm.code.trim(),
      category: editForm.category,
      customer_price: Number(editForm.customer_price),
      dealer_price: Number(editForm.dealer_price),
      note: editForm.note,
      is_serial_managed: editForm.is_serial_managed,
      image_url: imageUrl
    }

    if (!editForm.is_serial_managed) {
      updatePayload.stock = Number(editForm.stock) || 0
    }

    const { error } = await supabase.from('parts').update(updatePayload).eq('id', editingPart.id)

    if (!error) {
      alert('부품 정보가 수정되었습니다.')
      setEditingPart(null)
      setEditImageFile(null)
      refreshParts()
    } else {
      alert('수정 실패: ' + error.message)
    }
  }

  const handleDeletePart = async (id, name) => {
    if (!window.confirm(`[${name}] 부품을 정말 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('parts').delete().eq('id', id)
    if (!error) {
      alert('부품이 삭제되었습니다.')
      refreshParts()
    } else {
      alert('삭제 실패: ' + error.message)
    }
  }

  const handleInternalDeliverySubmit = async (e) => {
    e.preventDefault()
    if (deliveryItems.length === 0) return alert('출고할 부품 명세를 1개 이상 추가해주세요!')

    for (let i = 0; i < deliveryItems.length; i++) {
      const item = deliveryItems[i]
      if (!item.partId) return alert((i + 1) + '행의 부품을 선택해주세요!')
      const partObj = (partsList || []).find(p => String(p.id) === String(item.partId))
      if (partObj && partObj.is_serial_managed && !item.selectedSn) {
        return alert((i + 1) + '행(' + partObj.name + ')은 S/N 관리품입니다. 보유 S/N를 선택해주세요!')
      }
    }

    let summaryPartsList = []
    let serialListForNote = []

    for (const item of deliveryItems) {
      const partObj = (partsList || []).find(p => String(p.id) === String(item.partId))
      if (!partObj) continue

      let parsedSerials = []
      try {
        const temp = partObj.serials ? (typeof partObj.serials === 'string' ? JSON.parse(partObj.serials) : partObj.serials) : []
        parsedSerials = Array.isArray(temp) ? temp : []
      } catch (err) { parsedSerials = [] }

      let newStock = Number(partObj.stock) || 0
      let updatedSerials = [...parsedSerials]

      if (partObj.is_serial_managed) {
        updatedSerials = parsedSerials.filter(s => s.sn !== item.selectedSn)
        newStock = updatedSerials.length
        summaryPartsList.push(`${partObj.name} (S/N: ${item.selectedSn})`)
        serialListForNote.push(`${item.selectedSn}: ${partObj.name} 교체`)
      } else {
        const amt = Number(item.quantity) || 1
        if (newStock < amt) return alert(`[${partObj.name}] 부품의 재고가 부족합니다! (현재고: ${newStock}개)`)
        newStock -= amt
        summaryPartsList.push(`${partObj.name} (${amt}개)`)
      }

      const updatePayload = { stock: newStock }
      if (partObj.is_serial_managed) {
        updatePayload.serials = JSON.stringify(updatedSerials)
      }
      await supabase.from('parts').update(updatePayload).eq('id', partObj.id)
    }

    const validEquipSns = equipmentSns.filter(s => s && s.trim() !== '').join(', ')
    const finalSummary = summaryPartsList.join(', ')

    const deliveryPayloadJson = JSON.stringify({
      equipmentSns: equipmentSns.filter(s => s && s.trim() !== ''),
      items: deliveryItems.map(item => {
        const partObj = (partsList || []).find(p => String(p.id) === String(item.partId))
        return {
          code: partObj ? partObj.code : '-',
          name: partObj ? partObj.name : item.searchKeyword,
          isSerial: partObj ? partObj.is_serial_managed : false,
          selectedSn: item.selectedSn,
          quantity: item.quantity
        }
      })
    })

    const userNoteInput = deliveryNoteText ? deliveryNoteText.trim() : (serialListForNote.join(', ') || '엔지니어실 내근 출고')
    const finalNote = `${userNoteInput} [DELIVERY_DETAILS:${deliveryPayloadJson}]`

    const { error: historyErr } = await supabase.from('delivery_history').insert([{
      date: deliveryDate,
      company_name: deliveryCompanyName.trim() || '엔지니어실 (내근용)',
      equipment_sn: validEquipSns || '-',
      summary: finalSummary,
      author: deliveryAuthor || currentLoggedInName,
      note: finalNote,
      type: 'OUTBOUND'
    }])

    if (historyErr) {
      return alert('출고증 저장 오류: ' + historyErr.message)
    }

    alert('출고증이 성공적으로 발행 및 저장되었습니다!')
    setIsInternalIssueModalOpen(false)
    setDeliveryCompanyName('엔지니어실 (내근용)')
    setEquipmentSns([''])
    setDeliveryItems([{ partId: '', searchKeyword: '', selectedSn: '', quantity: 1, note: '', showDropdown: false }])
    setDeliveryNoteText('')
    refreshParts()
  }

  const filteredParts = (partsList || []).filter(p => {
    if (!p) return false
    const cat = (p.category || '').toLowerCase()
    const isConsumable = cat.includes('잉크') || cat.includes('희석제') || cat.includes('소모품')
    return !isConsumable && (!searchTerm.trim() || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase()))
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'))

  return (
    <div onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}>
      {showAddForm && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '14px', padding: '18px 20px', border: '1px solid #CBD5E1', marginBottom: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>⚙️ 신규 일반 부품 등록</h4>
            <button type="button" onClick={() => setShowAddForm(false)} style={{ border: 'none', background: 'none', fontSize: '14px', color: '#64748B', cursor: 'pointer', fontWeight: 'bold' }}>✕ 닫기</button>
          </div>

          <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 1fr 1fr', gap: '10px' }}>
              <div><label style={labelStyle}>Ident No. (코드)*</label><input placeholder="예: E55-010271T" value={partCode} onChange={e => setPartCode(e.target.value)} style={inputStyle} required /></div>
              <div><label style={labelStyle}>품명*</label><input placeholder="예: Display cable" value={partName} onChange={e => setPartName(e.target.value)} style={inputStyle} required /></div>
              <div>
                <label style={labelStyle}>구분 / 모델</label>
                <select value={partCategory} onChange={e => setPartCategory(e.target.value)} style={inputStyle}>
                  <option value="일반부품">일반부품</option>
                  <option value="Spare parts">Spare parts</option>
                  <option value="Accessories">Tag</option>
                  <option value="Tools">Tools</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>부품 사진 첨부</label>
                <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} style={{ ...inputStyle, padding: '5px', fontSize: '11px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '10px' }}>
              <div><label style={labelStyle}>소비자 기본가 (원)</label><input type="number" value={customerPrice} onChange={e => setCustomerPrice(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>딜러 기본가 (원)</label><input type="number" value={dealerPrice} onChange={e => setDealerPrice(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>📌 비고</label><input placeholder="특이사항 입력..." value={partNote} onChange={e => setPartNote(e.target.value)} style={inputStyle} /></div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="serialCheck" checked={isSerialManaged} onChange={e => setIsSerialManaged(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <label htmlFor="serialCheck" style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', cursor: 'pointer' }}>
                  이 부품은 개별 S/N(시리얼 번호) 관리 대상입니다. (체크 해제 시 순수 수량으로만 관리)
                </label>
              </div>
              {isSerialManaged && (
                <button type="button" onClick={() => setSerials([...serials, { sn: '', condition: 'BG' }])} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>+ S/N 추가</button>
              )}
            </div>

            {isSerialManaged ? (
              (serials || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                  {serials.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="text" placeholder="시리얼 번호 (S/N)..." value={s.sn} onChange={e => {
                        const updated = [...serials]; updated[idx].sn = e.target.value; setSerials(updated);
                      }} style={{ ...inputStyle, flex: 2, padding: '6px 10px' }} />
                      <select value={s.condition} onChange={e => {
                        const updated = [...serials]; updated[idx].condition = e.target.value; setSerials(updated);
                      }} style={{ ...inputStyle, flex: 1, padding: '6px 10px' }}>
                        <option value="BG">BG (신품)</option>
                        <option value="EX">EX (수리)</option>
                        <option value="OH">OH (중고)</option>
                      </select>
                      <button type="button" onClick={() => setSerials(serials.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '13px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div style={{ maxWidth: '200px' }}>
                <label style={labelStyle}>최초 보유 수량 (Stock)</label>
                <input type="number" min="0" value={initialStock} onChange={e => setInitialStock(e.target.value)} style={inputStyle} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '8px 14px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>취소</button>
              <button type="submit" style={{ padding: '8px 16px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}>등록 저장</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 부품 품명 또는 Ident No.(코드) 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '360px', flex: 1 }} />
        
        <button type="button" onClick={async () => {
          await fetchSessionUser()
          setIsInternalIssueModalOpen(true)
        }} style={{ background: '#059669', color: '#fff', border: 'none', padding: '11px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          📄 출고증 발행
        </button>
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '70px', textAlign: 'center' }}>사진</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '140px' }}>Ident No.</th>
              <th style={{ padding: '14px 16px', width: '180px' }}>품명</th>
              <th style={{ padding: '14px 16px', width: '220px' }}>재고 수량 및 S/N 현황</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>소비자가</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>딜러가</th>
              <th style={{ padding: '14px 16px', width: '110px', textAlign: 'center' }}>입·출고 / S/N</th>
              <th style={{ padding: '14px 16px', width: '100px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.length === 0 ? (
              <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>등록된 일반 부품이 없습니다.</td></tr>
            ) : (
              filteredParts.map(p => {
                let parsedSerials = []
                try {
                  const temp = p.serials ? (typeof p.serials === 'string' ? JSON.parse(p.serials) : p.serials) : []
                  parsedSerials = Array.isArray(temp) ? temp : []
                } catch (e) {}

                const totalStock = p.is_serial_managed ? parsedSerials.length : (Number(p.stock) || 0)

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                    <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} onClick={() => setPreviewImage(p.image_url)} style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid #CBD5E1' }} />
                      ) : (
                        <div style={{ width: '42px', height: '42px', backgroundColor: '#F1F5F9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#94A3B8', margin: '0 auto' }}>No Img</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span style={{ padding: '3px 6px', backgroundColor: '#F1F5F9', color: '#334155', borderRadius: '4px', fontSize: '11px', fontWeight: '700', width: 'fit-content' }}>{p.category || '일반부품'}</span>
                        <span style={{ fontSize: '10px', fontWeight: '800', color: p.is_serial_managed ? '#2563EB' : '#64748B' }}>
                          {p.is_serial_managed ? '🏷️ S/N 관리품' : '📦 수량 관리품'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', wordBreak: 'break-all' }}>{p.code || '-'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{p.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A', backgroundColor: '#F8FAFC', padding: '3px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                          {totalStock} 개
                        </span>
                        {p.is_serial_managed && (
                          <button type="button" onClick={() => { setSelectedSerialPart(p); setEditableSerials(parsedSerials); }} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            ✏️ 개별 S/N 일괄 편집 ({parsedSerials.length})
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563EB' }}>{p.customer_price ? Number(p.customer_price).toLocaleString() : 0} 원</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>{p.dealer_price ? Number(p.dealer_price).toLocaleString() : 0} 원</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {p.is_serial_managed ? (
                        <button type="button" onClick={() => setQuickSerialPart(p)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          + S/N 입고
                        </button>
                      ) : (
                        <button type="button" onClick={() => setQuantityStockPart(p)} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          + 수량 입·출고
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                        <button type="button" onClick={() => {
                          setEditingPart(p)
                          setEditForm({ name: p.name, code: p.code, category: p.category || '일반부품', customer_price: p.customer_price || 0, dealer_price: p.dealer_price || 0, note: p.note || '', is_serial_managed: !!p.is_serial_managed, stock: p.stock || 0 })
                          setEditImageFile(null)
                        }} style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '4px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          수정
                        </button>
                        <button type="button" onClick={() => handleDeletePart(p.id, p.name)} style={{ background: '#FEE2E2', color: '#EF4444', border: 'none', padding: '4px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {isInternalIssueModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #0F172A', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '900' }}>출 고 증 (DELIVERY NOTE)</h2>
              <button type="button" onClick={() => setIsInternalIssueModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <form onSubmit={handleInternalDeliverySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div>
                  <label style={labelStyle}>공급받는 자 (업체명 또는 수신자) *</label>
                  <input type="text" value={deliveryCompanyName} onChange={e => setDeliveryCompanyName(e.target.value)} placeholder="예: 엔지니어실 (내근용) 또는 거래처명" style={{ ...inputStyle, backgroundColor: '#ffffff', fontWeight: 'bold', color: '#0F172A', border: '1.5px solid #2563EB' }} required />
                </div>
                <div>
                  <label style={labelStyle}>발행 일자</label>
                  <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>발행자 (작성자)</label>
                  <input type="text" value={deliveryAuthor} onChange={e => setDeliveryAuthor(e.target.value)} style={{ ...inputStyle, fontWeight: 'bold', color: '#2563EB' }} required />
                </div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>장비 S/N 목록</label>
                  <button type="button" onClick={() => setEquipmentSns([...equipmentSns, ''])} style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>+ S/N 추가</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {equipmentSns.map((eqSn, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fff', padding: '4px 8px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                      <input type="text" placeholder="장비 S/N 입력" value={eqSn} onChange={e => {
                        const updated = [...equipmentSns]; updated[idx] = e.target.value; setEquipmentSns(updated);
                      }} style={{ border: 'none', outline: 'none', fontSize: '13px', width: '130px' }} />
                      {equipmentSns.length > 1 && (
                        <button type="button" onClick={() => setEquipmentSns(equipmentSns.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1E293B' }}>출고 부품 품목 명세</h3>
                  <button type="button" onClick={() => setDeliveryItems([...deliveryItems, { partId: '', searchKeyword: '', selectedSn: '', quantity: 1, note: '', showDropdown: false }])} style={{ background: '#2563EB', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 부품 추가</button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                      <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}>NO</th>
                      <th style={{ padding: '10px', width: '150px' }}>부품 ID / 코드</th>
                      <th style={{ padding: '10px', width: '160px' }}>부품 S/N (관리품 시)</th>
                      <th style={{ padding: '10px', width: '310px' }}>품명 / 규격 (검색 및 선택)</th>
                      <th style={{ padding: '10px', width: '70px' }}>수량</th>
                      <th style={{ padding: '10px', width: '60px', textAlign: 'center' }}>삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryItems.map((item, idx) => {
                      const selectedPartObj = (partsList || []).find(p => String(p.id) === String(item.partId))
                      const matchedParts = (partsList || []).filter(p => {
                        const cat = (p.category || '').toLowerCase()
                        const isConsumable = cat.includes('잉크') || cat.includes('희석제') || cat.includes('소모품')
                        if (isConsumable) return false
                        const kw = item.searchKeyword.trim().toLowerCase()
                        const pName = (p.name || '').toLowerCase()
                        const pCode = (p.code || '').toLowerCase()
                        return !kw || pName.includes(kw) || pCode.includes(kw)
                      })

                      let activeSerials = []
                      if (selectedPartObj && selectedPartObj.is_serial_managed) {
                        try {
                          const temp = selectedPartObj.serials ? (typeof selectedPartObj.serials === 'string' ? JSON.parse(selectedPartObj.serials) : selectedPartObj.serials) : []
                          activeSerials = Array.isArray(temp) ? temp : []
                        } catch (e) { activeSerials = [] }
                      }

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#64748B' }}>{idx + 1}</td>
                          <td style={{ padding: '10px' }}><input type="text" value={selectedPartObj ? selectedPartObj.code : '-'} readOnly style={{ ...inputStyle, backgroundColor: '#E2E8F0', fontWeight: 'bold' }} /></td>
                          <td style={{ padding: '10px' }}>
                            {selectedPartObj && selectedPartObj.is_serial_managed ? (
                              <select value={item.selectedSn} onChange={e => {
                                const updated = [...deliveryItems]; updated[idx].selectedSn = e.target.value; setDeliveryItems(updated);
                              }} style={inputStyle} required>
                                <option value="">-- 보유 S/N 선택 --</option>
                                {activeSerials.map((s, sIdx) => (
                                  <option key={sIdx} value={s.sn}>S/N: {s.sn} ({s.condition})</option>
                                ))}
                              </select>
                            ) : (
                              <input type="text" value="해당없음" readOnly style={{ ...inputStyle, backgroundColor: '#F1F5F9', color: '#94A3B8', textAlign: 'center' }} />
                            )}
                          </td>
                          <td style={{ padding: '10px', position: 'relative' }}>
                            <input type="text" placeholder="🔍 품명을 입력하여 검색..." value={item.searchKeyword} onChange={e => {
                              const keyword = e.target.value;
                              const updated = [...deliveryItems]; updated[idx].searchKeyword = keyword; updated[idx].showDropdown = true;
                              if (!keyword.trim()) { updated[idx].partId = ''; updated[idx].selectedSn = ''; }
                              setDeliveryItems(updated);
                            }} onFocus={() => {
                              const updated = [...deliveryItems]; updated[idx].showDropdown = true; setDeliveryItems(updated);
                            }} style={{ ...inputStyle, backgroundColor: '#ffffff', border: '2px solid #2563EB', fontWeight: '700', color: '#0F172A', padding: '10px 12px' }} />
                            {item.showDropdown && (
                              <div style={{ position: 'absolute', left: '10px', right: '10px', top: 'calc(100% + 4px)', backgroundColor: '#ffffff', border: '1px solid #CBD5E1', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', maxHeight: '220px', overflowY: 'auto', zIndex: 1500 }}>
                                {matchedParts.length === 0 ? (
                                  <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>검색 결과가 없습니다.</div>
                                ) : (
                                  matchedParts.map(p => {
                                    let pSerials = []
                                    try {
                                      const temp = p.serials ? (typeof p.serials === 'string' ? JSON.parse(p.serials) : p.serials) : []
                                      pSerials = Array.isArray(temp) ? temp : []
                                    } catch (err) {}
                                    const stockCnt = p.is_serial_managed ? pSerials.length : (Number(p.stock) || 0)
                                    return (
                                      <div key={p.id} onMouseDown={() => {
                                        const updated = [...deliveryItems];
                                        updated[idx].partId = p.id; updated[idx].searchKeyword = p.name; updated[idx].selectedSn = ''; updated[idx].showDropdown = false;
                                        setDeliveryItems(updated);
                                      }} style={{ padding: '10px 12px', fontSize: '12px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: '700', color: '#0F172A' }}>{p.name} <span style={{ fontWeight: 'normal', color: '#64748B' }}>({p.code})</span></span>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: p.is_serial_managed ? '#2563EB' : '#059669' }}>잔여: {stockCnt}개 {p.is_serial_managed ? '[S/N]' : ''}</span>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            {selectedPartObj && selectedPartObj.is_serial_managed ? (
                              <input type="number" value="1" readOnly style={{ ...inputStyle, textAlign: 'center', backgroundColor: '#F1F5F9' }} />
                            ) : (
                              <input type="number" min="1" value={item.quantity} onChange={e => {
                                const updated = [...deliveryItems]; updated[idx].quantity = e.target.value; setDeliveryItems(updated);
                              }} style={{ ...inputStyle, textAlign: 'center' }} required />
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            {deliveryItems.length > 1 && (
                              <button type="button" onClick={() => setDeliveryItems(deliveryItems.filter((_, i) => i !== idx))} style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', width: '28px', height: '28px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label style={labelStyle}>특이사항 및 작업 내용 (비고)</label>
                <textarea rows="3" placeholder="예: 장비 수리 및 소모품 교체 완료" value={deliveryNoteText} onChange={e => setDeliveryNoteText(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <button type="button" onClick={() => window.print()} style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🖨️ 출고증 인쇄 / PDF 저장
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setIsInternalIssueModalOpen(false)} style={{ padding: '10px 20px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                  <button type="submit" style={{ padding: '10px 24px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 6px -1px rgba(5,150,105,0.2)' }}>발행 완료 처리 및 저장</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}