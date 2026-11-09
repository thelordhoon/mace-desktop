import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const SEAL_IMAGE_URL = '/seal.png'

export default function EstimateForm({ user }) {
  const [companies, setCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [selectedCompany, setSelectedCompany] = useState(null)
  
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  const [managerList, setManagerList] = useState([])
  const [selectedManager, setSelectedManager] = useState(null)

  const [partsList, setPartsList] = useState([])
  const [frequentParts, setFrequentParts] = useState([]) // 💡 즐겨찾기(TOP) 부품 상태 추가
  
  const [estimateDate, setEstimateDate] = useState(() => new Date().toISOString().substring(0, 10))
  const [writer, setWriter] = useState('')
  const [note, setNote] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)

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
    if (pData) {
      setPartsList(pData)
      // 💡 부품 전체 목록 중 사용자가 '즐겨찾기(is_favorite)' 체크한 품목만 필터링
      const favorites = pData.filter(p => p.is_favorite === true)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'))
      setFrequentParts(favorites)
    }
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
      } catch (e) {}
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

  const handleAddQuickPart = (part) => {
    const emptyIndex = items.findIndex(item => !item.name && !item.code)
    
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

    if (emptyIndex !== -1) {
      const newItems = [...items]
      newItems[emptyIndex] = {
        part_id: part.id,
        category: part.category || '부품',
        code: part.code || '',
        name: part.name || '',
        price: determinedPrice,
        qty: 1,
        amount: determinedPrice,
        showDropdown: false
      }
      setItems(newItems)
    } else {
      const newItems = [...items]
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

  const handleAddCustomService = (customName, customPrice) => {
    const emptyIndex = items.findIndex(item => !item.name && !item.code)
    const newItemObj = {
      part_id: '',
      category: '서비스',
      code: 'SVC',
      name: customName,
      price: customPrice,
      qty: 1,
      amount: customPrice,
      showDropdown: false
    }

    if (emptyIndex !== -1) {
      const newItems = [...items]
      newItems[emptyIndex] = newItemObj
      setItems(newItems)
    } else {
      setItems([...items, newItemObj])
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

  const supplyAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const vatAmount = Math.round(supplyAmount * 0.1)
  const grandTotal = supplyAmount + vatAmount

  const filteredCompanies = companies.filter(c => 
    c.name && c.name.toLowerCase().includes((companySearchTerm || '').toLowerCase())
  )

  const assignedParts = selectedCompany ? partsList.filter(p => {
    if (!p.company_prices) return false
    try {
      const cpList = typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices
      return Array.isArray(cpList) && cpList.some(cp => cp.company_name === selectedCompany.name)
    } catch (e) {
      return false
    }
  }) : []

  const handlePrintWithAutoSave = async () => {
    if (isSubmitting) return

    if (!selectedCompany) {
      alert('거래처가 선택되지 않았습니다. 인쇄를 진행합니다.')
      window.print()
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        work_date: estimateDate,
        writer: writer,
        company_name: selectedCompany.name,
        company_id: selectedCompany.id,
        manager_name: selectedManager?.name || '',
        manager_phone: selectedManager?.phone || selectedCompany?.phone || '',
        serial_no: null,
        as_content: '',
        parts_data: items.filter(i => i.name.trim() !== ''),
        total_amount: grandTotal,
        estimate_sent_date: estimateDate,
        note: note,
        status: '견적 완료'
      }

      const { error } = await supabase.from('service_management').insert([payload])
      
      if (error) {
        alert(`대장 등록 실패!\n메시지: ${error.message}\n상세: ${error.details || '없음'}`)
        setIsSubmitting(false)
        return
      }

      window.print()
    } catch (err) {
      console.error(err)
      alert('예외 발생: ' + err.message)
    } finally {
      setTimeout(() => {
        setIsSubmitting(false)
      }, 2000)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '20px', maxWidth: '1280px', margin: '0 auto', alignItems: 'flex-start' }}>
      
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-estimate, #printable-estimate * {
            visibility: visible !important;
          }
          #printable-estimate {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 10px !important;
            box-shadow: none !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          input, select, textarea {
            border: none !important;
            background: transparent !important;
            appearance: none;
            resize: none !important;
            color: #000 !important;
          }
        }
      `}</style>

      {/* 좌측 패널 */}
      <div className="no-print" style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', boxSizing: 'border-box' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#1e40af', fontSize: '15px', borderBottom: '1px solid #93c5fd', paddingBottom: '6px' }}>
            🏷️ 지정 소모품 정보
          </h4>

          {!selectedCompany ? (
            <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
              거래처 선택 시 등록된 잉크/희석제가 표시됩니다.
            </div>
          ) : assignedParts.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
              등록된 지정 소모품이 없습니다.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {assignedParts.map((part) => {
                return (
                  <div 
                    key={part.id}
                    onClick={() => handleAddQuickPart(part)}
                    title="클릭 시 견적서 항목으로 자동 입력됩니다"
                    style={{ 
                      backgroundColor: '#fff', border: '1px solid #dbeafe', borderRadius: '6px', padding: '8px 10px', 
                      cursor: 'pointer', transition: 'all 0.15s ease-in-out'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#2563eb'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#dbeafe'}
                  >
                    <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>{part.code}</div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>{part.name}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxSizing: 'border-box' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#334155', fontSize: '15px', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>
            ⚡ 자주 사용하는 품목 (TOP)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            
            <button
              onClick={() => handleAddCustomService('공임비', 150000)}
              style={{
                backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px',
                textAlign: 'left', cursor: 'pointer', fontSize: '12px', color: '#0f172a', fontWeight: '600',
                display: 'flex', justifyContent: 'flex-start', alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <span style={{ width: '100%' }}>공임비</span>
            </button>

            <button
              onClick={() => handleAddCustomService('출장비', 100000)}
              style={{
                backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px',
                textAlign: 'left', cursor: 'pointer', fontSize: '12px', color: '#0f172a', fontWeight: '600',
                display: 'flex', justifyContent: 'flex-start', alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
            >
              <span style={{ width: '100%' }}>출장비</span>
            </button>

            {/* 💡 사용자가 직접 즐겨찾기(is_favorite) 체크한 품목들만 순서대로 표시 */}
            {frequentParts.map((part) => {
              return (
                <button
                  key={part.id}
                  onClick={() => handleAddQuickPart(part)}
                  title="클릭 시 견적서 항목으로 자동 입력됩니다"
                  style={{
                    backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 10px',
                    textAlign: 'left', cursor: 'pointer', fontSize: '12px', color: '#0f172a', fontWeight: '600',
                    display: 'flex', justifyContent: 'flex-start', alignItems: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {part.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* 우측 견적서 본문 */}
      <div style={{ flex: 1, backgroundColor: '#fff', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div id="printable-estimate">
          
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h1 style={{ fontSize: '28px', letterSpacing: '8px', margin: 0 }}>見 積 書</h1>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '20px' }}>
            
            <div style={{ flex: 1, border: '1px solid #333', padding: '12px', borderRadius: '4px' }}>
              <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>공급받는 자</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                  <strong>상호:</strong> ㈜메이쓰
                  <img 
                    src={SEAL_IMAGE_URL} 
                    alt="법인직인" 
                    style={{ 
                      position: 'absolute', 
                      left: '220px', 
                      top: '-5px', 
                      width: '55px', 
                      height: '55px', 
                      objectFit: 'contain',
                      display: 'block',
                      visibility: 'visible',
                      mixBlendMode: 'multiply',
                      zIndex: 5
                    }} 
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
                <div><strong>주소:</strong> 경기도 안산시 단원구 산단로 325<br />리드 스마트스퀘어 F-1106-F1111 호</div>
                <div><strong>전화:</strong> 031-404-8775 | <strong>팩스:</strong> 031-364-8073</div>
                <div><strong>작성자:</strong> <input type="text" value={writer} onChange={(e) => setWriter(e.target.value)} style={{ border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '13px', width: '120px' }} /></div>
                <div><strong>견적 유효기간:</strong> 발행후 7일</div>
              </div>
            </div>
          </div>

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
                const filteredParts = partsList.filter(p => {
                  if (!query) return false
                  const pName = (p.name || '').toLowerCase()
                  const pCode = (p.code || '').toLowerCase()
                  return pName.includes(query) || pCode.includes(query)
                })

                return (
                  <tr key={idx} style={{ textAlign: 'center', position: 'relative' }}>
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>{idx + 1}</td>
                    
                    <td style={{ border: '1px solid #ccc', padding: '6px' }}>
                      <input 
                        type="text"
                        value={item.code}
                        readOnly
                        placeholder="자동입력"
                        style={{ width: '92%', padding: '4px', border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold' }}
                      />
                    </td>

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

          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px' }}>
            <div>공급가액: <span style={{ color: '#0f172a', fontWeight: '800' }}>₩ {supplyAmount.toLocaleString()} 원</span></div>
            <div>+ 부가세(VAT): <span style={{ color: '#0f172a', fontWeight: '800' }}>₩ {vatAmount.toLocaleString()} 원</span></div>
            <div style={{ fontSize: '15px' }}>총 합계금액: <span style={{ color: '#2563eb', fontWeight: '900' }}>₩ {grandTotal.toLocaleString()} 원</span></div>
          </div>

          <div style={{ border: '1px solid #ccc', borderRadius: '4px', padding: '10px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '13px', display: 'block', marginBottom: '4px', color: '#334155' }}>비고 (REMARKS)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = `${e.target.scrollHeight}px`
              }}
              placeholder=""
              style={{
                width: '100%', border: 'none', outline: 'none', fontSize: '13px', lineHeight: '1.5',
                resize: 'none', boxSizing: 'border-box', background: 'transparent', overflowY: 'hidden'
              }}
            />
          </div>

          <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '20px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
            <img src="/logo.png" alt="MACE 로고" style={{ height: '35px', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px', fontWeight: '500' }}>
              (주)메이쓰 | MACE CO., LTD.
            </div>
          </div>
        </div>

        {/* 저장 및 인쇄 버튼 */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button 
            onClick={handlePrintWithAutoSave} 
            disabled={isSubmitting}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: isSubmitting ? '#94a3b8' : '#2563eb', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: isSubmitting ? 'not-allowed' : 'pointer', 
              fontWeight: 'bold' 
            }}
          >
            {isSubmitting ? '저장 및 인쇄 중...' : '🖨️ 인쇄 / PDF 저장 (대장 자동 등록)'}
          </button>
        </div>
      </div>

    </div>
  )
}
