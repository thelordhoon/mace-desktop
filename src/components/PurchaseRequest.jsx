import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function PurchaseRequest({ user, isAdmin, onUpdateRequests }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 💡 로그인한 사용자 이름을 자동으로 가져오기 (기본값: 배진철)
  const currentUserName = user?.author || user?.full_name || user?.username || '배진철'

  const [items, setItems] = useState([
    { item_name: '', quantity: 1, unit: 'EA', unit_price: '', purpose: '', site_url: '' }
  ])

  useEffect(() => {
    fetchPurchaseRequests()
  }, [])

  const fetchPurchaseRequests = async () => {
    setLoading(true)
    try {
      const { data: reqData, error: reqError } = await supabase
        .from('purchase_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (reqError) throw reqError

      if (!reqData || reqData.length === 0) {
        setRequests([])
        setLoading(false)
        if (onUpdateRequests) onUpdateRequests([])
        return
      }

      const reqIds = reqData.map(r => r.id)
      const { data: itemData, error: itemError } = await supabase
        .from('purchase_request_items')
        .select('*')
        .in('request_id', reqIds)

      if (itemError) throw itemError

      const combined = reqData.map(req => ({
        ...req,
        items: itemData.filter(item => item.request_id === req.id)
      }))

      setRequests(combined)
      if (onUpdateRequests) onUpdateRequests(combined)
    } catch (error) {
      console.error('구매요청 조회 오류:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItemRow = () => {
    setItems([
      ...items,
      { item_name: '', quantity: 1, unit: 'EA', unit_price: '', purpose: '', site_url: '' }
    ])
  }

  const handleRemoveItemRow = (index) => {
    if (items.length === 1) {
      alert('최소 1개의 품목은 입력해야 합니다.')
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...items]
    newItems[index][field] = value
    setItems(newItems)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    for (let i = 0; i < items.length; i++) {
      if (!items[i].item_name.trim()) {
        alert(`${i + 1}번째 품목명을 입력해주세요.`)
        return
      }
    }

    setSubmitting(true)

    try {
      const today = new Date().toISOString().split('T')[0]

      const { data: reqInsertData, error: reqInsertError } = await supabase
        .from('purchase_requests')
        .insert([
          {
            requester_id: String(user?.id || currentUserName),
            requester_name: currentUserName, // 💡 로그인한 사람의 이름이 자동으로 요청자로 등록됨
            request_date: today,
            status: 'requested'
          }
        ])
        .select()

      if (reqInsertError) throw reqInsertError

      const newRequestId = reqInsertData[0].id

      const itemsToInsert = items.map(item => ({
        request_id: newRequestId,
        item_name: item.item_name,
        specification: item.purpose.trim() || null,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit || 'EA',
        unit_price: parseFloat(item.unit_price) || 0,
        site_url: item.site_url.trim() || null
      }))

      const { error: itemInsertError } = await supabase
        .from('purchase_request_items')
        .insert(itemsToInsert)

      if (itemInsertError) throw itemInsertError

      alert('구매요청이 성공적으로 등록되었습니다.')
      setItems([{ item_name: '', quantity: 1, unit: 'EA', unit_price: '', purpose: '', site_url: '' }])
      fetchPurchaseRequests()
    } catch (error) {
      console.error('구매요청 등록 오류:', error.message)
      alert('구매요청 등록 중 오류가 발생했습니다: ' + error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (reqId, newStatus) => {
    const confirmMsg = newStatus === 'purchased' 
      ? '구매완료(배송중) 상태로 변경하시겠습니까?' 
      : `"${currentUserName}" 님 명의로 수령완료 처리하시겠습니까?`

    if (!window.confirm(confirmMsg)) return

    try {
      const now = new Date().toISOString()
      let updatePayload = { status: newStatus }

      if (newStatus === 'purchased') {
        updatePayload.paid_at = now
        updatePayload.paid_by = currentUserName
      } else if (newStatus === 'received') {
        updatePayload.received_at = now
        updatePayload.received_by = currentUserName
        updatePayload.recipient_name = currentUserName
      }

      const { error } = await supabase
        .from('purchase_requests')
        .update(updatePayload)
        .eq('id', reqId)

      if (error) throw error

      fetchPurchaseRequests()
    } catch (error) {
      console.error('상태 업데이트 오류:', error.message)
      alert('상태 변경 중 오류가 발생했습니다: ' + error.message)
    }
  }

  const handleDeleteRequest = async (reqId) => {
    if (!window.confirm(`구매요청 #${reqId} 내역을 삭제하시겠습니까?`)) return

    try {
      const { error: itemErr } = await supabase
        .from('purchase_request_items')
        .delete()
        .eq('request_id', reqId)

      if (itemErr) throw itemErr

      const { error: reqErr } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('id', reqId)

      if (reqErr) throw reqErr

      alert('구매요청 내역이 삭제되었습니다.')
      fetchPurchaseRequests()
    } catch (error) {
      console.error('구매요청 삭제 오류:', error.message)
      alert('삭제 중 오류가 발생했습니다: ' + error.message)
    }
  }

  const formTotalAmount = items.reduce((sum, item) => {
    return sum + ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))
  }, 0)

  const getStatusBadge = (status) => {
    switch (status) {
      case 'purchased':
        return { label: '구매완료 (배송중)', bg: '#fef3c7', color: '#d97706', border: '#fde68a' }
      case 'received':
        return { label: '수령완료', bg: '#dcfce7', color: '#15803d', border: '#bbf7d0' }
      case 'requested':
      default:
        return { label: '구매요청', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 페이지 타이틀 */}
      <div>
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>구매요청</h2>
        <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>필요한 자재 및 부품을 등록하고 구매/배송 진행 상태를 확인할 수 있습니다.</p>
      </div>

      {/* 신규 구매요청 등록 카드 */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px 0' }}>신규 구매요청</h3>
            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
              요청자: <strong style={{ color: '#0f172a' }}>{currentUserName}</strong>
            </div>
          </div>
          <button 
            type="button" 
            onClick={handleAddItemRow}
            style={{ padding: '7px 14px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            + 품목 추가
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map((item, index) => {
            const rowAmount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)

            return (
              <div key={index} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                
                <div style={{ flex: '1.8', minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>품목명 *</label>
                  <input 
                    type="text" 
                    placeholder="구매할 품목명 입력" 
                    value={item.item_name}
                    onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <div style={{ width: '75px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>수량</label>
                  <input 
                    type="number" 
                    placeholder="수량" 
                    value={item.quantity}
                    min="1"
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ width: '65px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>단위</label>
                  <input 
                    type="text" 
                    placeholder="EA" 
                    value={item.unit}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>단가 (원)</label>
                  <input 
                    type="number" 
                    placeholder="단가 입력" 
                    value={item.unit_price}
                    min="0"
                    onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ width: '110px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>예상 금액</label>
                  <div style={{ padding: '8px 10px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', fontWeight: '700', color: '#0f172a', textAlign: 'right' }}>
                    {rowAmount.toLocaleString()}원
                  </div>
                </div>

                <div style={{ flex: '1.8', minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>사용처 (구입 목적)</label>
                  <input 
                    type="text" 
                    placeholder="예: 사무실 비품, 부자재" 
                    value={item.purpose}
                    onChange={(e) => handleItemChange(index, 'purpose', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ flex: '1.8', minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>구매처 링크 (URL)</label>
                  <input 
                    type="text" 
                    placeholder="https://..." 
                    value={item.site_url}
                    onChange={(e) => handleItemChange(index, 'site_url', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>

                <button 
                  type="button" 
                  onClick={() => handleRemoveItemRow(index)}
                  style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  삭제
                </button>
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '14px', color: '#334155' }}>
              총 요청 예상 금액: <strong style={{ fontSize: '16px', color: '#2563eb' }}>{formTotalAmount.toLocaleString()}원</strong>
            </div>
            <button 
              type="submit"
              disabled={submitting}
              style={{ padding: '10px 24px', backgroundColor: submitting ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? '등록 중...' : '구매요청 등록'}
            </button>
          </div>
        </form>
      </div>

      {/* 전체 구매요청 내역 섹션 */}
      <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', margin: '0 0 16px 0' }}>전체 구매요청 내역</h3>

        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>불러오는 중...</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>등록된 구매요청 내역이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {requests.map((req) => {
              const totalAmount = req.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
              const badge = getStatusBadge(req.status)
              
              return (
                <div key={req.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  {/* 요청 카드 헤더 & 상태 / 액션 버튼 영역 */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>구매요청 #{req.id}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        요청일: {req.request_date} · 요청자: <strong>{req.requester_name}</strong>
                      </span>
                      {req.paid_by && (
                        <span style={{ fontSize: '11px', color: '#d97706', backgroundColor: '#fffbeb', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          구매처리: {req.paid_by} ({req.paid_at?.split('T')[0]})
                        </span>
                      )}
                      {req.recipient_name && (
                        <span style={{ fontSize: '11px', color: '#15803d', backgroundColor: '#f0fdf4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                          수령확인: {req.recipient_name} ({req.received_at?.split('T')[0]})
                        </span>
                      )}
                    </div>

                    {/* 상태 배지 및 단계별 액션 버튼 + 삭제 버튼 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        fontSize: '12px', 
                        fontWeight: '700', 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`
                      }}>
                        {badge.label}
                      </span>

                      {/* 💡 배진철, 이현희, 김우연 누구나 '구매완료 처리' 가능하도록 허용 */}
                      {req.status === 'requested' && ['배진철', '이현희', '김우연'].includes(currentUserName) && (
                        <button
                          onClick={() => handleStatusChange(req.id, 'purchased')}
                          style={{ padding: '5px 12px', backgroundColor: '#f59e0b', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          구매완료 처리
                        </button>
                      )}

                      {req.status === 'purchased' && (
                        <button
                          onClick={() => handleStatusChange(req.id, 'received')}
                          style={{ padding: '5px 12px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          수령완료 ({currentUserName})
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteRequest(req.id)}
                        style={{ padding: '5px 10px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        내역 삭제
                      </button>
                    </div>
                  </div>

                  {/* 품목 테이블 (고정 너비 tableLayout 적용으로 정렬 라인 일치) */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px', tableLayout: 'fixed' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', backgroundColor: '#ffffff' }}>
                          <th style={{ padding: '10px 16px', fontWeight: '600', width: '25%' }}>품목명</th>
                          <th style={{ padding: '10px 16px', fontWeight: '600', width: '10%' }}>수량</th>
                          <th style={{ padding: '10px 16px', fontWeight: '600', width: '12%' }}>단가</th>
                          <th style={{ padding: '10px 16px', fontWeight: '600', width: '13%' }}>금액</th>
                          <th style={{ padding: '10px 16px', fontWeight: '600', width: '20%' }}>사용처 (구입 목적)</th>
                          <th style={{ padding: '10px 16px', fontWeight: '600', width: '20%' }}>구매처 링크</th>
                        </tr>
                      </thead>
                      <tbody>
                        {req.items.map((item, idx) => {
                          const itemTotal = item.quantity * item.unit_price
                          const validUrl = item.site_url 
                            ? (item.site_url.startsWith('http') ? item.site_url : `https://${item.site_url}`) 
                            : null

                          return (
                            <tr key={idx} style={{ borderBottom: idx < req.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '600', wordBreak: 'break-all' }}>{item.item_name}</td>
                              <td style={{ padding: '12px 16px', color: '#475569' }}>{item.quantity} {item.unit}</td>
                              <td style={{ padding: '12px 16px', color: '#475569' }}>{item.unit_price ? `${item.unit_price.toLocaleString()}원` : '0원'}</td>
                              <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '600' }}>{itemTotal ? `${itemTotal.toLocaleString()}원` : '0원'}</td>
                              <td style={{ padding: '12px 16px', color: '#334155', wordBreak: 'break-all' }}>{item.specification || '-'}</td>
                              <td style={{ padding: '12px 16px', wordBreak: 'break-all' }}>
                                {validUrl ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#64748b', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                      {item.site_url}
                                    </span>
                                    <a 
                                      href={validUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      style={{ padding: '4px 8px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '4px', textDecoration: 'none', fontWeight: '600', fontSize: '11px', whiteSpace: 'nowrap' }}
                                    >
                                      바로가기 ↗
                                    </a>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>등록된 링크 없음</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 합계 영역 */}
                  <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>합계:</span>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>{totalAmount.toLocaleString()}원</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}