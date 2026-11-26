import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function OutboundModal({ partsList, companies, author, onClose, refreshParts }) {
  const [form, setForm] = useState({
    company_name: '', date: new Date().toISOString().split('T')[0], author: author || '배진철',
    equipment_sn: '', items: [{ code: '', name: '', qty: 1 }], note: ''
  })

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.company_name.trim()) return alert('업체명을 입력해주세요!')

    for (const item of form.items) {
      if (!item.code && !item.name) continue
      const matched = partsList.find(p => p.code && p.code.trim().toLowerCase() === item.code?.trim().toLowerCase())
      if (matched) {
        const subQty = Number(item.qty || 0)
        const newStock = Math.max(0, Number(matched.stock || 0) - subQty)
        await supabase.from('parts').update({ stock: newStock }).eq('id', matched.id)
      }
    }

    const summaryText = form.items.map(i => `${i.name || i.code} (${i.qty}개)`).join(', ')
    await supabase.from('delivery_history').insert([{
      date: form.date, company_name: form.company_name, equipment_sn: form.equipment_sn || '-',
      summary: summaryText, author: form.author, note: form.note, type: 'OUTBOUND'
    }])

    alert('출고증이 발행되었습니다.')
    onClose(); refreshParts()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '700px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📤 출고증 작성</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input placeholder="공급받는 자 (업체명)*" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} style={inputStyle} required />
          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 0.8fr', gap: '8px' }}>
              <input placeholder="코드" value={item.code} onChange={e => {
                const updated = [...form.items]; updated[idx].code = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle} />
              <input placeholder="품명" value={item.name} onChange={e => {
                const updated = [...form.items]; updated[idx].name = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle} />
              <input type="number" value={item.qty} onChange={e => {
                const updated = [...form.items]; updated[idx].qty = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px' }}>취소</button>
            <button type="submit" style={{ padding: '8px 20px', background: '#D97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700' }}>출고 저장</button>
          </div>
        </form>
      </div>
    </div>
  )
}