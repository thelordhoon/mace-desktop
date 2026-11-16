import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function GeneralPartsTab({ partsList, refreshParts, showAddForm, setShowAddForm }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [companies, setCompanies] = useState([])

  // 1. 신규 일반 부품 등록 폼 상태
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

  // 2. S/N 아코디언 상태
  const [expandedRows, setExpandedRows] = useState({})

  // 3. S/N 상세 관리 모달 상태
  const [selectedSerialPart, setSelectedSerialPart] = useState(null)
  const [editableSerials, setEditableSerials] = useState([])

  // 4. S/N 빠른 입고 모달 상태
  const [quickSerialPart, setQuickSerialPart] = useState(null)
  const [inputSn, setInputSn] = useState('')
  const [inputCondition, setInputCondition] = useState('BG')
  const [inputReceivedDate, setInputReceivedDate] = useState(new Date().toISOString().split('T')[0])

  // 5. 수량 관리품용 수량 입·출고 조절 모달 상태
  const [quantityStockPart, setQuantityStockPart] = useState(null)
  const [qtyChangeAmount, setQtyChangeAmount] = useState(1)
  const [qtyChangeType, setQtyChangeType] = useState('IN')
  const [qtyNote, setQtyNote] = useState('')

  // 6. 이미지 확대 보기 모달 상태
  const [previewImage, setPreviewImage] = useState(null)

  // 7. 품목 정보 수정 모달 상태
  const [editingPart, setEditingPart] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', category: '일반부품', customer_price: 0, dealer_price: 0, note: '', is_serial_managed: false, stock: 0 })
  const [editImageFile, setEditImageFile] = useState(null)

  useEffect(() => {
    fetchCompanies()
  }, [])

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

  const handleQuickAddSerial = async (e) => {
    e.preventDefault()
    if (!quickSerialPart) return
    if (!inputSn.trim()) return alert('시리얼 번호(S/N)를 입력해주세요!')

    let currentSerials = []
    try {
      currentSerials = quickSerialPart.serials ? (typeof quickSerialPart.serials === 'string' ? JSON.parse(quickSerialPart.serials) : quickSerialPart.serials) : []
    } catch (err) { currentSerials = [] }

    if (currentSerials.some(s => s.sn === inputSn.trim())) {
      return alert('이미 등록된 시리얼 번호(S/N)입니다!')
    }

    const newSerialItem = { sn: inputSn.trim(), condition: inputCondition, received_date: inputReceivedDate }
    const updatedSerials = [...currentSerials, newSerialItem]
    const calcStock = updatedSerials.length

    const { error } = await supabase.from('parts').update({
      serials: JSON.stringify(updatedSerials),
      stock: calcStock,
      is_serial_managed: true
    }).eq('id', quickSerialPart.id)

    if (error) return alert('입고 처리 오류: ' + error.message)

    const partCodeStr = quickSerialPart.code ? `[${quickSerialPart.code}] ` : ''
    await supabase.from('delivery_history').insert([{
      date: inputReceivedDate,
      company_name: '본사 창고 (입고)',
      equipment_sn: `S/N: ${inputSn.trim()} (${inputCondition})`,
      summary: `${partCodeStr}${quickSerialPart.name} (1개)`,
      author: '배진철',
      note: `상태: ${inputCondition}`,
      type: 'INBOUND'
    }])

    alert('시리얼 부품이 입고 등록되었습니다.')
    setQuickSerialPart(null); setInputSn('')
    refreshParts()
  }

  const handleQuantityStockChange = async (e) => {
    e.preventDefault()
    if (!quantityStockPart) return
    const amount = Number(qtyChangeAmount) || 0
    if (amount <= 0) return alert('수량을 올바르게 입력해주세요!')

    const currentStock = Number(quantityStockPart.stock) || 0
    let newStock = currentStock

    if (qtyChangeType === 'IN') {
      newStock += amount
    } else {
      if (currentStock < amount) return alert('현재 재고보다 출고 수량이 많습니다!')
      newStock -= amount
    }

    const { error } = await supabase.from('parts').update({ stock: newStock }).eq('id', quantityStockPart.id)
    if (error) return alert('재고 변경 실패: ' + error.message)

    const partCodeStr = quantityStockPart.code ? `[${quantityStockPart.code}] ` : ''
    await supabase.from('delivery_history').insert([{
      date: new Date().toISOString().split('T')[0],
      company_name: qtyChangeType === 'IN' ? '본사 창고 (입고)' : '수량 출고',
      equipment_sn: '-',
      summary: `${partCodeStr}${quantityStockPart.name} (${amount}개)`,
      author: '배진철',
      note: qtyNote || (qtyChangeType === 'IN' ? '수량 입고' : '수량 출고'),
      type: qtyChangeType === 'IN' ? 'INBOUND' : 'OUTBOUND'
    }])

    alert(qtyChangeType === 'IN' ? '수량이 입고되었습니다.' : '수량이 출고되었습니다.')
    setQuantityStockPart(null)
    setQtyChangeAmount(1)
    setQtyNote('')
    refreshParts()
  }

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredParts = (partsList || []).filter(p => {
    if (!p) return false
    const cat = p.category || ''
    const isConsumable = cat === '잉크' || cat === '희석제' || cat === '소모품'
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

      <div style={{ marginBottom: '16px' }}>
        <input type="text" placeholder="🔍 부품 품명 또는 Ident No.(코드) 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '360px' }} />
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
                const isExpanded = !!expandedRows[p.id]

                return (
                  <React.Fragment key={p.id}>
                    <tr style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
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
                          {/* 💡 (부족) 경고 문구 완전 제거 및 깔끔한 수량 표시 */}
                          <span style={{ fontWeight: '800', fontSize: '14px', color: '#0F172A', backgroundColor: '#F1F5F9', padding: '3px 10px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                            {totalStock} 개
                          </span>
                          
                          {p.is_serial_managed && (
                            <button type="button" onClick={() => toggleRowExpand(p.id)} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                              {isExpanded ? '▲ S/N 닫기' : `▼ S/N 보기 (${parsedSerials.length})`}
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
                            setEditForm({ 
                              name: p.name, 
                              code: p.code, 
                              category: p.category || '일반부품', 
                              customer_price: p.customer_price || 0, 
                              dealer_price: p.dealer_price || 0, 
                              note: p.note || '', 
                              is_serial_managed: !!p.is_serial_managed,
                              stock: p.stock || 0
                            })
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

                    {isExpanded && p.is_serial_managed && (
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <td colSpan="9" style={{ padding: '14px 24px', borderBottom: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>📋 개별 S/N 및 상태 리스트</span>
                            <button type="button" onClick={() => { setSelectedSerialPart(p); setEditableSerials(parsedSerials); }} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                              ✏️ 개별 S/N 일괄 편집 모달 열기
                            </button>
                          </div>
                          {parsedSerials.length === 0 ? (
                            <div style={{ fontSize: '12px', color: '#94A3B8', padding: '8px 0' }}>등록된 S/N가 없습니다.</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {parsedSerials.map((s, sIdx) => (
                                <div key={sIdx} style={{ backgroundColor: '#fff', border: '1px solid #CBD5E1', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                  <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800', backgroundColor: s.condition === 'BG' ? '#DEF7EC' : '#FEF3C7', color: s.condition === 'BG' ? '#03543F' : '#92400E' }}>
                                    {s.condition}
                                  </span>
                                  <span style={{ fontWeight: '700', color: '#0F172A' }}>S/N: {s.sn}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {previewImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }} onClick={() => setPreviewImage(null)}>
          <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '16px', maxWidth: '90vw', maxHeight: '90vh', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setPreviewImage(null)} style={{ position: 'absolute', top: '10px', right: '10px', border: 'none', background: '#EF4444', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', fontWeight: '700', cursor: 'pointer' }}>✕</button>
            <img src={previewImage} alt="Preview" style={{ maxWidth: '80vw', maxHeight: '80vh', objectFit: 'contain', display: 'block', borderRadius: '8px' }} />
          </div>
        </div>
      )}

      {quantityStockPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '400px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>📦 수량 입·출고 조절</h3>
                <div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{quantityStockPart.code} - {quantityStockPart.name}</div>
              </div>
              <button type="button" onClick={() => setQuantityStockPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleQuantityStockChange} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>작업 구분*</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button type="button" onClick={() => setQtyChangeType('IN')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #CBD5E1', background: qtyChangeType === 'IN' ? '#059669' : '#fff', color: qtyChangeType === 'IN' ? '#fff' : '#334155', fontWeight: 'bold', cursor: 'pointer' }}>➕ 입고 (재고 추가)</button>
                  <button type="button" onClick={() => setQtyChangeType('OUT')} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #CBD5E1', background: qtyChangeType === 'OUT' ? '#EF4444' : '#fff', color: qtyChangeType === 'OUT' ? '#fff' : '#334155', fontWeight: 'bold', cursor: 'pointer' }}>➖ 출고 (재고 차감)</button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>수량 (개)*</label>
                <input type="number" min="1" value={qtyChangeAmount} onChange={e => setQtyChangeAmount(e.target.value)} style={inputStyle} required autoFocus />
              </div>

              <div>
                <label style={labelStyle}>비고 및 사유</label>
                <input type="text" placeholder="예: 정기 점검 사용, 추가 입고 등..." value={qtyNote} onChange={e => setQtyNote(e.target.value)} style={inputStyle} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setQuantityStockPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 20px', background: qtyChangeType === 'IN' ? '#059669' : '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>확인 및 반영</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedSerialPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '600px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>🏷️ 개별 S/N 및 상태 관리</h3>
                <div style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{selectedSerialPart.code} - {selectedSerialPart.name}</div>
              </div>
              <button type="button" onClick={() => setSelectedSerialPart(null)} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {editableSerials.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>등록된 개별 S/N 정보가 없습니다.</div>
              ) : (
                editableSerials.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <span style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', backgroundColor: s.condition === 'BG' ? '#DEF7EC' : '#FEF3C7', color: s.condition === 'BG' ? '#03543F' : '#92400E' }}>
                        {s.condition}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#0F172A' }}>S/N: {s.sn}</strong>
                    </div>
                    <button type="button" onClick={() => {
                      const updated = editableSerials.filter((_, i) => i !== idx)
                      setEditableSerials(updated)
                    }} style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>삭제</button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => setSelectedSerialPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={async () => {
                const calcStock = editableSerials.length
                const { error } = await supabase.from('parts').update({
                  serials: JSON.stringify(editableSerials),
                  stock: calcStock
                }).eq('id', selectedSerialPart.id)

                if (!error) {
                  alert('S/N 목록이 업데이트되었습니다.')
                  setSelectedSerialPart(null)
                  refreshParts()
                } else {
                  alert('저장 실패: ' + error.message)
                }
              }} style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>변경사항 저장</button>
            </div>
          </div>
        </div>
      )}

      {quickSerialPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>📥 일반 부품 S/N 입고</h3>
                <div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{quickSerialPart.code} - {quickSerialPart.name}</div>
              </div>
              <button type="button" onClick={() => setQuickSerialPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleQuickAddSerial} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>시리얼 번호 (S/N)*</label><input type="text" placeholder="예: LJ-3516" value={inputSn} onChange={e => setInputSn(e.target.value)} style={inputStyle} required autoFocus /></div>
              <div>
                <label style={labelStyle}>상태 구분*</label>
                <select value={inputCondition} onChange={e => setInputCondition(e.target.value)} style={inputStyle}>
                  <option value="BG">BG - 신품 (Brand New)</option>
                  <option value="EX">EX - 수리제품 (Refurbished)</option>
                  <option value="OH">OH - 중고/재매입 (Pre-owned)</option>
                </select>
              </div>
              <div><label style={labelStyle}>입고일</label><input type="date" value={inputReceivedDate} onChange={e => setInputReceivedDate(e.target.value)} style={inputStyle} /></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setQuickSerialPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>입고 완료 및 기록</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>✏️ 일반 부품 정보 수정</h3>
              <button type="button" onClick={() => setEditingPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>Ident No. (코드)*</label><input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} style={inputStyle} required /></div>
              <div><label style={labelStyle}>품명*</label><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} required /></div>
              <div>
                <label style={labelStyle}>구분 / 장비 모델</label>
                <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={inputStyle}>
                  <option value="일반부품">일반부품</option>
                  <option value="Spare parts">Spare parts</option>
                  <option value="Accessories">Tag</option>
                  <option value="Tools">부자재</option>
                </select>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="editSerialCheck" checked={editForm.is_serial_managed} onChange={e => setEditForm({ ...editForm, is_serial_managed: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <label htmlFor="editSerialCheck" style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', cursor: 'pointer' }}>
                  이 부품은 개별 S/N 관리 대상입니다.
                </label>
              </div>

              {!editForm.is_serial_managed && (
                <div>
                  <label style={labelStyle}>보유 재고 수량 (Stock)</label>
                  <input type="number" min="0" value={editForm.stock} onChange={e => setEditForm({ ...editForm, stock: e.target.value })} style={inputStyle} />
                </div>
              )}

              <div>
                <label style={labelStyle}>부품 사진 변경 (선택)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {editingPart.image_url && <img src={editingPart.image_url} alt="Current" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #CBD5E1' }} />}
                  <input type="file" accept="image/*" onChange={e => setEditImageFile(e.target.files[0])} style={{ ...inputStyle, padding: '6px', fontSize: '11px', flex: 1 }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>소비자 기본가 (원)</label><input type="number" value={editForm.customer_price} onChange={e => setEditForm({ ...editForm, customer_price: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>딜러 기본가 (원)</label><input type="number" value={editForm.dealer_price} onChange={e => setEditForm({ ...editForm, dealer_price: e.target.value })} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>📌 비고</label><textarea rows="2" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} style={inputStyle} /></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setEditingPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>수정 사항 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}