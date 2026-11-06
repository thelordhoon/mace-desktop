import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function ServiceManagement() {
  const [services, setServices] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [periodFilter, setPeriodFilter] = useState('all') // 'all', '3months', '1year'
  
  const [selectedService, setSelectedService] = useState(null)
  const [recentHistory, setRecentHistory] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [editForm, setEditForm] = useState({
    serial_no: '',
    as_content: '',
    work_completed_date: '',
    statement_date: '',
    tax_invoice_date: '',
    status: '시스템 처리중',
    note: ''
  })

  useEffect(() => {
    fetchServiceRecords()
  }, [])

  const fetchServiceRecords = async () => {
    const { data, error } = await supabase
      .from('service_management')
      .select('*')
      .order('work_date', { ascending: false })

    if (!error && data) {
      setServices(data)
    }
  }

  const handleOpenDetailModal = async (item) => {
    setSelectedService(item)
    setRecentHistory(null)

    setEditForm({
      serial_no: item.serial_no || '',
      as_content: item.as_content || '',
      work_completed_date: item.work_completed_date || '',
      statement_date: item.statement_date || '',
      tax_invoice_date: item.tax_invoice_date || '',
      status: item.status === '처리완료' ? '계산서 발행완료' : (item.status || '시스템 처리중'),
      note: item.note || ''
    })

    if (item.company_id || item.company_name) {
      let query = supabase
        .from('service_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)

      if (item.company_id) {
        query = query.eq('company_id', item.company_id)
      } else {
        query = query.eq('company_name', item.company_name)
      }

      const { data } = await query
      if (data && data.length > 0) {
        setRecentHistory(data[0])
      }
    }

    setIsModalOpen(true)
  }

  // 💡 최근 서비스 이력 클릭 시 기술부 입력란에 자동 반영하는 함수
  const handleApplyRecentHistory = () => {
    if (!recentHistory) return

    setEditForm(prev => ({
      ...prev,
      serial_no: recentHistory.sn || prev.serial_no,
      work_completed_date: recentHistory.work_date || recentHistory.created_at?.substring(0, 10) || prev.work_completed_date,
      as_content: recentHistory.work_content || recentHistory.as_content || prev.as_content
    }))

    alert('최근 서비스 이력 내용이 기술부 입력 항목에 적용되었습니다.')
  }

  const handleSaveDetail = async () => {
    if (!selectedService) return
    setIsSaving(true)

    const payload = {
      serial_no: editForm.serial_no,
      as_content: editForm.as_content,
      work_completed_date: editForm.work_completed_date.trim() === '' ? null : editForm.work_completed_date,
      statement_date: editForm.statement_date.trim() === '' ? null : editForm.statement_date,
      tax_invoice_date: editForm.tax_invoice_date.trim() === '' ? null : editForm.tax_invoice_date,
      status: editForm.status,
      note: editForm.note
    }

    const { error } = await supabase
      .from('service_management')
      .update(payload)
      .eq('id', selectedService.id)

    setIsSaving(false)

    if (error) {
      alert('저장 실패: ' + error.message)
    } else {
      alert('기술 서비스 관리 내역이 수정되었습니다.')
      setIsModalOpen(false)
      fetchServiceRecords()
    }
  }

  const handleDeleteRecord = async (id, e) => {
    if (e) e.stopPropagation()
    if (!window.confirm('해당 기술 서비스 이력을 삭제하시겠습니까?')) return

    const { error } = await supabase.from('service_management').delete().eq('id', id)
    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      alert('삭제되었습니다.')
      if (selectedService?.id === id) setIsModalOpen(false)
      fetchServiceRecords()
    }
  }

  const filteredServices = services.filter(s => {
    const matchesSearch = 
      (s.company_name && s.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.serial_no && s.serial_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.writer && s.writer.toLowerCase().includes(searchTerm.toLowerCase()))

    if (!matchesSearch) return false
    if (periodFilter === 'all') return true

    if (s.work_date) {
      const workDate = new Date(s.work_date)
      const now = new Date()
      const diffMonths = (now.getFullYear() - workDate.getFullYear()) * 12 + (now.getMonth() - workDate.getMonth())

      if (periodFilter === '3months') {
        return diffMonths <= 3 && workDate <= now
      } else if (periodFilter === '1year') {
        return diffMonths <= 12 && workDate <= now
      }
    }
    return true
  })

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const getStatusBadge = (status) => {
    if (status === '계산서 발행완료' || status === '처리완료') {
      return <span style={{ padding: '4px 10px', backgroundColor: '#DCFCE7', color: '#166534', borderRadius: '4px', fontWeight: '700', fontSize: '12px' }}>계산서 발행완료</span>
    } else if (status === '미발행') {
      return <span style={{ padding: '4px 10px', backgroundColor: '#F1F5F9', color: '#475569', borderRadius: '4px', fontWeight: '700', fontSize: '12px' }}>미발행</span>
    }
    return <span style={{ padding: '4px 10px', backgroundColor: '#FEF3C7', color: '#92400E', borderRadius: '4px', fontWeight: '700', fontSize: '12px' }}>시스템 처리중</span>
  }

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>
      
      {/* 상단 헤더 및 필터 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '20px', border: '1px solid #CBD5E1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
          발행된 기술 서비스 및 견적 이력 목록 ({filteredServices.length}건)
        </h3>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '3px', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
            <button 
              onClick={() => setPeriodFilter('all')}
              style={{ padding: '6px 12px', background: periodFilter === 'all' ? '#2563EB' : 'transparent', color: periodFilter === 'all' ? '#FFF' : '#475569', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
            >
              전체
            </button>
            <button 
              onClick={() => setPeriodFilter('3months')}
              style={{ padding: '6px 12px', background: periodFilter === '3months' ? '#2563EB' : 'transparent', color: periodFilter === '3months' ? '#FFF' : '#475569', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
            >
              최근 3개월
            </button>
            <button 
              onClick={() => setPeriodFilter('1year')}
              style={{ padding: '6px 12px', background: periodFilter === '1year' ? '#2563EB' : 'transparent', color: periodFilter === '1year' ? '#FFF' : '#475569', border: 'none', borderRadius: '4px', fontWeight: '700', fontSize: '12px', cursor: 'pointer' }}
            >
              최근 1년
            </button>
          </div>

          <input 
            type="text" 
            placeholder="업체명 또는 S/N 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, width: '200px' }}
          />
        </div>
      </div>

      {/* 목록 테이블 */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#64748B', color: '#FFFFFF', borderBottom: '1px solid #475569' }}>
              <th style={{ padding: '12px 14px', width: '100px' }}>작업일자</th>
              <th style={{ padding: '12px 14px', width: '140px' }}>공급받는 자 (업체명)</th>
              <th style={{ padding: '12px 14px', width: '100px' }}>장비 S/N</th>
              <th style={{ padding: '12px 14px', width: '310px' }}>견적 품목</th>
              <th style={{ padding: '12px 14px', width: '110px', textAlign: 'center' }}>작업완료일자</th>
              <th style={{ padding: '12px 14px', width: '90px' }}>비고</th>
              <th style={{ padding: '12px 14px', width: '130px', textAlign: 'right' }}>견적 금액</th>
              <th style={{ padding: '12px 14px', width: '70px', textAlign: 'center' }}>작성자</th>
              <th style={{ padding: '12px 14px', width: '115px', textAlign: 'center' }}>관리부 상태</th>
              <th style={{ padding: '12px 14px', width: '150px', textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredServices.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  등록되었거나 조건에 맞는 기술 서비스 이력이 없습니다.
                </td>
              </tr>
            ) : (
              filteredServices.map((item, idx) => {
                let partsArray = []
                try {
                  const pArr = typeof item.parts_data === 'string' ? JSON.parse(item.parts_data) : item.parts_data
                  if (Array.isArray(pArr)) partsArray = pArr
                } catch (e) {}

                const totalAmt = Number(item.total_amount || 0)
                const supplyPrice = Math.round(totalAmt / 1.1)

                return (
                  <tr 
                    key={item.id} 
                    style={{ 
                      borderBottom: '1px solid #E2E8F0', 
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleOpenDetailModal(item)}
                  >
                    <td style={{ padding: '12px 14px', color: '#475569', fontWeight: '500' }}>
                      {item.work_date || '-'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: '700', color: '#2563EB' }}>
                      {item.company_name}
                    </td>
                    <td style={{ padding: '12px 14px', color: item.serial_no ? '#0284C7' : '#94A3B8', fontWeight: '700', fontFamily: 'monospace' }}>
                      {item.serial_no || '미입력'}
                    </td>
                    
                    <td style={{ padding: '12px 14px', color: '#334155', lineHeight: '1.6' }}>
                      {partsArray.length > 0 ? (
                        partsArray.map((p, pIdx) => (
                          <div key={pIdx} style={{ fontSize: '12px', color: '#0F172A', fontWeight: '500' }}>
                            • {p.name} {p.code ? <span style={{ color: '#0284C7', fontWeight: '600' }}>({p.code})</span> : ''} <span style={{ color: '#2563EB', fontWeight: 'bold' }}>({p.qty}개)</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: '#64748B' }}>{item.as_content || '견적 내역'}</div>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', textAlign: 'center', color: item.work_completed_date ? '#0F172A' : '#94A3B8', fontWeight: '500' }}>
                      {item.work_completed_date || '-'}
                    </td>

                    <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                      {item.note || '-'}
                    </td>

                    <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0F172A', textAlign: 'right' }}>
                      ₩ {supplyPrice.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569' }}>
                      {item.writer || '-'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {getStatusBadge(item.status)}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button 
                          onClick={() => handleOpenDetailModal(item)}
                          style={{ padding: '5px 10px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
                        >
                          상세/수정
                        </button>
                        <button 
                          onClick={(e) => handleDeleteRecord(item.id, e)}
                          style={{ padding: '5px 10px', background: '#FEE2E2', color: '#EF4444', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: 'pointer', fontSize: '12px' }}
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

      {/* 상세 정보 및 수정 모달 */}
      {isModalOpen && selectedService && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '800px',
            maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                서비스 관리 상세 - {selectedService.company_name}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '20px', color: '#64748B', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><b>작성자:</b> {selectedService.writer}</div>
                <div><b>업체 담당자:</b> {selectedService.manager_name || '-'}</div>
                <div><b>연락처:</b> {selectedService.manager_phone || '-'}</div>
                <div><b>견적 발송일:</b> {selectedService.estimate_sent_date || '-'}</div>
                <div style={{ gridColumn: 'span 2' }}>
                  <b>견적 금액 (VAT 제외):</b> <span style={{ color: '#2563EB', fontWeight: 'bold' }}>₩ {Math.round(Number(selectedService.total_amount || 0) / 1.1).toLocaleString()} 원</span>
                </div>
              </div>

              {/* 💡 최근 서비스 이력 카드 (클릭 시 기술부 폼에 자동 입력) */}
              <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '14px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <b style={{ color: '#0369A1', fontSize: '14px' }}>
                    🕒 최근 서비스 이력 (직전 1건)
                  </b>
                  {recentHistory && (
                    <button
                      onClick={handleApplyRecentHistory}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        fontWeight: '700',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      ✨ 기술부 입력란에 자동 채우기
                    </button>
                  )}
                </div>

                {recentHistory ? (
                  <div 
                    onClick={handleApplyRecentHistory}
                    title="클릭하면 아래 기술부 입력 항목에 내용이 자동으로 채워집니다."
                    style={{ 
                      backgroundColor: '#FFFFFF', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #E0F2FE', 
                      fontSize: '12px', 
                      lineHeight: '1.6',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold', color: '#0284C7' }}>
                      <span>일자: {recentHistory.work_date || recentHistory.created_at?.substring(0, 10)}</span>
                      <span>S/N: {recentHistory.sn || '미입력'}</span>
                    </div>
                    <div><b>작업내용:</b> {recentHistory.work_content || recentHistory.as_content || '-'}</div>
                    {recentHistory.replaced_parts && (
                      <div style={{ color: '#475569' }}><b>교체 파트:</b> {recentHistory.replaced_parts}</div>
                    )}
                    <div style={{ marginTop: '6px', fontSize: '11px', color: '#0284C7', textAlign: 'right', fontWeight: '600' }}>
                      👉 클릭하여 이 내용 적용하기
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#94A3B8', fontSize: '12px', textAlign: 'center', padding: '8px 0' }}>
                    조회된 이전 서비스 이력이 없습니다.
                  </div>
                )}
              </div>

              {/* 견적 품목 및 규격 내역 테이블 */}
              <div style={{ backgroundColor: '#F1F5F9', padding: '14px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '13px' }}>
                <b style={{ display: 'block', marginBottom: '10px', color: '#0F172A' }}>📋 견적 품목 및 규격 내역</b>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF', borderRadius: '6px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#E2E8F0', color: '#1E293B', fontSize: '12px', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #CBD5E1' }}>품명 / 규격명 (코드)</th>
                      <th style={{ padding: '8px 14px', borderBottom: '1px solid #CBD5E1', width: '80px', textAlign: 'right' }}>수량</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #CBD5E1', width: '110px', textAlign: 'right' }}>단가</th>
                      <th style={{ padding: '8px 10px', borderBottom: '1px solid #CBD5E1', width: '120px', textAlign: 'right' }}>합계금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      try {
                        const pArr = typeof selectedService.parts_data === 'string' ? JSON.parse(selectedService.parts_data) : selectedService.parts_data
                        if (Array.isArray(pArr) && pArr.length > 0) {
                          return pArr.map((p, pIdx) => {
                            const pQty = Number(p.qty || 1)
                            const pPrice = Number(p.price || 0)
                            const pAmount = p.amount ? Number(p.amount) : (pQty * pPrice)

                            return (
                              <tr key={pIdx} style={{ borderBottom: '1px solid #E2E8F0', fontSize: '12px' }}>
                                <td style={{ padding: '8px 10px', color: '#0F172A', fontWeight: '500' }}>
                                  {p.name} <span style={{ color: '#64748B', fontSize: '11px' }}>({p.code || '코드없음'})</span>
                                </td>
                                <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 'bold', color: '#2563EB' }}>
                                  {pQty}개
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155' }}>
                                  ₩ {pPrice.toLocaleString()}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#0F172A' }}>
                                  ₩ {pAmount.toLocaleString()}
                                </td>
                              </tr>
                            )
                          })
                        }
                      } catch (e) {}
                      return (
                        <tr>
                          <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748B' }}>
                            등록된 품목 상세 내역이 없습니다.
                          </td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>

              {/* 기술부 섹션 */}
              <div style={{ border: '1px solid #BFDBFE', backgroundColor: '#EFF6FF', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#1E40AF', fontSize: '14px', fontWeight: '700' }}>🛠️ 기술부 입력 항목</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>장비 Serial No.</label>
                    <input 
                      type="text" 
                      value={editForm.serial_no} 
                      onChange={(e) => setEditForm({ ...editForm, serial_no: e.target.value })}
                      placeholder="Serial No. 입력"
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>작업 완료일</label>
                    <input 
                      type="date" 
                      value={editForm.work_completed_date} 
                      onChange={(e) => setEditForm({ ...editForm, work_completed_date: e.target.value })}
                      style={inputStyle} 
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>A/S 내용</label>
                  <input 
                    type="text" 
                    value={editForm.as_content} 
                    onChange={(e) => setEditForm({ ...editForm, as_content: e.target.value })}
                    placeholder="A/S 작업 내용 입력"
                    style={inputStyle} 
                  />
                </div>
              </div>

              {/* 관리부 섹션 */}
              <div style={{ border: '1px solid #FBCFE8', backgroundColor: '#FDF2F8', borderRadius: '8px', padding: '16px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#9D174D', fontSize: '14px', fontWeight: '700' }}>🏢 관리부 처리 항목</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>거래명세서 발행일</label>
                    <input 
                      type="date" 
                      value={editForm.statement_date} 
                      onChange={(e) => setEditForm({ ...editForm, statement_date: e.target.value })}
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>세금계산서 발행일</label>
                    <input 
                      type="date" 
                      value={editForm.tax_invoice_date} 
                      onChange={(e) => setEditForm({ ...editForm, tax_invoice_date: e.target.value })}
                      style={inputStyle} 
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>처리 여부</label>
                    <select 
                      value={editForm.status} 
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      style={{ ...inputStyle, fontWeight: 'bold' }}
                    >
                      <option value="시스템 처리중">시스템 처리중</option>
                      <option value="계산서 발행완료">계산서 발행완료</option>
                      <option value="미발행">미발행</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 비고 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>비고 사항</label>
                <textarea 
                  rows="3" 
                  value={editForm.note} 
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="특이사항 입력"
                  style={inputStyle} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  style={{ padding: '10px 18px', background: '#64748B', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveDetail} 
                  disabled={isSaving}
                  style={{ padding: '10px 20px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}
                >
                  {isSaving ? '저장 중...' : '저장 완료'}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  )
}