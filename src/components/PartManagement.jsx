import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function PartManagement() {
  const [partsList, setPartsList] = useState([])
  const [companies, setCompanies] = useState([])
  const [partSearchTerm, setPartSearchTerm] = useState('')
  const [showAddPartForm, setShowAddPartForm] = useState(false)

  // 신규 등록 폼 상태
  const [partName, setPartName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [partCategory, setPartCategory] = useState('일반부품')
  const [dealerPrice, setDealerPrice] = useState(0)
  const [customerPrice, setCustomerPrice] = useState(0)
  const [stock, setStock] = useState(0)
  const [partNote, setPartNote] = useState('')
  const [companyPrices, setCompanyPrices] = useState([])
  const [uploading, setUploading] = useState(false)

  // 부품 수정 모드 상태
  const [editingPartId, setEditingPartId] = useState(null)
  const [editPartForm, setEditPartForm] = useState({
    name: '',
    code: '',
    category: '일반부품',
    dealer_price: 0,
    customer_price: 0,
    stock: 0,
    note: ''
  })
  const [editCompanyPrices, setEditCompanyPrices] = useState([])

  useEffect(() => {
    fetchParts()
    fetchCompanies()
  }, [])

  const fetchParts = async () => {
    const { data, error } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
    if (!error) setPartsList(data || [])
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  // 신규 등록용 업체별 단가 핸들러
  const handleAddCompanyPriceField = () => {
    setCompanyPrices([...companyPrices, { company_name: '', price: 0 }])
  }
  const handleRemoveCompanyPriceField = (index) => {
    setCompanyPrices(companyPrices.filter((_, i) => i !== index))
  }
  const handleCompanyPriceChange = (index, field, value) => {
    const updated = [...companyPrices]
    updated[index][field] = value
    setCompanyPrices(updated)
  }

  // 수정용 업체별 단가 핸들러
  const handleAddEditCompanyPriceField = () => {
    setEditCompanyPrices([...editCompanyPrices, { company_name: '', price: 0 }])
  }
  const handleRemoveEditCompanyPriceField = (index) => {
    setEditCompanyPrices(editCompanyPrices.filter((_, i) => i !== index))
  }
  const handleEditCompanyPriceChange = (index, field, value) => {
    const updated = [...editCompanyPrices]
    updated[index][field] = value
    setEditCompanyPrices(updated)
  }

  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!partName.trim()) return alert('부품명을 입력해주세요!')
    if (!partCode.trim()) return alert('부품 코드/품번을 입력해주세요!')

    setUploading(true)
    const { error } = await supabase.from('parts').insert([{
      name: partName, 
      code: partCode, 
      category: partCategory,
      dealer_price: Number(dealerPrice), 
      customer_price: Number(customerPrice),
      stock: Number(stock),
      company_prices: JSON.stringify(companyPrices),
      note: partNote
    }])
    setUploading(false)

    if (error) alert('부품 저장 실패: ' + error.message)
    else {
      alert('신규 부품이 등록되었습니다.')
      setPartName(''); setPartCode(''); setPartCategory('일반부품'); 
      setDealerPrice(0); setCustomerPrice(0); setStock(0); setPartNote('');
      setCompanyPrices([]);
      setShowAddPartForm(false); fetchParts()
    }
  }

  // 수정 모드 진입
  const handleStartEditPart = (p) => {
    setEditingPartId(p.id)
    setEditPartForm({
      name: p.name || '',
      code: p.code || '',
      category: p.category || '일반부품',
      dealer_price: p.dealer_price || 0,
      customer_price: p.customer_price || 0,
      stock: p.stock || 0,
      note: p.note || ''
    })

    try {
      if (p.company_prices) {
        const temp = typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices
        setEditCompanyPrices(Array.isArray(temp) ? temp : [])
      } else {
        setEditCompanyPrices([])
      }
    } catch (e) {
      setEditCompanyPrices([])
    }
  }

  // 수정 사항 저장
  const handleSavePartEdit = async (partId) => {
    setUploading(true)
    const { error } = await supabase
      .from('parts')
      .update({
        name: editPartForm.name,
        code: editPartForm.code,
        category: editPartForm.category,
        dealer_price: Number(editPartForm.dealer_price),
        customer_price: Number(editPartForm.customer_price),
        stock: Number(editPartForm.stock),
        company_prices: JSON.stringify(editCompanyPrices),
        note: editPartForm.note
      })
      .eq('id', partId)

    setUploading(false)

    if (error) {
      alert('부품 수정 실패: ' + error.message)
    } else {
      alert('부품 정보가 수정되었습니다.')
      setEditingPartId(null)
      fetchParts()
    }
  }

  const handleDeletePart = async (partId) => {
    if (!window.confirm('이 부품을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('parts').delete().eq('id', partId)
    if (!error) { alert('부품이 삭제되었습니다.'); fetchParts() }
  }

  // 💡 정렬 로직: 1순위 카테고리('소모품' 우선), 2순위 소모품 내 명칭(잉크/INK -> 희석제 -> 기타)
  const getPartSortWeight = (item) => {
    const cat = item.category || ''
    const name = (item.name || '').toUpperCase()

    // 1순위: 카테고리가 '소모품'인 경우
    if (cat === '소모품') {
      if (name.includes('잉크') || name.includes('INK')) return 1 // 소모품 내 잉크
      if (name.includes('희석제')) return 2                  // 소모품 내 희석제
      return 3                                           // 기타 소모품
    }

    // 2순위: 그 외 카테고리 (일반부품, 필터류, 기타 등)
    if (name.includes('잉크') || name.includes('INK')) return 4
    if (name.includes('희석제')) return 5
    return 6
  }

  // 검색 필터링 및 정렬 적용
  const filteredParts = partsList.filter(p => 
    !partSearchTerm.trim() || 
    (p.name && p.name.toLowerCase().includes(partSearchTerm.toLowerCase())) ||
    (p.code && p.code.toLowerCase().includes(partSearchTerm.toLowerCase()))
  ).sort((a, b) => {
    const weightA = getPartSortWeight(a)
    const weightB = getPartSortWeight(b)
    if (weightA !== weightB) {
      return weightA - weightB
    }
    return (a.name || '').localeCompare(b.name || '', 'ko-KR')
  })

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '13px', fontWeight: '600', color: '#64748B', marginBottom: '4px', display: 'block' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '800' }}>🔧 자재 및 부품 재고 관리</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>전체 부품 목록, 기본 단가, 재고를 관리합니다.</p>
        </div>
        <button 
          onClick={() => setShowAddPartForm(!showAddPartForm)} 
          style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}
        >
          {showAddPartForm ? '✕ 닫기' : '+ 신규 부품 등록'}
        </button>
      </div>

      {showAddPartForm && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', maxWidth: '850px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B', fontWeight: '700' }}>🔧 신규 부품 등록</h4>
          <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>부품 코드/품번*</label><input placeholder="예: E55-0000000" value={partCode} onChange={(e) => setPartCode(e.target.value)} style={inputStyle} required /></div>
              <div><label style={labelStyle}>부품명*</label><input placeholder="예: Service KIT" value={partName} onChange={(e) => setPartName(e.target.value)} style={inputStyle} required /></div>
              <div>
                <label style={labelStyle}>카테고리</label>
                <select value={partCategory} onChange={(e) => setPartCategory(e.target.value)} style={inputStyle}>
                  <option value="일반부품">일반부품</option><option value="소모품">소모품</option><option value="필터류">Overhaul</option><option value="기타">기타</option>
                </select>
              </div>
              <div><label style={labelStyle}>초기 재고 수량</label><input type="number" value={stock} onChange={(e) => setStock(e.target.value)} style={inputStyle} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>소비자 기본가 (원)</label><input type="number" value={customerPrice} onChange={(e) => setCustomerPrice(e.target.value)} style={inputStyle} /></div>
              <div><label style={labelStyle}>딜러 기본가 (원)</label><input type="number" value={dealerPrice} onChange={(e) => setDealerPrice(e.target.value)} style={inputStyle} /></div>
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 개별 단가 (선택)</span>
                  <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block' }}>특정 거래처의 공급가를 지정합니다.</span>
                </div>
                <button 
                  type="button" 
                  onClick={handleAddCompanyPriceField}
                  style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  + 업체 추가
                </button>
              </div>

              {companyPrices.map((cp, idx) => {
                const searchKeyword = cp.company_name || ''
                const matchedCompanies = searchKeyword.trim() === '' 
                  ? companies 
                  : companies.filter(c => c.name.toLowerCase().includes(searchKeyword.toLowerCase()))

                return (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', position: 'relative' }}>
                    <div style={{ flex: 1.5, position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="업체 검색..." 
                        value={cp.company_name} 
                        onChange={(e) => handleCompanyPriceChange(idx, 'company_name', e.target.value)}
                        style={{ ...inputStyle, paddingRight: '24px' }}
                      />
                      {cp.company_name && (
                        <span onClick={() => handleCompanyPriceChange(idx, 'company_name', '')} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#94A3B8', fontSize: '12px' }}>✕</span>
                      )}
                      {searchKeyword.trim() !== '' && !companies.some(c => c.name === searchKeyword) && matchedCompanies.length > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '2px' }}>
                          {matchedCompanies.map(c => (
                            <div 
                              key={c.id} 
                              onClick={() => handleCompanyPriceChange(idx, 'company_name', c.name)}
                              style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                            >
                              {c.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <input 
                      type="number" 
                      placeholder="특가 (원)" 
                      value={cp.price} 
                      onChange={(e) => handleCompanyPriceChange(idx, 'price', e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button 
                      type="button" 
                      onClick={() => handleRemoveCompanyPriceField(idx)} 
                      style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
            </div>

            <div>
              <label style={labelStyle}>📌 비고</label>
              <textarea rows="5" placeholder="메모 및 특이사항 입력" value={partNote} onChange={(e) => setPartNote(e.target.value)} style={inputStyle} />
            </div>

            <button type="submit" disabled={uploading} style={{ padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', marginTop: '6px' }}>
              {uploading ? '저장 중...' : '부품 등록 저장'}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <input type="text" placeholder="🔍 부품명 또는 품번으로 검색..." value={partSearchTerm} onChange={(e) => setPartSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '400px' }} />
      </div>

      {editingPartId !== null ? (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', border: '1px solid #2563EB', boxShadow: '0 4px 12px rgba(37,99,235,0.1)', marginBottom: '20px', maxWidth: '850px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '16px', color: '#2563EB', fontWeight: '700' }}>✏️ 부품 정보 수정</h4>
            <button type="button" onClick={() => setEditingPartId(null)} style={{ border: 'none', background: 'none', fontSize: '14px', color: '#64748B', cursor: 'pointer', fontWeight: '600' }}>✕ 취소</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>품번/코드</label><input value={editPartForm.code} onChange={(e) => setEditPartForm({ ...editPartForm, code: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>부품명</label><input value={editPartForm.name} onChange={(e) => setEditPartForm({ ...editPartForm, name: e.target.value })} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>카테고리</label>
                <select value={editPartForm.category} onChange={(e) => setEditPartForm({ ...editPartForm, category: e.target.value })} style={inputStyle}>
                  <option value="일반부품">일반부품</option><option value="소모품">소모품</option><option value="필터류">Overhaul</option><option value="기타">기타</option>
                </select>
              </div>
              <div><label style={labelStyle}>재고 수량</label><input type="number" value={editPartForm.stock} onChange={(e) => setEditPartForm({ ...editPartForm, stock: e.target.value })} style={inputStyle} /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>소비자 기본가</label><input type="number" value={editPartForm.customer_price} onChange={(e) => setEditPartForm({ ...editPartForm, customer_price: e.target.value })} style={inputStyle} /></div>
              <div><label style={labelStyle}>딜러 기본가</label><input type="number" value={editPartForm.dealer_price} onChange={(e) => setEditPartForm({ ...editPartForm, dealer_price: e.target.value })} style={inputStyle} /></div>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 특가 관리</span>
                <button type="button" onClick={handleAddEditCompanyPriceField} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 업체 추가</button>
              </div>

              {editCompanyPrices.map((cp, idx) => {
                const searchKeyword = cp.company_name || ''
                const matchedCompanies = searchKeyword.trim() === '' ? companies : companies.filter(c => c.name.toLowerCase().includes(searchKeyword.toLowerCase()))

                return (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '8px', border: '1px solid #E2E8F0', position: 'relative' }}>
                    <div style={{ flex: 1.5, position: 'relative' }}>
                      <input type="text" placeholder="업체 검색..." value={cp.company_name} onChange={(e) => handleEditCompanyPriceChange(idx, 'company_name', e.target.value)} style={{ ...inputStyle, paddingRight: '24px' }} />
                      {searchKeyword.trim() !== '' && !companies.some(c => c.name === searchKeyword) && matchedCompanies.length > 0 && (
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', backgroundColor: 'white', border: '1px solid #CBD5E1', borderRadius: '8px', maxHeight: '140px', overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {matchedCompanies.map(c => (
                            <div key={c.id} onClick={() => handleEditCompanyPriceChange(idx, 'company_name', c.name)} style={{ padding: '8px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}>{c.name}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="number" placeholder="특가 (원)" value={cp.price} onChange={(e) => handleEditCompanyPriceChange(idx, 'price', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <button type="button" onClick={() => handleRemoveEditCompanyPriceField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                  </div>
                )
              })}
            </div>

            <div><label style={labelStyle}>비고</label><textarea rows="5" value={editPartForm.note} onChange={(e) => setEditPartForm({ ...editPartForm, note: e.target.value })} style={inputStyle} /></div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button type="button" onClick={() => setEditingPartId(null)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>취소</button>
              <button type="button" onClick={() => handleSavePartEdit(editingPartId)} disabled={uploading} style={{ padding: '10px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>{uploading ? '저장 중...' : '수정 사항 저장'}</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '14px 16px' }}>카테고리</th>
                <th style={{ padding: '14px 16px' }}>품번 / 코드</th>
                <th style={{ padding: '14px 16px' }}>부품명</th>
                <th style={{ padding: '14px 16px' }}>재고 수량</th>
                <th style={{ padding: '14px 16px' }}>소비자 기본가</th>
                <th style={{ padding: '14px 16px' }}>딜러 기본가</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    등록된 부품이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredParts.map((p) => {
                  let parsedCompanyPrices = []
                  try {
                    if (p.company_prices) {
                      const temp = typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices
                      parsedCompanyPrices = Array.isArray(temp) ? temp.filter(cp => cp && cp.company_name) : []
                    }
                  } catch (e) {}

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '14px 16px' }}><span style={{ padding: '4px 8px', backgroundColor: '#EFF6FF', color: '#2563EB', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>{p.category || '일반부품'}</span></td>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: '#475569' }}>{p.code || '-'}</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0F172A' }}>
                        {p.name}
                        {parsedCompanyPrices.length > 0 && (
                          <span style={{ display: 'block', fontSize: '11px', color: '#D97706', marginTop: '2px' }}>
                            🏷️ 지정 업체 특별가 {parsedCompanyPrices.length}개 등록됨
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#10B981' }}>{p.stock ?? 0} 개</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#2563EB' }}>{p.customer_price ? Number(p.customer_price).toLocaleString() : 0} 원</td>
                      <td style={{ padding: '14px 16px', fontWeight: '700', color: '#334155' }}>{p.dealer_price ? Number(p.dealer_price).toLocaleString() : 0} 원</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
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
    </div>
  )
}