import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function InventoryLedgerTab({ partsList, refreshParts }) {
  const [ledgerData, setLedgerData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL') // 💡 구분별 필터 상태 추가
  
  // 상세 이력 모달 (드릴다운용)
  const [selectedItemHistory, setSelectedItemHistory] = useState(null)
  const [historyList, setHistoryList] = useState([])

  // 데이터 집계 및 계산 (잉크·희석제 소모품 포함)
  const fetchLedgerSummary = async () => {
    setLoading(true)
    try {
      // 1. delivery_history(입출고 내역) 가져오기
      const { data: historyData, error: histErr } = await supabase
        .from('delivery_history')
        .select('*')
        .order('date', { ascending: false })

      if (histErr) throw histErr

      // 2. part_stock_lots(로트별 입고 단가) 가져오기
      const { data: lotsData, error: lotsErr } = await supabase
        .from('part_stock_lots')
        .select('*')

      if (lotsErr) throw lotsErr

      // 3. 전체 품목 매핑 및 수불부 집계 산출
      const computed = (partsList || []).map(part => {
        const partLots = (lotsData || []).filter(l => String(l.part_id) === String(part.id))
        const currentStock = part.is_serial_managed 
          ? (tryParseSerials(part.serials).length) 
          : (Number(part.stock) || 0)

        // 재고 금액 계산 (현재고 기준 로트별 단가 또는 대표 단가 적용)
        let totalAssetValue = 0
        if (part.is_serial_managed) {
          const serialsArr = tryParseSerials(part.serials)
          serialsArr.forEach(s => {
            totalAssetValue += Number(s.unit_price || part.unit_price || 0)
          })
        } else {
          let remainingStockToCalc = currentStock
          const validLots = partLots.filter(l => (Number(l.current_qty) || 0) > 0)
          if (validLots.length > 0) {
            validLots.forEach(l => {
              const qty = Math.min(remainingStockToCalc, Number(l.current_qty) || 0)
              totalAssetValue += qty * (Number(l.unit_price) || Number(part.unit_price) || 0)
              remainingStockToCalc -= qty
            })
          }
          if (remainingStockToCalc > 0) {
            totalAssetValue += remainingStockToCalc * (Number(part.unit_price) || 0)
          }
        }

        // 해당 부품/소모품과 관련된 히스토리 필터링
        const partHistories = (historyData || []).filter(h => {
          if (h.part_id && String(h.part_id) === String(part.id)) return true
          if (h.summary && h.summary.includes(part.name)) return true
          return false
        })

        let inboundQty = 0
        let outboundQty = 0

        partHistories.forEach(h => {
          if (h.type === 'INBOUND' || h.company_name?.includes('입고')) {
            const match = h.summary?.match(/\((\d+)개\)/)
            const qty = match ? parseInt(match[1]) : 1
            inboundQty += qty
          } else if (h.type === 'OUTBOUND' || h.company_name?.includes('출고')) {
            const match = h.summary?.match(/\((\d+)개\)/)
            const qty = match ? parseInt(match[1]) : 1
            outboundQty += qty
          }
        })

        const carryOverStock = Math.max(0, currentStock - inboundQty + outboundQty)

        return {
          id: part.id,
          code: part.code || '-',
          name: part.name,
          category: part.category || '일반부품',
          carryOver: carryOverStock,
          inbound: inboundQty,
          outbound: outboundQty,
          current: currentStock,
          assetValue: totalAssetValue,
          histories: partHistories
        }
      })

      setLedgerData(computed)
    } catch (err) {
      console.error('수불부 데이터 집계 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  const tryParseSerials = (serialsStr) => {
    try {
      const parsed = typeof serialsStr === 'string' ? JSON.parse(serialsStr) : serialsStr
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }

  useEffect(() => {
    fetchLedgerSummary()
  }, [partsList])

  const handleOpenDetailHistory = (item, type) => {
    setSelectedItemHistory({ name: item.name, code: item.code, type })
    const filtered = (item.histories || []).filter(h => {
      if (type === 'INBOUND') return h.type === 'INBOUND' || h.company_name?.includes('입고')
      if (type === 'OUTBOUND') return h.type === 'OUTBOUND' || h.company_name?.includes('출고')
      return true
    })
    setHistoryList(filtered)
  }

  const handleExportExcel = () => {
    let csv = '\uFEFF' // UTF-8 BOM
    csv += 'Ident No.,품명,구분,이월재고,입고수량,출고수량,현재고,재고금액(원)\n'
    
    filteredLedger.forEach(item => {
      csv += `"${item.code}","${item.name}","${item.category}",${item.carryOver},${item.inbound},${item.outbound},${item.current},${item.assetValue}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', `재고수불부_결산_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 💡 검색어 및 선택된 구분(Category)에 따른 필터링 적용
  const filteredLedger = ledgerData.filter(item => {
    const matchesSearch = !searchTerm.trim() || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (selectedCategory === 'ALL') return matchesSearch
    return matchesSearch && item.category === selectedCategory
  })

  // 동적으로 존재하는 구분(카테고리) 목록 추출 (중복 제거)
  const availableCategories = ['ALL', ...new Set(ledgerData.map(i => i.category).filter(Boolean))]

  const totalSumAssetValue = filteredLedger.reduce((acc, cur) => acc + (cur.assetValue || 0), 0)

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: '13px', borderRadius: '8px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={{ padding: '4px' }}>
      {/* 상단 검색, 구분 필터 및 액션바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '500px', flexWrap: 'wrap' }}>
          <select 
            value={selectedCategory} 
            onChange={e => setSelectedCategory(e.target.value)} 
            style={{ ...inputStyle, width: '150px', fontWeight: '700', color: '#1E293B' }}
          >
            <option value="ALL">📁 구분 전체 보기</option>
            {availableCategories.filter(c => c !== 'ALL').map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <input 
            type="text" 
            placeholder="🔍 품명 또는 코드 검색..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            style={{ ...inputStyle, flex: 1, padding: '11px 14px', minWidth: '200px' }} 
          />
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>
            💰 자산 평가액 합계: {totalSumAssetValue.toLocaleString()} 원
          </div>
          <button 
            type="button" 
            onClick={fetchLedgerSummary} 
            style={{ background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            🔄 새로고침
          </button>
          <button 
            type="button" 
            onClick={handleExportExcel} 
            style={{ background: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            📊 엑셀 다운로드 (결산용)
          </button>
        </div>
      </div>

      {/* 수불부 메인 테이블 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '130px' }}>Ident No.</th>
              <th style={{ padding: '14px 16px', width: '200px' }}>ITEM (품명)</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>이월 재고</th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>입고 (수량)</th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>출고 (수량)</th>
              <th style={{ padding: '14px 16px', width: '100px', textAlign: 'center', backgroundColor: '#F1F5F9' }}>현재고</th>
              <th style={{ padding: '14px 16px', width: '130px', textAlign: 'right', backgroundColor: '#ECFDF5', color: '#065F46' }}>재고 금액 (원)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>데이터 집계 중...</td></tr>
            ) : filteredLedger.length === 0 ? (
              <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>조회된 수불부 내역이 없습니다.</td></tr>
            ) : (
              filteredLedger.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', wordBreak: 'break-all' }}>{item.code}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{item.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', backgroundColor: '#F1F5F9', color: '#334155', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#64748B' }}>{item.carryOver}</td>
                  
                  {/* 입고수량 클릭 시 상세 드릴다운 */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => handleOpenDetailHistory(item, 'INBOUND')}
                      style={{ background: item.inbound > 0 ? '#ECFDF5' : 'transparent', color: item.inbound > 0 ? '#059669' : '#94A3B8', border: item.inbound > 0 ? '1px solid #A7F3D0' : 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: '800', cursor: item.inbound > 0 ? 'pointer' : 'default' }}
                    >
                      {item.inbound} 개
                    </button>
                  </td>

                  {/* 출고수량 클릭 시 상세 드릴다운 */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => handleOpenDetailHistory(item, 'OUTBOUND')}
                      style={{ background: item.outbound > 0 ? '#EFF6FF' : 'transparent', color: item.outbound > 0 ? '#2563EB' : '#94A3B8', border: item.outbound > 0 ? '1px solid #BFDBFE' : 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: '800', cursor: item.outbound > 0 ? 'pointer' : 'default' }}
                    >
                      {item.outbound} 개
                    </button>
                  </td>

                  <td style={{ padding: '12px 16px', textAlign: 'center', backgroundColor: '#F8FAFC' }}>
                    <span style={{ fontWeight: '900', fontSize: '14px', color: '#0F172A', backgroundColor: '#fff', padding: '4px 12px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                      {item.current} 개
                    </span>
                  </td>

                  {/* 재고 금액 (자산 평가액) */}
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: '#059669', backgroundColor: '#F0FDF4' }}>
                    {item.assetValue ? item.assetValue.toLocaleString() : 0} 원
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 드릴다운 상세 이력 팝업 모달 */}
      {selectedItemHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '20px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '700px', maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                  📋 {selectedItemHistory.type === 'INBOUND' ? '입고' : '출고'} 상세 내역 이력
                </h3>
                <span style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                  [{selectedItemHistory.code}] {selectedItemHistory.name}
                </span>
              </div>
              <button type="button" onClick={() => setSelectedItemHistory(null)} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
              {historyList.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>상세 이력이 존재하지 않습니다.</div>
              ) : (
                historyList.map((h, idx) => (
                  <div key={idx} style={{ backgroundColor: '#F8FAFC', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB' }}>📅 {h.date}</span>
                        <span style={{ fontSize: '11px', backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: '#334155' }}>{h.company_name || '거래처 미지정'}</span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{h.summary}</span>
                      {h.note && <span style={{ fontSize: '11px', color: '#64748B' }}>비고: {h.note}</span>}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', display: 'block' }}>작성자</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155' }}>{h.author || '배진철'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
              <button type="button" onClick={() => setSelectedItemHistory(null)} style={{ padding: '8px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}