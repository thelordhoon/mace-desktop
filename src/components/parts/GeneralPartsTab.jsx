import React, { useState } from 'react'

export default function GeneralPartsTab({ partsList, refreshParts, showAddForm, setShowAddForm }) {
  const [searchTerm, setSearchTerm] = useState('')
  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }

  const filteredParts = partsList.filter(p => {
    const cat = p.category || '일반부품'
    const isConsumableOrPrinter = cat === '잉크' || cat === '희석제' || cat === '소모품' || cat === '프린터' || cat === '라이너'
    return !isConsumableOrPrinter && (!searchTerm.trim() || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase()))
  })

  return (
    <div>
      <input type="text" placeholder="🔍 일반부품 품명 또는 코드 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '360px', marginBottom: '16px' }} />
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px' }}>구분</th>
              <th style={{ padding: '14px' }}>코드</th>
              <th style={{ padding: '14px' }}>품명</th>
              <th style={{ padding: '14px' }}>재고 수량</th>
              <th style={{ padding: '14px' }}>소비자가</th>
              <th style={{ padding: '14px' }}>딜러가</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px' }}>{p.category}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>{p.code}</td>
                <td style={{ padding: '12px', fontWeight: '700' }}>{p.name}</td>
                <td style={{ padding: '12px' }}>{p.stock ?? 0} 개</td>
                <td style={{ padding: '12px', color: '#2563EB', fontWeight: '700' }}>{Number(p.customer_price || 0).toLocaleString()} 원</td>
                <td style={{ padding: '12px', fontWeight: '700' }}>{Number(p.dealer_price || 0).toLocaleString()} 원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}