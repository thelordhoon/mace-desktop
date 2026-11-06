import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function EstimateForm({ user }) {
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedCompany, setSelectedCompany] = useState(null)
  
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  const [managerList, setManagerList] = useState([])
  const [selectedManager, setSelectedManager] = useState(null)

  const [partsList, setPartsList] = useState([])
  
  const [estimateDate, setEstimateDate] = useState(() => new Date().toISOString().substring(0, 10))
  const [writer, setWriter] = useState('')
  
  const [items, setItems] = useState([
    { part_id: '', category: '', code: '', name: '', price: 0, qty: 1, amount: 0, showDropdown: false }
  ])

  useEffect(() => {
    fetchInitialData()
    fetchUserProfile()
  }, [])

  const fetchInitialData = async () => {
    const { data: cData } = await supabase.from('companies').select('*')
    const { data: pData } = await supabase.from('parts').select('*')
    if (cData) setCompanies(cData)
    if (pData) setPartsList(pData)
  }

  const fetchUserProfile = async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .or(`username.eq.${user.username},id.eq.${user.id}`)
      .single()
    
    if (data && data.full_name) {
      setWriter(data.full_name)
    } else {
      setWriter(user.full_name || user.username || '배진철')
    }
  }

  const handleSelectCompany = (comp) => {
    setSelectedCompanyId(comp.id)
    setSelectedCompany(comp)
    setCompanySearchTerm(comp.name)
    setShowCompanyDropdown(false)

    if (comp.manager) {
      try {
        const parsed = typeof comp.manager === 'string' ? JSON.parse(comp.manager) : comp.manager
        if (Array.isArray(parsed)) {
          setManagerList(parsed)
          if (parsed.length > 0) {
            setSelectedManager(parsed[0])
          } else {
            setSelectedManager({ name: '', role: '', phone: comp.phone || '', email: comp.email || '' })
          }
        }
      } catch (err) {
        setManagerList([])
        setSelectedManager({ name: comp.manager || '', role: '', phone: comp.phone || '', email: comp.email || '' })
      }
    } else {
      setManagerList([])
      setSelectedManager(null)
    }
  }

  const handleManagerSelect = (e) => {
    const idx = e.target.value
    if (managerList[idx]) {
      setSelectedManager(managerList[idx])
    }
  }

  const handleNameChange = (index, value) => {
    const newItems = [...items]
    newItems[index] = {
      ...newItems[index],
      name: value,
      showDropdown: true
    }
    setItems(newItems)
  }

  // 부품 선택 처리 (공통 함수)
  const handleSelectPart = (index, part) => {
    const newItems = [...items]
    
    let determinedPrice = Number(part.customer_price || part.dealer_price || 0)

    if (selectedCompany && part.company_prices) {
      try {
        const compPrices = typeof part.company_prices === 'string' ? JSON.parse(part.company_prices) : part.company_prices
        if (Array.isArray(compPrices)) {
          const matched = compPrices.find(cp => cp.company_name === selectedCompany.name)
          if (matched && matched.price) {
            determinedPrice = Number(matched.price)
          }
        }
      } catch (e) {
        console.error("company_prices 파싱 에러:", e)
      }
    }

    const qty = newItems[index].qty || 1

    newItems[index] = {
      part_id: part.id,
      category: part.category || '부품',
      code: part.code || '',
      name: part.name || '',
      price: determinedPrice,
      qty: qty,
      amount: determinedPrice * qty,
      showDropdown: false
    }
    setItems(newItems)
  }

  // 좌측 지정 소모품 클릭 시 견적서에 바로 담기 기능
  const handleAddAssignedPart = (part) => {
    // 빈 행이 있으면 첫 빈 행에 넣고, 없으면 새로 추가
    const emptyIndex = items.findIndex(item => !item.name && !item.code)
    if (emptyIndex !== -1) {
      handleSelectPart(emptyIndex, part)
    } else {
      const newItems = [...items]
      let determinedPrice = Number(part.customer_price || part.dealer_price || 0)
      if (selectedCompany && part.company_prices) {
        try {
          const compPrices = typeof part.company_prices === 'string' ? JSON.parse(part.company_prices) : part.company_prices
          if (Array.isArray(compPrices)) {
            const matched = compPrices.find(cp => cp.company_name === selectedCompany.name)
            if (matched && matched.price) determinedPrice = Number(matched.price)
          }
        } catch (e) {}
      }
      newItems.push({
        part_id: part.id,
        category: part.category || '부품',
        code: part.code || '',
        name: part.name || '',
        price: determinedPrice,
        qty: 1,
        amount: determinedPrice,
        showDropdown: false
      })
      setItems(newItems)
    }
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    const current = { ...newItems[index], [field]: value }
    if (field === 'price' || field === 'qty') {
      current.amount = (Number(current.price) || 0) * (Number(current.qty) || 0)
    }
    newItems[index] = current
    setItems(newItems)
  }

  const addItemRow = () => {
    setItems([...items, { part_id: '', category: '', code: '', name: '', price: 0, qty: 1, amount: 0, showDropdown: false }])
  }

  const removeItemRow = (index) => {
    if (items.length === 1) return
    const newItems = items.filter((_, idx) => idx !== index)
    setItems(newItems)
  }

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const vatAmount = Math.round(totalAmount * 0.1)
  const grandTotal = totalAmount + vatAmount

  const filteredCompanies = companies.filter(c => 
    c.name && c.name.toLowerCase().includes((companySearchTerm || '').toLowerCase())
  )

  // 선택된 거래처에 등록된 지정 소모품 리스트 추출
  const assignedParts = selectedCompany ? partsList.filter(p => {
    if (!p.company_prices) return false
    try {
      const cpList = typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices
      return Array.isArray(cpList) && cpList.some(cp => cp.company_name === selectedCompany.name)
    } catch (e) {
      return false
    }
  }) : []

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1250px', margin: '0 auto', alignItems: 'flex-start' }}>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-estimate, #printable-estimate * {
            visibility: visible;
          }
          #printable-estimate {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
          input, select {
            border: none !important;
            background: transparent !important;
            appearance: none;
          }
        }
      `}</style>

      {/* 💡 1. 좌측 거래처 지정 소모품 참고용 박스 (인쇄 시 숨겨짐) */}
      <div className="no-print" style={{ width: '280px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', boxSizing: 'border-box' }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '15px', borderBottom: '1px solid #93c5fd', paddingBottom: '6px' }}>
          🏷️ 지정 소모품 정보
        </h4>

        {!selectedCompany ? (
          <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
            거래처를 선택하시면 등록된 소모품(잉크/희석제) 목록이 표시됩니다.
          </div>
        ) : assignedParts.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            등록된 지정 소모품이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '550px', overflowY: 'auto' }}>
            {assignedParts.map((part) => {
              let price = part.customer_price || part.dealer_price || 0
              try {
                const cpList = typeof part.company_prices === 'string' ? JSON.parse(part.company_prices) : part.company_prices
                const matched = Array.isArray(cpList) && cpList.find(cp => cp.company_name === selectedCompany.name)
                if (matched && matched.price) price = matched.price
              } catch (e) {}

              return (
                <div 
                  key={part.id}
                  onClick={() => handleAddAssignedPart(part)}
                  title="클릭 시 견적서에 자동 입력됩니다"
                  style={{ 
                    backgroundColor: '#fff', border: '1px solid #dbeafe', borderRadius: '6px', padding: '10px', 
                    cursor: 'pointer', transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb'
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(37,99,235,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#dbeafe'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>{part.code}</div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{part.name}</div>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', marginTop: '4px', textAlign: 'right' }}>
                    {Number(price).toLocaleString()} 원 <span style={{ fontSize: '10px', color: '#059669' }}>(특별가)</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 💡 2. 우측 견적서 본문 (자유 검색 및 입력 가능) */}
      <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div id="printable-estimate">
          {/* 견적서 상단 타이틀 */}
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h1 style={{ fontSize: '28px', letterSpacing: '8px', margin: 0 }}>見 積 書</h1>
          </div>

          {/* 공급받는 자 및 공급자 정보 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '20px' }}>
            
            {/* 공급받는 자 */}
            <div style={{ flex: 1, border: '1px solid #333', padding: '12px', borderRadius: '4px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>공급받는 자</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                
                <div style={{ position: 'relative' }}>
                  <label style={{ fontWeight: 'bold' }}>거래처 선택: </label>
                  <input 
                    type="text"
                    placeholder="거래처명 검색..."
                    value={companySearchTerm}
                    onChange={(e) => {
                      setCompanySearchTerm(e.target.value)
                      setShowCompanyDropdown(true)
                    }}
                    onFocus={() => setShowCompanyDropdown(true)}
                    style={{ padding: '4px', width: '58%', border: '1px solid #ccc' }}
                  />
                  {showCompanyDropdown && companySearchTerm && filteredCompanies.length > 0 && (
                    <ul className="no-print" style={{ 
                      position: 'absolute', left: '85px', right: '0px', zIndex: 20, 
                      maxHeight: '150px', overflowY: 'auto', backgroundColor: '#fff', 
                      border: '1px solid #ccc', listStyle: 'none', padding: 0, margin: 0, textAlign: 'left',
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                    }}>
                      {filteredCompanies.map((c) => (
                        <li 
                          key={c.id}
                          onClick={() => handleSelectCompany(c)}
                          style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '13px' }}
                          onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                          onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                        >
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label style={{ fontWeight: 'bold' }}>담당자 선택: </label>
                  <select onChange={handleManagerSelect} style={{ padding: '4px', width: '60%' }} disabled={!managerList.length}>
                    {managerList.map((m, idx) => (
                      <option key={idx} value={idx}>{m.name} ({m.role || m.position || '담당'})</option>
                    ))}
                  </select>
                </div>
                <div>TEL: <input type="text" value={selectedManager?.phone || selectedCompany?.phone || ''} readOnly style={{ border: 'none', background: 'transparent' }} /></div>
                <div>E-mail: <input type="text" value={selectedManager?.email || selectedCompany?.email || ''} readOnly style={{ border: 'none', background: 'transparent', width: '80%' }} /></div>
                <div>견적일자: <input type="date" value={estimateDate} onChange={(e) => setEstimateDate(e.target.value)} style={{ padding: '2px' }} /></div>
              </div>
            </div>

            {/* 공급자 정보 */}
            <div style={{ flex: 1, border: '1px solid #333', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa', position: 'relative' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>공급자</h3>
              <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                <div><strong>상호:</strong> ㈜메이쓰</div>
                <div><strong>주소:</strong> 경기도 안산시 단원구 산단로 325 리드 스마트스퀘어 F1107 호</div>
                <div><strong>전화:</strong> 031-404-8775 | <strong>팩스:</strong> 031-364-8073</div>
                <div><strong>작성자:</strong> <input type="text" value={writer} onChange={(e) => setWriter(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '13px', width: '120px' }} /></div>
                <div><strong>견적 유효기간:</strong> 발행후 7일</div>
              </div>
              <div style={{ position: 'absolute', right: '15px', bottom: '15px', opacity: 0.85 }}>
                <img src="/seal.png" alt="직인" style={{ width: '60px', height: '60px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            </div>
          </div>

          {/* 합계 금액 표시 */}
          <div style={{ backgroundColor: '#e2e8f0', padding: '10px 15px', fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
            <span>합계 금액 (VAT 포함):</span>
            <span>₩ {grandTotal.toLocaleString()} 원</span>
          </div>

          {/* 품목 내역 테이블 */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#dcfce7', borderTop: '2px solid #333', borderBottom: '1px solid #333' }}>
                <th style={{ border: '1px solid #ccc', padding: '8px', width: '40px' }}>NO</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', width: '130px' }}>Part No.</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>품목 / 규격명</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', width: '100px' }}>단가</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', width: '60px' }}>수량</th>
                <th style={{ border: '1px solid #ccc', padding: '8px', width: '110px' }}>금액</th>
                <th className="no-print" style={{ border: '1px solid #ccc', padding: '8px', width: '50px' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const query = (item.name || '').toLowerCase()

                // 전체 parts 테이블 대상 실시간 스펠링 검색 (영문/한글 자유 검색)
                const filteredParts = partsList.filter(p => {
                  if (!query) return false
                  const pName = (p.name || '').toLowerCase()
                  const pCode = (p.code || '').toLowerCase()
                  return pName.includes(query) || pCode.includes(query)
                })

                return (
                  <tr key={idx} style={{ textAlign: 'center', position: 'relative' }}>
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>{idx + 1}</td>
                    
                    {/* Part No. (자동 입력) */}
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>
                      <input 
                        type="text"
                        value={item.code}
                        readOnly
                        placeholder="자동입력"
                        style={{ width: '92%', padding: '4px', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold' }}
                      />
                    </td>

                    {/* 품목 / 규격명 (자유 스펠링 검색) */}
                    <td style={{ border: '1px solid #ccc', padding: '6px', position: 'relative' }}>
                      <input 
                        type="text" 
                        placeholder="품명 스펠링 검색..."
                        value={item.name} 
                        onChange={(e) => handleNameChange(idx, e.target.value)} 
                        onFocus={() => {
                          const newItems = [...items]
                          newItems[idx].showDropdown = true
                          setItems(newItems)
                        }}
                        style={{ width: '96%', border: '1px solid #ddd', padding: '4px' }} 
                      />
                      {item.showDropdown && query && filteredParts.length > 0 && (
                        <ul className="no-print" style={{ 
                          position: 'absolute', left: '10px', right: '10px', zIndex: 10, 
                          maxHeight: '150px', overflowY: 'auto', backgroundColor: '#fff', 
                          border: '1px solid #ccc', listStyle: 'none', padding: 0, margin: 0, textAlign: 'left',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                        }}>
                          {filteredParts.map((p) => {
                            let displayPrice = p.customer_price || p.dealer_price || 0
                            if (selectedCompany && p.company_prices) {
                              try {
                                const cpList = typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices
                                const found = Array.isArray(cpList) && cpList.find(cp => cp.company_name === selectedCompany.name)
                                if (found && found.price) displayPrice = found.price
                              } catch (e) {}
                            }

                            return (
                              <li 
                                key={p.id}
                                onClick={() => handleSelectPart(idx, p)}
                                style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #eee', fontSize: '12px' }}
                                onMouseEnter={(e) => e.target.style.backgroundColor = '#f1f5f9'}
                                onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                              >
                                <strong>{p.name}</strong> ({p.code}) - {Number(displayPrice).toLocaleString()}원
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </td>

                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>
                      <input 
                        type="number" 
                        value={item.price} 
                        onChange={(e) => handleItemChange(idx, 'price', e.target.value)} 
                        style={{ width: '90%', textAlign: 'right', border: '1px solid #ddd', padding: '4px' }} 
                      />
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>
                      <input 
                        type="number" 
                        value={item.qty} 
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)} 
                        style={{ width: '80%', textAlign: 'center', border: '1px solid #ddd', padding: '4px' }} 
                      />
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>
                      {item.amount.toLocaleString()}
                    </td>
                    <td className="no-print" style={{ border: '1px solid #ccc', padding: '6px' }}>
                      <button 
                        onClick={() => removeItemRow(idx)} 
                        style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
                      >
                        X
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <button className="no-print" onClick={addItemRow} style={{ padding: '6px 12px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '15px' }}>
            + 품목 행 추가
          </button>

          {/* 하단 마진 및 회사 정보 영역 */}
          <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <img src="/logo.png" alt="MACE 로고" style={{ height: '35px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', fontWeight: '500' }}>
              (주)메이쓰 | MACE CO., LTD.
            </div>
          </div>
        </div>

        {/* 하단 인쇄 버튼 */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button onClick={() => window.print()} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            🖨️ 인쇄 / PDF 저장
          </button>
        </div>
      </div>

    </div>
  )
}