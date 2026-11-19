import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import * as XLSX from 'xlsx'

export default function StockClosingTab() {
  const currentYear = new Date().getFullYear()

  const [viewMode, setViewMode] = useState('CURRENT') // 'CURRENT' | 'CARRYOVER'
  const [closingYear, setClosingYear] = useState(currentYear)
  const [selectedCarryoverYear, setSelectedCarryoverYear] = useState(currentYear + 1)
  const [isClosingSaving, setIsClosingSaving] = useState(false)

  const [lots, setLots] = useState([])
  const [carryovers, setCarryovers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [hideZeroStock, setHideZeroStock] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({
    po_number: '',
    import_date: '',
    expiry_date: '',
    unit_price: 0,
    current_qty: 0
  })

  useEffect(() => {
    fetchStockLots()
    fetchCarryovers(currentYear + 1)
  }, [])

  useEffect(() => {
    if (viewMode === 'CARRYOVER') {
      fetchCarryovers(selectedCarryoverYear)
    }
  }, [viewMode, selectedCarryoverYear])

  const fetchStockLots = async () => {
    setLoading(true)

    const [{ data: lotsData, error: lotsError }, { data: partsData, error: partsError }] = await Promise.all([
      supabase.from('part_stock_lots').select('*').order('import_date', { ascending: false }),
      supabase.from('parts').select('id, name, code, category')
    ])

    if (lotsError || partsError) {
      console.error('조회 실패:', lotsError || partsError)
      setLoading(false)
      return
    }

    const partsMap = new Map()
    if (partsData) {
      partsData.forEach(p => partsMap.set(p.id, p))
    }

    const combinedLots = (lotsData || []).map(lot => {
      const matchedPart = partsMap.get(lot.part_id) || {}
      return {
        ...lot,
        parts: {
          name: matchedPart.name || '미지정 품목',
          code: matchedPart.code || '-',
          category: matchedPart.category || 'Spare parts'
        }
      }
    })

    combinedLots.sort((a, b) => {
      const codeA = a.parts.code || ''
      const codeB = b.parts.code || ''
      if (codeA !== codeB) {
        return codeA.localeCompare(codeB)
      }
      return new Date(b.import_date || 0) - new Date(a.import_date || 0)
    })

    setLots(combinedLots)
    setLoading(false)
  }

  const fetchCarryovers = async (targetCarryoverYear) => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory_carryovers')
      .select('*')
      .eq('carryover_year', Number(targetCarryoverYear))
      .order('part_code', { ascending: true })
      .order('import_date', { ascending: false })

    if (error) {
      console.error('이월 내역 조회 실패:', error)
      setCarryovers([])
    } else {
      setCarryovers(data || [])
    }
    setLoading(false)
  }

  const handleYearEndCarryover = async () => {
    const targetClosingYear = Number(closingYear)
    const targetCarryoverYear = targetClosingYear + 1

    if (!targetClosingYear || targetClosingYear < 2000) {
      alert('유효한 마감 연도를 선택해주세요.')
      return
    }

    if (lots.length === 0) {
      alert('이월할 로트 데이터가 없습니다.')
      return
    }

    const confirmMsg =
      `${targetClosingYear}년 결산 기준으로 현재 로트 ${lots.length}건(잔여고 0 로트 포함)을 ` +
      `${targetCarryoverYear}년 이월 재고로 저장하시겠습니까?\n` +
      `(동일 연도 이월 데이터가 이미 있으면 최신 값으로 갱신됩니다.)`

    if (!window.confirm(confirmMsg)) return

    setIsClosingSaving(true)
    const nowIso = new Date().toISOString()

    const payload = lots.map(lot => {
      const qty = Number(lot.current_qty || 0)
      const price = Number(lot.unit_price || 0)
      return {
        closing_year: targetClosingYear,
        carryover_year: targetCarryoverYear,
        lot_id: lot.id,
        part_id: lot.part_id,
        po_number: lot.po_number || '-',
        part_code: lot.parts?.code || '-',
        part_name: lot.parts?.name || '미지정 품목',
        category: lot.parts?.category || 'Spare parts',
        import_date: lot.import_date || null,
        expiry_date: lot.expiry_date || null,
        unit_price: price,
        initial_qty: Number(lot.initial_qty ?? 0),
        carryover_qty: qty,
        carryover_amount: qty * price,
        closed_at: nowIso
      }
    })

    const { error } = await supabase
      .from('inventory_carryovers')
      .upsert(payload, { onConflict: 'closing_year,lot_id' })

    setIsClosingSaving(false)

    if (error) {
      alert('연말 이월 저장 실패: ' + error.message)
      return
    }

    alert(`${targetClosingYear}년 마감 → ${targetCarryoverYear}년 이월 데이터 ${payload.length}건이 저장되었습니다.`)
    setSelectedCarryoverYear(targetCarryoverYear)
    setViewMode('CARRYOVER')
    fetchCarryovers(targetCarryoverYear)
  }

  const handleSaveEdit = async (id) => {
    const { error } = await supabase.from('part_stock_lots').update({
      po_number: editForm.po_number.trim() || '기존재고',
      import_date: editForm.import_date || null,
      expiry_date: editForm.expiry_date || null,
      unit_price: Number(editForm.unit_price || 0),
      current_qty: Number(editForm.current_qty || 0)
    }).eq('id', id)

    if (error) {
      alert('수정 실패: ' + error.message)
    } else {
      alert('수정되었습니다.')
      setEditingId(null)
      fetchStockLots()
    }
  }

  const handleDeleteLot = async (id, poNumber) => {
    if (!window.confirm(`P.O. [${poNumber || '미지정'}] 로트 항목을 정말 삭제하시겠습니까?`)) return

    const { error } = await supabase.from('part_stock_lots').delete().eq('id', id)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      alert('로트 항목이 삭제되었습니다.')
      fetchStockLots()
    }
  }

  const sourceRows = viewMode === 'CURRENT'
    ? lots.map(lot => ({
        id: lot.id,
        po_number: lot.po_number || '-',
        category: lot.parts?.category || 'Spare parts',
        code: lot.parts?.code || '-',
        name: lot.parts?.name || '미지정 품목',
        import_date: lot.import_date || '-',
        expiry_date: lot.expiry_date || '-',
        unit_price: Number(lot.unit_price || 0),
        initial_qty: Number(lot.initial_qty ?? 0),
        qty: Number(lot.current_qty || 0),
        amount: Number(lot.current_qty || 0) * Number(lot.unit_price || 0),
        rawLot: lot
      }))
    : carryovers.map(row => ({
        id: row.id,
        po_number: row.po_number || '-',
        category: row.category || 'Spare parts',
        code: row.part_code || '-',
        name: row.part_name || '미지정 품목',
        import_date: row.import_date || '-',
        expiry_date: row.expiry_date || '-',
        unit_price: Number(row.unit_price || 0),
        initial_qty: Number(row.initial_qty ?? 0),
        qty: Number(row.carryover_qty || 0),
        amount: Number(row.carryover_amount ?? (Number(row.carryover_qty || 0) * Number(row.unit_price || 0))),
        closing_year: row.closing_year,
        carryover_year: row.carryover_year
      }))

  const filteredRows = sourceRows.filter(row => {
    const matchesSearch =
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.po_number.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = selectedCategory === 'ALL' || row.category === selectedCategory
    const matchesZeroStock = hideZeroStock ? row.qty > 0 : true

    return matchesSearch && matchesCategory && matchesZeroStock
  })

  const handleExcelDownload = () => {
    if (filteredRows.length === 0) {
      alert('다운로드할 데이터가 없습니다.')
      return
    }

    const excelData = filteredRows.map((row, index) => {
      const baseRow = {
        'NO': index + 1,
        'P.O. 번호': row.po_number,
        '품목 구분': row.category,
        '품번 / 코드': row.code,
        '품명 (ITEM)': row.name,
        '입고일자': row.import_date,
        '유효기간': row.expiry_date,
        '입고 단가 (원)': row.unit_price,
        '최초 수량': row.initial_qty,
        [viewMode === 'CURRENT' ? '현재 잔여고' : `${selectedCarryoverYear}년 이월 수량`]: row.qty,
        [viewMode === 'CURRENT' ? '평가 금액 (원)' : `${selectedCarryoverYear}년 이월 금액 (원)`]: row.amount
      }

      if (viewMode === 'CARRYOVER') {
        return {
          '마감 연도': row.closing_year,
          '이월 연도': row.carryover_year,
          ...baseRow
        }
      }
      return baseRow
    })

    const worksheet = XLSX.utils.json_to_sheet(excelData)
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 10 },
      { wch: 6 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 },
      { wch: 30 },
      { wch: 14 },
      { wch: 14 },
      { wch: 15 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 }
    ]

    const workbook = XLSX.utils.book_new()
    const sheetName = viewMode === 'CURRENT' ? '결산재고명세서' : `${selectedCarryoverYear}년_이월재고`
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    const todayStr = new Date().toISOString().split('T')[0]
    const filePrefix = viewMode === 'CURRENT'
      ? `법인결산_재고자산명세서_${todayStr}`
      : `연말이월_${selectedCarryoverYear}년기초재고_${todayStr}`
    XLSX.writeFile(workbook, `${filePrefix}.xlsx`)
  }

  const totalAssetAmount = sourceRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const totalLotsCount = sourceRows.length
  const zeroStockCount = sourceRows.filter(row => Number(row.qty || 0) === 0).length

  return (
    <div style={styles.container}>
      {/* 상단 타이틀 및 KPI 카드 */}
      <div style={styles.headerArea}>
        <div>
          <h2 style={styles.title}>
            {viewMode === 'CURRENT'
              ? '📊 법인 결산 및 P.O. 로트별 재고 대시보드'
              : `📦 ${selectedCarryoverYear}년 기초(연말 이월) 재고 명세`}
          </h2>
          <p style={styles.subtitle}>
            {viewMode === 'CURRENT'
              ? '입고 날짜별 단가 차이와 선입선출(FIFO)이 반영된 실시간 자산 평가 현황'
              : `${selectedCarryoverYear - 1}년 연말 마감 시점 고정된 기초 재고 수량 및 이월 자산 금액`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExcelDownload}
            style={styles.excelBtn}
          >
            📥 {viewMode === 'CURRENT' ? '결산 서류 엑셀 다운로드 (.xlsx)' : '이월 명세 엑셀 다운로드 (.xlsx)'}
          </button>

          <div style={styles.totalCard}>
            <span style={styles.totalLabel}>
              {viewMode === 'CURRENT' ? '총 재고 자산 평가액' : `${selectedCarryoverYear}년 총 이월 재고금액`}
            </span>
            <span style={styles.totalValue}>{Math.round(totalAssetAmount).toLocaleString()} 원</span>
          </div>
        </div>
      </div>

      {/* 연말 이월 실행 및 보기 전환 바 */}
      <div style={styles.carryoverBar}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setViewMode('CURRENT')}
            style={{
              ...styles.modeBtn,
              backgroundColor: viewMode === 'CURRENT' ? '#0F172A' : '#FFFFFF',
              color: viewMode === 'CURRENT' ? '#FFFFFF' : '#334155'
            }}
          >
            현재 로트 결산
          </button>
          <button
            type="button"
            onClick={() => setViewMode('CARRYOVER')}
            style={{
              ...styles.modeBtn,
              backgroundColor: viewMode === 'CARRYOVER' ? '#0F172A' : '#FFFFFF',
              color: viewMode === 'CARRYOVER' ? '#FFFFFF' : '#334155'
            }}
          >
            연말 이월 내역
          </button>

          {viewMode === 'CARRYOVER' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#334155', marginLeft: '6px' }}>
              이월 연도:
              <select
                value={selectedCarryoverYear}
                onChange={e => setSelectedCarryoverYear(Number(e.target.value))}
                style={styles.yearSelect}
              >
                {[currentYear, currentYear + 1, currentYear + 2].map(yr => (
                  <option key={yr} value={yr}>{yr}년 기초</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700', color: '#1E3A8A' }}>
            마감 기준 연도:
            <select
              value={closingYear}
              onChange={e => setClosingYear(Number(e.target.value))}
              style={styles.yearSelect}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map(yr => (
                <option key={yr} value={yr}>{yr}년 마감 → {yr + 1}년 이월</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isClosingSaving}
            onClick={handleYearEndCarryover}
            style={styles.carryoverBtn}
          >
            {isClosingSaving ? '이월 저장 중...' : '🔁 연말 재고 이월 실행'}
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      <div style={styles.kpiContainer}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>
            {viewMode === 'CURRENT' ? '총 관리 로트(Lot) 수' : `${selectedCarryoverYear}년 이월 로트 수`}
          </span>
          <span style={styles.kpiValueSecondary}>{totalLotsCount} 건</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>잔여고 0 로트 수</span>
          <span style={{ ...styles.kpiValueSecondary, color: zeroStockCount > 0 ? '#DC2626' : '#059669' }}>
            {zeroStockCount} 건
          </span>
        </div>
      </div>

      {/* 필터 탭, 검색 바 및 잔여고 0 숨기기 버튼 */}
      <div style={styles.filterBar}>
        <div style={styles.tabGroup}>
          {['ALL', 'Spare parts', '잉크', '희석제', '부자재'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.tabBtn,
                backgroundColor: selectedCategory === cat ? '#2563EB' : '#F1F5F9',
                color: selectedCategory === cat ? '#FFFFFF' : '#475569',
              }}
            >
              {cat === 'ALL' ? '전체 품목군' : cat}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setHideZeroStock(!hideZeroStock)}
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: hideZeroStock ? '1px solid #2563EB' : '1px solid #CBD5E1',
              backgroundColor: hideZeroStock ? '#EFF6FF' : '#F8FAFC',
              color: hideZeroStock ? '#1D4ED8' : '#475569',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            {hideZeroStock ? '☑️ 재고량 0 숨김 중' : '☐ 재고량 0 숨기기'}
          </button>

          <input
            type="text"
            placeholder="품명, 품번(코드), P.O. 번호 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchBox}
          />
        </div>
      </div>

      {/* 데이터 테이블 */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>재고 데이터를 불러오는 중...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>P.O. 번호</th>
                <th style={styles.th}>품목 구분</th>
                <th style={styles.th}>품번 / 코드</th>
                <th style={styles.th}>품명 (ITEM)</th>
                <th style={styles.thCenter}>입고일자</th>
                <th style={styles.thCenter}>유효기간</th>
                <th style={styles.thRight}>입고 단가 (원)</th>
                <th style={styles.thCenter}>최초 수량</th>
                <th style={styles.thCenter}>{viewMode === 'CURRENT' ? '현재 잔여고' : '이월 수량'}</th>
                <th style={styles.thRight}>{viewMode === 'CURRENT' ? '평가 금액 (원)' : '이월 금액 (원)'}</th>
                {viewMode === 'CURRENT' && <th style={styles.thCenter}>관리</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => {
                  const isEditing = viewMode === 'CURRENT' && editingId === row.id

                  return (
                    <tr key={row.id} style={styles.tdRow}>
                      <td style={styles.tdCenterBold}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.po_number}
                            onChange={(e) => setEditForm({ ...editForm, po_number: e.target.value })}
                            style={styles.inlineInput}
                          />
                        ) : (
                          row.po_number
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badgeCategory}>
                          {row.category}
                        </span>
                      </td>
                      <td style={styles.tdCode}>{row.code}</td>
                      <td style={styles.tdBold}>{row.name}</td>
                      <td style={styles.tdCenter}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.import_date}
                            onChange={(e) => setEditForm({ ...editForm, import_date: e.target.value })}
                            style={styles.inlineInput}
                          />
                        ) : (
                          row.import_date
                        )}
                      </td>
                      <td style={styles.tdCenter}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.expiry_date}
                            onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                            style={styles.inlineInput}
                          />
                        ) : (
                          row.expiry_date
                        )}
                      </td>
                      <td style={styles.tdRight}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.unit_price}
                            onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                            style={{ ...styles.inlineInput, textAlign: 'right' }}
                          />
                        ) : (
                          `${row.unit_price.toLocaleString()} 원`
                        )}
                      </td>
                      <td style={styles.tdCenter}>{row.initial_qty}</td>
                      <td style={styles.tdCenter}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.current_qty}
                            onChange={(e) => setEditForm({ ...editForm, current_qty: e.target.value })}
                            style={{ ...styles.inlineInput, textAlign: 'center', width: '70px' }}
                          />
                        ) : (
                          <span style={{
                            ...styles.badgeQty,
                            backgroundColor: row.qty === 0 ? '#FEE2E2' : '#F0FDF4',
                            color: row.qty === 0 ? '#991B1B' : '#166534'
                          }}>
                            {row.qty} 개
                          </span>
                        )}
                      </td>
                      <td style={styles.tdRightAmount}>{Math.round(row.amount).toLocaleString()} 원</td>
                      {viewMode === 'CURRENT' && (
                        <td style={styles.tdCenter}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => handleSaveEdit(row.id)} style={styles.saveBtn}>저장</button>
                              <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>취소</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button onClick={() => {
                                setEditingId(row.id)
                                setEditForm({
                                  po_number: row.rawLot?.po_number || '',
                                  import_date: row.rawLot?.import_date || '',
                                  expiry_date: row.rawLot?.expiry_date || '',
                                  unit_price: row.rawLot?.unit_price || 0,
                                  current_qty: row.rawLot?.current_qty || 0
                                })
                              }} style={styles.editBtn}>수정</button>
                              <button onClick={() => handleDeleteLot(row.id, row.po_number)} style={styles.deleteBtn}>삭제</button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={viewMode === 'CURRENT' ? '11' : '10'} style={styles.noData}>
                    {viewMode === 'CURRENT'
                      ? '조건에 일치하는 입고 로트 데이터가 없습니다.'
                      : `${selectedCarryoverYear}년 이월 내역이 없거나 필터 조건에 일치하는 항목이 없습니다.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: { backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' },
  headerArea: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  title: { fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px 0' },
  subtitle: { fontSize: '13px', color: '#64748B', margin: 0 },
  excelBtn: { backgroundColor: '#059669', color: '#FFFFFF', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)' },
  totalCard: { backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '14px 22px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  totalLabel: { fontSize: '12px', fontWeight: '700', color: '#1E40AF' },
  totalValue: { fontSize: '22px', fontWeight: '900', color: '#1D4ED8', marginTop: '2px' },
  carryoverBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '12px' },
  modeBtn: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  yearSelect: { padding: '7px 10px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '13px', fontWeight: '700', color: '#0F172A' },
  carryoverBtn: { backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', padding: '9px 16px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', cursor: 'pointer' },
  kpiContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  kpiCard: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '14px 18px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' },
  kpiLabel: { fontSize: '12px', fontWeight: '600', color: '#64748B' },
  kpiValueSecondary: { fontSize: '18px', fontWeight: '800', color: '#0F172A' },
  filterBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  tabGroup: { display: 'flex', gap: '6px' },
  tabBtn: { padding: '8px 14px', borderRadius: '8px', border: 'none', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  searchBox: { padding: '9px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px', width: '240px', outline: 'none', backgroundColor: '#F8FAFC' },
  tableWrapper: { overflowX: 'auto', maxHeight: '600px', border: '1px solid #E2E8F0', borderRadius: '10px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  thRow: { backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 1 },
  th: { padding: '12px 16px', color: '#475569', fontWeight: '700', borderBottom: '1px solid #E2E8F0' },
  thCenter: { padding: '12px 16px', color: '#475569', fontWeight: '700', textAlign: 'center', borderBottom: '1px solid #E2E8F0' },
  thRight: { padding: '12px 16px', color: '#475569', fontWeight: '700', textAlign: 'right', borderBottom: '1px solid #E2E8F0' },
  tdRow: { borderBottom: '1px solid #F1F5F9' },
  td: { padding: '12px 16px', color: '#334155' },
  tdCode: { padding: '12px 16px', color: '#475569', fontWeight: '600' },
  tdBold: { padding: '12px 16px', color: '#0F172A', fontWeight: '700' },
  tdCenter: { padding: '12px 16px', color: '#334155', textAlign: 'center' },
  tdCenterBold: { padding: '12px 16px', color: '#2563EB', fontWeight: '700', textAlign: 'center' },
  tdRight: { padding: '12px 16px', color: '#334155', textAlign: 'right' },
  tdRightAmount: { padding: '12px 16px', color: '#0F172A', fontWeight: '800', textAlign: 'right', backgroundColor: '#F8FAFC' },
  badgeCategory: { padding: '4px 8px', backgroundColor: '#EFF6FF', color: '#2563EB', borderRadius: '6px', fontSize: '11px', fontWeight: '700' },
  badgeQty: { padding: '4px 10px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' },
  noData: { padding: '40px', textAlign: 'center', color: '#94A3B8', fontStyle: 'italic' },
  inlineInput: { width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #2563EB', fontSize: '12px', outline: 'none', boxSizing: 'border-box' },
  editBtn: { background: '#EFF6FF', color: '#2563EB', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  deleteBtn: { background: '#FEE2E2', color: '#EF4444', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  saveBtn: { background: '#059669', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  cancelBtn: { background: '#CBD5E1', color: '#334155', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }
}
