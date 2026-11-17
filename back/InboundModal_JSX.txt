import React, { useState } from 'react'
import { supabase } from '../../supabaseClient'

export default function InboundModal({ partsList, author, onClose, refreshParts }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    author: author || '배진철',
    items: [{ code: '', name: '', category: '일반부품', qty: 1, lot_number: '', expiry: '' }],
    note: ''
  })

  const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none', boxSizing: 'border-box' }

  const handleSave = async (e) => {
    e.preventDefault()
    let summaryParts = []

    for (const item of form.items) {
      if (!item.code && !item.name) continue
      const cleanCode = item.code?.trim().toLowerCase()
      const matched = partsList.find(p => p.code && p.code.trim().toLowerCase() === cleanCode)
      const isConsumable = item.category === '잉크' || item.category === '희석제' || item.category === '소모품'

      if (matched) {
        let currentLots = []
        try { currentLots = matched.lots ? JSON.parse(matched.lots) : [] } catch (e) {}

        if (isConsumable) {
          currentLots.push({ lot_number: item.lot_number || '', received_date: form.date, expiry: item.expiry || '', qty: Number(item.qty || 1) })
        }

        const newStock = isConsumable ? currentLots.reduce((s, l) => s + Number(l.qty || 0), 0) : Number(item.qty || 1) + Number(matched.stock || 0)
        await supabase.from('parts').update({ stock: newStock, lots: JSON.stringify(currentLots) }).eq('id', matched.id)
      }
      summaryParts.push(`${item.name || item.code} (${item.qty}개)`)
    }

    await supabase.from('delivery_history').insert([{
      date: form.date, company_name: '본사 창고 (입고)', equipment_sn: '입고 (INBOUND)',
      summary: summaryParts.join(', '), author: form.author, note: form.note, type: 'INBOUND'
    }])

    alert('입고증이 발행되었습니다.')
    onClose(); refreshParts()
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '700px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📥 입고증 작성</h3>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={inputStyle} />
          {form.items.map((item, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr 0.8fr', gap: '8px' }}>
              <input placeholder="코드" value={item.code} onChange={e => {
                const updated = [...form.items]; updated[idx].code = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle} />
              <input placeholder="품명" value={item.name} onChange={e => {
                const updated = [...form.items]; updated[idx].name = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle} />
              <select value={item.category} onChange={e => {
                const updated = [...form.items]; updated[idx].category = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle}>
                <option value="일반부품">일반부품</option><option value="잉크">잉크</option><option value="희석제">희석제</option><option value="소모품">소모품</option>
              </select>
              <input type="number" value={item.qty} onChange={e => {
                const updated = [...form.items]; updated[idx].qty = e.target.value; setForm({ ...form, items: updated })
              }} style={inputStyle} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #CBD5E1', background: '#fff', borderRadius: '6px' }}>취소</button>
            <button type="submit" style={{ padding: '8px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700' }}>입고 저장</button>
          </div>
        </form>
      </div>
    </div>
  )
}