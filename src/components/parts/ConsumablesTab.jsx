import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

const createEmptyDeliveryItem = () => ({
  partId: '',
  searchKeyword: '',
  selectedLotKey: '',
  quantity: 1,
  showDropdown: false,
})

export default function ConsumablesTab({ partsList, refreshParts, showAddForm, setShowAddForm, user }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [companies, setCompanies] = useState([])

  const getLoggedInUserName = () => {
    if (user?.full_name) return user.full_name
    if (user?.name) return user.name
    try {
      const saved = JSON.parse(localStorage.getItem('mace_desk_user') || 'null')
      if (saved?.full_name) return saved.full_name
      if (saved?.name) return saved.name
      if (saved?.username) return saved.username
    } catch (e) {}
    return user?.username || user?.email?.split('@')[0] || '배진철'
  }

  const currentLoggedInName = getLoggedInUserName()

  const getTodayLocalDate = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [quickLotPart, setQuickLotPart] = useState(null)
  const [quickLotNo, setQuickLotNo] = useState('')
  const [quickReceivedDate, setQuickReceivedDate] = useState(getTodayLocalDate())
  const [quickExpiry, setQuickExpiry] = useState('')
  const [quickQty, setQuickQty] = useState('')
  const [quickNote, setQuickNote] = useState('')

  const [outboundPart, setOutboundPart] = useState(null)
  const [outboundCompany, setOutboundCompany] = useState('')
  const [outboundDate, setOutboundDate] = useState(getTodayLocalDate())
  const [outboundNote, setOutboundNote] = useState('')
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [outboundLotInputs, setOutboundLotInputs] = useState({})

  // 다중 소모품 출고증 (DELIVERY NOTE) 모달 상태
  const [isMultiDeliveryOpen, setIsMultiDeliveryOpen] = useState(false)
  const [deliveryCompanyName, setDeliveryCompanyName] = useState('')
  const [showDeliveryCompanyDropdown, setShowDeliveryCompanyDropdown] = useState(false)
  const [deliveryDate, setDeliveryDate] = useState(getTodayLocalDate())
  const [deliveryAuthor, setDeliveryAuthor] = useState(currentLoggedInName)
  const [equipmentSns, setEquipmentSns] = useState([''])
  const [deliveryItems, setDeliveryItems] = useState([createEmptyDeliveryItem()])
  const [deliveryNoteText, setDeliveryNoteText] = useState('')
  const [isSavingDelivery, setIsSavingDelivery] = useState(false)

  const [partName, setPartName] = useState('')
  const [partCode, setPartCode] = useState('')
  const [partCategory, setPartCategory] = useState('잉크')
  const [dealerPrice, setDealerPrice] = useState(0)
  const [customerPrice, setCustomerPrice] = useState(0)
  const [partNote, setPartNote] = useState('')
  const [lots, setLots] = useState([])
  const [companyPrices, setCompanyPrices] = useState([])

  const [selectedExpiryPart, setSelectedExpiryPart] = useState(null)
  const [expiryLotPriceInputs, setExpiryLotPriceInputs] = useState({})

  const [selectedSpecialPart, setSelectedSpecialPart] = useState(null)
  const [selectedSpecialPrices, setSelectedSpecialPrices] = useState([])
  const [activeSpecialCompanyIdx, setActiveSpecialCompanyIdx] = useState(null)

  const [editingPart, setEditingPart] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    category: '잉크',
    customer_price: 0,
    dealer_price: 0,
    stock: 0,
    note: '',
  })

  useEffect(() => {
    fetchCompanies()
  }, [])

  useEffect(() => {
    setDeliveryAuthor(getLoggedInUserName())
  }, [user])

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    if (data) setCompanies(data)
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: '10px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    outline: 'none',
    boxSizing: 'border-box',
  }
  const labelStyle = {
    fontSize: '13px',
    fontWeight: '700',
    color: '#475569',
    marginBottom: '6px',
    display: 'block',
  }

  const getLotPrice = (l) => {
    const p = l?.unit_price !== undefined ? l.unit_price : l?.price !== undefined ? l.price : 0
    return Number(p || 0)
  }

  const parsePartLots = (rawLots) => {
    try {
      const parsed = typeof rawLots === 'string' ? JSON.parse(rawLots || '[]') : rawLots
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }

  const getLotOptionKey = (lot, idx) =>
    `${idx}::${lot?.lot_number || ''}::${lot?.received_date || ''}::${lot?.expiry || ''}`

  const isConsumableCategory = (category) => {
    const cat = String(category || '').trim()
    return cat === '잉크' || cat === '희석제' || cat === '소모품'
  }

  const consumableParts = (partsList || [])
    .filter((p) => isConsumableCategory(p?.category))
    .sort((a, b) => {
      const codeDiff = (a.code || '').localeCompare(b.code || '', 'ko-KR')
      if (codeDiff !== 0) return codeDiff
      return (a.name || '').localeCompare(b.name || '', 'ko-KR')
    })

  const filteredParts = consumableParts.filter((p) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.trim().toLowerCase()
    return p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
  })

  const openMultiDeliveryModal = () => {
    setDeliveryCompanyName('')
    setShowDeliveryCompanyDropdown(false)
    setDeliveryDate(getTodayLocalDate())
    setDeliveryAuthor(getLoggedInUserName())
    setEquipmentSns([''])
    setDeliveryItems([createEmptyDeliveryItem()])
    setDeliveryNoteText('')
    setIsMultiDeliveryOpen(true)
  }

  const deductFromPartStockLots = async (partId, lotNumber, deductQty) => {
    if (!lotNumber || deductQty <= 0) return
    const { data: matchingLots, error } = await supabase
      .from('part_stock_lots')
      .select('*')
      .eq('part_id', partId)
      .eq('po_number', lotNumber)
      .gt('current_qty', 0)
      .order('import_date', { ascending: true })

    if (error) throw error

    let remainingToDeduct = deductQty
    if (matchingLots && matchingLots.length > 0) {
      for (const dbLot of matchingLots) {
        if (remainingToDeduct <= 0) break
        const deductFromThis = Math.min(Number(dbLot.current_qty || 0), remainingToDeduct)
        const nextQty = Math.max(0, Number(dbLot.current_qty || 0) - deductFromThis)
        const { error: updErr } = await supabase
          .from('part_stock_lots')
          .update({ current_qty: nextQty })
          .eq('id', dbLot.id)
        if (updErr) throw updErr
        remainingToDeduct -= deductFromThis
      }
    }
  }

  const handleMultiDeliverySubmit = async (e) => {
    e.preventDefault()
    if (isSavingDelivery) return

    if (!deliveryCompanyName.trim()) {
      return alert('공급받는 자 (업체명 또는 수신자)를 입력해주세요!')
    }

    if (!Array.isArray(deliveryItems) || deliveryItems.length === 0) {
      return alert('출고할 소모품 명세를 1개 이상 추가해주세요!')
    }

    // 1. 입력 검증 및 행별 로트/수량 매핑
    const preparedRows = []
    const plannedDeductByPart = new Map()

    for (let i = 0; i < deliveryItems.length; i++) {
      const row = deliveryItems[i]
      if (!row.partId) {
        return alert(`${i + 1}행의 소모품을 선택해주세요!`)
      }

      const partObj = consumableParts.find((p) => String(p.id) === String(row.partId))
      if (!partObj) {
        return alert(`${i + 1}행에서 선택한 소모품 정보를 찾을 수 없습니다.`)
      }

      const qtyNum = Number(row.quantity)
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        return alert(`${i + 1}행(${partObj.name})의 출고 수량을 1 이상으로 입력해주세요!`)
      }

      const partLots = parsePartLots(partObj.lots)
      const availableLots = partLots
        .map((lot, lotIdx) => ({
          lot,
          lotIdx,
          key: getLotOptionKey(lot, lotIdx),
          availQty: Number(lot?.qty || 0),
        }))
        .filter((entry) => entry.availQty > 0)

      if (availableLots.length === 0) {
        return alert(
          `[${partObj.code}] ${partObj.name} 품목은 출고 가능한 잔여 로트가 없습니다. (현재고: ${partObj.stock ?? 0}개)`
        )
      }

      if (!row.selectedLotKey) {
        return alert(`${i + 1}행(${partObj.name})의 출고 로트를 직접 선택해주세요!`)
      }

      const chosenLotEntry = availableLots.find((entry) => entry.key === row.selectedLotKey)
      if (!chosenLotEntry) {
        return alert(
          `${i + 1}행(${partObj.name})에서 선택한 로트의 잔여 수량이 없거나 유효하지 않습니다.`
        )
      }

      if (qtyNum > chosenLotEntry.availQty) {
        return alert(
          `${i + 1}행(${partObj.name})의 출고 수량(${qtyNum}개)이 선택한 로트 [${
            chosenLotEntry.lot.lot_number || '미지정'
          }]의 잔여 수량(${chosenLotEntry.availQty}개)을 초과합니다!`
        )
      }

      const partKey = String(partObj.id)
      if (!plannedDeductByPart.has(partKey)) {
        plannedDeductByPart.set(partKey, {
          partObj,
          baseLots: partLots.map((l) => ({ ...l, qty: Number(l?.qty || 0) })),
          deductions: [],
        })
      }

      const partPlan = plannedDeductByPart.get(partKey)
      const alreadyPlannedForLot = partPlan.deductions
        .filter((d) => d.lotIdx === chosenLotEntry.lotIdx)
        .reduce((sum, d) => sum + d.qty, 0)

      if (alreadyPlannedForLot + qtyNum > chosenLotEntry.availQty) {
        return alert(
          `[${partObj.name}]의 동일 로트 [${
            chosenLotEntry.lot.lot_number || '미지정'
          }] 출고 합계(${alreadyPlannedForLot + qtyNum}개)가 잔여 수량(${
            chosenLotEntry.availQty
          }개)을 초과합니다!`
        )
      }

      const detailObj = {
        lot_number: chosenLotEntry.lot.lot_number || '',
        expiry: chosenLotEntry.lot.expiry || '',
        received_date: chosenLotEntry.lot.received_date || '',
        unit_price: getLotPrice(chosenLotEntry.lot),
        qty: qtyNum,
      }

      partPlan.deductions.push({
        lotIdx: chosenLotEntry.lotIdx,
        qty: qtyNum,
        detail: detailObj,
      })

      preparedRows.push({
        partObj,
        lot: chosenLotEntry.lot,
        quantity: qtyNum,
        detail: detailObj,
      })
    }

    setIsSavingDelivery(true)
    try {
      const validEquipSns = equipmentSns.map((s) => String(s || '').trim()).filter(Boolean)
      const outboundDateVal = deliveryDate || getTodayLocalDate()
      const companyVal = deliveryCompanyName.trim()
      const authorVal = (deliveryAuthor || currentLoggedInName || '배진철').trim()
      const baseNoteText = deliveryNoteText.trim()
        ? deliveryNoteText.trim()
        : validEquipSns.length > 0
          ? `장비 S/N: ${validEquipSns.join(', ')} / 소모품 출고증 발행`
          : '소모품 출고증 발행'

      // 전체 출고증 상세 payload (DeliveryHistoryTab 출고증 보기 & 인쇄용)
      const allItemsPayload = preparedRows.map((r) => ({
        partId: r.partObj.id,
        code: r.partObj.code || '-',
        name: r.partObj.name,
        isSerial: false,
        selectedSn: r.lot.lot_number ? `Lot: ${r.lot.lot_number}` : '-',
        expiry: r.lot.expiry || '',
        quantity: r.quantity,
        unitPrice: r.detail.unit_price || 0,
      }))

      const fullDeliveryPayloadJson = JSON.stringify({
        kind: 'CONSUMABLES_MULTI',
        equipmentSns: validEquipSns,
        items: allItemsPayload,
      })

      // 2. 품목별 재고·로트 차감 및 delivery_history 기록
      for (const [, plan] of plannedDeductByPart.entries()) {
        const { partObj, baseLots, deductions } = plan

        const updatedLots = baseLots
          .map((lot, idx) => {
            const subForIdx = deductions
              .filter((d) => d.lotIdx === idx)
              .reduce((sum, d) => sum + d.qty, 0)
            return {
              ...lot,
              qty: Math.max(0, Number(lot.qty || 0) - subForIdx),
            }
          })
          .filter((lot) => Number(lot.qty || 0) > 0)

        const newTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

        const { error: partErr } = await supabase
          .from('parts')
          .update({
            lots: JSON.stringify(updatedLots),
            stock: newTotalStock,
          })
          .eq('id', partObj.id)

        if (partErr) {
          throw new Error(`[${partObj.name}] 재고 업데이트 실패: ${partErr.message}`)
        }

        const deductedDetailsForPart = deductions.map((d) => d.detail)
        for (const d of deductions) {
          await deductFromPartStockLots(partObj.id, d.detail.lot_number, d.qty)
        }

        const partTotalQty = deductions.reduce((sum, d) => sum + d.qty, 0)
        const codePrefix = partObj.code ? `[${partObj.code}] ` : ''
        const summaryText = `${codePrefix}${partObj.name} (${partTotalQty}개)`
        const lotSummaryStr = deductedDetailsForPart
          .map((d) => `${d.lot_number || '미지정'}(${d.qty}개)`)
          .join(', ')

        const restoreTag = `[LOT_RESTORE:${JSON.stringify(deductedDetailsForPart)}]`
        const detailsTag = `[DELIVERY_DETAILS:${fullDeliveryPayloadJson}]`
        const finalNote = `${baseNoteText} ${restoreTag} ${detailsTag}`

        const { error: histErr } = await supabase.from('delivery_history').insert([
          {
            date: outboundDateVal,
            company_name: companyVal,
            equipment_sn: validEquipSns.length > 0 ? validEquipSns.join(', ') : lotSummaryStr || '-',
            summary: summaryText,
            author: authorVal,
            note: finalNote,
            type: 'OUTBOUND',
            part_id: partObj.id,
          },
        ])

        if (histErr) {
          throw new Error(`[${partObj.name}] 출고 이력 저장 실패: ${histErr.message}`)
        }
      }

      alert('소모품 출고증이 발행되었으며, 재고·로트 및 출고 이력에 반영되었습니다.')
      setIsMultiDeliveryOpen(false)
      setDeliveryCompanyName('')
      setEquipmentSns([''])
      setDeliveryItems([createEmptyDeliveryItem()])
      setDeliveryNoteText('')
      if (typeof refreshParts === 'function') {
        await refreshParts()
      }
    } catch (err) {
      console.error('다중 소모품 출고증 발행 오류:', err)
      alert(err?.message || '출고증 발행 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSavingDelivery(false)
    }
  }

  const handleDeleteLotItem = async (lotItem, lotIdx) => {
    const lotLabel = lotItem.lot_number || lotItem.po_number || '공백'
    if (!window.confirm(`Lot [${lotLabel}]을 삭제하시겠습니까?`)) return

    try {
      if (lotItem.id) {
        const { error: lotDelByIdError } = await supabase
          .from('part_stock_lots')
          .delete()
          .eq('id', lotItem.id)
        if (lotDelByIdError) {
          return alert('로트 테이블 삭제 실패: ' + lotDelByIdError.message)
        }
      } else {
        let deleteQuery = supabase
          .from('part_stock_lots')
          .delete()
          .eq('part_id', selectedExpiryPart.id)

        if (lotItem.lot_number || lotItem.po_number) {
          deleteQuery = deleteQuery.eq('po_number', lotItem.lot_number || lotItem.po_number)
        }
        if (lotItem.received_date || lotItem.import_date) {
          deleteQuery = deleteQuery.eq('import_date', lotItem.received_date || lotItem.import_date)
        }
        const targetQty = Number(lotItem.qty ?? lotItem.initial_qty ?? 0)
        if (targetQty > 0) {
          deleteQuery = deleteQuery.eq('initial_qty', targetQty)
        }

        const { error: lotDelError } = await deleteQuery
        if (lotDelError) {
          return alert('로트 테이블 삭제 실패: ' + lotDelError.message)
        }
      }

      const currentLots = parsePartLots(selectedExpiryPart.lots)
      const updatedLots = currentLots.filter((_, i) => i !== lotIdx)
      const calcStock = updatedLots.reduce((sum, item) => sum + Number(item.qty || 0), 0)

      const { error: partUpdateError } = await supabase
        .from('parts')
        .update({
          lots: JSON.stringify(updatedLots),
          stock: calcStock,
        })
        .eq('id', selectedExpiryPart.id)
        .eq('code', selectedExpiryPart.code)

      if (partUpdateError) {
        return alert('품목 로트 동기화 실패: ' + partUpdateError.message)
      }

      setExpiryLotPriceInputs({})
      setSelectedExpiryPart({ ...selectedExpiryPart, lots: updatedLots, stock: calcStock })
      if (typeof refreshParts === 'function') refreshParts()
    } catch (err) {
      console.error('로트 삭제 중 오류:', err)
      alert('로트 삭제 처리 중 오류가 발생했습니다.')
    }
  }

  const handleAddPart = async (e) => {
    e.preventDefault()
    if (!partName.trim() || !partCode.trim()) return alert('품명과 품번/코드를 입력해주세요!')

    const calculatedStock = lots.reduce((sum, l) => sum + Number(l.qty || 0), 0)
    const validPrices = companyPrices.filter((cp) => cp.company_name.trim() !== '')

    const { error } = await supabase.from('parts').insert([
      {
        name: partName.trim(),
        code: partCode.trim(),
        category: partCategory,
        dealer_price: Number(dealerPrice),
        customer_price: Number(customerPrice),
        stock: calculatedStock,
        lots: JSON.stringify(lots),
        company_prices: JSON.stringify(validPrices),
        note: partNote,
        is_favorite: false,
      },
    ])

    if (!error) {
      alert('신규 소모품이 성공적으로 등록되었습니다.')
      setPartName('')
      setPartCode('')
      setPartNote('')
      setLots([])
      setCompanyPrices([])
      setShowAddForm(false)
      refreshParts()
    } else {
      alert('등록 실패: ' + error.message)
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingPart) return

    const newTargetStock = Number(editForm.stock || 0)
    const currentLots = parsePartLots(editingPart.lots)

    const currentLotSum = currentLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)
    if (newTargetStock !== currentLotSum) {
      if (currentLots.length > 0) {
        const diff = newTargetStock - currentLotSum
        currentLots[0].qty = Math.max(0, Number(currentLots[0].qty || 0) + diff)
      } else {
        currentLots.push({
          lot_number: '재고보정',
          received_date: getTodayLocalDate(),
          expiry: '',
          qty: newTargetStock,
        })
      }
    }

    const { error } = await supabase
      .from('parts')
      .update({
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        category: editForm.category,
        customer_price: Number(editForm.customer_price),
        dealer_price: Number(editForm.dealer_price),
        stock: newTargetStock,
        lots: JSON.stringify(currentLots),
        note: editForm.note,
      })
      .eq('id', editingPart.id)

    if (!error) {
      alert('품목 정보 및 재고 수량이 수정되었습니다.')
      setEditingPart(null)
      refreshParts()
    } else {
      alert('수정 실패: ' + error.message)
    }
  }

  const handleDeletePart = async (id, name, code) => {
    if (!window.confirm(`[${code}] ${name} 품목을 정말 삭제하시겠습니까?`)) return
    const { error } = await supabase.from('parts').delete().eq('id', id)
    if (!error) {
      alert('품목이 삭제되었습니다.')
      refreshParts()
    } else {
      alert('삭제 실패: ' + error.message)
    }
  }

  const handleQuickAddLot = async (e) => {
    e.preventDefault()
    if (!quickLotPart) return
    if (!quickQty || Number(quickQty) <= 0) return alert('입고 수량을 정확히 입력해주세요!')

    const inboundDateVal = quickReceivedDate || getTodayLocalDate()
    const qtyNum = Number(quickQty)
    const poNumberVal = quickLotNo.trim() || `LOT-${Date.now().toString().slice(-6)}`
    const priceNum = 0

    const { error: lotError } = await supabase.from('part_stock_lots').insert([
      {
        part_id: quickLotPart.id,
        po_number: poNumberVal,
        import_date: inboundDateVal,
        expiry_date: quickExpiry || null,
        unit_price: priceNum,
        initial_qty: qtyNum,
        current_qty: qtyNum,
      },
    ])

    if (lotError) return alert('로트 입고 등록 오류: ' + lotError.message)

    const currentLots = parsePartLots(quickLotPart.lots)
    const newLot = {
      lot_number: poNumberVal,
      received_date: inboundDateVal,
      expiry: quickExpiry || '',
      qty: qtyNum,
      unit_price: priceNum,
    }

    const updatedLots = [...currentLots, newLot]
    const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

    const { error: partError } = await supabase
      .from('parts')
      .update({
        lots: JSON.stringify(updatedLots),
        stock: calculatedTotalStock,
      })
      .eq('id', quickLotPart.id)
      .eq('code', quickLotPart.code)

    if (partError) return alert('입고 처리 오류: ' + partError.message)

    const partCodeStr = quickLotPart.code ? `[${quickLotPart.code}] ` : ''
    const summaryText = `${partCodeStr}${quickLotPart.name} (${qtyNum}개)`

    let noteContent = quickExpiry ? `유통기한: ${quickExpiry}` : ''
    if (quickNote.trim()) {
      noteContent += (noteContent ? ' / ' : '') + quickNote.trim()
    }

    await supabase.from('delivery_history').insert([
      {
        date: inboundDateVal,
        company_name: '본사 창고 (입고)',
        equipment_sn: `LOT: ${poNumberVal}`,
        summary: summaryText,
        author: getLoggedInUserName(),
        note: noteContent,
        type: 'INBOUND',
        part_id: quickLotPart.id,
      },
    ])

    alert(`[${quickLotPart.code}] 선입고가 정상 등록되었습니다.`)
    setQuickLotPart(null)
    setQuickQty('')
    setQuickExpiry('')
    setQuickLotNo('')
    setQuickNote('')
    refreshParts()
  }

  const handleOutboundSubmit = async (e) => {
    e.preventDefault()
    if (!outboundPart) return
    if (!outboundCompany.trim()) return alert('공급받는 업체명을 입력해주세요!')

    const currentLots = parsePartLots(outboundPart.lots)
    let totalOutboundQty = 0
    const deductedDetails = []

    try {
      const updatedLots = currentLots
        .map((lot, idx) => {
          const inputVal = outboundLotInputs[idx]
          const deductQty = inputVal ? Number(inputVal) : 0
          if (deductQty < 0) return lot
          if (deductQty > Number(lot.qty || 0)) {
            alert(
              `Lot [${lot.lot_number || '미지정'}]의 재고 수량(${lot.qty}개)보다 많은 수량을 출고할 수 없습니다!`
            )
            throw new Error('Over-deduct')
          }
          if (deductQty > 0) {
            totalOutboundQty += deductQty
            deductedDetails.push({
              lot_number: lot.lot_number || '',
              expiry: lot.expiry || '',
              received_date: lot.received_date || '',
              unit_price: getLotPrice(lot),
              qty: deductQty,
            })
          }
          return {
            ...lot,
            qty: Number(lot.qty || 0) - deductQty,
          }
        })
        .filter((lot) => Number(lot.qty) > 0)

      if (totalOutboundQty <= 0) return alert('출고할 수량을 하나 이상 입력해주세요!')

      const calculatedTotalStock = updatedLots.reduce((sum, l) => sum + Number(l.qty || 0), 0)

      const { error: partError } = await supabase
        .from('parts')
        .update({
          lots: JSON.stringify(updatedLots),
          stock: calculatedTotalStock,
        })
        .eq('id', outboundPart.id)
        .eq('code', outboundPart.code)

      if (partError) return alert('출고 처리 오류: ' + partError.message)

      for (const detail of deductedDetails) {
        if (detail.lot_number) {
          await deductFromPartStockLots(outboundPart.id, detail.lot_number, detail.qty)
        }
      }

      const outboundDateVal = outboundDate || getTodayLocalDate()
      const partCodeStr = outboundPart.code ? `[${outboundPart.code}] ` : ''
      const summaryText = `${partCodeStr}${outboundPart.name} (${totalOutboundQty}개)`
      const lotSummaryStr = deductedDetails
        .map((d) => `${d.lot_number || '미지정'}(${d.qty}개)`)
        .join(', ')

      const deliveryPayloadJson = JSON.stringify({
        equipmentSns: [],
        items: deductedDetails.map((d) => ({
          code: outboundPart.code || '-',
          name: outboundPart.name,
          isSerial: false,
          selectedSn: d.lot_number ? `Lot: ${d.lot_number}` : '-',
          quantity: d.qty,
          unitPrice: d.unit_price || 0,
        })),
      })

      const userNoteInput = outboundNote.trim() ? outboundNote.trim() : '소모품 로트 출고'
      const restoreTag = `[LOT_RESTORE:${JSON.stringify(deductedDetails)}]`
      const detailsTag = `[DELIVERY_DETAILS:${deliveryPayloadJson}]`
      const finalNote = `${userNoteInput} ${restoreTag} ${detailsTag}`

      await supabase.from('delivery_history').insert([
        {
          date: outboundDateVal,
          company_name: outboundCompany.trim(),
          equipment_sn: lotSummaryStr || '-',
          summary: summaryText,
          author: getLoggedInUserName(),
          note: finalNote,
          type: 'OUTBOUND',
          part_id: outboundPart.id,
        },
      ])

      alert('출고가 완료되고 이력 및 결산 재고에 반영되었습니다.')
      setOutboundPart(null)
      setOutboundCompany('')
      setOutboundNote('')
      setOutboundLotInputs({})
      refreshParts()
    } catch (err) {
      if (err.message !== 'Over-deduct') console.error(err)
    }
  }

  return (
    <div>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-consumables-delivery-note, #printable-consumables-delivery-note * {
            visibility: visible;
          }
          #printable-consumables-delivery-note {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background-color: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            padding: 12px !important;
            margin: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {showAddForm && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #E2E8F0',
            marginBottom: '20px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          }}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
            🧪 신규 소모품 품목 등록
          </h4>
          <form onSubmit={handleAddPart} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>품번 / 코드*</label>
                <input
                  placeholder="예: 70000-00155"
                  value={partCode}
                  onChange={(e) => setPartCode(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>품명*</label>
                <input
                  placeholder="예: 잉크 (K-100)"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>구분</label>
                <select value={partCategory} onChange={(e) => setPartCategory(e.target.value)} style={inputStyle}>
                  <option value="잉크">잉크</option>
                  <option value="희석제">희석제</option>
                  <option value="소모품">소모품</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>소비자 기본가 (원)</label>
                <input
                  type="number"
                  value={customerPrice}
                  onChange={(e) => setCustomerPrice(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>딜러 기본가 (원)</label>
                <input
                  type="number"
                  value={dealerPrice}
                  onChange={(e) => setDealerPrice(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>업체별 개별 특가 (선택)</span>
                <button
                  type="button"
                  onClick={() => setCompanyPrices([...companyPrices, { company_name: '', price: 0 }])}
                  style={{
                    border: 'none',
                    background: '#EFF6FF',
                    color: '#2563EB',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  + 업체 특가 추가
                </button>
              </div>
              {companyPrices.map((cp, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                  <input
                    type="text"
                    placeholder="업체명..."
                    value={cp.company_name}
                    onChange={(e) => {
                      const updated = [...companyPrices]
                      updated[idx].company_name = e.target.value
                      setCompanyPrices(updated)
                    }}
                    style={{ ...inputStyle, flex: 1.5 }}
                  />
                  <input
                    type="number"
                    placeholder="특가(원)"
                    value={cp.price}
                    onChange={(e) => {
                      const updated = [...companyPrices]
                      updated[idx].price = e.target.value
                      setCompanyPrices(updated)
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setCompanyPrices(companyPrices.filter((_, i) => i !== idx))}
                    style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '14px', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label style={labelStyle}>📌 비고</label>
              <textarea
                rows="2"
                placeholder="특이사항 입력"
                value={partNote}
                onChange={(e) => setPartNote(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                style={{
                  padding: '10px 18px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                취소
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  background: '#2563EB',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                등록 저장
              </button>
            </div>
          </form>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="text"
          placeholder="🔍 소모품 품번/코드 또는 품명 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, padding: '12px', maxWidth: '360px', flex: 1 }}
        />

        <button
          type="button"
          onClick={openMultiDeliveryModal}
          style={{
            background: '#059669',
            color: '#fff',
            border: 'none',
            padding: '11px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          📄 출고증 발행
        </button>
      </div>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '14px 16px', width: '80px' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '130px' }}>품번 / 코드</th>
              <th style={{ padding: '14px 16px', width: '180px' }}>품명</th>
              <th style={{ padding: '14px 16px', width: '160px' }}>재고 수량 및 유통기한</th>
              <th style={{ padding: '14px 16px', width: '140px' }}>업체별 특가</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>소비자가</th>
              <th style={{ padding: '14px 16px', width: '100px' }}>딜러가</th>
              <th style={{ padding: '14px 16px', width: '160px', textAlign: 'center' }}>재고 입·출고</th>
              <th style={{ padding: '14px 16px', width: '110px', textAlign: 'center' }}>관리 (수정/삭제)</th>
            </tr>
          </thead>
          <tbody>
            {filteredParts.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  등록된 소모품이 없습니다.
                </td>
              </tr>
            ) : (
              filteredParts.map((p) => {
                let parsedCompanyPrices = []
                try {
                  const temp = p.company_prices
                    ? typeof p.company_prices === 'string'
                      ? JSON.parse(p.company_prices)
                      : p.company_prices
                    : []
                  parsedCompanyPrices = Array.isArray(temp) ? temp.filter((cp) => cp && cp.company_name) : []
                } catch (e) {}
                const specialPriceCount = parsedCompanyPrices.length

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                        }}
                      >
                        {p.category || '소모품'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '800', color: '#2563EB', wordBreak: 'break-all' }}>
                      {p.code || '-'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0F172A', wordBreak: 'break-all' }}>
                      {p.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '800', color: '#10B981', fontSize: '14px' }}>{p.stock ?? 0} 개</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedExpiryPart(p)
                            setExpiryLotPriceInputs({})
                          }}
                          style={{
                            border: 'none',
                            background: '#F0FDF4',
                            color: '#166534',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          ⏳ 유통기한/단가 🔍
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSpecialPart(p)
                          setSelectedSpecialPrices(parsedCompanyPrices)
                          setActiveSpecialCompanyIdx(null)
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: specialPriceCount > 0 ? '#D97706' : '#64748B',
                          backgroundColor: specialPriceCount > 0 ? '#FEF3C7' : '#F1F5F9',
                          border: specialPriceCount > 0 ? '1px solid #FCD34D' : '1px solid #CBD5E1',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          cursor: 'pointer',
                        }}
                      >
                        🏷️ 지정 특가 {specialPriceCount}개 [보기]
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563EB' }}>
                      {p.customer_price ? Number(p.customer_price).toLocaleString() : 0} 원
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: '#334155' }}>
                      {p.dealer_price ? Number(p.dealer_price).toLocaleString() : 0} 원
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setQuickLotPart(p)}
                          style={{
                            background: '#059669',
                            color: '#fff',
                            border: 'none',
                            padding: '5px 9px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          + 입고
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOutboundPart(p)
                            setOutboundLotInputs({})
                          }}
                          style={{
                            background: '#D97706',
                            color: '#fff',
                            border: 'none',
                            padding: '5px 9px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          - 출고
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPart(p)
                            setEditForm({
                              name: p.name,
                              code: p.code,
                              category: p.category || '잉크',
                              customer_price: p.customer_price || 0,
                              dealer_price: p.dealer_price || 0,
                              stock: p.stock ?? 0,
                              note: p.note || '',
                            })
                          }}
                          style={{
                            background: '#EFF6FF',
                            color: '#2563EB',
                            border: 'none',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePart(p.id, p.name, p.code)}
                          style={{
                            background: '#FEE2E2',
                            color: '#EF4444',
                            border: 'none',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
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

      {/* 0. 소모품 다중 출고증 (DELIVERY NOTE) 모달 - 행별 로트 직접 선택 */}
      {isMultiDeliveryOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1100,
            padding: '20px',
          }}
        >
          <div
            id="printable-consumables-delivery-note"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '980px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                borderBottom: '2px solid #0F172A',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '900' }}>
                  출 고 증 (DELIVERY NOTE) · 소모품 다중 출고
                </h2>
              </div>
              <button
                type="button"
                className="no-print"
                onClick={() => setIsMultiDeliveryOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '20px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleMultiDeliverySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.5fr 1fr 1fr',
                  gap: '12px',
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>공급받는 자 (업체명 또는 수신자) *</label>
                  <input
                    type="text"
                    value={deliveryCompanyName}
                    onChange={(e) => {
                      setDeliveryCompanyName(e.target.value)
                      setShowDeliveryCompanyDropdown(true)
                    }}
                    onFocus={() => setShowDeliveryCompanyDropdown(true)}
                    placeholder="예: 엔지니어실 (내근용) 또는 거래처명 검색/입력"
                    style={{
                      ...inputStyle,
                      backgroundColor: '#ffffff',
                      fontWeight: 'bold',
                      color: '#0F172A',
                      border: '1.5px solid #2563EB',
                    }}
                    required
                  />
                  {showDeliveryCompanyDropdown && deliveryCompanyName.trim() && (
                    <div
                      className="no-print"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#fff',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        zIndex: 1600,
                        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                      }}
                    >
                      {(companies || [])
                        .filter((c) => c?.name && c.name.toLowerCase().includes(deliveryCompanyName.toLowerCase()))
                        .map((c) => (
                          <div
                            key={c.id || c.name}
                            onMouseDown={() => {
                              setDeliveryCompanyName(c.name)
                              setShowDeliveryCompanyDropdown(false)
                            }}
                            style={{
                              padding: '8px 12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #F1F5F9',
                            }}
                          >
                            <strong>{c.name}</strong> {c.ceo ? <span style={{ color: '#64748B' }}>({c.ceo})</span> : ''}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>발행 일자</label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={labelStyle}>발행자 (작성자)</label>
                  <input
                    type="text"
                    value={deliveryAuthor}
                    onChange={(e) => setDeliveryAuthor(e.target.value)}
                    style={{ ...inputStyle, fontWeight: 'bold', color: '#2563EB' }}
                    required
                  />
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>장비 S/N 목록</label>
                  <button
                    type="button"
                    className="no-print"
                    onClick={() => setEquipmentSns([...equipmentSns, ''])}
                    style={{
                      background: '#EFF6FF',
                      color: '#2563EB',
                      border: '1px solid #BFDBFE',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    + S/N 추가
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {equipmentSns.map((eqSn, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: '#fff',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="장비 S/N 입력"
                        value={eqSn}
                        onChange={(e) => {
                          const updated = [...equipmentSns]
                          updated[idx] = e.target.value
                          setEquipmentSns(updated)
                        }}
                        style={{ border: 'none', outline: 'none', fontSize: '13px', width: '140px' }}
                      />
                      {equipmentSns.length > 1 && (
                        <button
                          type="button"
                          className="no-print"
                          onClick={() => setEquipmentSns(equipmentSns.filter((_, i) => i !== idx))}
                          style={{ border: 'none', background: 'none', color: '#EF4444', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#1E293B' }}>
                    출고 소모품 품목 명세 (행별 로트 직접 선택)
                  </h3>
                  <button
                    type="button"
                    className="no-print"
                    onClick={() => setDeliveryItems([...deliveryItems, createEmptyDeliveryItem()])}
                    style={{
                      background: '#2563EB',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    + 부품 추가
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569' }}>
                      <th style={{ padding: '10px', width: '48px', textAlign: 'center' }}>NO</th>
                      <th style={{ padding: '10px', width: '140px' }}>부품 ID / 코드</th>
                      <th style={{ padding: '10px', width: '250px' }}>로트 선택 (잔여/유통기한)</th>
                      <th style={{ padding: '10px', width: '280px' }}>소모품 품명 검색 및 선택</th>
                      <th style={{ padding: '10px', width: '85px' }}>수량</th>
                      <th className="no-print" style={{ padding: '10px', width: '56px', textAlign: 'center' }}>
                        삭제
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryItems.map((item, idx) => {
                      const selectedPartObj = consumableParts.find((p) => String(p.id) === String(item.partId))
                      const matchedParts = consumableParts.filter((p) => {
                        const kw = (item.searchKeyword || '').trim().toLowerCase()
                        if (!kw) return true
                        const pName = (p.name || '').toLowerCase()
                        const pCode = (p.code || '').toLowerCase()
                        const pCat = (p.category || '').toLowerCase()
                        return pName.includes(kw) || pCode.includes(kw) || pCat.includes(kw)
                      })

                      const rawLots = selectedPartObj ? parsePartLots(selectedPartObj.lots) : []
                      const selectableLots = rawLots
                        .map((lot, lotIdx) => ({
                          lot,
                          lotIdx,
                          key: getLotOptionKey(lot, lotIdx),
                          availQty: Number(lot?.qty || 0),
                        }))
                        .filter((entry) => entry.availQty > 0)

                      const activeLotEntry = selectableLots.find((entry) => entry.key === item.selectedLotKey)
                      const maxAllowedQty = activeLotEntry ? activeLotEntry.availQty : undefined

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0', verticalAlign: 'middle' }}>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#64748B' }}>
                            {idx + 1}
                          </td>

                          <td style={{ padding: '10px' }}>
                            <input
                              type="text"
                              value={selectedPartObj ? selectedPartObj.code || '-' : '-'}
                              readOnly
                              style={{ ...inputStyle, backgroundColor: '#E2E8F0', fontWeight: 'bold' }}
                            />
                          </td>

                          <td style={{ padding: '10px' }}>
                            {!selectedPartObj ? (
                              <input
                                type="text"
                                value="품목 먼저 선택"
                                readOnly
                                style={{ ...inputStyle, backgroundColor: '#F1F5F9', color: '#94A3B8', textAlign: 'center' }}
                              />
                            ) : selectableLots.length === 0 ? (
                              <input
                                type="text"
                                value="출고 가능 로트 없음 (재고 0)"
                                readOnly
                                style={{
                                  ...inputStyle,
                                  backgroundColor: '#FEF2F2',
                                  color: '#DC2626',
                                  fontWeight: '700',
                                  fontSize: '12px',
                                }}
                              />
                            ) : (
                              <select
                                value={item.selectedLotKey}
                                onChange={(e) => {
                                  const nextLotKey = e.target.value
                                  const nextLotEntry = selectableLots.find((en) => en.key === nextLotKey)
                                  const currentQty = Number(item.quantity || 1)
                                  const cappedQty =
                                    nextLotEntry && currentQty > nextLotEntry.availQty
                                      ? Math.max(1, nextLotEntry.availQty)
                                      : currentQty
                                  const updated = [...deliveryItems]
                                  updated[idx] = {
                                    ...updated[idx],
                                    selectedLotKey: nextLotKey,
                                    quantity: cappedQty,
                                  }
                                  setDeliveryItems(updated)
                                }}
                                style={{
                                  ...inputStyle,
                                  backgroundColor: '#ffffff',
                                  border: '1.5px solid #059669',
                                  fontWeight: '700',
                                  fontSize: '12px',
                                }}
                                required
                              >
                                <option value="">-- 로트 직접 선택 ({selectableLots.length}개) --</option>
                                {selectableLots.map((entry) => (
                                  <option key={entry.key} value={entry.key}>
                                    {entry.lot.lot_number || '미지정'} (잔여 {entry.availQty}개
                                    {entry.lot.expiry ? ` · 기한 ${entry.lot.expiry}` : ''})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          <td style={{ padding: '10px', position: 'relative' }}>
                            <input
                              type="text"
                              placeholder="🔍 소모품 품명 또는 코드 검색..."
                              value={item.searchKeyword}
                              onChange={(e) => {
                                const keyword = e.target.value
                                const updated = [...deliveryItems]
                                updated[idx] = {
                                  ...updated[idx],
                                  searchKeyword: keyword,
                                  showDropdown: true,
                                }
                                if (!keyword.trim()) {
                                  updated[idx].partId = ''
                                  updated[idx].selectedLotKey = ''
                                }
                                setDeliveryItems(updated)
                              }}
                              onFocus={() => {
                                const updated = [...deliveryItems]
                                updated[idx] = { ...updated[idx], showDropdown: true }
                                setDeliveryItems(updated)
                              }}
                              style={{
                                ...inputStyle,
                                backgroundColor: '#ffffff',
                                border: '2px solid #2563EB',
                                fontWeight: '700',
                                color: '#0F172A',
                                padding: '10px 12px',
                              }}
                            />
                            {item.showDropdown && (
                              <div
                                className="no-print"
                                style={{
                                  position: 'absolute',
                                  left: '10px',
                                  right: '10px',
                                  top: 'calc(100% + 4px)',
                                  backgroundColor: '#ffffff',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.12)',
                                  maxHeight: '220px',
                                  overflowY: 'auto',
                                  zIndex: 1500,
                                }}
                              >
                                {matchedParts.length === 0 ? (
                                  <div style={{ padding: '12px', fontSize: '12px', color: '#94A3B8', textAlign: 'center' }}>
                                    검색 결과가 없습니다.
                                  </div>
                                ) : (
                                  matchedParts.map((p) => {
                                    const stockCnt = Number(p.stock || 0)
                                    const pLots = parsePartLots(p.lots).filter((l) => Number(l?.qty || 0) > 0)
                                    return (
                                      <div
                                        key={p.id}
                                        onMouseDown={() => {
                                          const updated = [...deliveryItems]
                                          updated[idx] = {
                                            ...updated[idx],
                                            partId: p.id,
                                            searchKeyword: p.name,
                                            selectedLotKey: '',
                                            quantity: 1,
                                            showDropdown: false,
                                          }
                                          setDeliveryItems(updated)
                                        }}
                                        style={{
                                          padding: '10px 12px',
                                          fontSize: '12px',
                                          borderBottom: '1px solid #F1F5F9',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          gap: '8px',
                                        }}
                                      >
                                        <span style={{ fontWeight: '700', color: '#0F172A' }}>
                                          [{p.category || '소모품'}] {p.name}{' '}
                                          <span style={{ fontWeight: 'normal', color: '#64748B' }}>({p.code || '-'})</span>
                                        </span>
                                        <span
                                          style={{
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            color: stockCnt > 0 ? '#059669' : '#DC2626',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          잔여 {stockCnt}개 · 로트 {pLots.length}건
                                        </span>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </td>

                          <td style={{ padding: '10px' }}>
                            <input
                              type="number"
                              min="1"
                              max={maxAllowedQty}
                              value={item.quantity}
                              disabled={!activeLotEntry}
                              onChange={(e) => {
                                const updated = [...deliveryItems]
                                updated[idx] = { ...updated[idx], quantity: e.target.value }
                                setDeliveryItems(updated)
                              }}
                              style={{
                                ...inputStyle,
                                textAlign: 'center',
                                fontWeight: '700',
                                backgroundColor: activeLotEntry ? '#ffffff' : '#F1F5F9',
                              }}
                              required
                            />
                          </td>

                          <td className="no-print" style={{ padding: '10px', textAlign: 'center' }}>
                            {deliveryItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setDeliveryItems(deliveryItems.filter((_, i) => i !== idx))}
                                style={{
                                  border: 'none',
                                  background: '#FEE2E2',
                                  color: '#EF4444',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                }}
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <label style={labelStyle}>특이사항 및 작업 내용 (비고)</label>
                <textarea
                  rows="3"
                  placeholder="예: 장비 수리 및 소모품 교체 완료"
                  value={deliveryNoteText}
                  onChange={(e) => setDeliveryNoteText(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>

              <div
                className="no-print"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #E2E8F0',
                  paddingTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    padding: '10px 18px',
                    background: '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  🖨️ 출고증 인쇄 / PDF 저장
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsMultiDeliveryOpen(false)}
                    disabled={isSavingDelivery}
                    style={{
                      padding: '10px 20px',
                      border: '1px solid #CBD5E1',
                      background: 'white',
                      color: '#64748B',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingDelivery}
                    style={{
                      padding: '10px 24px',
                      background: isSavingDelivery ? '#94A3B8' : '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '800',
                      cursor: isSavingDelivery ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      boxShadow: '0 4px 6px -1px rgba(5,150,105,0.2)',
                    }}
                  >
                    {isSavingDelivery ? '저장 중...' : '발행 완료 처리 및 저장'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. 소모품 입고 모달 */}
      {quickLotPart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '420px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '10px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>
                  📥 소모품 선입고 처리
                </h3>
                <div style={{ fontSize: '12px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>
                  [{quickLotPart.code}] {quickLotPart.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickLotPart(null)}
                style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddLot} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>P.O. / Lot 번호 (선택)</label>
                <input
                  type="text"
                  placeholder="예: MACE-261117"
                  value={quickLotNo}
                  onChange={(e) => setQuickLotNo(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>입고일</label>
                <input
                  type="date"
                  value={quickReceivedDate}
                  onChange={(e) => setQuickReceivedDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>유통기한 (필수)</label>
                <input
                  type="date"
                  value={quickExpiry}
                  onChange={(e) => setQuickExpiry(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>입고 수량 (개)*</label>
                <input
                  type="number"
                  placeholder="예: 50"
                  value={quickQty}
                  onChange={(e) => setQuickQty(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>📌 비고 및 특이사항</label>
                <textarea
                  rows="2"
                  placeholder="입고 관련 메모 입력"
                  value={quickNote}
                  onChange={(e) => setQuickNote(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setQuickLotPart(null)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #CBD5E1',
                    background: 'white',
                    color: '#64748B',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  선입고 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. 소모품 단건 출고 모달 */}
      {outboundPart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '540px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '10px',
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0F172A', fontWeight: '800' }}>
                  📤 소모품 출고 처리
                </h3>
                <div style={{ fontSize: '12px', color: '#D97706', fontWeight: '700', marginTop: '2px' }}>
                  [{outboundPart.code}] {outboundPart.name} (총 재고: {outboundPart.stock || 0}개)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOutboundPart(null)}
                style={{ border: 'none', background: 'none', fontSize: '16px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleOutboundSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1, overflowY: 'auto', paddingRight: '4px' }}
            >
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>공급받는 자 (업체명)*</label>
                <input
                  placeholder="업체명 검색 또는 입력..."
                  value={outboundCompany}
                  onChange={(e) => {
                    setOutboundCompany(e.target.value)
                    setShowCompanyDropdown(true)
                  }}
                  onFocus={() => setShowCompanyDropdown(true)}
                  style={inputStyle}
                  required
                />
                {showCompanyDropdown && outboundCompany.trim() && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: '#fff',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      maxHeight: '140px',
                      overflowY: 'auto',
                      zIndex: 50,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                    }}
                  >
                    {(companies || [])
                      .filter((c) => c.name && c.name.toLowerCase().includes(outboundCompany.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c.id || c.name}
                          onClick={() => {
                            setOutboundCompany(c.name)
                            setShowCompanyDropdown(false)
                          }}
                          style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                        >
                          <strong>{c.name}</strong> {c.ceo ? <span style={{ color: '#64748B' }}>({c.ceo})</span> : ''}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label style={labelStyle}>출고일</label>
                <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>⏳ 로트 및 유통기한별 출고 수량 지정*</label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid #E2E8F0',
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  {parsePartLots(outboundPart.lots).length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                      등록된 로트 정보가 없습니다.
                    </div>
                  ) : (
                    parsePartLots(outboundPart.lots).map((l, idx) => {
                      const lotPrice = getLotPrice(l)
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#fff',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid #CBD5E1',
                            gap: '10px',
                          }}
                        >
                          <div style={{ flex: 1.5 }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#0F172A' }}>
                              Lot: {l.lot_number || '(미지정)'} <span style={{ color: '#10B981' }}>(잔여: {l.qty}개)</span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#D97706', marginTop: '2px' }}>
                              유통기한: {l.expiry || '미입력'} | 입고 단가:{' '}
                              <strong style={{ color: lotPrice > 0 ? '#2563EB' : '#DC2626' }}>
                                {lotPrice > 0 ? `${lotPrice.toLocaleString()}원` : '미입력'}
                              </strong>
                            </div>
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              min="0"
                              max={l.qty}
                              placeholder="출고수량"
                              value={outboundLotInputs[idx] || ''}
                              onChange={(e) => {
                                const val = e.target.value
                                setOutboundLotInputs((prev) => ({ ...prev, [idx]: val }))
                              }}
                              style={{ ...inputStyle, textAlign: 'right', padding: '6px 8px', fontWeight: '700' }}
                            />
                            <span style={{ fontSize: '12px', color: '#64748B' }}>개</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div>
                <label style={labelStyle}>📌 비고 및 특이사항</label>
                <textarea
                  rows="2"
                  placeholder="출고 관련 메모 입력"
                  value={outboundNote}
                  onChange={(e) => setOutboundNote(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '10px',
                  flexShrink: 0,
                  borderTop: '1px solid #F1F5F9',
                  paddingTop: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setOutboundPart(null)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #CBD5E1',
                    background: 'white',
                    color: '#64748B',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    background: '#D97706',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  출고 차감 및 이력 기록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. 유통기한 및 입고 로트 현황 모달 */}
      {selectedExpiryPart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '600px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                  ⏳ 유통기한 및 로트별 단가 관리
                </h3>
                <div style={{ fontSize: '13px', color: '#2563EB', fontWeight: '700', marginTop: '2px' }}>
                  [{selectedExpiryPart.code}] {selectedExpiryPart.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExpiryPart(null)}
                style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {parsePartLots(selectedExpiryPart.lots).length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                  등록된 로트/유통기한 정보가 없습니다.
                </div>
              ) : (
                parsePartLots(selectedExpiryPart.lots).map((l, idx) => {
                  const lotPrice = getLotPrice(l)
                  const currentPriceInput =
                    expiryLotPriceInputs[idx] !== undefined ? expiryLotPriceInputs[idx] : lotPrice > 0 ? lotPrice : ''

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '14px',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '10px',
                        border: '1px solid #E2E8F0',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                          Lot No: {l.lot_number || '(미지정)'}{' '}
                          <span style={{ color: '#10B981', marginLeft: '8px' }}>수량: {l.qty}개</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteLotItem(l, idx)}
                          style={{
                            border: 'none',
                            background: '#FEE2E2',
                            color: '#EF4444',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </div>

                      <div style={{ fontSize: '12px', color: '#64748B' }}>
                        입고일: {l.received_date || '-'} |{' '}
                        <strong style={{ color: '#D97706' }}>유통기한: {l.expiry || '미입력'}</strong>
                        <span style={{ marginLeft: '10px', color: lotPrice > 0 ? '#2563EB' : '#DC2626', fontWeight: '700' }}>
                          입고 단가: {lotPrice > 0 ? `${lotPrice.toLocaleString()}원` : '미입력'}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '4px',
                          paddingTop: '8px',
                          borderTop: '1px dashed #CBD5E1',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB', whiteSpace: 'nowrap' }}>
                          💰 입고 단가(원):
                        </span>
                        <input
                          type="number"
                          placeholder="단가 입력..."
                          value={currentPriceInput}
                          onChange={(e) => {
                            const val = e.target.value
                            setExpiryLotPriceInputs((prev) => ({ ...prev, [idx]: val }))
                          }}
                          style={{ ...inputStyle, padding: '6px 10px', backgroundColor: '#fff' }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const currentLots = [...parsePartLots(selectedExpiryPart.lots)]
                            const newPrice = Number(currentPriceInput || 0)
                            currentLots[idx].unit_price = newPrice

                            const { error } = await supabase
                              .from('parts')
                              .update({
                                lots: JSON.stringify(currentLots),
                              })
                              .eq('id', selectedExpiryPart.id)
                              .eq('code', selectedExpiryPart.code)

                            if (!error) {
                              if (l.lot_number) {
                                const { error: lotPriceErr } = await supabase
                                  .from('part_stock_lots')
                                  .update({ unit_price: newPrice })
                                  .eq('part_id', selectedExpiryPart.id)
                                  .eq('po_number', l.lot_number)
                                if (lotPriceErr) {
                                  alert('로트 테이블 단가 반영 실패: ' + lotPriceErr.message)
                                  return
                                }
                              }

                              alert(`Lot [${l.lot_number || '미지정'}]의 단가가 ${newPrice.toLocaleString()}원으로 저장되었습니다.`)
                              setSelectedExpiryPart({ ...selectedExpiryPart, lots: currentLots })
                              refreshParts()
                            } else {
                              alert('단가 저장 실패: ' + error.message)
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: '#2563EB',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          단가 저장
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setSelectedExpiryPart(null)}
                style={{
                  padding: '8px 20px',
                  background: '#475569',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. 업체별 지정 특가 관리 모달 */}
      {selectedSpecialPart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#0F172A', fontWeight: '800' }}>
                  🏷️ 업체별 지정 특가 관리
                </h3>
                <div style={{ fontSize: '12px', color: '#D97706', fontWeight: '700', marginTop: '2px' }}>
                  [{selectedSpecialPart.code}] {selectedSpecialPart.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecialPart(null)
                  setActiveSpecialCompanyIdx(null)
                }}
                style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(selectedSpecialPrices || []).map((sp, idx) => {
                const kw = (sp.company_name || '').trim().toLowerCase()
                const matchedCompanies = (companies || []).filter(
                  (c) => c && c.name && (!kw || c.name.toLowerCase().includes(kw))
                )

                return (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1.5 }}>
                      <input
                        type="text"
                        placeholder="업체명 검색 또는 입력"
                        value={sp.company_name}
                        onFocus={() => setActiveSpecialCompanyIdx(idx)}
                        onChange={(e) => {
                          const updated = [...selectedSpecialPrices]
                          updated[idx].company_name = e.target.value
                          setSelectedSpecialPrices(updated)
                          setActiveSpecialCompanyIdx(idx)
                        }}
                        style={inputStyle}
                      />
                      {activeSpecialCompanyIdx === idx && matchedCompanies.length > 0 && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: '#fff',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            maxHeight: '140px',
                            overflowY: 'auto',
                            zIndex: 60,
                            marginTop: '2px',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                          }}
                        >
                          {matchedCompanies.map((c) => (
                            <div
                              key={c.id || c.name}
                              onMouseDown={() => {
                                const updated = [...selectedSpecialPrices]
                                updated[idx].company_name = c.name
                                setSelectedSpecialPrices(updated)
                                setActiveSpecialCompanyIdx(null)
                              }}
                              style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid #F1F5F9' }}
                            >
                              <strong>{c.name}</strong> {c.ceo ? <span style={{ color: '#64748B' }}>({c.ceo})</span> : ''}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="number"
                      placeholder="지정 단가(원)"
                      value={sp.price}
                      onChange={(e) => {
                        const updated = [...selectedSpecialPrices]
                        updated[idx].price = e.target.value
                        setSelectedSpecialPrices(updated)
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSpecialPrices(selectedSpecialPrices.filter((_, i) => i !== idx))
                        if (activeSpecialCompanyIdx === idx) setActiveSpecialCompanyIdx(null)
                      }}
                      style={{
                        border: 'none',
                        background: '#FEE2E2',
                        color: '#EF4444',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                onClick={() => {
                  const nextList = [...(selectedSpecialPrices || []), { company_name: '', price: 0 }]
                  setSelectedSpecialPrices(nextList)
                  setActiveSpecialCompanyIdx(nextList.length - 1)
                }}
                style={{
                  background: '#FEF3C7',
                  color: '#D97706',
                  border: '1px dashed #FCD34D',
                  padding: '8px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                + 업체 특가 추가
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecialPart(null)
                  setActiveSpecialCompanyIdx(null)
                }}
                style={{
                  padding: '8px 16px',
                  background: '#F1F5F9',
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={async () => {
                  const validPrices = (selectedSpecialPrices || []).filter(
                    (sp) => sp.company_name && sp.company_name.trim() !== ''
                  )
                  const { error } = await supabase
                    .from('parts')
                    .update({
                      company_prices: JSON.stringify(validPrices),
                    })
                    .eq('id', selectedSpecialPart.id)
                    .eq('code', selectedSpecialPart.code)

                  if (!error) {
                    alert('업체별 지정 특가가 저장되었습니다.')
                    setSelectedSpecialPart(null)
                    setActiveSpecialCompanyIdx(null)
                    refreshParts()
                  } else {
                    alert('저장 실패: ' + error.message)
                  }
                }}
                style={{
                  padding: '8px 20px',
                  background: '#D97706',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 소모품 정보 수정 모달 */}
      {editingPart && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '480px',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #F1F5F9',
                paddingBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0F172A', fontWeight: '800' }}>
                ✏️ 소모품 정보 수정
              </h3>
              <button
                type="button"
                onClick={() => setEditingPart(null)}
                style={{ border: 'none', background: 'none', fontSize: '18px', color: '#64748B', cursor: 'pointer', fontWeight: '700' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>품번 / 코드*</label>
                  <input
                    type="text"
                    value={editForm.code}
                    onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                    style={inputStyle}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>구분</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="잉크">잉크</option>
                    <option value="희석제">희석제</option>
                    <option value="소모품">소모품</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>품명*</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>소비자 기본가 (원)</label>
                  <input
                    type="number"
                    value={editForm.customer_price}
                    onChange={(e) => setEditForm({ ...editForm, customer_price: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>딜러 기본가 (원)</label>
                  <input
                    type="number"
                    value={editForm.dealer_price}
                    onChange={(e) => setEditForm({ ...editForm, dealer_price: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>총 재고 수량 (개)</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.stock}
                  onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>📌 비고</label>
                <textarea
                  rows="2"
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  style={{
                    padding: '8px 16px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    background: '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}