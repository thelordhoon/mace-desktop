import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function DeliveryHistory({ partsList }) {
  const [companies, setCompanies] = useState([])
  const [allHistories, setAllHistories] = useState([])
  const [deliveryHistorySearch, setDeliveryHistorySearch] = useState('')
  const [selectedReportImage, setSelectedReportImage] = useState(null)

  // 출고증 작성/조회 모달 상태
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [deliveryTargetHistory, setDeliveryTargetHistory] = useState(null)
  const [selectedCompany, setSelectedCompany] = useState(null)
  
  // 출고증 Form 상태
  const [deliveryIssuer, setDeliveryIssuer] = useState('배진철')
  const [customIssuer, setCustomIssuer] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliverySnList, setDeliverySnList] = useState([''])
  const [deliveryItems, setDeliveryItems] = useState([{ partId: '', partSn: '', name: '', qty: 1 }])
  const [deliveryNote, setDeliveryNote] = useState('')
  const [issuerOptions, setIssuerOptions] = useState(['배진철', '직접 입력'])

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
    const { data } = await supabase.from('companies').select('*')
    setCompanies(data || [])
  }

  const fetchAllServiceHistories = async () => {
    const { data } = await supabase.from('service_history').select('*').order('created_at', { ascending: false })
    setAllHistories(data || [])
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
            let rawStr = typeof p === 'object' ? (p.name || p.code || p.part_id || '') : String(p).replace(/\(\d+개\)/g, '').trim()
            let qtyVal = typeof p === 'object' ? (p.qty || 1) : 1
            const matched = partsList?.find(pt => pt.code?.toLowerCase() === rawStr.toLowerCase() || pt.name?.toLowerCase() === rawStr.toLowerCase())
            return matched ? { partId: matched.code || '', partSn: '', name: matched.name || '', qty: qtyVal } : { partId: '', partSn: '', name: rawStr, qty: qtyVal }
          })
        }
      }
    } catch (e) {}

    setDeliveryItems(parsedParts.length > 0 ? parsedParts : [{ partId: '', partSn: '', name: '', qty: 1 }])
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
    window.location.href = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`
    alert('메일 내용이 클립보드에 복사되었으며, Outlook 메일 창을 호출합니다.')
  }

  const issuedDeliveries = allHistories.filter(h => h.delivery_issued === true).map(h => {
    const comp = companies.find(c => c.id === h.company_id)
    return { ...h, companyName: comp ? comp.name : '알 수 없는 업체' }
  }).filter(h => {
    if (!deliveryHistorySearch.trim()) return true
    const q = deliveryHistorySearch.toLowerCase()
    return h.companyName.toLowerCase().includes(q) || (h.sn && h.sn.toLowerCase().includes(q))
  })

  const inputStyle = { width: '100%', padding: '8px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-delivery-area, .printable-delivery-area * { visibility: visible; }
          .printable-delivery-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0 !important; padding: 10px !important; background: #FFFFFF !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 10mm 15mm; }
        }
      `}</style>

      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #CBD5E1', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
            발행된 출고증 이력 목록 ({issuedDeliveries.length}건)
          </h4>
          <div style={{ position: 'relative', width: '220px' }}>
            <input 
              type="text"
              placeholder="업체명 또는 S/N 검색..."
              value={deliveryHistorySearch}
              onChange={(e) => setDeliveryHistorySearch(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#64748B', color: '#FFFFFF', borderBottom: '1px solid #475569' }}>
                <th style={{ padding: '10px 14px', width: '110px' }}>작업일자</th>
                <th style={{ padding: '10px 14px', width: '150px' }}>공급받는 자 (업체명)</th>
                <th style={{ padding: '10px 14px', width: '120px' }}>장비 S/N</th>
                <th style={{ padding: '10px 14px' }}>출고 부품 요약</th>
                {/* 💡 요청하신 대로 작성자를 서비스 리포트 보기 왼쪽으로 이동 */}
                <th style={{ padding: '10px 14px', width: '132px', textAlign: 'center' }}>작성자</th>
                <th style={{ padding: '10px 14px', width: '140px', textAlign: 'center' }}>서비스 리포트 보기</th>
                <th style={{ padding: '10px 14px', width: '180px', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {issuedDeliveries.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                    발행 완료된 출고증 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                issuedDeliveries.map((h, index) => {
                  let parsedItems = []
                  try {
                    const dData = typeof h.delivery_data === 'string' ? JSON.parse(h.delivery_data) : h.delivery_data
                    if (dData && dData.items) parsedItems = dData.items
                  } catch (e) {}

                  const itemsSummary = parsedItems.map(i => `${i.name || i.partId} (${i.qty}개)`).join(', ') || h.work_content || '-'
                  const issuerName = (() => {
                    try {
                      const d = typeof h.delivery_data === 'string' ? JSON.parse(h.delivery_data) : h.delivery_data
                      return d?.issuer || '-'
                    } catch (e) {
                      return '-'
                    }
                  })()

                  return (
                    <tr key={h.id} style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>{h.work_date}</td>
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#2563EB' }}>{h.companyName}</td>
                      <td style={{ padding: '10px 14px', color: '#0284C7', fontFamily: 'monospace', fontWeight: '600' }}>{h.sn || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '250px' }} title={itemsSummary}>
                        {itemsSummary}
                      </td>
                      {/* 💡 작성자 컬럼 위치 반영 */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                        {issuerName}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {h.report_url ? (
                          <button 
                            onClick={() => setSelectedReportImage(h.report_url)}
                            style={{ padding: '4px 10px', background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontSize: '11px' }}
                          >
                            리포트 보기
                          </button>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: '12px' }}>없음</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button 
                          onClick={() => handleOpenDeliveryModal(h)}
                          style={{ padding: '5px 10px', background: '#10B981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}
                        >
                          출고증 보기
                        </button>
                        <button 
                          onClick={() => handleDeleteHistoryItem(h.id)}
                          style={{ padding: '5px 10px', background: '#FEE2E2', color: '#EF4444', border: 'none', borderRadius: '4px', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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

            <div style={{ border: '1px solid #0F172A', borderRadius: '4px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #CBD5E1' }}>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '45px', textAlign: 'center' }}>NO</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '160px' }}>부품 ID / 코드</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0', width: '130px' }}>부품 S/N</th>
                    <th style={{ padding: '8px', borderRight: '1px solid #E2E8F0' }}>품명 / 규격</th>
                    <th style={{ padding: '8px', width: '75px', textAlign: 'center' }}>수량</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '6px', textAlign: 'center', borderRight: '1px solid #E2E8F0', fontWeight: '700' }}>{idx + 1}</td>
                      <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0' }}>{item.partId || '-'}</td>
                      <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0' }}>{item.partSn || '-'}</td>
                      <td style={{ padding: '6px', borderRight: '1px solid #E2E8F0' }}>{item.name || '-'}</td>
                      <td style={{ padding: '6px', textAlign: 'center' }}>{item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
              <button onClick={() => window.print()} style={{ padding: '10px 18px', background: '#475569', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                바로 인쇄 / PDF
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSendOutlookMail} style={{ padding: '10px 18px', background: '#0284C7', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>
                  Outlook 메일 전송
                </button>
                <button onClick={handleSaveDeliveryNote} style={{ padding: '10px 20px', background: '#10B981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>
                  발행 완료 처리 및 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedReportImage && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
          <button onClick={() => setSelectedReportImage(null)} style={{ position: 'absolute', top: '20px', right: '20px', backgroundColor: '#EF4444', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ width: '100%', maxWidth: '480px', maxHeight: '80vh', overflowY: 'auto', borderRadius: '12px', backgroundColor: 'white', padding: '12px' }}>
            <img src={selectedReportImage} alt="서비스 리포트" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '8px' }} />
          </div>
        </div>
      )}
    </div>
  )
}