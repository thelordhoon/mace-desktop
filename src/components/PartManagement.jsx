import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function PartManagement() {
  const [activeTab, setActiveTab] = useState('소모품') // '소모품' | '일반부품' | '프린터' | '이력관리'
  const [partsList, setPartsList] = useState([])
  const [companies, setCompanies] = useState([])
  const [currentUserName, setCurrentUserName] = useState('배진철')
  const [partSearchTerm, setPartSearchTerm] = useState('')
  const [printerStatusFilter, setPrinterStatusFilter] = useState('ALL') // 'ALL' | 'NEW' | 'USED' | 'DEMO' | 'DISCARD'
  const [showAddPartForm, setShowAddPartForm] = useState(false)

  // 📋 이력 관리 관련 상태
  const [historyList, setHistoryList] = useState([])
  const [historySearchTerm, setHistorySearchTerm] = useState('')
  const [historyFilterType, setHistoryFilterType] = useState('ALL') // 'ALL' | 'INBOUND' | 'OUTBOUND'
  const [selectedHistory, setSelectedHistory] = useState(null) // 상세 모달

  // 모달 상태
  const [selectedSpecialPrices, setSelectedSpecialPrices] = useState(null)
  const [selectedSpecialPart, setSelectedSpecialPart] = useState(null)
  const [selectedFifoPart, setSelectedFifoPart] = useState(null)
  const [selectedSerialPart, setSelectedSerialPart] = useState(null)
  const [selectedPrinterDetailPart, setSelectedPrinterDetailPart] = useState(null)

  // 입고증 / 출고증 작성 모달 상태
  const [showInboundModal, setShowInboundModal] = useState(false)
  const [showOutboundModal, setShowOutboundModal] = useState(false)
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false) // 업체명 드롭다운 제어

  // 입고증 폼 상태
  const [inboundForm, setInboundForm] = useState({
    date: new Date().toISOString().split('T')[0],
    author: '배진철',
    items: [{ code: '', name: '', category: '일반부품', qty: 1, lot_number: '', expiry: '', serials: [] }],
    note: ''
  })

  // 출고증 폼 상태
  const [outboundForm, setOutboundForm] = useState({
    company_name: '',
    date: new Date().toISOString().split('T')[0],
    author: '배진철',
    equipment_sn: '',
    items: [{ code: '', name: '', category: '일반부품', qty: 1, note: '' }],
    note: ''
  })

  // 빠른 입고 로트 추가 상태
  const [quickLotPart, setQuickLotPart] = useState(null)
  const [quickLotNo, setQuickLotNo] = useState('')
  const [quickReceivedDate, setQuickReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [quickExpiry, setQuickExpiry] = useState('')
  const [quickQty, setQuickQty] = useState('')

  // 신규 등록 폼 상태
  const [partName, setPartName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [partCategory, setPartCategory] = useState('잉크')
  const [purchasePrice, setPurchasePrice] = useState(0)
  const [dealerPrice, setDealerPrice] = useState(0)
  const [customerPrice, setCustomerPrice] = useState(0)
  const [partNote, setPartNote] = useState('')
  const [companyPrices, setCompanyPrices] = useState([])
  const [lots, setLots] = useState([])
  const [uploading, setUploading] = useState(false)

  // 정보 수정 팝업 모달 상태
  const [editingPart, setEditingPart] = useState(null)
  const [editPartForm, setEditPartForm] = useState({
    name: '', code: '', category: '일반부품', purchase_price: 0, dealer_price: 0, customer_price: 0, stock: 0, note: ''
  })
  const [editCompanyPrices, setEditCompanyPrices] = useState([])
  const [editLots, setEditLots] = useState([])
  const [editSerials, setEditSerials] = useState([])

  useEffect(() => {
    fetchParts()
    fetchCompanies()
    fetchCurrentUserInfo()
    fetchHistory()
  }, [])

  useEffect(() => {
    if (activeTab === '소모품') setPartCategory('잉크')
    else if (activeTab === '일반부품') setPartCategory('일반부품')
    else if (activeTab === '프린터') {
      setPartCategory('프린터')
      if (!partCode) setPartCode(Math.floor(10000000 + Math.random() * 90000000).toString())
    } else if (activeTab === '이력관리') {
      fetchHistory()
    }
  }, [activeTab])

  const fetchCurrentUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (profile?.full_name) {
        setCurrentUserName(profile.full_name)
        setInboundForm(prev => ({ ...prev, author: profile.full_name }))
        setOutboundForm(prev => ({ ...prev, author: profile.full_name }))
      }
    }
  }

  const fetchParts = async () => {
    const { data, error } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
    if (!error) setPartsList(data || [])
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  const fetchHistory = async () => {
    const { data, error } = await supabase
      .from('delivery_history')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
    if (!error) setHistoryList(data || [])
  }

  const handleDeleteHistory = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('이 발행 이력을 삭제하시겠습니까? (※ 주의: 재고 수량은 원복되지 않습니다)')) return
    const { error } = await supabase.from('delivery_history').delete().eq('id', id)
    if (!error) {
      alert('이력이 삭제되었습니다.')
      fetchHistory()
    }
  }

  const handleToggleFavorite = async (part) => {
    const newStatus = !part.is_favorite
    setPartsList(prev => prev.map(p => p.id === part.id ? { ...p, is_favorite: newStatus } : p))
    await supabase.from('parts').update({ is_favorite: newStatus }).eq('id', part.id)
  }

  const handleAddCompanyPriceField = () => setCompanyPrices([...companyPrices, { company_name: '', price: 0 }])
  const handleRemoveCompanyPriceField = (i) => setCompanyPrices(companyPrices.filter((_, idx) => idx !== i))
  const handleCompanyPriceChange = (i, field, val) => {
    const updated = [...companyPrices]; updated[i][field] = val; setCompanyPrices(updated)
  }

  const handleAddEditCompanyPriceField = () => setEditCompanyPrices([...editCompanyPrices, { company_name: '', price: 0 }])
  const handleRemoveEditCompanyPriceField = (i) => setEditCompanyPrices(editCompanyPrices.filter((_, idx) => idx !== i))
  const handleEditCompanyPriceChange = (i, field, val) => {
    const updated = [...editCompanyPrices]; updated[i][field] = val; setEditCompanyPrices(updated)
  }

  const handleAddEditSerialField = () => setEditSerials([...editSerials, { sn: `SN-${Math.floor(1000 + Math.random() * 9000)}`, condition: 'NEW', location: '창고', cost_price: 0, sell_price: 0 }])
  const handleRemoveEditSerialField = (i) => setEditSerials(editSerials.filter((_, idx) => idx !== i))
  const handleEditSerialChange = (i, field, val) => {
    const updated = [...editSerials]; updated[i][field] = val; setEditSerials(updated)
  }

  const handleAddModalCompanyPriceField = () => setSelectedSpecialPrices([...selectedSpecialPrices, { company_name: '', price: 0 }])
  const handleRemoveModalCompanyPriceField = (i) => setSelectedSpecialPrices(selectedSpecialPrices.filter((_, idx) => idx !== i))
  const handleModalCompanyPriceChange = (i, field, val) => {
    const updated = [...selectedSpecialPrices]; updated[i][field] = val; setSelectedSpecialPrices(updated)
  }

  const handleSaveModalSpecialPrices = async () => {
    if (!selectedSpecialPart) return
    const validPrices = selectedSpecialPrices.filter(cp => cp.company_name.trim() !== '')
    const { error } = await supabase.from('parts').update({ company_prices: JSON.stringify(validPrices) }).eq('id', selectedSpecialPart.id)
    if (error) alert('특가 저장 실패: ' + error.message)
    else {
      alert('지정 특가가 업데이트되었습니다.')
      setSelectedSpecialPrices(null); setSelectedSpecialPart(null); fetchParts()
    }
  }

  const handleAddLotField = () => setLots([...lots, { lot_number: '', received_date: new Date().toISOString().split('T')[0], expiry: '', qty: 0 }])
  const handleRemoveLotField = (i) => setLots(lots.filter((_, idx) => idx !== i))
  const handleLotChange = (i, field, val) => {
    const updated = [...lots]; updated[i][field] = val; setLots(updated)
  }

  const handleQuickAddLotSubmit = async (e) => {
    e.preventDefault()
    if (!quickLotPart) return
    if (!quickQty || Number(quickQty) <= 0) return alert('입고 수량을 정확히 입력해주세요!')

    let currentLots = []
    try {
      currentLots = quickLotPart.lots ? (typeof quickLotPart.lots === 'string' ? JSON.parse(quickLotPart.lots) : quickLotPart.lots) : []
    } catch (err) { currentLots = [] }

    const newLot = {
      lot_number: quickLotNo ? quickLotNo.trim() : '',
      received_date: quickReceivedDate || new Date().toISOString().split('T')[0],
      expiry: quickExpiry ? quickExpiry : '',
      qty: Number(quickQty)
    }

    const updatedLots = [...currentLots, newLot]
    const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

    const { error } = await supabase.from('parts').update({
      lots: JSON.stringify(updatedLots),
      stock: calculatedTotalStock
    }).eq('id', quickLotPart.id)

    if (!error) {
      alert('입고 로트가 추가되고 재고가 반영되었습니다.')
      setQuickLotPart(null); setQuickQty(''); setQuickExpiry(''); setQuickLotNo(''); fetchParts()
    }
  }

  const handleDeleteFifoLot = async (targetLotNumber) => {
    if (!selectedFifoPart) return
    if (!window.confirm(`Lot [${targetLotNumber || '공백'}] 삭제하시겠습니까?`)) return

    let currentLots = []
    try {
      currentLots = selectedFifoPart.lots ? (typeof selectedFifoPart.lots === 'string' ? JSON.parse(selectedFifoPart.lots) : selectedFifoPart.lots) : []
    } catch (e) { currentLots = [] }

    const updatedLots = currentLots.filter(l => l.lot_number !== targetLotNumber)
    const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

    const { error } = await supabase.from('parts').update({
      lots: JSON.stringify(updatedLots),
      stock: calculatedTotalStock
    }).eq('id', selectedFifoPart.id)

    if (!error) {
      alert('로트가 삭제되었습니다.')
      setSelectedFifoPart({ ...selectedFifoPart, lots: updatedLots, stock: calculatedTotalStock })
      fetchParts()
    }
  }

  const handleSaveInbound = async (e) => {
    e.preventDefault()
    try {
      let summaryParts = []
      for (const item of inboundForm.items) {
        if (!item.code && !item.name) continue
        const cleanCode = item.code?.trim().toLowerCase()
        const matched = partsList.find(p => p.code && p.code.trim().toLowerCase() === cleanCode)

        if (matched) {
          let currentSerials = []
          try { currentSerials = matched.serials ? (typeof matched.serials === 'string' ? JSON.parse(matched.serials) : matched.serials) : [] } catch(e){}
          let currentLots = []
          try { currentLots = matched.lots ? (typeof matched.lots === 'string' ? JSON.parse(matched.lots) : matched.lots) : [] } catch(e){}

          if (item.category === '잉크' || item.category === '희석제') {
            currentLots.push({ lot_number: item.lot_number || '', received_date: inboundForm.date, expiry: item.expiry || '', qty: Number(item.qty || 1) })
          } else {
            for(let i=0; i<Number(item.qty || 1); i++) {
              currentSerials.push({ sn: `SN-${Math.floor(1000 + Math.random() * 9000)}`, condition: 'NEW', location: '본사 창고', cost_price: 0, sell_price: 0 })
            }
          }

          const newStock = (item.category === '잉크' || item.category === '희석제')
            ? currentLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)
            : (item.category === '프린터' || item.category === '라이너' ? Number(item.qty || 1) + Number(matched.stock || 0) : currentSerials.length)

          await supabase.from('parts').update({ stock: newStock, serials: JSON.stringify(currentSerials), lots: JSON.stringify(currentLots) }).eq('id', matched.id)
        } else {
          let newSerials = []
          let newLots = []
          if (item.category === '잉크' || item.category === '희석제') {
            newLots.push({ lot_number: item.lot_number || '', received_date: inboundForm.date, expiry: item.expiry || '', qty: Number(item.qty || 1) })
          } else if (item.category !== '프린터' && item.category !== '라이너') {
            for(let i=0; i<Number(item.qty || 1); i++) {
              newSerials.push({ sn: `SN-${Math.floor(1000 + Math.random() * 9000)}`, condition: 'NEW', location: '본사 창고', cost_price: 0, sell_price: 0 })
            }
          }

          await supabase.from('parts').insert([{
            code: item.code || `CODE-${Math.floor(1000+Math.random()*9000)}`,
            name: item.name || '신규 입고 품목',
            category: item.category || '일반부품',
            stock: Number(item.qty || 1),
            serials: JSON.stringify(newSerials),
            lots: JSON.stringify(newLots),
            customer_price: 0,
            dealer_price: 0
          }])
        }
        summaryParts.push(`${item.name || item.code} (${item.qty}개)`)
      }

      await supabase.from('delivery_history').insert([{
        date: inboundForm.date,
        company_name: '본사 창고 (입고)',
        equipment_sn: '입고 (INBOUND)',
        summary: summaryParts.join(', '),
        author: inboundForm.author,
        note: inboundForm.note,
        type: 'INBOUND'
      }])

      alert('입고증이 발행되고 재고에 반영되었습니다!')
      setShowInboundModal(false)
      fetchParts()
      fetchHistory()
    } catch (err) { alert('입고 처리 오류: ' + err.message) }
  }

  const handleSaveOutbound = async (e) => {
    e.preventDefault()
    if (!outboundForm.company_name.trim()) return alert('공급받는 업체를 입력해주세요!')

    try {
      for (const item of outboundForm.items) {
        if (!item.code && !item.name) continue
        const cleanCode = item.code?.trim().toLowerCase()
        const matched = partsList.find(p => p.code && p.code.trim().toLowerCase() === cleanCode)
        if (matched) {
          const subQty = Number(item.qty || 0)
          const newStock = Math.max(0, Number(matched.stock || 0) - subQty)
          await supabase.from('parts').update({ stock: newStock }).eq('id', matched.id)
        }
      }

      const summaryText = outboundForm.items.map(i => `${i.name || i.code} (${i.qty}개)`).join(', ')
      await supabase.from('delivery_history').insert([{
        date: outboundForm.date,
        company_name: outboundForm.company_name,
        equipment_sn: outboundForm.equipment_sn || '-',
        summary: summaryText,
        author: outboundForm.author,
        note: outboundForm.note,
        type: 'OUTBOUND'
      }])

      alert('출고증이 발행되고 재고에서 차감되었습니다!')
      setShowOutboundModal(false)
      fetchParts()
      fetchHistory()
    } catch (err) { alert('출고증 발행 오류: ' + err.message) }
  }

  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!partName.trim()) return alert('품명을 입력해주세요!')
    if (!partCode.trim()) return alert('코드/품번을 입력해주세요!')

    setUploading(true)
    let calculatedStock = activeTab === '소모품' 
      ? lots.reduce((sum, l) => sum + Number(l.qty || 0), 0)
      : Number(document.getElementById('newPartStockInput')?.value || 0)

    const insertData = {
      name: partName, code: partCode, category: partCategory,
      dealer_price: Number(dealerPrice), customer_price: Number(customerPrice),
      stock: calculatedStock, company_prices: JSON.stringify(companyPrices),
      lots: JSON.stringify(lots), note: partNote, is_favorite: false
    }
    if (activeTab === '일반부품') insertData.purchase_price = Number(purchasePrice)

    const { error } = await supabase.from('parts').insert([insertData])
    setUploading(false)

    if (!error) {
      alert('신규 항목이 등록되었습니다.')
      setPartName(''); setPartCode(activeTab === '프린터' ? Math.floor(10000000 + Math.random() * 90000000).toString() : '');
      setPurchasePrice(0); setDealerPrice(0); setCustomerPrice(0); setPartNote('');
      setCompanyPrices([]); setLots([]); setShowAddPartForm(false); fetchParts()
    }
  }

  const handleStartEditPart = (p) => {
    setEditingPart(p)
    setEditPartForm({
      name: p.name || '', code: p.code || '', category: p.category || '일반부품',
      purchase_price: p.purchase_price || 0, dealer_price: p.dealer_price || 0,
      customer_price: p.customer_price || 0, stock: p.stock || 0, note: p.note || ''
    })
    try { setEditCompanyPrices(p.company_prices ? (typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices) : []) } catch (e) { setEditCompanyPrices([]) }
    try { setEditLots(p.lots ? (typeof p.lots === 'string' ? JSON.parse(p.lots) : p.lots) : []) } catch (e) { setEditLots([]) }
    try { setEditSerials(p.serials ? (typeof p.serials === 'string' ? JSON.parse(p.serials) : p.serials) : []) } catch (e) { setEditSerials([]) }
  }

  const handleSavePartEdit = async (e) => {
    e.preventDefault()
    if (!editingPart) return
    setUploading(true)

    const isConsumableItem = editPartForm.category === '잉크' || editPartForm.category === '희석제' || editPartForm.category === '소모품'
    const isAssetItem = editPartForm.category === '프린터' || editPartForm.category === '라이너'

    const calculatedTotalStock = isConsumableItem 
      ? editLots.reduce((sum, lot) => sum + Number(lot.qty || 0), 0) 
      : (isAssetItem ? Number(editPartForm.stock || 0) : editSerials.length)

    const updateData = {
      name: editPartForm.name, code: editPartForm.code, category: editPartForm.category,
      dealer_price: Number(editPartForm.dealer_price), customer_price: Number(editPartForm.customer_price),
      stock: calculatedTotalStock, company_prices: JSON.stringify(editCompanyPrices),
      lots: JSON.stringify(editLots), serials: JSON.stringify(editSerials), note: editPartForm.note
    }
    if (!isConsumableItem && !isAssetItem) updateData.purchase_price = Number(editPartForm.purchase_price)

    const { error } = await supabase.from('parts').update(updateData).eq('id', editingPart.id)
    setUploading(false)

    if (!error) {
      alert('정보가 수정되었습니다.')
      setEditingPart(null); fetchParts()
    }
  }

  const handleDeletePart = async (partId) => {
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return
    const { error } = await supabase.from('parts').delete().eq('id', partId)
    if (!error) { alert('삭제되었습니다.'); fetchParts() }
  }

  const getFifoLots = (p) => {
    let lots = []
    try { lots = p.lots ? (typeof p.lots === 'string' ? JSON.parse(p.lots) : p.lots) : [] } catch (e) {}
    return Array.isArray(lots) ? lots.sort((a, b) => new Date(a.expiry) - new Date(b.expiry)) : []
  }

  const getConditionCounts = (p) => {
    let serials = []
    try { serials = p.serials ? (typeof p.serials === 'string' ? JSON.parse(p.serials) : p.serials) : [] } catch (e) {}
    if (!Array.isArray(serials) || serials.length === 0) return { total: p.stock || 0, new: p.stock || 0, used: 0, demo: 0, discard: 0, list: [] }
    const counts = { total: serials.length, new: 0, used: 0, demo: 0, discard: 0, list: serials }
    serials.forEach(s => {
      const cond = (s.condition || 'NEW').toUpperCase()
      if (cond === 'USED') counts.used += 1
      else if (cond === 'DEMO') counts.demo += 1
      else if (cond === 'DISCARD') counts.discard += 1
      else counts.new += 1
    })
    return counts
  }

  const filteredParts = partsList.filter(p => {
    const cat = p.category || '일반부품'
    const isConsumableCat = cat === '잉크' || cat === '희석제' || cat === '소모품'
    const isPrinterCat = cat === '프린터' || cat === '라이너'

    if (activeTab === '소모품' && !isConsumableCat) return false
    if (activeTab === '일반부품' && (isConsumableCat || isPrinterCat)) return false
    if (activeTab === '프린터' && !isPrinterCat) return false

    if (activeTab === '프린터' && printerStatusFilter !== 'ALL') {
      let serials = []
      try { serials = p.serials ? (typeof p.serials === 'string' ? JSON.parse(p.serials) : p.serials) : [] } catch(e){}
      const hasMatchingStatus = serials.some(s => (s.condition || 'NEW').toUpperCase() === printerStatusFilter)
      if (!hasMatchingStatus && printerStatusFilter !== 'NEW' && Number(p.stock || 0) <= 0) return false
    }

    return !partSearchTerm.trim() || 
      (p.name && p.name.toLowerCase().includes(partSearchTerm.toLowerCase())) ||
      (p.code && p.code.toLowerCase().includes(partSearchTerm.toLowerCase()))
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko-KR'))

  const filteredHistory = historyList.filter(item => {
    if (historyFilterType !== 'ALL' && item.type !== historyFilterType) return false
    const searchLower = historySearchTerm.toLowerCase()
    return (
      !historySearchTerm.trim() ||
      (item.company_name && item.company_name.toLowerCase().includes(searchLower)) ||
      (item.summary && item.summary.toLowerCase().includes(searchLower)) ||
      (item.author && item.author.toLowerCase().includes(searchLower)) ||
      (item.equipment_sn && item.equipment_sn.toLowerCase().includes(searchLower)) ||
      (item.note && item.note.toLowerCase().includes(searchLower))
    )
  })

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '10px',
    border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', outline: 'none',
    boxSizing: 'border-box'
  }
  const labelStyle = { fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '6px', display: 'block' }

  return (
    <div onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault() }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '800' }}>🔧 자재 및 부품 재고 관리</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            {activeTab === '소모품' && '🧪 잉크 & 희석제 선입선출(FIFO) 및 유통기한을 관리합니다.'}
            {activeTab === '일반부품' && '⚙️ 일반 부품 및 부자재 S/N별 보유 상태 및 매입가·특가를 관리합니다.'}
            {activeTab === '프린터' && '🖨️ 프린터 및 라이너 장비 S/N별 상태(신품/중고매입/난수사용품/폐기)를 관리합니다.'}
            {activeTab === '이력관리' && '📋 발행된 모든 입고증 및 출고증의 내역을 시간순으로 확인합니다.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: '0' }}>
          <button type="button" onClick={() => setShowInboundModal(true)} style={{ padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
            + 입고증 작성
          </button>
          <button type="button" onClick={() => setShowOutboundModal(true)} style={{ padding: '10px 16px', background: '#D97706', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
            + 출고증 작성
          </button>
          {activeTab !== '이력관리' && (
            <button type="button" onClick={() => setShowAddPartForm(!showAddPartForm)} style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
              {showAddPartForm ? '✕ 닫기' : `+ 신규 ${activeTab} 등록`}
            </button>
          )}
        </div>
      </div>

      {/* 📌 상단 탭 메뉴 ([📋 입·출고증 발행 이력] 탭 포함) */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #E2E8F0', paddingBottom: '2px' }}>
        <button type="button" onClick={() => setActiveTab('소모품')} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', borderBottom: activeTab === '소모품' ? '3px solid #2563EB' : 'none', color: activeTab === '소모품' ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' }}>
          🧪 소모품 관리 (FIFO)
        </button>
        <button type="button" onClick={() => setActiveTab('일반부품')} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', borderBottom: activeTab === '일반부품' ? '3px solid #2563EB' : 'none', color: activeTab === '일반부품' ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' }}>
          ⚙️ 일반 부품 및 부자재
        </button>
        <button type="button" onClick={() => setActiveTab('프린터')} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', borderBottom: activeTab === '프린터' ? '3px solid #2563EB' : 'none', color: activeTab === '프린터' ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' }}>
          🖨️ 프린터 관리
        </button>
        <button type="button" onClick={() => setActiveTab('이력관리')} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', borderBottom: activeTab === '이력관리' ? '3px solid #2563EB' : 'none', color: activeTab === '이력관리' ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' }}>
          📋 입·출고증 발행 이력
        </button>
      </div>

      {/* 1. 이력관리 탭 화면 */}
      {activeTab === '이력관리' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder="🔍 업체명, 품목 요약, 작성자, S/N 검색..." 
              value={historySearchTerm} 
              onChange={(e) => setHistorySearchTerm(e.target.value)} 
              style={{ ...inputStyle, padding: '12px', maxWidth: '380px' }} 
            />

            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'ALL', label: '전체 보기' },
                { key: 'INBOUND', label: '📥 입고 이력' },
                { key: 'OUTBOUND', label: '📤 출고 이력' }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setHistoryFilterType(tab.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '700',
                    border: historyFilterType === tab.key ? '2px solid #2563EB' : '1px solid #CBD5E1',
                    backgroundColor: historyFilterType === tab.key ? '#EFF6FF' : '#FFFFFF',
                    color: historyFilterType === tab.key ? '#2563EB' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '14px 16px', width: '100px' }}>구분</th>
                  <th style={{ padding: '14px 16px', width: '120px' }}>발행 일자</th>
                  <th style={{ padding: '14px 16px', width: '200px' }}>공급받는 자 / 입고처</th>
                  <th style={{ padding: '14px 16px', width: '320px' }}>품목 명세 요약</th>
                  <th style={{ padding: '14px 16px', width: '110px' }}>작성자</th>
                  <th style={{ padding: '14px 16px', width: '100px', textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>등록된 발행 이력이 없습니다.</td></tr>
                ) : (
                  filteredHistory.map((item) => {
                    const isInbound = item.type === 'INBOUND'
                    return (
                      <tr 
                        key={item.id} 
                        style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle', cursor: 'pointer' }}
                        onClick={() => setSelectedHistory(item)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ padding: '4px 8px', backgroundColor: isInbound ? '#DEF7EC' : '#FEF3C7', color: isInbound ? '#03543F' : '#92400E', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                            {isInbound ? '📥 입고증' : '📤 출고증'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>{item.date}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>{item.company_name || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#334155', wordBreak: 'break-all' }}>{item.summary || '-'}</td>
                        <td style={{ padding: '12px 16px', color: '#64748B', whiteSpace: 'nowrap' }}>{item.author || '-'}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            <button type="button" onClick={() => setSelectedHistory(item)} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>상세</button>
                            <button type="button" onClick={(e) => handleDeleteHistory(item.id, e)} style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* 2. 일반 부품/소모품/프린터 관리 탭 화면 */
        <div>
          {showAddPartForm && (
            <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '20px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', maxWidth: '900px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1E293B', fontWeight: '700' }}>🔧 신규 {activeTab} 등록</h4>
              <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.3fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>품번 / 코드* {activeTab === '프린터' && '(8자리)'}</label>
                    <input 
                      placeholder={activeTab === '프린터' ? "예: 76000117" : "예: E55-004891S"} 
                      maxLength={activeTab === '프린터' ? 8 : undefined}
                      value={partCode} 
                      onChange={(e) => setPartCode(e.target.value)} 
                      style={inputStyle} 
                      required 
                    />
                  </div>
                  <div><label style={labelStyle}>품명*</label><input placeholder="품명 입력" value={partName} onChange={(e) => setPartName(e.target.value)} style={inputStyle} required /></div>
                  <div>
                    <label style={labelStyle}>구분 (카테고리)</label>
                    <select value={partCategory} onChange={(e) => setPartCategory(e.target.value)} style={inputStyle}>
                      {activeTab === '소모품' && (<><option value="잉크">잉크</option><option value="희석제">희석제</option></>)}
                      {activeTab === '일반부품' && (<><option value="일반부품">일반부품</option><option value="필터류">필터류</option><option value="기타">기타</option></>)}
                      {activeTab === '프린터' && (<><option value="프린터">프린터</option><option value="라이너">라이너</option></>)}
                    </select>
                  </div>
                </div>

                {activeTab === '소모품' && (
                  <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>⏳ 입고 로트(Lot) 및 유통기한 관리 (FIFO)</span>
                      <button type="button" onClick={handleAddLotField} style={{ border: 'none', background: '#2563EB', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 입고 로트 추가</button>
                    </div>
                    {lots.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '12px' }}>[+ 입고 로트 추가] 버튼을 눌러 입고일과 유통기한을 입력하세요.</div>
                    ) : (
                      lots.map((l, idx) => (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 0.8fr 30px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                          <input type="text" placeholder="Lot No (선택)" value={l.lot_number} onChange={(e) => handleLotChange(idx, 'lot_number', e.target.value)} style={inputStyle} />
                          <input type="date" placeholder="입고일" value={l.received_date} onChange={(e) => handleLotChange(idx, 'received_date', e.target.value)} style={inputStyle} />
                          <input type="date" placeholder="유통기한 (선택)" value={l.expiry} onChange={(e) => handleLotChange(idx, 'expiry', e.target.value)} style={inputStyle} />
                          <input type="number" placeholder="수량" value={l.qty} onChange={(e) => handleLotChange(idx, 'qty', e.target.value)} style={inputStyle} />
                          <button type="button" onClick={() => handleRemoveLotField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', textAlign: 'center' }}>✕</button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === '프린터' && (
                  <div><label style={labelStyle}>초기 재고 수량 (대)</label><input type="number" id="newPartStockInput" defaultValue={1} style={inputStyle} /></div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: activeTab === '일반부품' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '12px' }}>
                  {activeTab === '일반부품' && (<div><label style={labelStyle}>매입 가격 (원)</label><input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} style={inputStyle} /></div>)}
                  <div><label style={labelStyle}>소비자 기본가 (원)</label><input type="number" value={customerPrice} onChange={(e) => setCustomerPrice(e.target.value)} style={inputStyle} /></div>
                  <div><label style={labelStyle}>딜러 기본가 (원)</label><input type="number" value={dealerPrice} onChange={(e) => setDealerPrice(e.target.value)} style={inputStyle} /></div>
                </div>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 개별 특가 (선택)</span>
                    <button type="button" onClick={handleAddCompanyPriceField} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 업체 추가</button>
                  </div>
                  {companyPrices.map((cp, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', backgroundColor: '#F8FAFC', padding: '8px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <input type="text" placeholder="업체명 검색..." value={cp.company_name} onChange={(e) => handleCompanyPriceChange(idx, 'company_name', e.target.value)} style={{ ...inputStyle, flex: 1.5 }} />
                      <input type="number" placeholder="특가 (원)" value={cp.price} onChange={(e) => handleCompanyPriceChange(idx, 'price', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      <button type="button" onClick={() => handleRemoveCompanyPriceField(idx)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                    </div>
                  ))}
                </div>

                <div><label style={labelStyle}>📌 비고</label><textarea rows="3" placeholder="메모 및 특이사항 입력" value={partNote} onChange={(e) => setPartNote(e.target.value)} style={inputStyle} /></div>

                <button type="submit" disabled={uploading} style={{ padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', marginTop: '6px' }}>
                  {uploading ? '저장 중...' : '등록 저장'}
                </button>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <input type="text" placeholder={`🔍 ${activeTab} 품명 또는 품번 검색...`} value={partSearchTerm} onChange={(e) => setPartSearchTerm(e.target.value)} style={{ ...inputStyle, padding: '12px', maxWidth: '360px' }} />

            {activeTab === '프린터' && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { key: 'ALL', label: '전체' },
                  { key: 'NEW', label: '✨ 신품' },
                  { key: 'USED', label: '📦 중고매입' },
                  { key: 'DEMO', label: '🧪 난수사용품' },
                  { key: 'DISCARD', label: '🗑️ 폐기' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setPrinterStatusFilter(tab.key)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                      border: printerStatusFilter === tab.key ? '2px solid #2563EB' : '1px solid #CBD5E1',
                      backgroundColor: printerStatusFilter === tab.key ? '#EFF6FF' : '#FFFFFF',
                      color: printerStatusFilter === tab.key ? '#2563EB' : '#475569', cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                  <th style={{ padding: '14px 16px', width: '90px' }}>구분</th>
                  <th style={{ padding: '14px 16px', width: '110px' }}>품번 / 코드</th>
                  <th style={{ padding: '14px 16px', width: '280px' }}>품명</th>
                  <th style={{ padding: '14px 16px', width: '200px' }}>
                    {activeTab === '소모품' && '재고 수량 (FIFO)'}
                    {activeTab === '일반부품' && '재고 현황 (S/N 상태)'}
                    {activeTab === '프린터' && '재고 및 S/N 상태'}
                  </th>
                  <th style={{ padding: '14px 16px', width: '140px' }}>업체별 특가</th>
                  <th style={{ padding: '14px 16px', width: '110px' }}>소비자 기본가</th>
                  <th style={{ padding: '14px 16px', width: '110px' }}>딜러 기본가</th>
                  <th style={{ padding: '14px 16px', width: '110px', textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {filteredParts.length === 0 ? (
                  <tr><td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>등록된 {activeTab} 항목이 없습니다.</td></tr>
                ) : (
                  filteredParts.map((p) => {
                    let parsedCompanyPrices = []
                    try {
                      const temp = p.company_prices ? (typeof p.company_prices === 'string' ? JSON.parse(p.company_prices) : p.company_prices) : []
                      parsedCompanyPrices = Array.isArray(temp) ? temp.filter(cp => cp && cp.company_name) : []
                    } catch (e) {}

                    const specialPriceCount = parsedCompanyPrices.length
                    const condCounts = getConditionCounts(p)

                    return (
                      <tr 
                        key={p.id} 
                        style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle', cursor: activeTab === '프린터' ? 'pointer' : 'default' }}
                        onClick={() => { if (activeTab === '프린터') setSelectedPrinterDetailPart(p) }}
                        onMouseEnter={(e) => { if(activeTab === '프린터') e.currentTarget.style.backgroundColor = '#F8FAFC' }}
                        onMouseLeave={(e) => { if(activeTab === '프린터') e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ padding: '4px 8px', backgroundColor: '#EFF6FF', color: '#2563EB', borderRadius: '6px', fontSize: '12px', fontWeight: '700' }}>
                            {p.category || '기타'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', wordBreak: 'break-all' }}>{p.code || '-'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span style={{ wordBreak: 'break-all' }}>{p.name} {activeTab === '프린터' && <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: '500' }}>(🔍 상세)</span>}</span>
                            {activeTab === '소모품' && (
                              <button type="button" onClick={(e) => { e.stopPropagation(); setQuickLotPart(p) }} style={{ backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1', padding: '4px 9px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                + 입고 로트 추가
                              </button>
                            )}
                          </div>
                        </td>
                        
                        {activeTab === '소모품' && (
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: '800', color: '#10B981', fontSize: '14px' }}>{p.stock ?? 0} 개</span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFifoPart(p) }} style={{ border: 'none', background: '#F0FDF4', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                                ⏳ FIFO 🔍
                              </button>
                            </div>
                          </td>
                        )}

                        {activeTab === '일반부품' && (
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: '800', color: '#0F172A', fontSize: '13px' }}>총 {condCounts.total}개</span>
                              <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedSerialPart(p) }} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>S/N 🔍</button>
                            </div>
                          </td>
                        )}

                        {activeTab === '프린터' && (
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: '800', color: '#2563EB', fontSize: '13px' }}>총 {p.stock ?? 0}대</span>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedSerialPart(p) }} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>S/N 관리 🔍</button>
                              </div>
                            </div>
                          </td>
                        )}

                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => { setSelectedSpecialPart(p); setSelectedSpecialPrices(parsedCompanyPrices) }} style={{ fontSize: '11px', fontWeight: '700', color: specialPriceCount > 0 ? '#D97706' : '#64748B', backgroundColor: specialPriceCount > 0 ? '#FEF3C7' : '#F1F5F9', border: specialPriceCount > 0 ? '1px solid #FCD34D' : '1px solid #CBD5E1', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer' }}>
                            🏷️ 지정 특가 {specialPriceCount}개 [보기]
                          </button>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563EB', whiteSpace: 'nowrap' }}>{p.customer_price ? Number(p.customer_price).toLocaleString() : 0} 원</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>{p.dealer_price ? Number(p.dealer_price).toLocaleString() : 0} 원</td>
                        
                        <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                            <button type="button" onClick={() => handleToggleFavorite(p)} style={{ border: '1px solid #CBD5E1', background: p.is_favorite ? '#FEF3C7' : '#FFFFFF', borderRadius: '6px', cursor: 'pointer', fontSize: '15px', padding: '4px 8px' }}>{p.is_favorite ? '⭐' : '☆'}</button>
                            <button type="button" onClick={() => handleStartEditPart(p)} style={{ border: 'none', background: '#EFF6FF', color: '#2563EB', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>수정</button>
                            <button type="button" onClick={() => handleDeletePart(p.id)} style={{ border: 'none', background: '#FEE2E2', color: '#EF4444', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '12px' }}>삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 출고증 작성 모달 (드롭다운 자동닫힘 수정 적용) */}
      {showOutboundModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '740px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>📤 출고증 작성 (DELIVERY NOTE)</h3>
              <button type="button" onClick={() => setShowOutboundModal(false)} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <form onSubmit={handleSaveOutbound} onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault() }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '12px' }}>
                
                {/* 🔍 공급받는 자 (업체명) 검색 및 드롭다운 선택 닫힘 처리 */}
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>공급받는 자 (업체명)*</label>
                  <input 
                    placeholder="업체명 검색 입력..." 
                    value={outboundForm.company_name} 
                    onChange={(e) => {
                      setOutboundForm({ ...outboundForm, company_name: e.target.value })
                      setShowCompanyDropdown(true)
                    }} 
                    onFocus={() => setShowCompanyDropdown(true)}
                    style={inputStyle} 
                    required 
                  />
                  {showCompanyDropdown && outboundForm.company_name.trim() && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #CBD5E1', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', zIndex: 50, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                      {companies.filter(c => c.name && c.name.toLowerCase().includes(outboundForm.company_name.toLowerCase())).length === 0 ? (
                        <div style={{ padding: '8px 12px', fontSize: '12px', color: '#94A3B8' }}>일치하는 거래처가 없습니다 (직접 입력 가능)</div>
                      ) : (
                        companies.filter(c => c.name && c.name.toLowerCase().includes(outboundForm.company_name.toLowerCase())).map(c => (
                          <div 
                            key={c.id || c.name} 
                            onClick={() => {
                              setOutboundForm({ ...outboundForm, company_name: c.name })
                              setShowCompanyDropdown(false) // 💡 선택 시 드롭다운 즉시 닫기
                            }}
                            style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = '#F8FAFC'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
                          >
                            <strong>{c.name}</strong> {c.ceo ? <span style={{ color: '#64748B' }}>({c.ceo})</span> : ''}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div><label style={labelStyle}>장비 S/N</label><input placeholder="장비 S/N" value={outboundForm.equipment_sn} onChange={(e) => setOutboundForm({ ...outboundForm, equipment_sn: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>발행 일자</label><input type="date" value={outboundForm.date} onChange={(e) => setOutboundForm({ ...outboundForm, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>작성자</label><input value={outboundForm.author} onChange={(e) => setOutboundForm({ ...outboundForm, author: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>출고 품목 명세 (품번 입력 시 품명 자동 출력)</span>
                  <button type="button" onClick={() => setOutboundForm({ ...outboundForm, items: [...outboundForm.items, { code: '', name: '', qty: 1, note: '' }] })} style={{ border: 'none', background: '#D97706', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 품목 추가</button>
                </div>
                {outboundForm.items.map((item, idx) => (
                  <div key={idx} style={{ position: 'relative', marginBottom: '12px', backgroundColor: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr 0.8fr 30px', gap: '8px', alignItems: 'center' }}>
                      <input 
                        placeholder="품번/코드" 
                        value={item.code} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...outboundForm.items];
                          updated[idx].code = val;
                          const found = partsList.find(p => p.code && p.code.trim().toLowerCase() === val.trim().toLowerCase());
                          if (found) updated[idx].name = found.name || '';
                          setOutboundForm({ ...outboundForm, items: updated });
                        }} 
                        style={inputStyle} 
                      />
                      <input placeholder="품명" value={item.name} onChange={(e) => {
                        const updated = [...outboundForm.items]; updated[idx].name = e.target.value;
                        setOutboundForm({ ...outboundForm, items: updated });
                      }} style={inputStyle} />
                      <input type="number" placeholder="수량" value={item.qty} onChange={(e) => {
                        const updated = [...outboundForm.items]; updated[idx].qty = e.target.value;
                        setOutboundForm({ ...outboundForm, items: updated })
                      }} style={inputStyle} />
                      <button type="button" onClick={() => setOutboundForm({ ...outboundForm, items: outboundForm.items.filter((_, i) => i !== idx) })} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer', textAlign: 'center' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <div><label style={labelStyle}>비고 및 특이사항</label><textarea rows="3" value={outboundForm.note} onChange={(e) => setOutboundForm({ ...outboundForm, note: e.target.value })} style={inputStyle} /></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowOutboundModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#D97706', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>출고 완료 및 재고 차감</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 이력 상세 보기 모달 */}
      {selectedHistory !== null && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '540px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                  {selectedHistory.type === 'INBOUND' ? '📥 입고증 상세 내역' : '📤 출고증 상세 내역'}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>발행일자: {selectedHistory.date} | 작성자: {selectedHistory.author}</div>
              </div>
              <button type="button" onClick={() => setSelectedHistory(null)} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: '#334155' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ marginBottom: '8px' }}><strong>{selectedHistory.type === 'INBOUND' ? '입고처 / 창고:' : '공급받는 업체:'}</strong> {selectedHistory.company_name}</div>
                {selectedHistory.equipment_sn && <div style={{ marginBottom: '8px' }}><strong>장비 S/N:</strong> {selectedHistory.equipment_sn}</div>}
                <div><strong>품목 명세:</strong><p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{selectedHistory.summary}</p></div>
              </div>

              <div>
                <strong>📌 비고 및 특이사항:</strong>
                <p style={{ margin: '4px 0 0 0', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', minHeight: '60px', color: '#475569' }}>
                  {selectedHistory.note || '등록된 비고 및 특이사항이 없습니다.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={() => setSelectedHistory(null)} style={{ padding: '8px 20px', background: '#2563EB', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 입고증 작성 모달 */}
      {showInboundModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: '24px', width: '820px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>📥 입고증 작성 (INBOUND NOTE)</h3>
              <button type="button" onClick={() => setShowInboundModal(false)} style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}>✕</button>
            </div>
            <form onSubmit={handleSaveInbound} onKeyDown={(e) => { if(e.key === 'Enter') e.preventDefault() }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>발행 일자</label><input type="date" value={inboundForm.date} onChange={(e) => setInboundForm({ ...inboundForm, date: e.target.value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>작성자</label><input value={inboundForm.author} onChange={(e) => setInboundForm({ ...inboundForm, author: e.target.value })} style={inputStyle} /></div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>입고 품목 명세</span>
                  <button type="button" onClick={() => setInboundForm({ ...inboundForm, items: [...inboundForm.items, { code: '', name: '', category: '일반부품', qty: 1, lot_number: '', expiry: '', serials: [] }] })} style={{ border: 'none', background: '#059669', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>+ 품목 추가</button>
                </div>
                {inboundForm.items.map((item, idx) => (
                  <div key={idx} style={{ backgroundColor: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', marginBottom: '10px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr 1fr 0.8fr 30px', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <input 
                        placeholder="품번/코드" 
                        value={item.code} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...inboundForm.items]; 
                          updated[idx].code = val;
                          const found = partsList.find(p => p.code && p.code.trim().toLowerCase() === val.trim().toLowerCase());
                          if (found) {
                            updated[idx].name = found.name || '';
                            updated[idx].category = found.category || '일반부품';
                          }
                          setInboundForm({ ...inboundForm, items: updated });
                        }} 
                        style={inputStyle} 
                      />
                      <input placeholder="품명" value={item.name} onChange={(e) => {
                        const updated = [...inboundForm.items]; updated[idx].name = e.target.value;
                        setInboundForm({ ...inboundForm, items: updated })
                      }} style={inputStyle} />
                      <select value={item.category} onChange={(e) => {
                        const updated = [...inboundForm.items]; updated[idx].category = e.target.value;
                        setInboundForm({ ...inboundForm, items: updated })
                      }} style={inputStyle}>
                        <option value="일반부품">일반부품</option>
                        <option value="잉크">잉크</option>
                        <option value="희석제">희석제</option>
                        <option value="프린터">프린터</option>
                        <option value="라이너">라이너</option>
                        <option value="필터류">필터류</option>
                        <option value="기타">기타</option>
                      </select>
                      <input type="number" placeholder="수량" value={item.qty} onChange={(e) => {
                        const updated = [...inboundForm.items]; updated[idx].qty = e.target.value;
                        setInboundForm({ ...inboundForm, items: updated })
                      }} style={inputStyle} />
                      <button type="button" onClick={() => setInboundForm({ ...inboundForm, items: inboundForm.items.filter((_, i) => i !== idx) })} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '16px', cursor: 'pointer', textAlign: 'center' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>

              <div><label style={labelStyle}>비고 및 특이사항</label><textarea rows="3" value={inboundForm.note} onChange={(e) => setInboundForm({ ...inboundForm, note: e.target.value })} style={inputStyle} /></div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowInboundModal(false)} style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer' }}>입고 완료 및 재고 반영</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}