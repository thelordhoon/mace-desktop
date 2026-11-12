import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

export default function DeliveryHistoryTab() {
  const [historyList, setHistoryList] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL') // 'ALL' | 'INBOUND' | 'OUTBOUND'

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box'
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('delivery_history')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      
      if (!error) {
        setHistoryList(data || [])
      }
    } catch (e) {
      console.error('이력 조회 오류:', e)
    }
  }

  const handleDeleteHistory = async (id) => {
    if (!window.confirm('해당 발행 이력을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('delivery_history').delete().eq('id', id)
    if (!error) {
      fetchHistory()
    } else {
      alert('삭제 실패: ' + error.message)
    }
  }

  // 안전한 필터링 처리
  const safeHistoryList = Array.isArray(historyList) ? historyList : []
  const filteredHistory = safeHistoryList.filter(item => {
    if (!item) return false
    const matchesType = filterType === 'ALL' || item.type === filterType
    const s = (searchTerm || '').toLowerCase()
    const matchSearch = !searchTerm.trim() || 
      (item.company_name && item.company_name.toLowerCase().includes(s)) ||
      (item.summary && item.summary.toLowerCase().includes(s)) ||
      (item.author && item.author.toLowerCase().includes(s)) ||
      (item.equipment_sn && item.equipment_sn.toLowerCase().includes(s))

    return matchesType && matchSearch
  })

  return (
    <div>
      {/* 상단 검색 및 필터 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="🔍 업체명, 품목 요약, 작성자, S/N 검색..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          style={{ ...inputStyle, padding: '12px', maxWidth: '380px', margin: 0 }} 
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          <button 
            type="button" 
            onClick={() => setFilterType('ALL')} 
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: filterType === 'ALL' ? '#2563EB' : '#fff', color: filterType === 'ALL' ? '#fff' : '#475569', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
          >
            전체 보기
          </button>
          <button 
            type="button" 
            onClick={() => setFilterType('INBOUND')} 
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: filterType === 'INBOUND' ? '#059669' : '#fff', color: filterType === 'INBOUND' ? '#fff' : '#475569', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
          >
            📥 입고 이력
          </button>
          <button 
            type="button" 
            onClick={() => setFilterType('OUTBOUND')} 
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #CBD5E1', background: filterType === 'OUTBOUND' ? '#D97706' : '#fff', color: filterType === 'OUTBOUND' ? '#fff' : '#475569', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
          >
            📤 출고 이력
          </button>
        </div>
      </div>

      {/* 이력 테이블 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '90px' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '120px' }}>발행일</th>
              <th style={{ padding: '14px 16px', width: '180px' }}>거래처 / 입고처</th>
              <th style={{ padding: '14px 16px', width: '280px' }}>품목 명세 요약</th>
              <th style={{ padding: '14px 16px', width: '110px' }}>작성자</th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '50px', textAlign: 'center', color: '#94A3B8' }}>
                  등록된 발행 이력이 없습니다.
                </td>
              </tr>
            ) : (
              filteredHistory.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 8px', backgroundColor: item.type === 'INBOUND' ? '#DEF7EC' : '#FEF3C7', color: item.type === 'INBOUND' ? '#03543F' : '#92400E', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                      {item.type === 'INBOUND' ? '📥 입고' : '📤 출고'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: '#334155' }}>{item.date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{item.company_name}</td>
                  <td style={{ padding: '12px 16px', color: '#475569', wordBreak: 'break-all' }}>{item.summary}</td>
                  <td style={{ padding: '12px 16px', color: '#64748B' }}>{item.author}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteHistory(item.id)} 
                      style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}