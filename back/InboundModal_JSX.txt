import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function InboundModal({ partsList, author, onClose, refreshParts }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    author: author || '배진철',
    items: [{ code: '', name: '', category: '일반부품', qty: 1, po_number: '', lot_number: '', expiry: '', unit_price: '' }],
    note: ''
  })

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px', display: 'block' }

  const handleSave = async (e) => {
    e.preventDefault()
    let summaryParts = []

    for (const item of form.items) {
      if (!item.code && !item.name) continue
      const cleanCode = item.code?.trim().toLowerCase()
      const matched = partsList.find(p => p.code && p.code.trim().toLowerCase() === cleanCode)
      const qtyNum = Number(item.qty || 1)
      const priceNum = Number(item.unit_price || 0)
      const poNum = item.po_number?.trim() || `PO-${Date.now().toString().slice(-6)}`

      if (matched) {
        // 1. 카테고리 불문하고 모든 입고 품목을 part_stock_lots 테이블에 P.O. 로트 단위로 INSERT
        const { error: lotError } = await supabase.from('part_stock_lots').insert([{
          part_id: matched.id,
          po_number: poNum,
          import_date: form.date,
          expiry_date: item.expiry || null,
          unit_price: priceNum,
          initial_qty: qtyNum,
          current_qty: qtyNum
        }])
        if (lotError) {
          console.error('로트 입고 등록 실패:', lotError.message)
        }

        // 2. 기존 호환성 및 기존 로트 관리 구조(JSON) 유지를 위한 parts 테이블 업데이트
        let currentLots = []
        try { currentLots = matched.lots ? JSON.parse(matched.lots) : [] } catch (e) {}
        currentLots.push({ 
          po_number: poNum, 
          lot_number: item.lot_number || '', 
          received_date: form.date, 
          expiry: item.expiry || '', 
          qty: qtyNum, 
          unit_price: priceNum 
        })

        const newStock = currentLots.reduce((s, l) => s + Number(l.qty || 0), 0)
        await supabase.from('parts').update({ stock: newStock, lots: JSON.stringify(currentLots) }).eq('id', matched.id)
      }
      summaryParts.push(`${item.name || item.code} (${qtyNum}개 / P.O: ${poNum} / 단가: ${priceNum.toLocaleString()}원)`)
    }

    // 3. 입고 이력 기록 (delivery_history)
    await supabase.from('delivery_history').insert([{
      date: form.date, 
      company_name: '본사 창고 (입고)', 
      equipment_sn: '입고 (INBOUND)',
      summary: summaryParts.join(', '), 
      author: form.author, 
      note: form.note, 
      type: 'INBOUND'
    }])

    alert('입고증 발행 및 P.O. 로트별 단가 등록이 완료되었습니다.')
    onClose(); refreshParts()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '800', color: '#0F172A' }}>📥 입고증 작성 (P.O. 및 단가 등록)</h3>
        
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>입고일</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>작성자</label>
              <input type="text" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
            <label style={{ ...labelStyle, fontSize: '13px', fontWeight: '800', color: '#1E293B', marginBottom: '8px' }}>입고 품목 상세</label>
            {form.items.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr 1.2fr 1fr 0.8fr 1.2fr', gap: '8px', marginBottom: '8px', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div>
                  <label style={labelStyle}>코드</label>
                  <input placeholder="코드" value={item.code} onChange={e => {
                    const updated = [...form.items]; updated[idx].code = e.target.value; setForm({ ...form, items: updated })
                  }} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>품명</label>
                  <input placeholder="품명" value={item.name} onChange={e => {
                    const updated = [...form.items]; updated[idx].name = e.target.value; setForm({ ...form, items: updated })
                  }} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>구분</label>
                  <select value={item.category} onChange={e => {
                    const updated = [...form.items]; updated[idx].category = e.target.value; setForm({ ...form, items: updated })
                  }} style={inputStyle}>
                    <option value="일반부품">일반부품</option><option value="잉크">잉크</option><option value="희석제">희석제</option><option value="소모품">소모품</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>P.O. 번호</label>
                  <input placeholder="MACE-2611" value={item.po_number} onChange={e => {
                    const updated = [...form.items]; updated[idx].po_number = e.target.value; setForm({ ...form, items: updated })
                  }} style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: '#2563EB' }}>입고 단가(원)</label>
                  <input type="number" placeholder="원가 입력" value={item.unit_price} onChange={e => {
                    const updated = [...form.items]; updated[idx].unit_price = e.target.value; setForm({ ...form, items: updated })
                  }} style={{ ...inputStyle, fontWeight: '700', color: '#2563EB' }} />
                </div>
                <div>
                  <label style={labelStyle}>수량</label>
                  <input type="number" min="1" value={item.qty} onChange={e => {
                    const updated = [...form.items]; updated[idx].qty = e.target.value; setForm({ ...form, items: updated })
                  }} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>유통기한</label>
                  <input type="date" value={item.expiry} onChange={e => {
                    const updated = [...form.items]; updated[idx].expiry = e.target.value; setForm({ ...form, items: updated })
                  }} style={inputStyle} />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label style={labelStyle}>비고 및 특이사항</label>
            <textarea rows="2" placeholder="입고 관련 메모" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 18px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>취소</button>
            <button type="submit" style={{ padding: '10px 24px', background: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>입고 저장 및 로트 반영</button>
          </div>
        </form>
      </div>
    </div>
  )
}
 