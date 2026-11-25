import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabaseClient'

const PAGE_SIZE = 15

const STATUS_META = {
  IN_STOCK: { label: '재고 보유', bg: '#DCFCE7', color: '#166534' },
  DEMO: { label: '데모/임대', bg: '#FEF3C7', color: '#92400E' },
  SOLD: { label: '납품 완료', bg: '#DBEAFE', color: '#1E40AF' },
  REPAIR: { label: '수리 중', bg: '#F3E8FF', color: '#6B21A8' },
  SCRAPPED: { label: '폐기', bg: '#FEE2E2', color: '#991B1B' },
}

const CONDITION_META = {
  NEW: '신품',
  DEMO_USED: '데모기',
  REFURB: '리퍼',
}

const MOVEMENT_TYPE_META = {
  INBOUND: '입고',
  OUTBOUND_SALE: '판매 출고',
  OUTBOUND_DEMO: '데모 출고',
  RETURN_DEMO: '데모 회수',
  TRANSFER: '위치 이동',
  AS_SWAP: '대체 투입',
  SCRAP: '폐기 처리',
}

const normalizeSerial = (val = '') => val.trim().replace(/\s+/g, '').toUpperCase()
const onlyDigits = (val = '') => String(val ?? '').replace(/[^0-9]/g, '')

const formatCurrency = (amount, currency = 'KRW') => {
  if (amount === null || amount === undefined || amount === '') return '-'
  const num = Number(amount)
  if (Number.isNaN(num)) return '-'
  return `${num.toLocaleString('ko-KR')} ${currency || 'KRW'}`
}

