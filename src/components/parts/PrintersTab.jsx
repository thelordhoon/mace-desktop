import React, { useState } from 'react'

export default function PrintersTab({ partsList, refreshParts, showAddForm, setShowAddForm }) {
  const [searchTerm, setSearchTerm] = useState('')
  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }

  const filteredParts = partsList.filter(p => {
    const cat = p.category || ''
    const isPrinter = cat === '프린터' || cat === '라이너'
    return isPrinter && (!searchTerm.trim() || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase()))
  })

  return (
    <div>
      <input type="text" placeholder="🔍 프린터 장비 검색..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '360px', marginBottom: '16px' }} />
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px' }}>구분</th>
              <th style={{ padding: '14px' }}>장비 코드</th>
              <th style={{ padding: '14px' }}>품명</th>
              <th style={{ padding: '14px' }}>보유 수량</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px' }}>{p.category}</td>
                <td style={{ padding: '12px', fontWeight: '600' }}>{p.code}</td>
                <td style={{ padding: '12px', fontWeight: '700' }}>{p.name}</td>
                <td style={{ padding: '12px', fontWeight: '800', color: '#2563EB' }}>{p.stock ?? 0} 대</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}