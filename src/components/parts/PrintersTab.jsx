import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

const PAGE_SIZE = 15

const NOZZLE_SIZE_OPTIONS = ['35µm', '40µm', '50µm', '55µm', '60µm', '70µm']

const EXTRA_MODELS = [
  {
    id: '__VIRTUAL_JET3_ECO__',
    manufacturer: 'LEIBINGER',
    category: 'PRINTER',
    series: 'JET3',
    model_name: 'JET3 Eco',
    track_serial: true,
  },
  {
    id: '__VIRTUAL_JET3_ECO_PI__',
    manufacturer: 'LEIBINGER',
    category: 'PRINTER',
    series: 'JET3',
    model_name: 'JET3 Eco Pi',
    track_serial: true,
  },
]

const STATUS_META = {
  IN_STOCK: { label: '재고 보유', bg: '#DCFCE7', color: '#166534' },
  SOLD: { label: '납품 완료', bg: '#DBEAFE', color: '#1E40AF' },
  DEMO: { label: '대여 중', bg: '#FEF3C7', color: '#92400E' },
  REPAIR: { label: '수리 중', bg: '#F3E8FF', color: '#6B21A8' },
  SCRAPPED: { label: '폐기', bg: '#FEE2E2', color: '#991B1B' },
}

const REINBOUND_META = {
  NONE: { label: '일반 입고', badge: null },
  RETURN_DEMO: { label: '대여반납 재입고', badge: '대여반납 재입고' },
  RETURN_SALE: { label: '반품 재입고', badge: '반품 재입고' },
}

const MOVEMENT_TYPE_META = {
  INBOUND: '입고',
  OUTBOUND_SALE: '판매 출고',
  OUTBOUND_DEMO: '대여 출고',
  RETURN_DEMO: '대여반납 재입고',
  TRANSFER: '위치 이동',
  AS_SWAP: '대체 투입',
  SCRAP: '폐기 처리',
}

const normalizeSerial = (val = '') => val.trim().replace(/\s+/g, '').toUpperCase()
const onlyDigits = (val = '') => String(val ?? '').replace(/[^0-9]/g, '')

const formatModelLabel = (model) => {
  if (!model) return '-'
  const name = String(model.model_name || '').trim()
  const series = String(model.series || '').trim()
  return name || series || '-'
}

const formatCurrency = (amount, currency = 'KRW') => {
  if (amount === null || amount === undefined || amount === '') return '-'
  const num = Number(amount)
  if (Number.isNaN(num)) return '-'
  return `${num.toLocaleString('ko-KR')} ${currency || 'KRW'}`
}

const parseReinboundFromMemo = (memoText) => {
  if (!memoText || typeof memoText !== 'string') return null
  const match = memoText.match(/\[REINBOUND_TYPE:(NONE|RETURN_DEMO|RETURN_SALE)\]/)
  return match ? match[1] : null
}

const stripSystemTags = (text) => {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/\[REINBOUND_TYPE:(NONE|RETURN_DEMO|RETURN_SALE)\]/g, '')
    .replace(/\[DELIVERY_DETAILS:[\s\S]*$/, '')
    .trim()
}

const buildMemoWithReinboundTag = (cleanMemo, reinboundType) => {
  const base = stripSystemTags(cleanMemo)
  if (!reinboundType || reinboundType === 'NONE') {
    return base || null
  }
  const tag = `[REINBOUND_TYPE:${reinboundType}]`
  return base ? `${base} ${tag}` : tag
}

