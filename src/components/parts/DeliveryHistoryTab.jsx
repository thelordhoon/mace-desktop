import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function DeliveryHistoryTab({ refreshParts }) {
  const [historyList, setHistoryList] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL') // ALL, OUTBOUND, INBOUND
  const [loading, setLoading] = useState(true)

  // 💡 출고증 상세 보기 모달 상태
  const [viewingDeliveryItem, setViewingDeliveryItem] = useState(null)

  useEffect(() => {
    fetchHistory()
  }, [])

  // 💡 입·출고증 발행 이력 목록 불러오기
  const fetchHistory = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('delivery_history')
      .select('*')
      .order('date', { ascending: false })
      .order('id', { ascending: false })

    if (!error && data) {
      setHistoryList(data)
    }
    setLoading(false)
  }

  // 💡 이력 삭제 시 로트별 / S/N별 정밀 복원 함수
  const handleDeleteHistory = async (item) => {
    if (!window.confirm(`[${item.summary}]\n이 내역을 삭제하시겠습니까?\n(삭제 시 차감되었던 수량이나 S/N가 원래 상태로 정확하게 복원됩니다.)`)) return

    const qtyMatch = item.summary?.match(/\((\d+)개\)/)
    const totalQty = qtyMatch ? Number(qtyMatch[1]) : 0
    const codeMatch = item.summary?.match(/\[(.*?)\]/)
    
    let partCode = null
    if (codeMatch && codeMatch[1]) {
      const rawCode = codeMatch[1]
      partCode = rawCode.split(' ')[0].trim()
    }

    if (partCode && totalQty > 0) {
      const { data: partsMatched, error: fetchError } = await supabase
        .from('parts')
        .select('*')
        .eq('code', partCode)

      if (!fetchError && partsMatched && partsMatched.length > 0) {
        const partData = partsMatched[0]
        const cat = partData.category || ''
        const isConsumable = cat === '잉크' || cat === '희석제' || cat === '소모품'

        if (isConsumable) {
          let currentLots = []
          try {
            currentLots = partData.lots ? (typeof partData.lots === 'string' ? JSON.parse(partData.lots) : partData.lots) : []
          } catch (e) { currentLots = [] }

          if (item.type === 'OUTBOUND') {
            let restored = false
            const restoreTagMatch = item.note?.match(/\[LOT_RESTORE:(.*?)\]/)
            if (restoreTagMatch) {
              try {
                const restoredDetails = JSON.parse(restoreTagMatch[1])
                if (Array.isArray(restoredDetails) && restoredDetails.length > 0) {
                  restoredDetails.forEach(rd => {
                    const rdQty = Number(rd.qty || 0)
                    if (rdQty <= 0) return

                    const existingLot = currentLots.find(l => 
                      String(l.lot_number || '').trim() === String(rd.lot_number || '').trim() && 
                      String(l.expiry || '').trim() === String(rd.expiry || '').trim()
                    )

                    if (existingLot) {
                      existingLot.qty = Number(existingLot.qty || 0) + rdQty
                    } else {
                      currentLots.push({
                        lot_number: rd.lot_number || '',
                        received_date: rd.received_date || new Date().toISOString().split('T')[0],
                        expiry: rd.expiry || '',
                        qty: rdQty
                      })
                    }
                  })
                  restored = true
                }
              } catch (e) {
                console.error('LOT 복원 파싱 에러:', e)
              }
            }

            if (!restored) {
              if (currentLots.length > 0) {
                currentLots[0].qty = Number(currentLots[0].qty || 0) + totalQty
              } else {
                currentLots.push({
                  lot_number: '',
                  received_date: new Date().toISOString().split('T')[0],
                  expiry: '',
                  qty: totalQty
                })
              }
            }
          } else if (item.type === 'INBOUND') {
            let rem = totalQty
            currentLots = currentLots.map(lot => {
              if (rem <= 0) return lot
              const lQty = Number(lot.qty || 0)
              if (lQty <= rem) {
                rem -= lQty
                return { ...lot, qty: 0 }
              } else {
                const newQ = lQty - rem
                rem = 0
                return { ...lot, qty: newQ }
              }
            }).filter(l => Number(l.qty) > 0)
          }

          const newStock = currentLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)
          await supabase.from('parts').update({
            lots: JSON.stringify(currentLots),
            stock: newStock
          }).eq('id', partData.id)

        } else {
          let currentSerials = []
          try {
            currentSerials = partData.serials ? (typeof partData.serials === 'string' ? JSON.parse(partData.serials) : partData.serials) : []
          } catch (e) { currentSerials = [] }

          const snMatch = item.equipment_sn?.match(/S\/N:\s*([^\s(]+)/)
          const snValue = snMatch ? snMatch[1].trim() : null
          const condMatch = item.equipment_sn?.match(/\((BG|EX|OH)\)/)
          const condValue = condMatch ? condMatch[1] : 'BG'

          if (item.type === 'INBOUND' && snValue) {
            currentSerials = currentSerials.filter(s => s.sn !== snValue)
          } else if (item.type === 'OUTBOUND' && snValue) {
            if (!currentSerials.some(s => s.sn === snValue)) {
              currentSerials.push({ sn: snValue, condition: condValue, received_date: item.date })
            }
          }

          await supabase.from('parts').update({
            serials: JSON.stringify(currentSerials),
            stock: currentSerials.length
          }).eq('id', partData.id)
        }
      }
    }

    const { error: delError } = await supabase.from('delivery_history').delete().eq('id', item.id)
    if (!delError) {
      alert('이력이 삭제되고 재고가 정확하게 원복되었습니다.')
      fetchHistory()
      if (typeof refreshParts === 'function') refreshParts()
    } else {
      alert('이력 삭제 실패: ' + delError.message)
    }
  }

  // 💡 저장된 note 속에서 상세 JSON 데이터를 파싱하는 함수
  const parseDeliveryDetails = (noteText) => {
    if (!noteText) return null
    const match = noteText.match(/\[DELIVERY_DETAILS:(.*?)\]/)
    if (match) {
      try {
        return JSON.parse(match[1])
      } catch (e) {
        return null
      }
    }
    return null
  }

  // 검색 및 탭 필터링 적용
  const filteredHistory = historyList.filter(item => {
    if (filterType !== 'ALL' && item.type !== filterType) return false
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      item.company_name?.toLowerCase().includes(q) ||
      item.summary?.toLowerCase().includes(q) ||
      item.equipment_sn?.toLowerCase().includes(q) ||
      item.note?.toLowerCase().includes(q) ||
      item.author?.toLowerCase().includes(q)
    )
  })

  return (
    <div onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}>
      {/* 인쇄 전용 깔끔한 서류 스타일 CSS (그라데이션 및 회색 음영 제거, 순백색 서류 형태로 출력) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-delivery-note, #printable-delivery-note * {
            visibility: visible;
          }
          #printable-delivery-note {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          /* 인쇄 시 회색 배경 박스들을 깔끔한 테두리 서류 박스로 강제 변환 */
          div[style*="background-color"] {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* 상단 필터 및 검색 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'ALL', label: '전체 보기' },
            { id: 'OUTBOUND', label: '출고 이력' },
            { id: 'INBOUND', label: '입고 이력' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: filterType === tab.id ? '1px solid #2563EB' : '1px solid #CBD5E1',
                backgroundColor: filterType === tab.id ? '#2563EB' : '#ffffff',
                color: filterType === tab.id ? '#ffffff' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: filterType === tab.id ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="업체명, 품목 요약, 작성자, S/N 검색..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 14px',
            fontSize: '13px',
            borderRadius: '8px',
            border: '1px solid #CBD5E1',
            backgroundColor: '#ffffff',
            width: '320px',
            outline: 'none'
          }}
        />
      </div>

      {/* 테이블 레이아웃 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '130px' }}>발행일</th>
              <th style={{ padding: '14px 16px', width: '220px' }}>거래처 / 입고처</th>
              <th style={{ padding: '14px 16px' }}>품목 명세 요약</th>
              <th style={{ padding: '14px 16px', width: '110px', textAlign: 'center' }}>작성자</th>
              <th style={{ padding: '14px 16px', width: '160px', textAlign: 'center' }}>관리 / 보기</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>이력을 불러오는 중입니다...</td></tr>
            ) : filteredHistory.length === 0 ? (
              <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>조회된 입·출고 이력이 없습니다.</td></tr>
            ) : (
              filteredHistory.map(item => {
                const hasDetails = parseDeliveryDetails(item.note)
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '60px',
                        padding: '4px 0',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        backgroundColor: item.type === 'OUTBOUND' ? '#FEF3C7' : '#DEF7EC',
                        color: item.type === 'OUTBOUND' ? '#D97706' : '#03543F'
                      }}>
                        {item.type === 'OUTBOUND' ? '출고' : '입고'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontWeight: '600' }}>{item.date}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{item.company_name}</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1E293B', wordBreak: 'break-all' }}>{item.summary}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontWeight: '600' }}>{item.author || '-'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        {item.type === 'OUTBOUND' && hasDetails && (
                          <button
                            type="button"
                            onClick={() => setViewingDeliveryItem(item)}
                            style={{
                              background: '#EFF6FF',
                              color: '#2563EB',
                              border: 'none',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            출고증 보기
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteHistory(item)}
                          style={{
                            background: '#FEE2E2',
                            color: '#EF4444',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer'
                          }}
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

      {/* 💡 [출고증 상세 보기 및 인쇄 모달] */}
      {viewingDeliveryItem && (() => {
        const details = parseDeliveryDetails(viewingDeliveryItem.note)
        return (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
            <div 
              id="printable-delivery-note"
              style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '28px', width: '900px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
            >
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #0F172A', paddingBottom: '12px' }}>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '900' }}>출 고 증 (DELIVERY NOTE)</h2>
                <button type="button" onClick={() => setViewingDeliveryItem(null)} className="no-print" style={{ border: 'none', background: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 상단 메타 정보 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '12px', backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', display: 'block', marginBottom: '4px' }}>공급받는 자</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingDeliveryItem.company_name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', display: 'block', marginBottom: '4px' }}>발행 일자</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingDeliveryItem.date}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748B', display: 'block', marginBottom: '4px' }}>발행자 (작성자)</span>
                    <strong style={{ fontSize: '13px', color: '#0F172A' }}>{viewingDeliveryItem.author || '-'}</strong>
                  </div>
                </div>

                {/* 장비 S/N 목록 */}
                {details?.equipmentSns && details.equipmentSns.length > 0 && (
                  <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#1E293B', display: 'block', marginBottom: '8px' }}>장비 S/N 목록</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {details.equipmentSns.map((eqSn, idx) => (
                        <span key={idx} style={{ backgroundColor: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                          {eqSn}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 출고 부품 품목 명세 테이블 */}
                <div>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#1E293B' }}>출고 부품 품목 명세</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', border: '1px solid #CBD5E1' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                        <th style={{ padding: '10px', width: '50px', textAlign: 'center', borderBottom: '1px solid #CBD5E1' }}>NO</th>
                        <th style={{ padding: '10px', width: '160px', borderBottom: '1px solid #CBD5E1' }}>부품 ID / 코드</th>
                        <th style={{ padding: '10px', width: '180px', borderBottom: '1px solid #CBD5E1' }}>부품 S/N</th>
                        <th style={{ padding: '10px', borderBottom: '1px solid #CBD5E1' }}>품명 / 규격</th>
                        <th style={{ padding: '10px', width: '90px', textAlign: 'center', borderBottom: '1px solid #CBD5E1' }}>수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details?.items?.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#64748B' }}>{idx + 1}</td>
                          <td style={{ padding: '10px', fontWeight: '600', color: '#475569' }}>{it.code || '-'}</td>
                          <td style={{ padding: '10px', fontWeight: '700', color: '#2563EB' }}>{it.selectedSn ? `S/N: ${it.selectedSn}` : '해당없음'}</td>
                          <td style={{ padding: '10px', fontWeight: '800', color: '#0F172A' }}>{it.name}</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: '800' }}>{it.quantity} 개</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 특이사항 */}
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px' }}>특이사항 및 작업 내용</span>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', color: '#334155', minHeight: '50px' }}>
                    {viewingDeliveryItem.note?.replace(/\[DELIVERY_DETAILS:.*?\]/g, '').trim() || '특이사항 없음'}
                  </div>
                </div>

                {/* 하단 버튼 (인쇄 시 숨김 처리됨) */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                  <button 
                    type="button" 
                    onClick={() => window.print()} 
                    style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🖨️ 출고증 인쇄 / PDF 저장
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setViewingDeliveryItem(null)} 
                    style={{ padding: '10px 20px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    닫기
                  </button>
                </div>

              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
