import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function StockClosingTab() {
  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  
  // 💡 잔여고 0인 품목 숨기기 토글 상태 (기본값: false -> 전체 보기, 클릭하면 잔여고 0 제외)
  const [hideZeroStock, setHideZeroStock] = useState(false)

  // 인라인 수정 상태 관리
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ po_number: '', import_date: '', expiry_date: '', unit_price: 0, current_qty: 0 })

  useEffect(() => {
    fetchStockLots()
  }, [])

  const fetchStockLots = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('part_stock_lots')
      .select('*, parts(name, code, category)')
      .order('import_date', { ascending: false })

    if (error) {
      console.error('로트 재고 조회 실패:', error)
    } else {
      setLots(data || [])
    }
    setLoading(false)
  }

  // 인라인 수정 저장 핸들러
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

  // 검색, 카테고리, 그리고 잔여고 0 숨기기 필터링 적용
  const filteredLots = lots.filter(lot => {
    const itemName = lot.parts?.name || ''
    const itemCode = lot.parts?.code || ''
    const poNumber = lot.po_number || ''
    const category = lot.parts?.category || '일반부품'
    const currentQty = Number(lot.current_qty || 0)

    const matchesSearch = itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          poNumber.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'ALL' || category === selectedCategory
    const matchesZeroStock = hideZeroStock ? currentQty > 0 : true

    return matchesSearch && matchesCategory && matchesZeroStock
  })

  // 총 재고 자산 평가액은 잔여고가 있는 항목들 위주로 정확하게 계산됨
  const totalAssetAmount = lots.reduce((sum, lot) => sum + (Number(lot.current_qty || 0) * Number(lot.unit_price || 0)), 0)
  const totalLotsCount = lots.length
  const zeroStockCount = lots.filter(lot => Number(lot.current_qty || 0) === 0).length

  return (
    <div style={styles.container}>
      {/* 상단 타이틀 및 KPI 카드 */}
      <div style={styles.headerArea}>
        <div>
          <h2 style={styles.title}>📊 법인 결산 및 P.O. 로트별 재고 대시보드</h2>
          <p style={styles.subtitle}>입고 날짜별 단가 차이와 선입선출(FIFO)이 반영된 실시간 자산 평가 현황</p>
        </div>
        <div style={styles.totalCard}>
          <span style={styles.totalLabel}>총 재고 자산 평가액</span>
          <span style={styles.totalValue}>{Math.round(totalAssetAmount).toLocaleString()} 원</span>
        </div>
      </div>

      <div style={styles.kpiContainer}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>총 관리 로트(Lot) 수</span>
          <span style={styles.kpiValueSecondary}>{totalLotsCount} 건</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>품절(잔여고 0) 로트 수</span>
          <span style={{ ...styles.kpiValueSecondary, color: zeroStockCount > 0 ? '#DC2626' : '#059669' }}>
            {zeroStockCount} 건
          </span>
        </div>
      </div>

      {/* 필터 탭, 검색 바 및 잔여고 0 토글 버튼 */}
      <div style={styles.filterBar}>
        <div style={styles.tabGroup}>
          {['ALL', '일반부품', '잉크', '희석제', '소모품'].map((cat) => (
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
            {hideZeroStock ? '☑️ 잔여고 0 품목 숨김 중' : '☐ 잔여고 0 품목 포함 보기'}
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
        <p style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>재고 로트 데이터를 불러오는 중...</p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thRow}>
                <th style={styles.th}>P.O. 번호</th>
                <th style={styles.th}>품목 구분</th>
                <th style={styles.th}>품번 / 코드</th>
                <th style={styles.th}>품명 (ITEM)</th>
                <th style={styles.thCenter}>수입 통관일</th>
                <th style={styles.thCenter}>유효기간</th>
                <th style={styles.thRight}>입고 단가 (원)</th>
                <th style={styles.thCenter}>최초 수량</th>
                <th style={styles.thCenter}>현재 잔여고</th>
                <th style={styles.thRight}>평가 금액 (원)</th>
                <th style={styles.thCenter}>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredLots.length > 0 ? (
                filteredLots.map((lot) => {
                  const isEditing = editingId === lot.id
                  const evaluationAmount = Number(lot.current_qty || 0) * Number(lot.unit_price || 0)

                  return (
                    <tr key={lot.id} style={styles.tdRow}>
                      <td style={styles.tdCenterBold}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.po_number}
                            onChange={(e) => setEditForm({ ...editForm, po_number: e.target.value })}
                            style={styles.inlineInput}
                          />
                        ) : (
                          lot.po_number || '-'
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={styles.badgeCategory}>
                          {lot.parts?.category || '일반부품'}
                        </span>
                      </td>
                      <td style={styles.tdCode}>{lot.parts?.code || '-'}</td>
                      <td style={styles.tdBold}>{lot.parts?.name || '미지정 품목'}</td>
                      <td style={styles.tdCenter}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.import_date}
                            onChange={(e) => setEditForm({ ...editForm, import_date: e.target.value })}
                            style={styles.inlineInput}
                          />
                        ) : (
                          lot.import_date || '-'
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
                          lot.expiry_date || '-'
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
                          `${Number(lot.unit_price || 0).toLocaleString()} 원`
                        )}
                      </td>
                      <td style={styles.tdCenter}>{lot.initial_qty ?? 0}</td>
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
                            backgroundColor: Number(lot.current_qty) === 0 ? '#FEE2E2' : '#F0FDF4',
                            color: Number(lot.current_qty) === 0 ? '#991B1B' : '#166534'
                          }}>
                            {lot.current_qty ?? 0} 개
                          </span>
                        )}
                      </td>
                      <td style={styles.tdRightAmount}>{Math.round(evaluationAmount).toLocaleString()} 원</td>
                      <td style={styles.tdCenter}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button onClick={() => handleSaveEdit(lot.id)} style={styles.saveBtn}>저장</button>
                            <button onClick={() => setEditingId(null)} style={styles.cancelBtn}>취소</button>
                          </div>
                        ) : (
                          <button onClick={() => {
                            setEditingId(lot.id)
                            setEditForm({
                              po_number: lot.po_number || '',
                              import_date: lot.import_date || '',
                              expiry_date: lot.expiry_date || '',
                              unit_price: lot.unit_price || 0,
                              current_qty: lot.current_qty || 0
                            })
                          }} style={styles.editBtn}>수정</button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="11" style={styles.noData}>조건에 일치하는 입고 로트 데이터가 없습니다.</td>
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
  totalCard: { backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', padding: '14px 22px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  totalLabel: { fontSize: '12px', fontWeight: '700', color: '#1E40AF' },
  totalValue: { fontSize: '22px', fontWeight: '900', color: '#1D4ED8', marginTop: '2px' },
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
  saveBtn: { background: '#059669', color: '#fff', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  cancelBtn: { background: '#CBD5E1', color: '#334155', border: 'none', padding: '5px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }
}