import React, { useState } from 'react'

export default function StockClosingTab() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')

  // 2025년 결산 재고 샘플 데이터
  const stockData = [
    { no: 1, item: 'RFID TAG', identNo: '77001-00030', category: 'TAG', prevStock: 139, currIn: 3000, currOut: 2878, total: 261, amount: 3753966 },
    { no: 2, item: 'Solvent', identNo: '77001-00030', category: 'Solvent', prevStock: 0, currIn: 311, currOut: 249, total: 62, amount: 1239442 },
    { no: 3, item: 'WT Solvent', identNo: '-', category: 'Solvent', prevStock: 0, currIn: 54, currOut: 0, total: 54, amount: 746928 },
    { no: 4, item: 'RFID TAG', identNo: '77001-00080', category: 'TAG', prevStock: 0, currIn: 1500, currOut: 284, total: 1216, amount: 18260912 },
    { no: 5, item: 'Solvent Normal', identNo: '77001-00080', category: 'Solvent', prevStock: 0, currIn: 456, currOut: 402, total: 54, amount: 1007046 },
    { no: 6, item: 'WT Solvent', identNo: '-', category: 'Solvent', prevStock: 0, currIn: 71, currOut: 11, total: 60, amount: 760740 },
    { no: 7, item: 'Reset SSN', identNo: '-', category: 'Etc', prevStock: 1, currIn: 0, currOut: 0, total: 1, amount: 8851 },
    { no: 8, item: '77001-00080EGG', identNo: '-', category: 'Etc', prevStock: 0, currIn: 445, currOut: 397, total: 48, amount: 934368 },
    { no: 9, item: 'Acetone solvent', identNo: '77001-00080BA', category: 'Solvent', prevStock: 0, currIn: 1257, currOut: 1200, total: 57, amount: 1128657 },
    { no: 10, item: 'WT Solvent', identNo: '-', category: 'Solvent', prevStock: 0, currIn: 1013, currOut: 984, total: 29, amount: 714844 },
    { no: 11, item: 'SMD Ink tag', identNo: '76000-00117', category: 'TAG', prevStock: 0, currIn: 280, currOut: 180, total: 100, amount: 5382100 },
    { no: 12, item: 'UV INK', identNo: 'CIJ INV-200', category: 'Ink', prevStock: 1, currIn: 18, currOut: 10, total: 9, amount: 1049576 },
    { no: 13, item: 'Solvent for 79-106', identNo: '77001-00107', category: 'Solvent', prevStock: 8, currIn: 5, currOut: 0, total: 13, amount: 712054 },
    { no: 14, item: 'Solvent for 70-115', identNo: '77001-00114', category: 'Solvent', prevStock: 0, currIn: 890, currOut: 851, total: 39, amount: 1795209 },
    { no: 15, item: 'WT Solvent', identNo: '-', category: 'Solvent', prevStock: 0, currIn: 319, currOut: 236, total: 83, amount: 1092363 },
    { no: 16, item: 'Solvent for 70-121', identNo: '77001-00117', category: 'Solvent', prevStock: 27, currIn: 0, currOut: 0, total: 27, amount: 975645 },
    { no: 17, item: 'Solvent for 75-104', identNo: '77001-00122', category: 'Solvent', prevStock: 0, currIn: 20, currOut: 9, total: 11, amount: 705870 },
    { no: 18, item: 'Solvent for 79-114', identNo: '77001-00157', category: 'Solvent', prevStock: 49, currIn: 0, currOut: 0, total: 49, amount: 2520658 },
    { no: 19, item: 'Solvent for 75-101', identNo: '77001-00160', category: 'Solvent', prevStock: 0, currIn: 10, currOut: 0, total: 10, amount: 705490 },
    { no: 20, item: 'INK - Black', identNo: '70000-00030', category: 'Ink', prevStock: 0, currIn: 47, currOut: 6, total: 41, amount: 5777654 },
    { no: 21, item: 'INK - Black', identNo: '70000-00031', category: 'Ink', prevStock: 0, currIn: 28, currOut: 17, total: 11, amount: 2665046 },
    { no: 22, item: 'INK - Black', identNo: '70000-00101', category: 'Ink', prevStock: 1, currIn: 0, currOut: 0, total: 1, amount: 187328 },
    { no: 23, item: 'INK - Black Temp resist', identNo: '70000-00107', category: 'Ink', prevStock: 1, currIn: 0, currOut: 0, total: 1, amount: 187726 },
    { no: 24, item: 'Ink-black (Aceton)', identNo: '70000-00115', category: 'Ink', prevStock: 0, currIn: 43, currOut: 27, total: 16, amount: 2802790 },
    { no: 25, item: 'Ink - Black (Ethanol)', identNo: '70000-00121', category: 'Ink', prevStock: 16, currIn: 1, currOut: 0, total: 17, amount: 1935678 },
    { no: 26, item: 'INK - Black', identNo: '70000-00134', category: 'Ink', prevStock: 0, currIn: 3, currOut: 1, total: 2, amount: 600096 },
    { no: 27, item: 'Black Halogen free', identNo: '70000-00154', category: 'Ink', prevStock: 1, currIn: 0, currOut: 0, total: 1, amount: 137198 },
    { no: 28, item: 'Black ink 1000℃ resistant', identNo: '70000-00155', category: 'Ink', prevStock: 0, currIn: 2, currOut: 0, total: 2, amount: 1167464 },
    { no: 29, item: 'Black non pi PE adhesive', identNo: '70000-00156', category: 'Ink', prevStock: 2, currIn: 0, currOut: 0, total: 2, amount: 359492 },
    { no: 30, item: 'Black Acetone Halogen free', identNo: '70000-00164', category: 'Ink', prevStock: 2, currIn: 0, currOut: 0, total: 2, amount: 305338 },
    { no: 31, item: 'Ink black for PVC soft pi', identNo: '70000-00165', category: 'Ink', prevStock: 4, currIn: 0, currOut: 0, total: 4, amount: 524860 },
    { no: 32, item: 'INK - Yellow', identNo: '74000-00105', category: 'Ink', prevStock: 0, currIn: 5, currOut: 5, total: 0, amount: 0 },
    { no: 33, item: 'Yellow Pi', identNo: '74000-00111', category: 'Ink', prevStock: 1, currIn: 0, currOut: 0, total: 1, amount: 151594 },
    { no: 34, item: 'Green ink for egg', identNo: '75000-00101', category: 'Ink', prevStock: 0, currIn: 2, currOut: 0, total: 2, amount: 420874 },
    { no: 35, item: 'Green pi', identNo: '75000-00104', category: 'Ink', prevStock: 0, currIn: 6, currOut: 5, total: 1, amount: 320663 },
    { no: 36, item: 'INK - WHITE', identNo: '79000-00104', category: 'Ink', prevStock: 2, currIn: 0, currOut: 0, total: 2, amount: 389724 },
    { no: 37, item: 'INK - WHITE', identNo: '79000-00106', category: 'Ink', prevStock: 1, currIn: 3, currOut: 1, total: 3, amount: 1014927 },
    { no: 38, item: 'INK - WHITE', identNo: '79000-00108', category: 'Ink', prevStock: 3, currIn: 0, currOut: 0, total: 3, amount: 497396 },
    { no: 39, item: 'INK - WHITE Halogen', identNo: '79000-00114', category: 'Ink', prevStock: 9, currIn: 0, currOut: 0, total: 9, amount: 1427435 },
    { no: 40, item: 'White PVC', identNo: '79000-00122', category: 'Ink', prevStock: 0, currIn: 30, currOut: 26, total: 4, amount: 989696 },
  ]

  // 필터링 로직
  const filteredData = stockData.filter(item => {
    const matchesSearch = item.item.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.identNo.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // 총 금액 및 통계 계산
  const grandTotalAmount = stockData.reduce((sum, item) => sum + item.amount, 0)
  const totalItemsCount = stockData.length
  const zeroStockCount = stockData.filter(item => item.total === 0).length

  return (
    <div style={styles.container}>
      {/* 상단 헤더 및 KPI 카드 섹션 */}
      <div style={styles.headerArea}>
        <div>
          <h2 style={styles.title}>📊 법인 결산 재고 자산 대시보드</h2>
          <p style={styles.subtitle}>2025년 기말 잉크 및 솔벤트 재고 자산 현황 요약 및 관리</p>
        </div>
        <button style={styles.excelBtn} onClick={() => alert('엑셀 다운로드 기능 연동 예정')}>
          📥 결산 재고 리스트 다운로드 (.XLSX)
        </button>
      </div>

      <div style={styles.kpiContainer}>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>총 재고 자산 평가액</span>
          <span style={styles.kpiValue}>{grandTotalAmount.toLocaleString()} 원</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>등록된 총 품목 수</span>
          <span style={styles.kpiValueSecondary}>{totalItemsCount} 개</span>
        </div>
        <div style={styles.kpiCard}>
          <span style={styles.kpiLabel}>품절(재고 0) 품목 수</span>
          <span style={{ ...styles.kpiValueSecondary, color: zeroStockCount > 0 ? '#dc2626' : '#059669' }}>
            {zeroStockCount} 개
          </span>
        </div>
      </div>

      {/* 검색 및 필터 탭 */}
      <div style={styles.filterArea}>
        <div style={styles.tabGroup}>
          {['ALL', 'Ink', 'Solvent', 'TAG', 'Etc'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                ...styles.tabBtn,
                backgroundColor: selectedCategory === cat ? '#2563eb' : '#f1f5f9',
                color: selectedCategory === cat ? '#ffffff' : '#475569',
              }}
            >
              {cat === 'ALL' ? '전체 품목' : cat}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="품목명 또는 Ident No. 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchBox}
        />
      </div>

      {/* 모던 데이터 테이블 */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <th style={styles.th}>NO.</th>
              <th style={styles.th}>ITEM</th>
              <th style={styles.th}>IDENT NO.</th>
              <th style={styles.thCenter}>전년 이월재고</th>
              <th style={styles.thCenter}>2025 입고</th>
              <th style={styles.thCenter}>2025 출고</th>
              <th style={styles.thCenter}>현재고 (Total)</th>
              <th style={styles.thRight}>재고금액 (원)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? (
              filteredData.map((row) => (
                <tr key={row.no} style={styles.tdRow}>
                  <td style={styles.tdCenter}>{row.no}</td>
                  <td style={styles.tdBold}>{row.item}</td>
                  <td style={styles.td}>{row.identNo}</td>
                  <td style={styles.tdCenter}>{row.prevStock}</td>
                  <td style={styles.tdCenter}>{row.currIn}</td>
                  <td style={styles.tdCenter}>{row.currOut}</td>
                  <td style={styles.tdCenter}>
                    <span style={{
                      ...styles.stockBadge,
                      backgroundColor: row.total === 0 ? '#fee2e2' : '#f0fdf4',
                      color: row.total === 0 ? '#991b1b' : '#166534'
                    }}>
                      {row.total}
                    </span>
                  </td>
                  <td style={styles.tdRight}>{row.amount.toLocaleString()} 원</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={styles.noData}>검색된 품목이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const styles = {
  container: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '20px' },
  headerArea: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' },
  title: { fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0' },
  subtitle: { fontSize: '13px', color: '#64748b', margin: 0 },
  excelBtn: { backgroundColor: '#059669', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  kpiContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' },
  kpiCard: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px 20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
  kpiLabel: { fontSize: '12px', fontWeight: '600', color: '#64748b' },
  kpiValue: { fontSize: '20px', fontWeight: '800', color: '#1d4ed8' },
  kpiValueSecondary: { fontSize: '20px', fontWeight: '800', color: '#0f172a' },
  filterArea: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  tabGroup: { display: 'flex', gap: '6px' },
  tabBtn: { padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  searchBox: { padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '260px', outline: 'none' },
  tableWrapper: { overflowX: 'auto', maxHeight: '550px', border: '1px solid #e2e8f0', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  thRow: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 1 },
  th: { padding: '12px 16px', color: '#475569', fontWeight: '700', borderBottom: '1px solid #e2e8f0' },
  thCenter: { padding: '12px 16px', color: '#475569', fontWeight: '700', textAlign: 'center', borderBottom: '1px solid #e2e8f0' },
  thRight: { padding: '12px 16px', color: '#475569', fontWeight: '700', textAlign: 'right', borderBottom: '1px solid #e2e8f0' },
  tdRow: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 16px', color: '#334155' },
  tdBold: { padding: '12px 16px', color: '#0f172a', fontWeight: '600' },
  tdCenter: { padding: '12px 16px', color: '#334155', textAlign: 'center' },
  tdRight: { padding: '12px 16px', color: '#0f172a', fontWeight: '700', textAlign: 'right' },
  stockBadge: { padding: '4px 10px', borderRadius: '12px', fontWeight: '700', fontSize: '12px' },
  noData: { padding: '30px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }
}