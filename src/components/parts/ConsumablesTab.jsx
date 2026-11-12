import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function ConsumablesTab({ partsList, refreshParts, showAddForm, setShowAddForm }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [companies, setCompanies] = useState([])

  // 1. 빠른 입고 로트 모달 상태
  const [quickLotPart, setQuickLotPart] = useState(null)
  const [quickLotNo, setQuickLotNo] = useState('')
  const [quickReceivedDate, setQuickReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [quickExpiry, setQuickExpiry] = useState('')
  const [quickQty, setQuickQty] = useState('')

  // 2. 소모품 전용 출고 모달 상태
  const [outboundPart, setOutboundPart] = useState(null)
  const [outboundCompany, setOutboundCompany] = useState('')
  const [outboundQty, setOutboundQty] = useState('')
  const [outboundDate, setOutboundDate] = useState(new Date().toISOString().split('T')[0])
  const [outboundNote, setOutboundNote] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // 3. 신규 소모품 등록 폼 상태
  const [partName, setPartName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [partCategory, setPartCategory] = useState('잉크')
  const [dealerPrice, setDealerPrice] = useState(0)
  const [customerPrice, setCustomerPrice] = useState(0)
  const [partNote, setPartNote] = useState('')
  const [lots, setLots] = useState([])
  const [companyPrices, setCompanyPrices] = useState([])

  // 4. 유통기한 상세 확인 모달 상태
  const [selectedExpiryPart, setSelectedExpiryPart] = useState(null)

  // 5. 업체별 지정 특가 관리 모달 상태
  const [selectedSpecialPart, setSelectedSpecialPart] = useState(null)
  const [selectedSpecialPrices, setSelectedSpecialPrices] = useState(null)
  const [specialCompanySearchIndex, setSpecialCompanySearchIndex] = useState(null)

  // 6. 품목 정보 수정 모달 상태
  const [editingPart, setEditingPart] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', code: '', category: '잉크', customer_price: 0, dealer_price: 0, note: '' })

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }

  // A. 신규 소모품 품목 등록
  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!partName.trim() || !partCode.trim()) return alert('품명과 품번/코드를 입력해주세요!')

    const calculatedStock = lots.reduce((sum, l) => sum + Number(l.qty || 0), 0)
    const validPrices = companyPrices.filter(cp => cp.company_name.trim() !== '')

    const { error } = await supabase.from('parts').insert([{
      name: partName.trim(),
      code: partCode.trim(),
      category: partCategory,
      dealer_price: Number(dealerPrice),
      customer_price: Number(customerPrice),
      stock: calculatedStock,
      lots: JSON.stringify(lots),
      company_prices: JSON.stringify(validPrices),
      note: partNote,
      is_favorite: false
    }])

    if (!error) {
      alert('신규 소모품이 성공적으로 등록되었습니다.')
      setPartName(''); setPartCode(''); setPartNote(''); setLots([]); setCompanyPrices([]); setShowAddForm(false)
      refreshParts()
    } else {
      alert('등록 실패: ' + error.message)
    }
  }

  // B. 품목 수정 저장
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingPart) return

    const { error } = await supabase.from('parts').update({
      name: editForm.name.trim(),
      code: editForm.code.trim(),
      category: editForm.category,
      customer_price: Number(editForm.customer_price),
      dealer_price: Number(editForm.dealer_price),
      note: editForm.note
    }).eq('id', editingPart.id)

    if (!error) {
      alert('품목 정보가 수정되었습니다.')
      setEditingPart(null)
      refreshParts()
    } else {
      alert('수정 실패: ' + error.message)
    }
  }

  // C. 품목 삭제
  const handleDeletePart = async (id, name) => {
    if (!window.confirm(`[${name}] 품목을 정말 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('parts').delete().eq('id', id)
    if (!error) {
      alert('품목이 삭제되었습니다.')
      refreshParts()
    } else {
      alert('삭제 실패: ' + error.message)
    }
  }

  // D. 입고 처리
  const handleQuickAddLot = async (e) => {
    e.preventDefault()
    if (!quickLotPart) return
    if (!quickQty || Number(quickQty) <= 0) return alert('입고 수량을 정확히 입력해주세요!')

    let currentLots = []
    try {
      currentLots = quickLotPart.lots ? (typeof quickLotPart.lots === 'string' ? JSON.parse(quickLotPart.lots) : quickLotPart.lots) : []
    } catch (err) { currentLots = [] }

    const newLot = {
      lot_number: quickLotNo.trim(),
      received_date: quickReceivedDate || new Date().toISOString().split('T')[0],
      expiry: quickExpiry || '',
      qty: Number(quickQty)
    }

    const updatedLots = [...currentLots, newLot]
    const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

    const { error: partError } = await supabase.from('parts').update({
      lots: JSON.stringify(updatedLots),
      stock: calculatedTotalStock
    }).eq('id', quickLotPart.id)

    if (partError) return alert('입고 처리 오류: ' + partError.message)

    await supabase.from('delivery_history').insert([{
      date: quickReceivedDate || new Date().toISOString().split('T')[0],
      company_name: '본사 창고 (입고)',
      equipment_sn: quickLotNo.trim() ? `LOT: ${quickLotNo.trim()}` : '로트 입고',
      summary: `${quickLotPart.name} (${quickQty}개)`,
      author: '배진철',
      note: quickExpiry ? `유통기한: ${quickExpiry}` : '유통기한 미지정',
      type: 'INBOUND'
    }])

    alert('입고 로트가 추가되고 이력에 등록되었습니다.')
    setQuickLotPart(null); setQuickQty(''); setQuickExpiry(''); setQuickLotNo('');
    refreshParts()
  }

  // E. 출고 처리
  const handleOutboundSubmit = async (e) => {
    e.preventDefault()
    if (!outboundPart) return
    if (!outboundCompany.trim()) return alert('공급받는 업체명을 입력해주세요!')
    const reqSubQty = Number(outboundQty)
    if (!reqSubQty || reqSubQty <= 0) return alert('출고 수량을 올바르게 입력해주세요!')

    let currentLots = []
    try {
      currentLots = outboundPart.lots ? (typeof outboundPart.lots === 'string' ? JSON.parse(outboundPart.lots) : outboundPart.lots) : []
    } catch (err) { currentLots = [] }

    currentLots.sort((a, b) => new Date(a.expiry || '9999-12-31') - new Date(b.expiry || '9999-12-31'))

    let remainingToDeduct = reqSubQty
    const updatedLots = currentLots.map(lot => {
      if (remainingToDeduct <= 0) return lot
      const lotQty = Number(lot.qty || 0)
      if (lotQty <= remainingToDeduct) {
        remainingToDeduct -= lotQty
        return { ...lot, qty: 0 }
      } else {
        const newQty = lotQty - remainingToDeduct
        remainingToDeduct = 0
        return { ...lot, qty: newQty }
      }
    }).filter(lot => Number(lot.qty) > 0)

    const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

    const { error: partError } = await supabase.from('parts').update({
      lots: JSON.stringify(updatedLots),
      stock: calculatedTotalStock
    }).eq('id', outboundPart.id)

    if (partError) return alert('출고 처리 오류: ' + partError.message)

    await supabase.from('delivery_history').insert([{
      date: outboundDate || new Date().toISOString().split('T')[0],
      company_name: outboundCompany.trim(),
      equipment_sn: '-',
      summary: `${outboundPart.name} (${reqSubQty}개)`,
      author: '배진철',
      note: outboundNote.trim(),
      type: 'OUTBOUND'
    }])

    alert('출고가 완료되고 이력에 등록되었습니다.')
    setOutboundPart(null); setOutboundCompany(''); setOutboundQty(''); setOutboundNote('')
    refreshParts()
  }

  const filteredParts = partsList.filter(p => {
    const cat = p.category || ''
    const isConsumable = cat === '잉크' || cat === '희석제' || cat === '소모품'
    return isConsumable && (!searchTerm.trim() || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase()))
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'))

  return (
    <div onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}>
      {showAddForm && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>🧪 신규 소모품 품목 등록</h4>
          <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>품번 / 코드*</label><input placeholder="예: 70000-00155" value={partCode} onChange={e => setPartCode(e.target.value)} style={inputStyle} required /></div>
              <div><label style={labelStyle}>품명*</label><input placeholder="예: 잉크 (K-100)" value={partName} onChange={e => setPartName(e.target.value)} style={inputStyle} required /></div>
              <div>
                <label style={labelStyle}>구분</label>
                <select value={partCategory} onChange={e => setPartCategory(e.target.value)} style={inputStyle}>
                  <option value="잉크">잉크</option>
                  <option value="희석제">희석제</option>
                  <option value="소모품">소모품</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>소비자 기본가 (원)</label><input type="number" value={customerPrice} onChange={e => setCustomerPrice(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>딜러 기본가 (원)</label><input type="number" value={dealerPrice} onChange={e => setDealerPrice(e.target.value)} style={inputStyle} /></div>
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 개별 특가 (선택)</span>
                <button type="button" onClick={() => setCompanyPrices([...companyPrices, { company_name: '', price: 0 }])} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>+ 업체 특가 추가</button>
              </div>
              {companyPrices.map((cp, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <input type="text" placeholder="업체명..." value={cp.company_name} onChange={e => {
                    const updated = [...companyPrices]; updated[idx].company_name = e.target.value; setCompanyPrices(updated);
                  }} style={{ ...inputStyle, flex: 1.5 }} />
                  <input type="number" placeholder="특가(원)" value={cp.price} onChange={e => {
                    const updated = [...companyPrices]; updated[idx].price = e.target.value; setCompanyPrices(updated);
                  }} style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={() => setCompanyPrices(companyPrices.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>

            <div><label style={labelStyle}>📌 비고</label><textarea rows="2" placeholder="특이사항 입력" value={partNote} onChange={e => setPartNote(e.target.value)} style={inputStyle} /></div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ padding: '10px 18px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>취소</button>
              <button type="submit" style={{ padding: '10px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>등록 저장</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input type="text" placeholder="🔍 소모품 품명 또는 코드 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '360px' }} />
      </div>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '80px' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '120px' }}>품번 / 코드</th>
              <th style={{ padding: '14px 16px', width: '180px' }}>품명</th>
              <th style={{ padding: '14px 16px', width: '160px' }}>재고 수량 및 유통기한</th>
              <th style={{ padding: '14px 16px', width: '140px' }}>업체별 특가</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>소비자가</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>딜러가</th>
              <th style={{ padding: '14px 16px', width: '160px', textAlign: 'center' }}>재고 입·출고</th>
              <th style={{ padding: '14px 16px', width: '110px', textAlign: 'center' }}>관리 (수정/삭제)</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.length === 0 ? (
              <tr><td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>등록된 소모품이 없습니다.</td></tr>
            ) : (
              filteredParts.map(p => {
                let parsedCompanyPrices = []
                try {
                  const temp = p.company_prices ? (typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices) : []
                  parsedCompanyPrices = Array.isArray(temp) ? temp.filter(cp => cp && cp.company_name) : []
                } catch (e) {}
                const specialPriceCount = parsedCompanyPrices.length

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '4px 8px', backgroundColor: '#EFF6FF', color: '#2563EB', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                        {p.category || '소모품'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', wordBreak: 'break-all' }}>{p.code || '-'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{p.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', color: '#10B981', fontSize: '14px' }}>{p.stock ?? 0} 개</span>
                        <button type="button" onClick={() => setSelectedExpiryPart(p)} style={{ border: 'none', background: '#F0FDF4', color: '#166534', padding: '3px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                          ⏳ 유통기한 🔍
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <button type="button" onClick={() => { setSelectedSpecialPart(p); setSelectedSpecialPrices(parsedCompanyPrices); }} style={{ fontSize: '11px', fontWeight: '700', color: specialPriceCount > 0 ? '#D97706' : '#64748B', backgroundColor: specialPriceCount > 0 ? '#FEF3C7' : '#F1F5F9', border: specialPriceCount > 0 ? '1px solid #FCD34D' : '1px solid #CBD5E1', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer' }}>
                        🏷️ 지정 특가 {specialPriceCount}개 [보기]
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563EB' }}>{p.customer_price ? Number(p.customer_price).toLocaleString() : 0} 원</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>{p.dealer_price ? Number(p.dealer_price).toLocaleString() : 0} 원</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button type="button" onClick={() => setQuickLotPart(p)} style={{ background: '#059669', color: '#fff', border: 'none', padding: '5px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                          + 입고
                        </button>
                        <button type="button" onClick={() => setOutboundPart(p)} style={{ background: '#D97706', color: '#fff', border: 'none', padding: '5px 9px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                          - 출고
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button 
                          type="button" 
                          onClick={() => {
                            setEditingPart(p)
                            setEditForm({ name: p.name, code: p.code, category: p.category || '잉크', customer_price: p.customer_price || 0, dealer_price: p.dealer_price || 0, note: p.note || '' })
                          }} 
                          style={{ background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          수정
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDeletePart(p.id, p.name)} 
                          style={{ background: '#FEE2E2', color: '#EF4444', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
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

      {/* 지정 특가 관리 모달 */}
      {selectedSpecialPart && selectedSpecialPrices && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', width: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>🏷️ 업체별 개별 특가 관리</h3>
                <div style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700', marginTop: '3px' }}>{selectedSpecialPart.code} - {selectedSpecialPart.name}</div>
              </div>
              <button type="button" onClick={() => { setSelectedSpecialPart(null); setSelectedSpecialPrices(null); }} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>등록된 특가 목록</span>
              <button type="button" onClick={() => setSelectedSpecialPrices([...selectedSpecialPrices, { company_name: '', price: 0 }])} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 특가 업체 추가</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flexGrow: 1, overflowY: 'auto', marginBottom: '20px', paddingRight: '4px', minHeight: '350px', maxHeight: '50vh' }}>
              {selectedSpecialPrices.length === 0 ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: '#94A3B8', fontSize: '14px' }}>등록된 업체별 특가가 없습니다.</div>
              ) : (
                selectedSpecialPrices.map((cp, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', position: 'relative', backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div style={{ flex: 1.5, position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="업체명 검색..." 
                        value={cp.company_name} 
                        onChange={e => {
                          const updated = [...selectedSpecialPrices];
                          updated[idx].company_name = e.target.value;
                          setSelectedSpecialPrices(updated);
                          setSpecialCompanySearchIndex(idx);
                        }}
                        onFocus={() => setSpecialCompanySearchIndex(idx)}
                        style={inputStyle} 
                      />
                      {specialCompanySearchIndex === idx && cp.company_name.trim() && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', maxHeight: '160px', overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                          {(companies || []).filter(c => c.name && c.name.toLowerCase().includes(cp.company_name.toLowerCase())).length === 0 ? (
                            <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94A3B8' }}>일치하는 업체가 없습니다 (직접 입력 가능)</div>
                          ) : (
                            (companies || []).filter(c => c.name && c.name.toLowerCase().includes(cp.company_name.toLowerCase())).map(c => (
                              <div 
                                key={c.id || c.name} 
                                onClick={() => {
                                  const updated = [...selectedSpecialPrices];
                                  updated[idx].company_name = c.name;
                                  setSelectedSpecialPrices(updated);
                                  setSpecialCompanySearchIndex(null);
                                }}
                                style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                                onMouseEnter={e => e.target.style.backgroundColor = '#F8FAFC'}
                                onMouseLeave={e => e.target.style.backgroundColor = '#fff'}
                              >
                                <strong>{c.name}</strong> {c.ceo ? <span style={{ color: '#64748B' }}>({c.ceo})</span> : ''}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                    <input 
                      type="number" 
                      placeholder="특가(원)" 
                      value={cp.price} 
                      onChange={e => {
                        const updated = [...selectedSpecialPrices];
                        updated[idx].price = e.target.value;
                        setSelectedSpecialPrices(updated);
                      }} 
                      style={{ ...inputStyle, flex: 1 }} 
                    />
                    <button type="button" onClick={() => setSelectedSpecialPrices(selectedSpecialPrices.filter((_, i) => i !== idx))} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>✕</button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0, borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
              <button type="button" onClick={() => { setSelectedSpecialPart(null); setSelectedSpecialPrices(null); }} style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
              <button type="button" onClick={async () => {
                const validPrices = selectedSpecialPrices.filter(cp => cp.company_name.trim() !== '')
                const { error } = await supabase.from('parts').update({ company_prices: JSON.stringify(validPrices) }).eq('id', selectedSpecialPart.id)
                if (error) alert('특가 저장 실패: ' + error.message)
                else {
                  alert('지정 특가가 업데이트되었습니다.')
                  setSelectedSpecialPrices(null); setSelectedSpecialPart(null);
                  refreshParts()
                }
              }} style={{ padding: '10px 24px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 품목 정보 수정 모달 */}
      {editingPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '480px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>✏️ 소모품 품목 정보 수정</h3>
              <button type="button" onClick={() => setEditingPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>품번 / 코드*</label><input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} style={inputStyle} required /></div>
              <div><label style={labelStyle}>품명*</label><input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} style={inputStyle} required /></div>
              <div>
                <label style={labelStyle}>구분</label>
                <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={inputStyle}>
                  <option value="잉크">잉크</option>
                  <option value="희석제">희석제</option>
                  <option value="소모품">소모품</option>
                </select>
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

      {/* 입고 모달 */}
      {quickLotPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '420px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>📥 소모품 입고 처리</h3>
                <div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{quickLotPart.code} - {quickLotPart.name}</div>
              </div>
              <button type="button" onClick={() => setQuickLotPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleQuickAddLot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={labelStyle}>Lot 번호 (선택)</label><input type="text" placeholder="예: LOT-202611" value={quickLotNo} onChange={e => setQuickLotNo(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>입고일</label><input type="date" value={quickReceivedDate} onChange={e => setQuickReceivedDate(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>유통기한 (필수)</label><input type="date" value={quickExpiry} onChange={e => setQuickExpiry(e.target.value)} style={inputStyle} required /></div>
              <div><label style={labelStyle}>입고 수량 (개)*</label><input type="number" placeholder="예: 50" value={quickQty} onChange={e => setQuickQty(e.target.value)} style={inputStyle} required autoFocus /></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setQuickLotPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>입고 완료 및 이력 기록</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 출고 모달 */}
      {outboundPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '460px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>📤 소모품 출고 처리</h3>
                <div style={{ fontSize: '12px', color: '#D97706', fontWeight: '700', marginTop: '2px' }}>{outboundPart.code} - {outboundPart.name} (현재 재고: {outboundPart.stock || 0}개)</div>
              </div>
              <button type="button" onClick={() => setOutboundPart(null)} style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <form onSubmit={handleOutboundSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>공급받는 자 (업체명)*</label>
                <input 
                  placeholder="업체명 검색 또는 입력..." 
                  value={outboundCompany} 
                  onChange={e => { setOutboundCompany(e.target.value); setShowCompanyDropdown(true); }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  style={inputStyle} 
                  required 
                />
                {showCompanyDropdown && outboundCompany.trim() && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', maxHeight: '140px', overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    {(companies || []).filter(c => c.name && c.name.toLowerCase().includes(outboundCompany.toLowerCase())).map(c => (
                      <div 
                        key={c.id || c.name} 
                        onClick={() => { setOutboundCompany(c.name); setShowCompanyDropdown(false); }}
                        style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                      >
                        <strong>{c.name}</strong> {c.ceo ? <span style={{ color: '#64748B' }}>({c.ceo})</span> : ''}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={labelStyle}>출고 수량 (개)*</label><input type="number" placeholder="예: 10" value={outboundQty} onChange={e => setOutboundQty(e.target.value)} style={inputStyle} required autoFocus /></div>
                <div><label style={labelStyle}>출고일</label><input type="date" value={outboundDate} onChange={e => setOutboundDate(e.target.value)} style={inputStyle} /></div>
              </div>

              <div><label style={labelStyle}>비고 및 특이사항</label><textarea rows="2" placeholder="메모 입력" value={outboundNote} onChange={e => setOutboundNote(e.target.value)} style={inputStyle} /></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button type="button" onClick={() => setOutboundPart(null)} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 20px', background: '#D97706', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>출고 차감 및 이력 기록</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 유통기한 상세 조회 모달 */}
      {selectedExpiryPart && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '550px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>⏳ 유통기한 및 입고 로트 현황</h3>
                <div style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>{selectedExpiryPart.code} - {selectedExpiryPart.name}</div>
              </div>
              <button type="button" onClick={() => setSelectedExpiryPart(null)} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(!selectedExpiryPart.lots || (typeof selectedExpiryPart.lots === 'string' ? JSON.parse(selectedExpiryPart.lots) : selectedExpiryPart.lots).length === 0) ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>등록된 로트/유통기한 정보가 없습니다.</div>
              ) : (
                (typeof selectedExpiryPart.lots === 'string' ? JSON.parse(selectedExpiryPart.lots) : selectedExpiryPart.lots).map((l, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                        Lot No: {l.lot_number || '(미지정)'} <span style={{ color: '#10B981', marginLeft: '8px' }}>수량: {l.qty}개</span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>
                        입고일: {l.received_date || '-'} | <strong style={{ color: '#D97706' }}>유통기한: {l.expiry || '미입력'}</strong>
                      </div>
                    </div>
                    <button type="button" onClick={async () => {
                      if (!window.confirm(`Lot [${l.lot_number || '공백'}]을 삭제하시겠습니까?`)) return
                      let currentLots = typeof selectedExpiryPart.lots === 'string' ? JSON.parse(selectedExpiryPart.lots) : selectedExpiryPart.lots
                      
                      // 💡 index를 이용해 정확히 클릭한 해당 로트 하나만 제외하고 필터링
                      const updatedLots = currentLots.filter((_, i) => i !== idx)
                      
                      const calcStock = updatedLots.reduce((sum, item) => sum + Number(item.qty || 0), 0)
                      
                      const { error } = await supabase.from('parts').update({ 
                        lots: JSON.stringify(updatedLots), 
                        stock: calcStock 
                      }).eq('id', selectedExpiryPart.id)

                      if (!error) {
                        setSelectedExpiryPart({ ...selectedExpiryPart, lots: updatedLots, stock: calcStock })
                        refreshParts()
                      } else {
                        alert('삭제 실패: ' + error.message)
                      }
                    }} style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>삭제</button>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setSelectedExpiryPart(null)} style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}