export default function PrintersTab({ refreshParts, showAddForm, setShowAddForm }) {
  const [models, setModels] = useState([])
  const [units, setUnits] = useState([])
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
    condition: 'NEW',
    inbound_date: new Date().toISOString().slice(0, 10),
    unit_cost: '',
    currency: 'KRW',
    warehouse_location: '본사 창고',
    memo: '',
  })

  // 선택 장비 입고일자 / 입고단가 별도 수정 모드 상태
  const [isEditingInboundSpec, setIsEditingInboundSpec] = useState(false)
  const [specForm, setSpecForm] = useState({
    inbound_date: '',
    unit_cost: '',
  })
  const [savingSpec, setSavingSpec] = useState(false)

  // 상태/위치 변경 및 폐기 폼 (선택된 장비 기준)
  const [moveForm, setMoveForm] = useState({
    movement_type: 'OUTBOUND_SALE',
    to_status: 'SOLD',
    location_or_customer: '',
    scrap_reason: '',
    unit_cost: '',
    note: '',
  })

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

  // 모델 및 프린터 개체 목록 조회
  const fetchPrinterData = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const [{ data: modelRows, error: modelErr }, { data: unitRows, error: unitErr }] =
        await Promise.all([
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
        ])

      if (modelErr) throw modelErr
      if (unitErr) throw unitErr

      setModels(modelRows || [])
      setUnits(unitRows || [])

      if (!newForm.model_id && modelRows?.length) {
        setNewForm((prev) => ({ ...prev, model_id: modelRows[0].id }))
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

  // 선택된 프린터의 이동 이력 조회
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
    setMoveForm((prev) => ({
      ...prev,
      location_or_customer: '',
      scrap_reason: '',
      unit_cost: '',
      note: '',
    }))
  }, [selectedUnitId])

  // S/N, 모델명, 거래처명, 창고위치 통합 검색 + 상태 필터
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
      const modelMatch = model?.model_name?.toLowerCase().includes(q)
      const custMatch = u.customer_name?.toLowerCase().includes(q)
      const locMatch = u.warehouse_location?.toLowerCase().includes(q)
      const scrapMatch = u.scrap_reason?.toLowerCase().includes(q)

      return snMatch || modelMatch || custMatch || locMatch || scrapMatch
    })
  }, [units, searchTerm, statusFilter])

  // 검색어 또는 상태 필터 변경 시 1페이지로 초기화
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

  // S/N 검색어와 정확히 일치하는 장비가 있으면 자동 선택 및 해당 페이지로 이동
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

  // 선택 장비 변경 시 입고정보 수정 모드 초기화
  useEffect(() => {
    setIsEditingInboundSpec(false)
    if (selectedUnit) {
      setSpecForm({
        inbound_date: selectedUnit.inbound_date ? String(selectedUnit.inbound_date).slice(0, 10) : '',
        unit_cost:
          selectedUnit.unit_cost !== null && selectedUnit.unit_cost !== undefined
            ? String(selectedUnit.unit_cost)
            : '',
      })
    } else {
      setSpecForm({ inbound_date: '', unit_cost: '' })
    }
  }, [selectedUnit])

  const handleStartEditInboundSpec = () => {
    if (!selectedUnit) return
    setSpecForm({
      inbound_date: selectedUnit.inbound_date ? String(selectedUnit.inbound_date).slice(0, 10) : '',
      unit_cost:
        selectedUnit.unit_cost !== null && selectedUnit.unit_cost !== undefined
          ? String(selectedUnit.unit_cost)
          : '',
    })
    setErrorMsg('')
    setIsEditingInboundSpec(true)
  }

  const handleSaveInboundSpec = async () => {
    if (!selectedUnit) return

    const trimmedDate = specForm.inbound_date.trim()
    const cleanedCost = String(specForm.unit_cost ?? '').replace(/,/g, '').trim()
    const parsedCost = cleanedCost === '' ? null : Number(cleanedCost)

    if (parsedCost !== null && (Number.isNaN(parsedCost) || parsedCost < 0)) {
      setErrorMsg('입고단가는 0 이상의 숫자로 입력해 주세요.')
      return
    }

    setSavingSpec(true)
    setErrorMsg('')
    try {
      const { error } = await supabase
        .from('printer_units')
        .update({
          inbound_date: trimmedDate || null,
          unit_cost: parsedCost,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUnit.id)

      if (error) throw error

      setIsEditingInboundSpec(false)
      await fetchPrinterData()
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '입고일자 및 입고단가 저장 중 오류가 발생했습니다.')
    } finally {
      setSavingSpec(false)
    }
  }

  // 신규 입고 등록 (printer_units INSERT + printer_movements INBOUND INSERT)
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
      const parsedCost =
        newForm.unit_cost === '' || newForm.unit_cost === null
          ? null
          : Number(newForm.unit_cost)

      const { data: createdUnit, error: unitErr } = await supabase
        .from('printer_units')
        .insert([
          {
            model_id: newForm.model_id,
            serial_number: cleanSerial,
            status: 'IN_STOCK',
            condition: newForm.condition,
            inbound_date: newForm.inbound_date || null,
            unit_cost: parsedCost,
            currency: newForm.currency || 'KRW',
            warehouse_location: newForm.warehouse_location.trim() || '본사 창고',
            memo: newForm.memo.trim() || null,
          },
        ])
        .select()
        .single()

      if (unitErr) throw unitErr

      const { error: moveErr } = await supabase.from('printer_movements').insert([
        {
          printer_unit_id: createdUnit.id,
          movement_type: 'INBOUND',
          from_status: null,
          to_status: 'IN_STOCK',
          from_location: '외부 입고',
          to_location: newForm.warehouse_location.trim() || '본사 창고',
          unit_cost: parsedCost,
          reference_type: 'MANUAL',
          note: newForm.memo.trim() || '신규 프린터 입고',
        },
      ])

      if (moveErr) throw moveErr

      setNewForm((prev) => ({
        ...prev,
        serial_number: '',
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

  // 상태/위치 변경 및 폐기 처리 (printer_movements INSERT -> 트리거로 printer_units 동기화)
  const handleMovementSubmit = async (e) => {
    e.preventDefault()
    if (!selectedUnit) return

    const targetLoc = moveForm.location_or_customer.trim()
    if (['SOLD', 'DEMO', 'REPAIR'].includes(moveForm.to_status) && !targetLoc) {
      setErrorMsg('납품/데모/수리 상태 변경 시 거래처명 또는 위치를 입력하세요.')
      return
    }

    setSaving(true)
    setErrorMsg('')
    try {
      const prevLoc =
        selectedUnit.customer_name || selectedUnit.warehouse_location || '-'

      const { error: moveErr } = await supabase.from('printer_movements').insert([
        {
          printer_unit_id: selectedUnit.id,
          movement_type: moveForm.movement_type,
          from_status: selectedUnit.status,
          to_status: moveForm.to_status,
          from_location: prevLoc,
          to_location:
            moveForm.to_status === 'SCRAPPED'
              ? `폐기 (${moveForm.scrap_reason.trim() || '사유 미기재'})`
              : moveForm.to_status === 'IN_STOCK'
                ? targetLoc || '본사 창고'
                : targetLoc,
          customer_name: ['SOLD', 'DEMO', 'REPAIR'].includes(moveForm.to_status)
            ? targetLoc
            : null,
          unit_cost: moveForm.unit_cost === '' ? null : Number(moveForm.unit_cost),
          reference_type: 'MANUAL',
          note: moveForm.note.trim() || moveForm.scrap_reason.trim() || null,
        },
      ])

      if (moveErr) throw moveErr

      // 폐기 상태일 때 폐기일시 및 폐기 사유 추가 기록
      if (moveForm.to_status === 'SCRAPPED') {
        const { error: scrapErr } = await supabase
          .from('printer_units')
          .update({
            scrapped_at: new Date().toISOString(),
            scrap_reason: moveForm.scrap_reason.trim() || '사유 미기재',
          })
          .eq('id', selectedUnit.id)

        if (scrapErr) throw scrapErr
      } else if (selectedUnit.status === 'SCRAPPED') {
        await supabase
          .from('printer_units')
          .update({ scrapped_at: null, scrap_reason: null })
          .eq('id', selectedUnit.id)
      }

      setMoveForm((prev) => ({
        ...prev,
        location_or_customer: '',
        scrap_reason: '',
        unit_cost: '',
        note: '',
      }))

      await fetchPrinterData()
      await fetchMovements(selectedUnit.id)
      refreshParts?.()
    } catch (err) {
      setErrorMsg(err.message || '상태 변경 처리 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 상태 요약 카운트
  const summaryCounts = useMemo(() => {
    return units.reduce(
      (acc, u) => {
        acc.total += 1
        acc[u.status] = (acc[u.status] || 0) + 1
        return acc
      },
      { total: 0, IN_STOCK: 0, DEMO: 0, SOLD: 0, REPAIR: 0, SCRAPPED: 0 }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 상단 요약 바 & 신규 입고 버튼 */}
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
            <label style={labelStyle}>프린터 모델 *</label>
            <select
              value={newForm.model_id}
              onChange={(e) => setNewForm((prev) => ({ ...prev, model_id: e.target.value }))}
              style={inputStyle}
              required
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  [{m.manufacturer}] {m.model_name}
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
            <label style={labelStyle}>장비 상태 구분</label>
            <select
              value={newForm.condition}
              onChange={(e) => setNewForm((prev) => ({ ...prev, condition: e.target.value }))}
              style={inputStyle}
            >
              <option value="NEW">신품 (NEW)</option>
              <option value="DEMO_USED">데모기 (DEMO_USED)</option>
              <option value="REFURB">리퍼 (REFURB)</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>보관 창고 위치</label>
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
              placeholder="옵션, 펌웨어 등"
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
              {saving ? '저장 중...' : '입고 완료'}
            </button>
          </div>
        </form>
      )}

      {/* 검색창 */}
      <div>
        <input
          type="text"
          placeholder="🔍 S/N, 모델, 납품업체, 창고 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...inputStyle, padding: '11px 12px' }}
        />
      </div>

      {/* 본문 2단 레이아웃: 좌측 목록(15개 단위 페이지네이션) / 우측 S/N 상세 & 이동 이력 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* 좌측: 프린터 개체 목록 (페이지당 15개, 열 너비 고정 및 말줄임표 처리) */}
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
                minWidth: '540px',
                tableLayout: 'fixed',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <colgroup>
                <col style={{ width: '92px' }} />
                <col style={{ width: '124px' }} />
                <col style={{ width: '96px' }} />
                <col style={{ width: '138px' }} />
                <col style={{ width: '90px' }} />
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
                  <th style={{ padding: '12px' }}>제조사 / 모델</th>
                  <th style={{ padding: '12px' }}>상태</th>
                  <th style={{ padding: '12px' }}>현재 위치 / 거래처</th>
                  <th style={{ padding: '12px' }}>입고일</th>
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
                    const locationText =
                      u.status === 'SCRAPPED'
                        ? `폐기 (${u.scrap_reason || '사유 미기재'})`
                        : u.customer_name || u.warehouse_location || '-'

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
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#64748B',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {u.printer_models?.manufacturer || '-'}
                          </div>
                          <div
                            style={{
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={u.printer_models?.model_name || '-'}
                          >
                            {u.printer_models?.model_name || '-'}
                          </div>
                        </td>
                        <td style={{ padding: '11px 12px', overflow: 'hidden' }}>
                          {renderStatusBadge(u.status)}
                        </td>
                        <td
                          style={{
                            padding: '11px 12px',
                            fontWeight: '600',
                            color: '#1E293B',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={locationText}
                        >
                          {locationText}
                        </td>
                        <td
                          style={{
                            padding: '11px 12px',
                            color: '#475569',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {u.inbound_date || '-'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 하단 페이지네이션 바 (페이지당 15개 기준) */}
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

        {/* 우측: 선택된 S/N 상세 스냅샷 + 출고/데모/폐기 처리 + 이동 이력 */}
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
              {/* S/N 핵심 요약 헤더 */}
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
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: '700' }}>
                    {selectedUnit.printer_models?.manufacturer} ·{' '}
                    {selectedUnit.printer_models?.series} ·{' '}
                    {CONDITION_META[selectedUnit.condition] || selectedUnit.condition}
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '900',
                      color: '#0F172A',
                      marginTop: '2px',
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
                    {selectedUnit.printer_models?.model_name || '-'}
                  </div>
                </div>
                {renderStatusBadge(selectedUnit.status)}
              </div>

              {/* 입고일 · 입고단가 · 현재 위치/납품업체 · 폐기 여부 요약 (별도 수정 모드) */}
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
                    입고 및 개체 요약
                  </span>

                  {!isEditingInboundSpec ? (
                    <button
                      type="button"
                      onClick={handleStartEditInboundSpec}
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
                      입고정보 수정
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setIsEditingInboundSpec(false)}
                        disabled={savingSpec}
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
                        onClick={handleSaveInboundSpec}
                        disabled={savingSpec}
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
                        {savingSpec ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>입고일자</div>
                    {isEditingInboundSpec ? (
                      <input
                        type="date"
                        value={specForm.inbound_date}
                        onChange={(e) =>
                          setSpecForm((prev) => ({ ...prev, inbound_date: e.target.value }))
                        }
                        style={{ ...inputStyle, padding: '7px 10px', marginTop: '4px' }}
                      />
                    ) : (
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {selectedUnit.inbound_date || '-'}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>입고단가</div>
                    {isEditingInboundSpec ? (
                      <input
                        type="number"
                        step="0.01"
                        placeholder="예: 12000000"
                        value={specForm.unit_cost}
                        onChange={(e) =>
                          setSpecForm((prev) => ({ ...prev, unit_cost: e.target.value }))
                        }
                        style={{ ...inputStyle, padding: '7px 10px', marginTop: '4px' }}
                      />
                    ) : (
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                        {formatCurrency(selectedUnit.unit_cost, selectedUnit.currency)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                      현재 납품업체 / 보관위치
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>
                      {selectedUnit.customer_name || selectedUnit.warehouse_location || '-'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>폐기 여부</div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: selectedUnit.status === 'SCRAPPED' ? '#991B1B' : '#166534',
                      }}
                    >
                      {selectedUnit.status === 'SCRAPPED'
                        ? `폐기됨 (${selectedUnit.scrapped_at ? selectedUnit.scrapped_at.slice(0, 10) : ''})`
                        : '정상 (미폐기)'}
                    </div>
                  </div>

                  {selectedUnit.status === 'SCRAPPED' && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '11px', color: '#991B1B' }}>폐기 사유</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#991B1B' }}>
                        {selectedUnit.scrap_reason || '폐기 사유 미기재'}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '11px', color: '#64748B' }}>누적 A/S 횟수</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                      {selectedUnit.service_count ?? 0} 회
                    </div>
                  </div>
                </div>
              </div>

              {/* 상태/위치 변경 및 폐기 처리 */}
              <form
                onSubmit={handleMovementSubmit}
                style={{
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>
                  출고 / 데모 / 위치이동 / 폐기 처리
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>처리 유형</label>
                    <select
                      value={moveForm.movement_type}
                      onChange={(e) => {
                        const val = e.target.value
                        const nextStatusMap = {
                          OUTBOUND_SALE: 'SOLD',
                          OUTBOUND_DEMO: 'DEMO',
                          RETURN_DEMO: 'IN_STOCK',
                          TRANSFER: 'IN_STOCK',
                          AS_SWAP: 'DEMO',
                          SCRAP: 'SCRAPPED',
                        }
                        setMoveForm((prev) => ({
                          ...prev,
                          movement_type: val,
                          to_status: nextStatusMap[val] || prev.to_status,
                        }))
                      }}
                      style={inputStyle}
                    >
                      <option value="OUTBOUND_SALE">판매 출고 (납품)</option>
                      <option value="OUTBOUND_DEMO">데모 출고</option>
                      <option value="RETURN_DEMO">데모 회수 (재고복귀)</option>
                      <option value="TRANSFER">창고 위치 이동</option>
                      <option value="AS_SWAP">대체 장비 투입</option>
                      <option value="SCRAP">폐기 처리</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>변경 후 상태</label>
                    <select
                      value={moveForm.to_status}
                      onChange={(e) =>
                        setMoveForm((prev) => ({ ...prev, to_status: e.target.value }))
                      }
                      style={inputStyle}
                    >
                      {Object.entries(STATUS_META).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label} ({k})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {moveForm.to_status === 'SCRAPPED' ? (
                  <div>
                    <label style={labelStyle}>폐기 사유 *</label>
                    <input
                      type="text"
                      placeholder="예: 메인보드/헤드 노후 수리불가, 데모기 폐기"
                      value={moveForm.scrap_reason}
                      onChange={(e) =>
                        setMoveForm((prev) => ({ ...prev, scrap_reason: e.target.value }))
                      }
                      style={inputStyle}
                      required
                    />
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>
                      {moveForm.to_status === 'IN_STOCK'
                        ? '보관 창고 위치 (미입력 시 본사 창고)'
                        : '납품/설치 업체명 *'}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        moveForm.to_status === 'IN_STOCK'
                          ? '예: 본사 창고, 안산 사무실'
                          : '예: (주)대한패키징'
                      }
                      value={moveForm.location_or_customer}
                      onChange={(e) =>
                        setMoveForm((prev) => ({
                          ...prev,
                          location_or_customer: e.target.value,
                        }))
                      }
                      style={inputStyle}
                      required={moveForm.to_status !== 'IN_STOCK'}
                    />
                  </div>
                )}

                <div>
                  <label style={labelStyle}>비고 / 메모</label>
                  <input
                    type="text"
                    placeholder="견적번호, 리포트 번호, 특이사항 등"
                    value={moveForm.note}
                    onChange={(e) => setMoveForm((prev) => ({ ...prev, note: e.target.value }))}
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor:
                      moveForm.to_status === 'SCRAPPED' ? '#DC2626' : '#2563EB',
                    color: '#FFFFFF',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {saving ? '처리 중...' : '이력 기록 및 상태 반영'}
                </button>
              </form>

              {/* 이동/입출고/폐기 이력 타임라인 */}
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: '800',
                    color: '#0F172A',
                    marginBottom: '8px',
                  }}
                >
                  입출고 · 이동 · 폐기 이력 ({movements.length})
                </div>

                {movementsLoading ? (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>이력 불러오는 중...</div>
                ) : movements.length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#64748B' }}>
                    등록된 이동 이력이 없습니다.
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
                            fontWeight: '700',
                          }}
                        >
                          <span>
                            {MOVEMENT_TYPE_META[m.movement_type] || m.movement_type} ·{' '}
                            {STATUS_META[m.to_status]?.label || m.to_status}
                          </span>
                          <span style={{ color: '#64748B', fontWeight: '500' }}>
                            {m.moved_at ? m.moved_at.slice(0, 16).replace('T', ' ') : ''}
                          </span>
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
                          <div style={{ color: '#64748B', marginTop: '2px' }}>메모: {m.note}</div>
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
    </div>
  )
}