import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function InventoryLedgerTab({ partsList, refreshParts }) {
  const [ledgerData, setLedgerData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [hideZeroStock, setHideZeroStock] = useState(false)
  
  const [selectedItemHistory, setSelectedItemHistory] = useState(null)
  const [historyList, setHistoryList] = useState([])

  const cleanNoteText = (rawNote) => {
    if (!rawNote) return ''
    const str = String(rawNote)
    const cutIndex = str.search(/\[(LOT_RESTORE|DELIVERY_DETAILS):/)
    const baseText = cutIndex >= 0 ? str.slice(0, cutIndex) : str
    return baseText.trim()
  }

  const extractQtyFromSummary = (summary, partName) => {
    if (!summary) return 0
    if (partName) {
      const escapedName = String(partName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const namedMatch = summary.match(new RegExp(`${escapedName}[^\\n(]*\\((\\d+)개\\)`))
      if (namedMatch) return parseInt(namedMatch[1], 10)
    }
    const genericMatch = summary.match(/\((\d+)개\)/)
    return genericMatch ? parseInt(genericMatch[1], 10) : 0
  }

  const extractUnitPriceFromText = (text) => {
    if (!text) return null
    const match = String(text).match(/단가\s*[:：]?\s*([\d,]+)\s*원?/)
    if (!match) return null
    const parsed = Number(match[1].replace(/,/g, ''))
    return Number.isNaN(parsed) ? null : parsed
  }

  const fetchLedgerSummary = async () => {
    setLoading(true)
    try {
      const { data: historyData, error: histErr } = await supabase
        .from('delivery_history')
        .select('*')
        .order('date', { ascending: false })

      if (histErr) throw histErr

      const { data: lotsData, error: lotsErr } = await supabase
        .from('part_stock_lots')
        .select('*')

      if (lotsErr) throw lotsErr

      const computed = (partsList || []).map(part => {
        const partLots = (lotsData || []).filter(l => String(l.part_id) === String(part.id))
        const currentStock = Number(part.stock) || 0
        const carryOverStock = Number(part.carry_over_stock) || 0

        let totalAssetValue = 0
        let remainingStockToCalc = currentStock
        const validLots = partLots.filter(l => (Number(l.current_qty) || 0) > 0)

        if (validLots.length > 0 && remainingStockToCalc > 0) {
          validLots.forEach(l => {
            if (remainingStockToCalc <= 0) return
            const qty = Math.min(remainingStockToCalc, Number(l.current_qty) || 0)
            const lotUnitPrice = Number(l.unit_price) || Number(part.unit_price) || 0
            totalAssetValue += qty * lotUnitPrice
            remainingStockToCalc -= qty
          })
        }

        if (remainingStockToCalc > 0) {
          if (part.is_serial_managed) {
            const serialsArr = tryParseSerials(part.serials)
            let snCalculated = 0
            serialsArr.forEach(s => {
              if (snCalculated < remainingStockToCalc) {
                totalAssetValue += Number(s.unit_price || part.unit_price || 0)
                snCalculated += 1
              }
            })
            if (snCalculated < remainingStockToCalc) {
              totalAssetValue += (remainingStockToCalc - snCalculated) * (Number(part.unit_price) || 0)
            }
          } else {
            totalAssetValue += remainingStockToCalc * (Number(part.unit_price) || 0)
          }
        }

        const partHistories = (historyData || []).filter(h => {
          if (h.part_id !== undefined && h.part_id !== null && String(h.part_id).trim() !== '') {
            return String(h.part_id) === String(part.id)
          }
          if (!h.summary) return false
          if (part.code && String(part.code).trim() !== '') {
            return h.summary.includes(`[${part.code}]`)
          }
          if (part.name && String(part.name).trim() !== '') {
            return h.summary.includes(part.name)
          }
          return false
        })

        let inboundQty = 0
        let outboundQty = 0

        const lotInboundSum = partLots.reduce((sum, lot) => sum + (Number(lot.initial_qty) || 0), 0)

        const inboundHistorySum = partHistories.reduce((sum, h) => {
          const isInbound = h.type === 'INBOUND' || h.company_name?.includes('입고')
          if (!isInbound) return sum
          const qty = extractQtyFromSummary(h.summary, part.name)
          return sum + (qty > 0 ? qty : 1)
        }, 0)

        inboundQty = partLots.length > 0 ? lotInboundSum : inboundHistorySum

        partHistories.forEach(h => {
          if (h.type === 'OUTBOUND' || h.company_name?.includes('출고')) {
            const qty = extractQtyFromSummary(h.summary, part.name)
            outboundQty += qty > 0 ? qty : 1
          }
        })

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
          histories: partHistories,
          lots: partLots
        }
      })

      setLedgerData(computed)
    } catch (err) {
      console.error('수불부 데이터 집계 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshAll = async () => {
    if (typeof refreshParts === 'function') {
      await refreshParts()
    }
    await fetchLedgerSummary()
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

    if (type === 'INBOUND') {
      const hasLots = Array.isArray(item.lots) && item.lots.length > 0

      if (hasLots) {
        const inboundHistories = (item.histories || []).filter(
          h => h.type === 'INBOUND' || h.company_name?.includes('입고')
        )

        const lotInboundRows = item.lots.map(lot => {
          const qty = Number(lot.initial_qty ?? lot.current_qty ?? 0)
          const lotPrice = lot.unit_price !== undefined && lot.unit_price !== null ? Number(lot.unit_price) : null

          const matchedHistory = inboundHistories.find(h => {
            const noteText = cleanNoteText(h.note)
            if (lot.po_number && noteText.includes(`LOT/PO: ${lot.po_number}`)) {
              return !lot.import_date || h.date === lot.import_date
            }
            return false
          }) || inboundHistories.find(h => lot.import_date && h.date === lot.import_date)

          const historyNote = matchedHistory ? cleanNoteText(matchedHistory.note) : ''

          return {
            date: lot.import_date || '-',
            badge: `로트 (${lot.po_number || '미지정'})`,
            summary: `[${item.code}] ${item.name} (${qty}개)`,
            note: historyNote,
            author: matchedHistory?.author || '로트 관리',
            unitPrice: lotPrice
          }
        }).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

        setHistoryList(lotInboundRows)
        return
      }

      const historyInboundRows = (item.histories || [])
        .filter(h => h.type === 'INBOUND' || h.company_name?.includes('입고'))
        .map(h => {
          const parsedPrice = extractUnitPriceFromText(`${h.summary || ''} ${h.note || ''}`)
          return {
            date: h.date || '-',
            badge: h.company_name || '입고 이력',
            summary: h.summary || '-',
            note: cleanNoteText(h.note),
            author: h.author || '배진철',
            unitPrice: parsedPrice
          }
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

      setHistoryList(historyInboundRows)
      return
    }

    const filteredOutbound = (item.histories || [])
      .filter(h => h.type === 'OUTBOUND' || h.company_name?.includes('출고'))
      .map(h => ({
        date: h.date || '-',
        badge: h.company_name || '거래처 미지정',
        summary: h.summary || '-',
        note: cleanNoteText(h.note),
        author: h.author || '배진철',
        unitPrice: null
      }))

    setHistoryList(filteredOutbound)
  }

  const escapeCsvCell = (value) => {
    const str = value === null || value === undefined ? '' : String(value)
    return `"${str.replace(/"/g, '""')}"`
  }

  const handleExportExcel = () => {
    let csv = '\uFEFF'
    csv += 'Ident No.,품명,구분,이월재고,입고수량,출고수량,현재고,재고금액(원)\n'
    
    filteredLedger.forEach(item => {
      csv += [
        escapeCsvCell(item.code),
        escapeCsvCell(item.name),
        escapeCsvCell(item.category),
        escapeCsvCell(item.carryOver),
        escapeCsvCell(item.inbound),
        escapeCsvCell(item.outbound),
        escapeCsvCell(item.current),
        escapeCsvCell(item.assetValue)
      ].join(',') + '\n'
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

  const filteredLedger = ledgerData.filter(item => {
    const matchesSearch = !searchTerm.trim() || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
    const matchesZeroStock = hideZeroStock ? item.current > 0 : true

    return matchesSearch && matchesCategory && matchesZeroStock
  }).sort((a, b) => {
    const codeDiff = (a.code || '').localeCompare(b.code || '', 'ko-KR')
    if (codeDiff !== 0) return codeDiff
    return (a.name || '').localeCompare(b.name || '', 'ko-KR')
  })

  const availableCategories = ['ALL', ...new Set(ledgerData.map(i => i.category).filter(Boolean))]

  const totalSumAssetValue = filteredLedger.reduce((acc, cur) => acc + (cur.assetValue || 0), 0)

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: '13px', borderRadius: '8px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={{ padding: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '640px', flexWrap: 'wrap', alignItems: 'center' }}>
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
            placeholder="🔍 품번/코드 또는 품명 검색..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            style={{ ...inputStyle, flex: 1, padding: '11px 14px', minWidth: '180px' }} 
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap', backgroundColor: '#F1F5F9', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
            <input 
              type="checkbox" 
              checked={hideZeroStock} 
              onChange={e => setHideZeroStock(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
            />
            잔여 재고 0 제외
          </label>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>
            💰 자산 평가액 합계: {totalSumAssetValue.toLocaleString()} 원
          </div>
          <button 
            type="button" 
            onClick={handleRefreshAll} 
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

      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '140px' }}>Ident No. (코드)</th>
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
                  <td style={{ padding: '12px 16px', fontWeight: '800', color: '#2563EB', wordBreak: 'break-all' }}>{item.code}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{item.name}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '3px 8px', backgroundColor: '#F1F5F9', color: '#334155', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600', color: '#64748B' }}>{item.carryOver}</td>
                  
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => handleOpenDetailHistory(item, 'INBOUND')}
                      style={{ background: item.inbound > 0 ? '#ECFDF5' : 'transparent', color: item.inbound > 0 ? '#059669' : '#94A3B8', border: item.inbound > 0 ? '1px solid #A7F3D0' : 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: '800', cursor: item.inbound > 0 ? 'pointer' : 'default' }}
                    >
                      {item.inbound} 개
                    </button>
                  </td>

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

                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: '#059669', backgroundColor: '#F0FDF4' }}>
                    {item.assetValue ? item.assetValue.toLocaleString() : 0} 원
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB' }}>📅 {h.date}</span>
                        <span style={{ fontSize: '11px', backgroundColor: '#E2E8F0', padding: '2px 6px', borderRadius: '4px', fontWeight: '700', color: '#334155' }}>{h.badge}</span>
                        {selectedItemHistory.type === 'INBOUND' && (
                          <span style={{ fontSize: '11px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 7px', borderRadius: '4px', fontWeight: '800', color: '#059669' }}>
                            💰 단가: {h.unitPrice !== null && h.unitPrice !== undefined ? `${Number(h.unitPrice).toLocaleString()}원` : '미입력'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{h.summary}</span>
                      {h.note && <span style={{ fontSize: '11px', color: '#64748B' }}>비고: {h.note}</span>}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', display: 'block' }}>구분/작성자</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155' }}>{h.author}</span>
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