export default function PrintersTab({ refreshParts, showAddForm, setShowAddForm }) {
  const [models, setModels] = useState([])
  const [units, setUnits] = useState([])
  const [allMovements, setAllMovements] = useState([])
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [movements, setMovements] = useState([])

  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [movementsLoading, setMovementsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 검색 및 상단 상태 뱃지 필터 상태
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // 신규 프린터 입고 폼
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newForm, setNewForm] = useState({
    model_id: '',
    serial_number: '',
    nozzle_size: '',
    condition: 'NEW',
    inbound_date: new Date().toISOString().slice(0, 10),
    unit_cost: '',
    currency: 'KRW',
    warehouse_location: '본사 창고',
    memo: '',
  })

  // 다중 S/N 출고증 팝업 상태
  const [isVoucherOpen, setIsVoucherOpen] = useState(false)
  const [voucherSearch, setVoucherSearch] = useState('')
  const [selectedVoucherUnitIds, setSelectedVoucherUnitIds] = useState([])
  const [voucherForm, setVoucherForm] = useState({
    movement_type: 'OUTBOUND_SALE', // OUTBOUND_SALE | OUTBOUND_DEMO
    outbound_date: new Date().toISOString().slice(0, 10),
    customer_name: '',
    unit_cost: '',
    note: '',
  })

  // 대여 반납(재입고) 폼 상태
  const [isReturnOpen, setIsReturnOpen] = useState(false)
  const [returnForm, setReturnForm] = useState({
    return_date: new Date().toISOString().slice(0, 10),
    warehouse_location: '본사 창고',
    note: '',
  })

  // 선택 장비 정보 수정 모드 상태
  const [isEditingUnit, setIsEditingUnit] = useState(false)
  const [editForm, setEditForm] = useState({
    model_id: '',
    nozzle_size: '',
    condition: 'NEW',
    inbound_date: '',
    delivery_date: '',
    unit_cost: '',
    status: 'IN_STOCK',
    reinbound_type: 'NONE', // NONE | RETURN_DEMO | RETURN_SALE
    reinbound_date: new Date().toISOString().slice(0, 10),
    reinbound_note: '',
    location_or_customer: '',
    memo: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // [임시 정리용] 이력 삭제 처리 상태 (정리 완료 후 삭제 가능)
  const [deletingMovementId, setDeletingMovementId] = useState(null)

  const openAddModal = () => {
    setErrorMsg('')
    setIsAddOpen(true)
    setShowAddForm?.(true)
  }

  const closeAddModal = () => {
    setIsAddOpen(false)
    setShowAddForm?.(false)
  }

  useEffect(() => {
    if (showAddForm) {
      setIsAddOpen(true)
    }
  }, [showAddForm])

  const fetchPrinterData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [
        { data: modelRows, error: modelErr },
        { data: unitRows, error: unitErr },
        { data: allMoveRows, error: allMoveErr },
      ] = await Promise.all([
        supabase
          .from('printer_models')
          .select('*')
          .order('manufacturer', { ascending: true })
          .order('model_name', { ascending: true }),
        supabase
          .from('printer_units')
          .select(`
            *,
            printer_models (
              id,
              manufacturer,
              category,
              series,
              model_name,
              track_serial
            )
          `)
          .order('updated_at', { ascending: false }),
        supabase
          .from('printer_movements')
          .select('id, printer_unit_id, movement_type, moved_at, note'),
      ])

      if (modelErr) throw modelErr
      if (unitErr) throw unitErr
      if (allMoveErr) throw allMoveErr

      const normalizedModels = [...(modelRows || [])]
      EXTRA_MODELS.forEach((extra) => {
        const exists = normalizedModels.some(
          (m) => String(m.model_name || '').toLowerCase() === extra.model_name.toLowerCase()
        )
        if (!exists) {
          normalizedModels.push(extra)
        }
      })

      setModels(normalizedModels)
      setUnits(unitRows || [])
      setAllMovements(allMoveRows || [])

      if (!newForm.model_id && normalizedModels.length) {
        setNewForm((prev) => ({ ...prev, model_id: normalizedModels[0].id }))
      }

      if (unitRows?.length) {
        setSelectedUnitId((prev) => prev || unitRows[0].id)
      } else {
        setSelectedUnitId(null)
      }
    } catch (err) {
      setErrorMsg(err.message || '프린터 데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const resolveModelId = async (selectedModelId) => {
    const virtualModel = EXTRA_MODELS.find((m) => m.id === selectedModelId)
    if (!virtualModel) {
      return selectedModelId
    }

    const { data: existing, error: findErr } = await supabase
      .from('printer_models')
      .select('id')
      .eq('model_name', virtualModel.model_name)
      .maybeSingle()

    if (findErr) throw findErr
    if (existing?.id) return existing.id

    const { data: inserted, error: insertErr } = await supabase
      .from('printer_models')
      .insert([
        {
          manufacturer: virtualModel.manufacturer,
          category: virtualModel.category,
          series: virtualModel.series,
          model_name: virtualModel.model_name,
          track_serial: virtualModel.track_serial,
        },
      ])
      .select('id')
      .single()

    if (insertErr) throw insertErr
    return inserted.id
  }

  const fetchMovements = async (unitId) => {
    if (!unitId) {
      setMovements([])
      return
    }
    setMovementsLoading(true)
    try {
      const { data, error } = await supabase
        .from('printer_movements')
        .select('*')
        .eq('printer_unit_id', unitId)
        .order('moved_at', { ascending: false })

      if (error) throw error
      setMovements(data || [])
    } catch (err) {
      setErrorMsg(err.message || '이동 이력을 불러오지 못했습니다.')
    } finally {
      setMovementsLoading(false)
    }
  }

  useEffect(() => {
    fetchPrinterData()
  }, [])

  useEffect(() => {
    fetchMovements(selectedUnitId)
    setIsReturnOpen(false)
    setReturnForm({
      return_date: new Date().toISOString().slice(0, 10),
      warehouse_location: '본사 창고',
      note: '',
    })
  }, [selectedUnitId])

  // 개체별 이력 기반 재입고 구분 맵
  const movementReinboundMap = useMemo(() => {
    const map = new Map()
    ;(allMovements || []).forEach((m) => {
      if (!m.printer_unit_id) return
      const key = String(m.printer_unit_id)
      if (m.movement_type === 'RETURN_DEMO') {
        map.set(key, 'RETURN_DEMO')
      } else if (
        m.movement_type === 'INBOUND' &&
        typeof m.note === 'string' &&
        m.note.includes('반품 재입고') &&
        !map.has(key)
      ) {
        map.set(key, 'RETURN_SALE')
      }
    })
    return map
  }, [allMovements])

  // 개체별 이력 기반 최근 판매 출고(납품)일 맵
  const movementDeliveryDateMap = useMemo(() => {
    const map = new Map()
    ;(allMovements || []).forEach((m) => {
      if (!m.printer_unit_id || m.movement_type !== 'OUTBOUND_SALE' || !m.moved_at) return
      const key = String(m.printer_unit_id)
      const dateStr = String(m.moved_at).slice(0, 10)
      const prev = map.get(key)
      if (!prev || dateStr > prev) {
        map.set(key, dateStr)
      }
    })
    return map
  }, [allMovements])

  const getDeliveryDate = (unit) => {
    if (!unit) return null
    if (unit.delivery_date) return String(unit.delivery_date).slice(0, 10)
    return movementDeliveryDateMap.get(String(unit.id)) || null
  }

  const getReinboundType = (unit) => {
    if (!unit) return 'NONE'
    const tagged = parseReinboundFromMemo(unit.memo)
    if (tagged) return tagged
    const fromMove = movementReinboundMap.get(String(unit.id))
    if (fromMove) return fromMove
    if (unit.condition === 'REFURB') return 'RETURN_SALE'
    return 'NONE'
  }

  const getReinboundLabel = (unit) => {
    const rType = getReinboundType(unit)
    return REINBOUND_META[rType]?.badge || null
  }

  const filteredUnits = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    const normQ = normalizeSerial(searchTerm).toLowerCase()

    return units.filter((u) => {
      const model = u.printer_models
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false

      if (!q) return true

      const snMatch =
        u.serial_number?.toLowerCase().includes(q) ||
        normalizeSerial(u.serial_number).toLowerCase().includes(normQ)
      const modelMatch =
        model?.model_name?.toLowerCase().includes(q) ||
        model?.series?.toLowerCase().includes(q)
      const custMatch = u.customer_name?.toLowerCase().includes(q)
      const locMatch = u.warehouse_location?.toLowerCase().includes(q)
      const nozzleMatch = u.nozzle_size?.toLowerCase().includes(q)

      return snMatch || modelMatch || custMatch || locMatch || nozzleMatch
    })
  }, [units, searchTerm, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredUnits.length / PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const paginatedUnits = useMemo(() => {
    const startIdx = (currentPage - 1) * PAGE_SIZE
    return filteredUnits.slice(startIdx, startIdx + PAGE_SIZE)
  }, [filteredUnits, currentPage])

  const pageNumbers = useMemo(() => {
    const blockStart = Math.floor((currentPage - 1) / 10) * 10 + 1
    const blockEnd = Math.min(totalPages, blockStart + 9)
    const list = []
    for (let p = blockStart; p <= blockEnd; p += 1) {
      list.push(p)
    }
    return list
  }, [currentPage, totalPages])

  useEffect(() => {
    const normQ = normalizeSerial(searchTerm)
    if (!normQ) return
    const matchIndex = filteredUnits.findIndex((u) => normalizeSerial(u.serial_number) === normQ)
    if (matchIndex !== -1) {
      const targetUnit = filteredUnits[matchIndex]
      setSelectedUnitId(targetUnit.id)
      setCurrentPage(Math.floor(matchIndex / PAGE_SIZE) + 1)
    }
  }, [searchTerm, filteredUnits])

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) || null,
    [units, selectedUnitId]
  )

  useEffect(() => {
    setIsEditingUnit(false)
    if (selectedUnit) {
      setEditForm({
        model_id: selectedUnit.model_id || selectedUnit.printer_models?.id || '',
        nozzle_size: selectedUnit.nozzle_size || '',
        condition: selectedUnit.condition || 'NEW',
        inbound_date: selectedUnit.inbound_date ? String(selectedUnit.inbound_date).slice(0, 10) : '',
        delivery_date: getDeliveryDate(selectedUnit) || '',
        unit_cost:
          selectedUnit.unit_cost !== null && selectedUnit.unit_cost !== undefined
            ? String(selectedUnit.unit_cost)
            : '',
        status: selectedUnit.status || 'IN_STOCK',
        reinbound_type: getReinboundType(selectedUnit),
        reinbound_date: new Date().toISOString().slice(0, 10),
        reinbound_note: '',
        location_or_customer:
          selectedUnit.status === 'SOLD' || selectedUnit.status === 'DEMO'
            ? selectedUnit.customer_name || ''
            : selectedUnit.warehouse_location || selectedUnit.customer_name || '',
        memo: stripSystemTags(selectedUnit.memo || ''),
      })
    }
  }, [selectedUnit])

  // 출고증 팝업 열기 (현재 재고 보유 IN_STOCK 장비 대상)
  const handleOpenVoucherModal = () => {
    const inStockList = units.filter((u) => u.status === 'IN_STOCK')
    const defaultIds =
      selectedUnit && selectedUnit.status === 'IN_STOCK'
        ? [selectedUnit.id]
        : inStockList.length === 1
          ? [inStockList[0].id]
          : []

    setVoucherSearch('')
    setSelectedVoucherUnitIds(defaultIds)
    setVoucherForm({
      movement_type: 'OUTBOUND_SALE',
      outbound_date: new Date().toISOString().slice(0, 10),
      customer_name: '',
      unit_cost: '',
      note: '',
    })
    setErrorMsg('')
    setIsVoucherOpen(true)
  }

  const availableVoucherUnits = useMemo(() => {
    const q = voucherSearch.trim().toLowerCase()
    const normQ = normalizeSerial(voucherSearch).toLowerCase()
    return units
      .filter((u) => u.status === 'IN_STOCK')
      .filter((u) => {
        if (!q) return true
        const snMatch =
          u.serial_number?.toLowerCase().includes(q) ||
          normalizeSerial(u.serial_number).toLowerCase().includes(normQ)
        const modelMatch =
          u.printer_models?.model_name?.toLowerCase().includes(q) ||
          u.printer_models?.series?.toLowerCase().includes(q)
        const inboundMatch = String(u.inbound_date || '').includes(q)
        return snMatch || modelMatch || inboundMatch
      })
  }, [units, voucherSearch])

  const toggleVoucherUnit = (unitId) => {
    setSelectedVoucherUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    )
  }

  const handleToggleAllVisibleVoucherUnits = () => {
    const visibleIds = availableVoucherUnits.map((u) => u.id)
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedVoucherUnitIds.includes(id))
    if (allSelected) {
      setSelectedVoucherUnitIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedVoucherUnitIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  // 다중 S/N 출고증 저장 (판매 출고 OUTBOUND_SALE / 대여 출고 OUTBOUND_DEMO + DeliveryHistoryTab 연동 태그)
  const handleVoucherSubmit = async (e) => {
    e.preventDefault()
    const targetName = voucherForm.customer_name.trim()
    if (selectedVoucherUnitIds.length === 0) {
      setErrorMsg('출고할 프린터(S/N)를 1대 이상 선택해 주세요.')
      return
    }
    if (!targetName) {
      setErrorMsg(
        voucherForm.movement_type === 'OUTBOUND_DEMO'
          ? '대여처를 입력해 주세요.'
          : '납품처를 입력해 주세요.'
      )
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      const isDemo = voucherForm.movement_type === 'OUTBOUND_DEMO'
      const nextStatus = isDemo ? 'DEMO' : 'SOLD'
      const parsedCost =
        voucherForm.unit_cost === '' || voucherForm.unit_cost === null
          ? null
          : Number(voucherForm.unit_cost)
      const movedAtIso = voucherForm.outbound_date
        ? `${voucherForm.outbound_date}T09:00:00.000Z`
        : new Date().toISOString()

      const selectedTargets = units.filter((u) => selectedVoucherUnitIds.includes(u.id))

      const printerItemsMeta = selectedTargets.map((u) => {
        const model = u.printer_models
        const modelName = [model?.manufacturer, formatModelLabel(model)]
          .filter((v) => v && v !== '-')
          .join(' ')
        return {
          serialNumber: u.serial_number,
          modelName: modelName || '프린터',
          inboundDate: u.inbound_date || '-',
          reinboundLabel: getReinboundLabel(u) || '일반 입고',
        }
      })

      const detailsPayload = {
        kind: 'PRINTER',
        movementType: voucherForm.movement_type,
        equipmentSns: selectedTargets.map((u) => u.serial_number),
        printerItems: printerItemsMeta,
      }

      const cleanUserNote = voucherForm.note.trim()
      const formattedNote = `${cleanUserNote ? `${cleanUserNote}\n` : ''}[DELIVERY_DETAILS:${JSON.stringify(detailsPayload)}]`

      const movementPayloads = selectedTargets.map((u) => ({
        printer_unit_id: u.id,
        movement_type: voucherForm.movement_type,
        from_status: u.status,
        to_status: nextStatus,
        from_location: u.warehouse_location || '본사 창고',
        to_location: targetName,
        customer_name: targetName,
        unit_cost: parsedCost,
        reference_type: 'MANUAL',
        moved_at: movedAtIso,
        note: formattedNote,
      }))

      const { error: moveErr } = await supabase.from('printer_movements').insert(movementPayloads)
      if (moveErr) throw moveErr

      const nowIso = new Date().toISOString()
      for (const u of selectedTargets) {
        const unitUpdatePayload = {
          status: nextStatus,
          customer_name: targetName,
          updated_at: nowIso,
        }
        if (!isDemo && voucherForm.outbound_date) {
          unitUpdatePayload.delivery_date = voucherForm.outbound_date
        }

        const { error: unitErr } = await supabase
          .from('printer_units')
          .update(unitUpdatePayload)
          .eq('id', u.id)

        if (unitErr) throw unitErr
      }

      const firstId = selectedTargets[0]?.id || selectedUnitId
      setIsVoucherOpen(false)
      setSelectedVoucherUnitIds([])
      setVoucherForm({
        movement_type: 'OUTBOUND_SALE',
        outbound_date: new Date().toISOString().slice(0, 10),
        customer_name: '',
        unit_cost: '',
        note: '',
      })

      if (firstId) setSelectedUnitId(firstId)
      await fetchPrinterData()
      if (firstId) await fetchMovements(firstId)
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '출고증 처리 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 대여 반납(재입고) 처리 -> RETURN_DEMO 이력 기록 및 IN_STOCK 복귀
  const handleReturnDemoSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUnit) return

    setSaving(true)
    setErrorMsg('')
    try {
      const returnLoc = returnForm.warehouse_location.trim() || '본사 창고'
      const movedAtIso = returnForm.return_date
        ? `${returnForm.return_date}T09:00:00.000Z`
        : new Date().toISOString()

      const { error: moveErr } = await supabase.from('printer_movements').insert([
        {
          printer_unit_id: selectedUnit.id,
          movement_type: 'RETURN_DEMO',
          from_status: selectedUnit.status,
          to_status: 'IN_STOCK',
          from_location: selectedUnit.customer_name || selectedUnit.warehouse_location || '대여처',
          to_location: returnLoc,
          customer_name: null,
          reference_type: 'MANUAL',
          moved_at: movedAtIso,
          note: returnForm.note.trim() || '대여반납 재입고',
        },
      ])

      if (moveErr) throw moveErr

      const updatedMemo = buildMemoWithReinboundTag(selectedUnit.memo, 'RETURN_DEMO')

      const { error: unitErr } = await supabase
        .from('printer_units')
        .update({
          status: 'IN_STOCK',
          customer_name: null,
          warehouse_location: returnLoc,
          memo: updatedMemo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUnit.id)

      if (unitErr) throw unitErr

      setIsReturnOpen(false)
      setReturnForm({
        return_date: new Date().toISOString().slice(0, 10),
        warehouse_location: '본사 창고',
        note: '',
      })

      await fetchPrinterData()
      await fetchMovements(selectedUnit.id)
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '대여 반납(재입고) 처리 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleStartEditUnit = () => {
    if (!selectedUnit) return
    setEditForm({
      model_id: selectedUnit.model_id || selectedUnit.printer_models?.id || '',
      nozzle_size: selectedUnit.nozzle_size || '',
      condition: selectedUnit.condition || 'NEW',
      inbound_date: selectedUnit.inbound_date ? String(selectedUnit.inbound_date).slice(0, 10) : '',
      delivery_date: getDeliveryDate(selectedUnit) || '',
      unit_cost:
        selectedUnit.unit_cost !== null && selectedUnit.unit_cost !== undefined
          ? String(selectedUnit.unit_cost)
          : '',
      status: selectedUnit.status || 'IN_STOCK',
      reinbound_type: getReinboundType(selectedUnit),
      reinbound_date: new Date().toISOString().slice(0, 10),
      reinbound_note: '',
      location_or_customer:
        selectedUnit.status === 'SOLD' || selectedUnit.status === 'DEMO'
          ? selectedUnit.customer_name || ''
          : selectedUnit.warehouse_location || selectedUnit.customer_name || '',
      memo: stripSystemTags(selectedUnit.memo || ''),
    })
    setErrorMsg('')
    setIsEditingUnit(true)
  }

  const handleSaveUnitEdit = async () => {
    if (!selectedUnit) return
    if (!editForm.model_id) {
      setErrorMsg('모델을 선택해 주세요.')
      return
    }

    const cleanedCost = String(editForm.unit_cost ?? '').replace(/,/g, '').trim()
    const parsedCost = cleanedCost === '' ? null : Number(cleanedCost)
    if (parsedCost !== null && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      setErrorMsg('입고단가는 0 이상의 숫자로 입력해 주세요.')
      return
    }

    const prevReinboundType = getReinboundType(selectedUnit)
    const nextReinboundType = editForm.reinbound_type || 'NONE'
    const cleanReinboundNote = editForm.reinbound_note.trim()

    if (nextReinboundType !== 'NONE' && nextReinboundType !== prevReinboundType && !cleanReinboundNote) {
      setErrorMsg(
        `${REINBOUND_META[nextReinboundType]?.label} 이력을 생성할 반납/반품 내용을 입력해 주세요.`
      )
      return
    }

    const locVal = editForm.location_or_customer.trim()
    const isExternal = editForm.status === 'SOLD' || editForm.status === 'DEMO'
    const nextWarehouseLoc = isExternal
      ? selectedUnit.warehouse_location || '본사 창고'
      : locVal || '본사 창고'
    const mergedMemo = buildMemoWithReinboundTag(editForm.memo, nextReinboundType)

    setSavingEdit(true)
    setErrorMsg('')
    try {
      const resolvedModelId = await resolveModelId(editForm.model_id)

      const { error } = await supabase
        .from('printer_units')
        .update({
          model_id: resolvedModelId,
          nozzle_size: editForm.nozzle_size.trim() || null,
          condition: nextReinboundType === 'RETURN_SALE' ? 'REFURB' : editForm.condition,
          inbound_date: editForm.inbound_date.trim() || null,
          delivery_date: editForm.delivery_date.trim() || null,
          unit_cost: parsedCost,
          status: editForm.status,
          customer_name: isExternal ? locVal || null : null,
          warehouse_location: nextWarehouseLoc,
          memo: mergedMemo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUnit.id)

      if (error) throw error

      // 재입고 구분이 새로 선택된 경우 이력 1건 생성
      if (nextReinboundType !== 'NONE' && nextReinboundType !== prevReinboundType) {
        const movedAtIso = editForm.reinbound_date
          ? `${editForm.reinbound_date}T09:00:00.000Z`
          : new Date().toISOString()

        const isDemoReturn = nextReinboundType === 'RETURN_DEMO'
        const { error: moveErr } = await supabase.from('printer_movements').insert([
          {
            printer_unit_id: selectedUnit.id,
            movement_type: isDemoReturn ? 'RETURN_DEMO' : 'INBOUND',
            from_status: selectedUnit.status,
            to_status: editForm.status,
            from_location: selectedUnit.customer_name || (isDemoReturn ? '대여처' : '외부 반품처'),
            to_location: nextWarehouseLoc,
            customer_name: null,
            reference_type: 'MANUAL',
            moved_at: movedAtIso,
            note: isDemoReturn
              ? `[대여반납 재입고] ${cleanReinboundNote}`
              : `[반품 재입고] ${cleanReinboundNote}`,
          },
        ])

        if (moveErr) throw moveErr
      }

      setIsEditingUnit(false)
      await fetchPrinterData()
      await fetchMovements(selectedUnit.id)
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '장비 정보 수정 중 오류가 발생했습니다.')
    } finally {
      setSavingEdit(false)
    }
  }

  // 신규 입고 등록 (모델, S/N, 노즐 사이즈, 입고일, 입고단가, 창고, 메모)
  const handleCreateUnit = async (e) => {
    e.preventDefault()
    const cleanSerial = onlyDigits(newForm.serial_number)
    if (!newForm.model_id || !cleanSerial) {
      setErrorMsg('모델과 숫자 시리얼 번호(S/N)는 필수입니다.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      const resolvedModelId = await resolveModelId(newForm.model_id)
      const parsedCost =
        newForm.unit_cost === '' || newForm.unit_cost === null ? null : Number(newForm.unit_cost)
      const loc = newForm.warehouse_location.trim() || '본사 창고'

      const { data: createdUnit, error: unitErr } = await supabase
        .from('printer_units')
        .insert([
          {
            model_id: resolvedModelId,
            serial_number: cleanSerial,
            nozzle_size: newForm.nozzle_size.trim() || null,
            status: 'IN_STOCK',
            condition: newForm.condition,
            inbound_date: newForm.inbound_date || null,
            unit_cost: parsedCost,
            currency: newForm.currency || 'KRW',
            warehouse_location: loc,
            memo: newForm.memo.trim() || null,
          },
        ])
        .select()
        .single()

      if (unitErr) throw unitErr

      const movedAtIso = newForm.inbound_date
        ? `${newForm.inbound_date}T09:00:00.000Z`
        : new Date().toISOString()

      const { error: moveErr } = await supabase.from('printer_movements').insert([
        {
          printer_unit_id: createdUnit.id,
          movement_type: 'INBOUND',
          from_status: null,
          to_status: 'IN_STOCK',
          from_location: '외부 입고',
          to_location: loc,
          unit_cost: parsedCost,
          reference_type: 'MANUAL',
          moved_at: movedAtIso,
          note: newForm.memo.trim() || '신규 프린터 입고',
        },
      ])

      if (moveErr) throw moveErr

      setNewForm((prev) => ({
        ...prev,
        serial_number: '',
        nozzle_size: '',
        unit_cost: '',
        memo: '',
      }))
      closeAddModal()
      setCurrentPage(1)
      setSelectedUnitId(createdUnit.id)
      await fetchPrinterData()
      await fetchMovements(createdUnit.id)
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '프린터 입고 등록 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // [임시 정리용] 이력 삭제 핸들러 (정리 후 해당 함수와 버튼만 제거하면 됨)
  const handleDeleteMovement = async (movementId) => {
    if (!selectedUnit || !movementId) return
    setDeletingMovementId(movementId)
    setErrorMsg('')
    try {
      const { error } = await supabase.from('printer_movements').delete().eq('id', movementId)
      if (error) throw error

      await fetchMovements(selectedUnit.id)
      await fetchPrinterData()
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '이력 삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingMovementId(null)
    }
  }

  const summaryCounts = useMemo(() => {
    return units.reduce(
      (acc, u) => {
        acc.total += 1
        acc[u.status] = (acc[u.status] || 0) + 1
        return acc
      },
      { total: 0, IN_STOCK: 0, SOLD: 0, DEMO: 0, REPAIR: 0, SCRAPPED: 0 }
    )
  }, [units])

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
    display: 'block',
    fontSize: '12px',
    fontWeight: '700',
    color: '#334155',
    marginBottom: '6px',
  }

  const renderStatusBadge = (status) => {
    const meta = STATUS_META[status] || {
      label: status || '-',
      bg: '#F1F5F9',
      color: '#334155',
    }
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: '700',
          backgroundColor: meta.bg,
          color: meta.color,
          whiteSpace: 'nowrap',
        }}
      >
        {meta.label}
      </span>
    )
  }

  const renderReinboundBadge = (unit) => {
    const label = getReinboundLabel(unit)
    if (!label) return null
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '2px 7px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: '800',
          backgroundColor: '#FEF3C7',
          color: '#92400E',
          border: '1px solid #F59E0B',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    )
  }

  const prevReinboundInEdit = selectedUnit ? getReinboundType(selectedUnit) : 'NONE'
  const isNewReinboundSelected =
    editForm.reinbound_type !== 'NONE' && editForm.reinbound_type !== prevReinboundInEdit

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 상단 요약 바 & 출고증 팝업 / 신규 입고 버튼 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontWeight: '800', fontSize: '15px', color: '#0F172A' }}>
            전체 {summaryCounts.total}대
          </span>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === key ? 'ALL' : key))}
              style={{
                padding: '6px 12px',
                borderRadius: '999px',
                border: statusFilter === key ? '2px solid #0F172A' : '1px solid #E2E8F0',
                backgroundColor: meta.bg,
                color: meta.color,
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              {meta.label} {summaryCounts[key] || 0}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleOpenVoucherModal}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#0F172A',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            📄 출고증 작성 (다중 S/N)
          </button>

          <button
            type="button"
            onClick={() => (isAddOpen ? closeAddModal() : openAddModal())}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {isAddOpen ? '입고 폼 닫기' : '+ 프린터 입고 등록'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            fontSize: '13px',
            fontWeight: '600',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* 신규 프린터 입고 등록 폼 */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateUnit}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #CBD5E1',
            padding: '18px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: '12px',
          }}
        >
          <div>
            <label style={labelStyle}>모델 *</label>
            <select
              value={newForm.model_id}
              onChange={(e) => setNewForm((prev) => ({ ...prev, model_id: e.target.value }))}
              style={inputStyle}
              required
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.manufacturer}] {formatModelLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>본체 시리얼 번호 (숫자만) *</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="예: 341946"
              value={newForm.serial_number}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, serial_number: onlyDigits(e.target.value) }))
              }
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>노즐 사이즈</label>
            <select
              value={newForm.nozzle_size}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, nozzle_size: e.target.value }))
              }
              style={inputStyle}
            >
              <option value="">선택</option>
              {NOZZLE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>입고일자</label>
            <input
              type="date"
              value={newForm.inbound_date}
              onChange={(e) => setNewForm((prev) => ({ ...prev, inbound_date: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>입고단가</label>
            <input
              type="number"
              step="0.01"
              placeholder="예: 12000000"
              value={newForm.unit_cost}
              onChange={(e) => setNewForm((prev) => ({ ...prev, unit_cost: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>보관 위치</label>
            <input
              type="text"
              value={newForm.warehouse_location}
              onChange={(e) =>
                setNewForm((prev) => ({ ...prev, warehouse_location: e.target.value }))
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>메모</label>
            <input
              type="text"
              placeholder="비고"
              value={newForm.memo}
              onChange={(e) => setNewForm((prev) => ({ ...prev, memo: e.target.value }))}
              style={inputStyle}
            />
          </div>

          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            <button
              type="button"
              onClick={closeAddModal}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                backgroundColor: '#FFFFFF',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#0F172A',
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {saving ? '저장 중...' : '입고 등록'}
            </button>
          </div>
        </form>
      )}

      {/* 검색창 */}
      <div>
        <input
          type="text"
          placeholder="🔍 S/N, 모델(JET2Neo, JET3 Eco, JET3 Eco Pi), 납품처/대여처, 창고 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, padding: '11px 12px' }}
        />
      </div>

      {/* 본문 2단 레이아웃 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* 좌측 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '580px',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <colgroup>
                <col style={{ width: '96px' }} />
                <col style={{ width: '136px' }} />
                <col style={{ width: '98px' }} />
                <col style={{ width: '146px' }} />
                <col style={{ width: '104px' }} />
              </colgroup>
              <thead>
                <tr
                  style={{
                    backgroundColor: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    color: '#475569',
                  }}
                >
                  <th style={{ padding: '12px' }}>S/N</th>
                  <th style={{ padding: '12px' }}>모델</th>
                  <th style={{ padding: '12px' }}>입고일자</th>
                  <th style={{ padding: '12px' }}>재입고 여부</th>
                  <th style={{ padding: '12px' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : paginatedUnits.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}
                    >
                      조건에 맞는 프린터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedUnits.map((u) => {
                    const isSelected = u.id === selectedUnitId
                    const modelLabel = formatModelLabel(u.printer_models)
                    const reinboundLabel = getReinboundLabel(u)

                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUnitId(u.id)}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                          cursor: 'pointer',
                        }}
                      >
                        <td
                          style={{
                            padding: '11px 12px',
                            fontWeight: '800',
                            color: '#0F172A',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={u.serial_number}
                        >
                          {u.serial_number}
                        </td>
                        <td
                          style={{
                            padding: '11px 12px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={modelLabel}
                        >
                          {modelLabel}
                        </td>
                        <td
                          style={{
                            padding: '11px 12px',
                            color: '#334155',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.inbound_date || '-'}
                        </td>
                        <td style={{ padding: '11px 12px', overflow: 'hidden' }}>
                          {reinboundLabel ? (
                            renderReinboundBadge(u)
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94A3B8' }}>일반 입고</span>
                          )}
                        </td>
                        <td style={{ padding: '11px 12px', overflow: 'hidden' }}>
                          {renderStatusBadge(u.status)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredUnits.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                padding: '6px 4px',
              }}
            >
              {currentPage > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  &lt; 이전
                </button>
              )}

              {pageNumbers.map((pageNum) => {
                const isActive = pageNum === currentPage
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    style={{
                      minWidth: '30px',
                      height: '30px',
                      padding: '0 8px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #CBD5E1' : '1px solid transparent',
                      backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                      color: isActive ? '#DC2626' : '#334155',
                      fontSize: '13px',
                      fontWeight: isActive ? '800' : '600',
                      cursor: 'pointer',
                    }}
                  >
                    {pageNum}
                  </button>
                )
              })}

              {currentPage < totalPages && (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  다음 &gt;
                </button>
              )}
            </div>
          )}
        </div>

        {/* 우측: 선택 S/N 상세 & 정보 수정 + 대여 반납 + 이력 */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
          }}
        >
          {!selectedUnit ? (
            <div
              style={{
                padding: '28px',
                textAlign: 'center',
                color: '#64748B',
                fontSize: '13px',
              }}
            >
              좌측 목록에서 프린터를 선택하거나 S/N을 검색하세요.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px',
                  borderBottom: '1px solid #F1F5F9',
                  paddingBottom: '14px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>
                      {selectedUnit.printer_models?.manufacturer || '-'}
                    </span>
                    {renderReinboundBadge(selectedUnit)}
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '900',
                      color: '#0F172A',
                      marginTop: '4px',
                    }}
                  >
                    {selectedUnit.serial_number}
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: '700',
                      color: '#2563EB',
                      marginTop: '2px',
                    }}
                  >
                    {formatModelLabel(selectedUnit.printer_models)}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {renderStatusBadge(selectedUnit.status)}
                  {selectedUnit.status === 'DEMO' && (
                    <button
                      type="button"
                      onClick={() => setIsReturnOpen((prev) => !prev)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {isReturnOpen ? '반납 닫기' : '대여 반납(재입고)'}
                    </button>
                  )}
                </div>
              </div>

              {/* 대여 반납(재입고) 폼 */}
              {selectedUnit.status === 'DEMO' && isReturnOpen && (
                <form
                  onSubmit={handleReturnDemoSubmit}
                  style={{
                    backgroundColor: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '12px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#065F46' }}>
                    대여 반납 (재입고 처리)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>반납일자 *</label>
                      <input
                        type="date"
                        value={returnForm.return_date}
                        onChange={(e) =>
                          setReturnForm((prev) => ({ ...prev, return_date: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>재입고 보관 위치</label>
                      <input
                        type="text"
                        placeholder="예: 본사 창고"
                        value={returnForm.warehouse_location}
                        onChange={(e) =>
                          setReturnForm((prev) => ({
                            ...prev,
                            warehouse_location: e.target.value,
                          }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>반납 메모</label>
                    <input
                      type="text"
                      placeholder="점검/상태 메모"
                      value={returnForm.note}
                      onChange={(e) =>
                        setReturnForm((prev) => ({ ...prev, note: e.target.value }))
                      }
                      style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsReturnOpen(false)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#059669',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      {saving ? '처리 중...' : '재입고 완료'}
                    </button>
                  </div>
                </form>
              )}

              {/* 개체 정보 요약 및 정보 수정 */}
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155' }}>
                    개체 정보 (모델 · 노즐 · 입고/납품 · 재입고 · 납품/대여처)
                  </span>

                  {!isEditingUnit ? (
                    <button
                      type="button"
                      onClick={handleStartEditUnit}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      정보 수정
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingUnit(false)}
                        disabled={savingEdit}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveUnitEdit}
                        disabled={savingEdit}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          backgroundColor: '#2563EB',
                          color: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                        }}
                      >
                        {savingEdit ? '저장 중...' : '수정 저장'}
                      </button>
                    </div>
                  )}
                </div>

                {!isEditingUnit ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>모델</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {formatModelLabel(selectedUnit.printer_models)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>노즐 사이즈</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {selectedUnit.nozzle_size || '-'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>입고일자</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {selectedUnit.inbound_date || '-'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>납품일</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {getDeliveryDate(selectedUnit) || '-'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>입고단가</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {formatCurrency(selectedUnit.unit_cost, selectedUnit.currency)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>재입고 구분</div>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: '800',
                          color: '#334155',
                          marginTop: '2px',
                        }}
                      >
                        {REINBOUND_META[getReinboundType(selectedUnit)]?.label || '일반 입고'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>납품/대여처 · 위치</div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {selectedUnit.customer_name || selectedUnit.warehouse_location || '-'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B' }}>메모</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                        {stripSystemTags(selectedUnit.memo) || '-'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={labelStyle}>모델</label>
                      <select
                        value={editForm.model_id}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, model_id: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.manufacturer}] {formatModelLabel(m)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>노즐 사이즈</label>
                      <select
                        value={editForm.nozzle_size}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, nozzle_size: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      >
                        <option value="">선택</option>
                        {editForm.nozzle_size &&
                          !NOZZLE_SIZE_OPTIONS.includes(editForm.nozzle_size) && (
                            <option value={editForm.nozzle_size}>{editForm.nozzle_size}</option>
                          )}
                        {NOZZLE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>입고일자</label>
                      <input
                        type="date"
                        value={editForm.inbound_date}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, inbound_date: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>납품일</label>
                      <input
                        type="date"
                        value={editForm.delivery_date}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, delivery_date: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>입고단가</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="예: 12000000"
                        value={editForm.unit_cost}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, unit_cost: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>상태</label>
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, status: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      >
                        {Object.entries(STATUS_META).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>재입고 여부</label>
                      <select
                        value={editForm.reinbound_type}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, reinbound_type: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      >
                        {Object.entries(REINBOUND_META).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 재입고 구분을 새로 선택한 경우 반납일 및 내용 입력 */}
                    {isNewReinboundSelected && (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          backgroundColor: '#FEF3C7',
                          border: '1px solid #F59E0B',
                          borderRadius: '10px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '800', color: '#92400E' }}>
                          {REINBOUND_META[editForm.reinbound_type]?.label} 이력 생성 정보
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px' }}>
                          <div>
                            <label style={labelStyle}>재입고일 *</label>
                            <input
                              type="date"
                              value={editForm.reinbound_date}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  reinbound_date: e.target.value,
                                }))
                              }
                              style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                              required
                            />
                          </div>

                          <div>
                            <label style={labelStyle}>반납/반품 내용 (이력 메모) *</label>
                            <input
                              type="text"
                              placeholder="예: OO업체 대여 종료 반납, 현장 반품 등"
                              value={editForm.reinbound_note}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  reinbound_note: e.target.value,
                                }))
                              }
                              style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>
                        {editForm.status === 'SOLD' || editForm.status === 'DEMO'
                          ? '납품/대여처'
                          : '보관 위치'}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          editForm.status === 'SOLD' || editForm.status === 'DEMO'
                            ? '업체명 입력'
                            : '예: 본사 창고'
                        }
                        value={editForm.location_or_customer}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            location_or_customer: e.target.value,
                          }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>메모</label>
                      <input
                        type="text"
                        value={editForm.memo}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, memo: e.target.value }))
                        }
                        style={{ ...inputStyle, backgroundColor: '#FFFFFF' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 입출고 · 대여/반납 이력 목록 ([임시 정리용] 삭제 버튼 포함) */}
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#0F172A',
                    marginBottom: '8px',
                  }}
                >
                  입출고 · 대여/반납 이력 ({movements.length})
                </div>

                {movementsLoading ? (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>이력 불러오는 중...</div>
                ) : movements.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    등록된 이력이 없습니다.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      maxHeight: '240px',
                      overflowY: 'auto',
                    }}
                  >
                    {movements.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          fontSize: '12px',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '700',
                          }}
                        >
                          <span>
                            {MOVEMENT_TYPE_META[m.movement_type] || m.movement_type} ·{' '}
                            {m.moved_at ? m.moved_at.slice(0, 10) : ''}
                          </span>

                          {/* [임시 정리용] 이력 삭제 버튼: 정리 후 이 버튼 블록과 handleDeleteMovement만 지우면 됩니다 */}
                          <button
                            type="button"
                            disabled={deletingMovementId === m.id}
                            onClick={() => handleDeleteMovement(m.id)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #FCA5A5',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              fontSize: '11px',
                              fontWeight: '700',
                              cursor: 'pointer',
                            }}
                          >
                            {deletingMovementId === m.id ? '삭제 중...' : '삭제'}
                          </button>
                        </div>

                        <div style={{ color: '#334155', marginTop: '4px' }}>
                          {m.from_location || '-'} → <strong>{m.to_location || '-'}</strong>
                        </div>
                        {m.unit_cost !== null && m.unit_cost !== undefined && (
                          <div style={{ color: '#475569', marginTop: '2px' }}>
                            단가: {formatCurrency(m.unit_cost)}
                          </div>
                        )}
                        {m.note && (
                          <div style={{ color: '#64748B', marginTop: '2px' }}>
                            메모: {stripSystemTags(m.note)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 다중 S/N 출고증 팝업 (판매 출고 / 대여 출고) */}
      {isVoucherOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1200,
            padding: '16px',
          }}
        >
          <form
            onSubmit={handleVoucherSubmit}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              width: '820px',
              maxWidth: '96vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '22px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #E2E8F0',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>
                  📄 프린터 출고증 작성 (다중 S/N 선택)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  출고할 S/N들을 선택하고 입고일자 및 재입고 이력 여부를 확인한 뒤 출고증을 저장합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: '700',
                }}
              >
                ✕
              </button>
            </div>

            {/* 출고증 기본 정보 */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
              }}
            >
              <div>
                <label style={labelStyle}>출고 구분 *</label>
                <select
                  value={voucherForm.movement_type}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, movement_type: e.target.value }))
                  }
                  style={inputStyle}
                >
                  <option value="OUTBOUND_SALE">판매 출고 (납품)</option>
                  <option value="OUTBOUND_DEMO">대여 출고 (임대/데모)</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>출고일자 *</label>
                <input
                  type="date"
                  value={voucherForm.outbound_date}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, outbound_date: e.target.value }))
                  }
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>
                  {voucherForm.movement_type === 'OUTBOUND_DEMO' ? '대여처 *' : '납품처 *'}
                </label>
                <input
                  type="text"
                  placeholder={
                    voucherForm.movement_type === 'OUTBOUND_DEMO'
                      ? '예: (주)OOO 대여현장'
                      : '예: (주)대한패키징'
                  }
                  value={voucherForm.customer_name}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, customer_name: e.target.value }))
                  }
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>단가 (선택)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="예: 15000000"
                  value={voucherForm.unit_cost}
                  onChange={(e) =>
                    setVoucherForm((prev) => ({ ...prev, unit_cost: e.target.value }))
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>출고증 메모</label>
              <input
                type="text"
                placeholder="견적번호, 대여기간, 납품 특이사항 등"
                value={voucherForm.note}
                onChange={(e) => setVoucherForm((prev) => ({ ...prev, note: e.target.value }))}
                style={inputStyle}
              />
            </div>

            {/* 출고 대상 S/N 선택 테이블 */}
            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  padding: '10px 12px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                  출고 대상 선택 (선택됨: {selectedVoucherUnitIds.length}대 / 재고 보유{' '}
                  {units.filter((u) => u.status === 'IN_STOCK').length}대)
                </span>
                <input
                  type="text"
                  placeholder="S/N, 모델, 입고일 필터..."
                  value={voucherSearch}
                  onChange={(e) => setVoucherSearch(e.target.value)}
                  style={{
                    ...inputStyle,
                    width: '230px',
                    padding: '7px 10px',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12px',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                      <th style={{ padding: '9px 10px', width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            availableVoucherUnits.length > 0 &&
                            availableVoucherUnits.every((u) =>
                              selectedVoucherUnitIds.includes(u.id)
                            )
                          }
                          onChange={handleToggleAllVisibleVoucherUnits}
                        />
                      </th>
                      <th style={{ padding: '9px 10px' }}>S/N</th>
                      <th style={{ padding: '9px 10px' }}>모델</th>
                      <th style={{ padding: '9px 10px' }}>입고일자</th>
                      <th style={{ padding: '9px 10px' }}>재입고 이력 여부</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableVoucherUnits.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ padding: '20px', textAlign: 'center', color: '#64748B' }}
                        >
                          출고 가능한 재고 보유(IN_STOCK) 프린터가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      availableVoucherUnits.map((u) => {
                        const checked = selectedVoucherUnitIds.includes(u.id)
                        const reinboundLabel = getReinboundLabel(u)
                        return (
                          <tr
                            key={u.id}
                            onClick={() => toggleVoucherUnit(u.id)}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: checked ? '#EFF6FF' : '#FFFFFF',
                              cursor: 'pointer',
                            }}
                          >
                            <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {}}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td style={{ padding: '9px 10px', fontWeight: '800', color: '#0F172A' }}>
                              {u.serial_number}
                            </td>
                            <td style={{ padding: '9px 10px', fontWeight: '700', color: '#334155' }}>
                              {formatModelLabel(u.printer_models)}
                            </td>
                            <td style={{ padding: '9px 10px', fontWeight: '600', color: '#334155' }}>
                              {u.inbound_date || '-'}
                            </td>
                            <td style={{ padding: '9px 10px' }}>
                              {reinboundLabel ? (
                                renderReinboundBadge(u)
                              ) : (
                                <span style={{ color: '#94A3B8' }}>일반 입고</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setIsVoucherOpen(false)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || selectedVoucherUnitIds.length === 0}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: selectedVoucherUnitIds.length === 0 ? '#94A3B8' : '#2563EB',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: '800',
                  cursor: selectedVoucherUnitIds.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {saving
                  ? '출고 처리 중...'
                  : `${selectedVoucherUnitIds.length}대 출고증 완료`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
