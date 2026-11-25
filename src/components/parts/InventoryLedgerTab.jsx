import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'

const PRINTER_MOVEMENT_LABELS = {
  INBOUND: '프린터 입고',
  OUTBOUND_SALE: '판매 출고',
  OUTBOUND_DEMO: '데모 출고',
  RETURN_DEMO: '데모 회수',
  TRANSFER: '위치 이동',
  AS_SWAP: '대체 투입',
  SCRAP: '폐기 처리',
}

export default function InventoryLedgerTab({ partsList, refreshParts }) {
  const [ledgerData, setLedgerData] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [hideZeroStock, setHideZeroStock] = useState(false)

  const [selectedItemHistory, setSelectedItemHistory] = useState(null)
  const [historyList, setHistoryList] = useState([])

  // 12월 마감 결산 확인 모달 및 재확정/잠금 방어 상태
  const [showYearEndModal, setShowYearEndModal] = useState(false)
  const [closingYear, setClosingYear] = useState('2026')
  const [closingConfirmedNote, setClosingConfirmedNote] = useState('')
  const [closedRecordsByYear, setClosedRecordsByYear] = useState({})
  const [reopenMode, setReopenMode] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenConfirmedCheck, setReopenConfirmedCheck] = useState(false)

  const cleanNoteText = (rawNote) => {
    if (!rawNote) return ''
    const str = String(rawNote)
    const cutIndex = str.search(/\[(LOT_RESTORE|DELIVERY_DETAILS):/)
    const baseText = cutIndex >= 0 ? str.slice(0, cutIndex) : str
    return baseText.trim()
  }

  const parseDeliveryDetailsItems = (rawNote) => {
    if (!rawNote) return []
    const str = String(rawNote)
    const tag = '[DELIVERY_DETAILS:'
    const startIndex = str.indexOf(tag)
    if (startIndex === -1) return []

    const jsonPart = str.slice(startIndex + tag.length).trim()
    const endIndex = jsonPart.lastIndexOf(']')
    const jsonString = endIndex >= 0 ? jsonPart.slice(0, endIndex).trim() : jsonPart

    try {
      const parsed = JSON.parse(jsonString)
      return Array.isArray(parsed?.items) ? parsed.items : []
    } catch (e) {
      return []
    }
  }

  const extractQtyFromSummary = (summary, partName, rawNote = '', partCode = '') => {
    if (summary) {
      if (partName) {
        const escapedName = String(partName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const namedMatch = summary.match(new RegExp(`${escapedName}[^\\n(]*\\((\\d+)개\\)`))
        if (namedMatch) return parseInt(namedMatch[1], 10)
      }
      const genericMatch = summary.match(/\((\d+)개\)/)
      if (genericMatch) return parseInt(genericMatch[1], 10)
    }

    if (rawNote) {
      const detailItems = parseDeliveryDetailsItems(rawNote)
      const matchedItem = detailItems.find((it) => {
        const codeMatch =
          partCode &&
          it?.code &&
          String(it.code).trim().toLowerCase() === String(partCode).trim().toLowerCase()
        const nameMatch =
          partName &&
          it?.name &&
          String(it.name).trim().toLowerCase() === String(partName).trim().toLowerCase()
        return codeMatch || nameMatch
      })
      if (matchedItem && matchedItem.quantity !== undefined && matchedItem.quantity !== null) {
        const parsedQty = Number(matchedItem.quantity)
        if (!Number.isNaN(parsedQty) && parsedQty > 0) return parsedQty
      }
    }

    return 0
  }

  const extractUnitPriceFromText = (text) => {
    if (!text) return null
    const match = String(text).match(/단가\s*[:：]?\s*([\d,]+)\s*원?/)
    if (!match) return null
    const parsed = Number(match[1].replace(/,/g, ''))
    return Number.isNaN(parsed) ? null : parsed
  }

  const tryParseSerials = (serialsStr) => {
    try {
      const parsed = typeof serialsStr === 'string' ? JSON.parse(serialsStr) : serialsStr
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }

  const formatManufacturerTitle = (rawMfr) => {
    const clean = String(rawMfr || '').trim()
    if (!clean) return 'Leibinger'
    if (clean.toUpperCase() === 'LEIBINGER') return 'Leibinger'
    if (clean.toUpperCase() === 'REINER') return 'Reiner'
    return clean
  }

  const buildPrinterLedgerRows = (printerUnits = [], printerMovements = []) => {
    if (!Array.isArray(printerUnits) || printerUnits.length === 0) return []

    const unitById = new Map()
    const groups = new Map()

    printerUnits.forEach((unit) => {
      unitById.set(String(unit.id), unit)
      const mfrTitle = formatManufacturerTitle(unit.printer_models?.manufacturer)
      const categoryLabel = `${mfrTitle} 프린터`

      if (!groups.has(categoryLabel)) {
        groups.set(categoryLabel, {
          manufacturer: mfrTitle,
          categoryLabel,
          units: [],
          movements: [],
        })
      }
      groups.get(categoryLabel).units.push(unit)
    })

    ;(printerMovements || []).forEach((mv) => {
      const unit = unitById.get(String(mv.printer_unit_id))
      if (!unit) return
      const mfrTitle = formatManufacturerTitle(unit.printer_models?.manufacturer)
      const categoryLabel = `${mfrTitle} 프린터`
      const grp = groups.get(categoryLabel)
      if (grp) {
        grp.movements.push({ ...mv, _unit: unit })
      }
    })

    const rows = []

    groups.forEach((grp) => {
      const inStockUnits = grp.units.filter((u) => u.status === 'IN_STOCK')
      const currentQty = inStockUnits.length
      const totalAssetValue = inStockUnits.reduce((sum, u) => {
        const cost = Number(u.unit_cost)
        return sum + (Number.isNaN(cost) ? 0 : cost)
      }, 0)

      const inboundMovementRows = grp.movements
        .filter((mv) => mv.movement_type === 'INBOUND')
        .map((mv) => {
          const u = mv._unit
          const modelName = u.printer_models?.model_name || '프린터'
          const sn = u.serial_number || '-'
          const dateStr = mv.moved_at
            ? String(mv.moved_at).slice(0, 10)
            : u.inbound_date
              ? String(u.inbound_date).slice(0, 10)
              : '-'
          const rawPrice =
            mv.unit_cost !== null && mv.unit_cost !== undefined
              ? Number(mv.unit_cost)
              : u.unit_cost !== null && u.unit_cost !== undefined
                ? Number(u.unit_cost)
                : null

          return {
            date: dateStr,
            badge: `S/N ${sn}`,
            summary: `[${modelName}] S/N: ${sn} (1대)`,
            note: mv.note || u.memo || '',
            author: '프린터 관리',
            unitPrice: rawPrice !== null && !Number.isNaN(rawPrice) ? rawPrice : null,
          }
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

      const outboundMovementRows = grp.movements
        .filter((mv) =>
          ['OUTBOUND_SALE', 'OUTBOUND_DEMO', 'AS_SWAP', 'SCRAP'].includes(mv.movement_type)
        )
        .map((mv) => {
          const u = mv._unit
          const modelName = u.printer_models?.model_name || '프린터'
          const sn = u.serial_number || '-'
          const dateStr = mv.moved_at ? String(mv.moved_at).slice(0, 10) : '-'
          const typeLabel = PRINTER_MOVEMENT_LABELS[mv.movement_type] || mv.movement_type
          const destLabel = mv.customer_name || mv.to_location || typeLabel

          return {
            date: dateStr,
            badge: `${typeLabel} · ${destLabel}`,
            summary: `[${modelName}] S/N: ${sn} (1대)`,
            note: mv.note || '',
            author: '프린터 관리',
            unitPrice: null,
          }
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

      const returnDemoCount = grp.movements.filter(
        (mv) => mv.movement_type === 'RETURN_DEMO'
      ).length

      const inboundQty = inboundMovementRows.length
      const outboundQty = Math.max(0, outboundMovementRows.length - returnDemoCount)
      const carryOverQty = currentQty + outboundQty - inboundQty

      rows.push({
        id: `printer-group-${grp.categoryLabel}`,
        isPrinterGroup: true,
        code: grp.manufacturer.toUpperCase(),
        name: `${grp.manufacturer} 프린터 (본체)`,
        category: grp.categoryLabel,
        carryOver: carryOverQty,
        inbound: inboundQty,
        outbound: outboundQty,
        current: currentQty,
        assetValue: totalAssetValue,
        histories: [],
        lots: [],
        printerInboundRows: inboundMovementRows,
        printerOutboundRows: outboundMovementRows,
      })
    })

    return rows
  }

  const fetchLedgerSummary = async () => {
    setLoading(true)
    try {
      const [
        { data: historyData, error: histErr },
        { data: lotsData, error: lotsErr },
        { data: printerUnitsData, error: printerUnitsErr },
        { data: printerMovementsData, error: printerMovementsErr },
      ] = await Promise.all([
        supabase.from('delivery_history').select('*').order('date', { ascending: false }),
        supabase.from('part_stock_lots').select('*'),
        supabase.from('printer_units').select(`
          *,
          printer_models (
            id,
            manufacturer,
            category,
            series,
            model_name
          )
        `),
        supabase.from('printer_movements').select('*').order('moved_at', { ascending: false }),
      ])

      if (histErr) throw histErr
      if (lotsErr) throw lotsErr
      if (printerUnitsErr) throw printerUnitsErr
      if (printerMovementsErr) throw printerMovementsErr

      const hasPrinterUnits = Array.isArray(printerUnitsData) && printerUnitsData.length > 0
      const filteredPartsList = (partsList || []).filter((part) => {
        if (!hasPrinterUnits) return true
        const cat = String(part.category || '').trim()
        return cat !== 'Leibinger 프린터' && cat !== '프린터'
      })

      const computedParts = filteredPartsList.map((part) => {
        const partLots = (lotsData || []).filter((l) => String(l.part_id) === String(part.id))
        const currentStock = Number(part.stock) || 0
        const carryOverStock = Number(part.carry_over_stock) || 0

        let totalAssetValue = 0
        let remainingStockToCalc = currentStock
        const validLots = partLots.filter((l) => (Number(l.current_qty) || 0) > 0)

        if (validLots.length > 0 && remainingStockToCalc > 0) {
          validLots.forEach((l) => {
            if (remainingStockToCalc <= 0) return
            const qty = Math.min(remainingStockToCalc, Number(l.current_qty) || 0)
            const lotUnitPrice = Number(l.unit_price) || Number(part.unit_price) || 0
            totalAssetValue += qty * lotUnitPrice
            remainingStockToCalc -= qty
          })
        }

        if (remainingStockToCalc > 0) {
          if (part.is_serial_managed) {
            const serialsArr = tryParseSerials(part.serials)
            let snCalculated = 0
            serialsArr.forEach((s) => {
              if (snCalculated < remainingStockToCalc) {
                totalAssetValue += Number(s.unit_price || part.unit_price || 0)
                snCalculated += 1
              }
            })
            if (snCalculated < remainingStockToCalc) {
              totalAssetValue +=
                (remainingStockToCalc - snCalculated) * (Number(part.unit_price) || 0)
            }
          } else {
            totalAssetValue += remainingStockToCalc * (Number(part.unit_price) || 0)
          }
        }

        const partCodeNorm = part.code ? String(part.code).trim().toLowerCase() : ''
        const partNameNorm = part.name ? String(part.name).trim().toLowerCase() : ''

        const partHistories = (historyData || []).filter((h) => {
          if (h.part_id !== undefined && h.part_id !== null && String(h.part_id).trim() !== '') {
            return String(h.part_id) === String(part.id)
          }

          if (h.summary) {
            const summaryLower = String(h.summary).toLowerCase()
            if (partCodeNorm && summaryLower.includes(`[${partCodeNorm}]`)) {
              return true
            }
            if (partNameNorm && summaryLower.includes(partNameNorm)) {
              return true
            }
          }

          const detailItems = parseDeliveryDetailsItems(h.note)
          if (detailItems.length > 0) {
            const matchedInDetails = detailItems.some((it) => {
              const itemCodeNorm = it?.code ? String(it.code).trim().toLowerCase() : ''
              const itemNameNorm = it?.name ? String(it.name).trim().toLowerCase() : ''
              return (
                (partCodeNorm && itemCodeNorm && itemCodeNorm === partCodeNorm) ||
                (partNameNorm && itemNameNorm && itemNameNorm === partNameNorm)
              )
            })
            if (matchedInDetails) return true
          }

          return false
        })

        let inboundQty = 0
        let outboundQty = 0

        const lotInboundSum = partLots.reduce(
          (sum, lot) => sum + (Number(lot.initial_qty) || 0),
          0
        )

        const inboundHistorySum = partHistories.reduce((sum, h) => {
          const isInbound = h.type === 'INBOUND' || h.company_name?.includes('입고')
          if (!isInbound) return sum
          const qty = extractQtyFromSummary(h.summary, part.name, h.note, part.code)
          return sum + (qty > 0 ? qty : 1)
        }, 0)

        inboundQty = partLots.length > 0 ? lotInboundSum : inboundHistorySum

        partHistories.forEach((h) => {
          if (h.type === 'OUTBOUND' || h.company_name?.includes('출고')) {
            const qty = extractQtyFromSummary(h.summary, part.name, h.note, part.code)
            outboundQty += qty > 0 ? qty : 1
          }
        })

        return {
          id: part.id,
          isPrinterGroup: false,
          code: part.code || '-',
          name: part.name,
          category: part.category || '일반부품',
          carryOver: carryOverStock,
          inbound: inboundQty,
          outbound: outboundQty,
          current: currentStock,
          assetValue: totalAssetValue,
          histories: partHistories,
          lots: partLots,
        }
      })

      const computedPrinters = buildPrinterLedgerRows(printerUnitsData || [], printerMovementsData || [])

      setLedgerData([...computedPrinters, ...computedParts])
    } catch (err) {
      console.error('수불부 데이터 집계 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshAll = async () => {
    if (typeof refreshParts === 'function') {
      await refreshParts()
    }
    await fetchLedgerSummary()
  }

  useEffect(() => {
    fetchLedgerSummary()
  }, [partsList])

  const handleOpenDetailHistory = (item, type) => {
    setSelectedItemHistory({ name: item.name, code: item.code, type })

    if (item.isPrinterGroup) {
      if (type === 'INBOUND') {
        setHistoryList(item.printerInboundRows || [])
      } else {
        setHistoryList(item.printerOutboundRows || [])
      }
      return
    }

    if (type === 'INBOUND') {
      const hasLots = Array.isArray(item.lots) && item.lots.length > 0

      if (hasLots) {
        const inboundHistories = (item.histories || []).filter(
          (h) => h.type === 'INBOUND' || h.company_name?.includes('입고')
        )

        const lotInboundRows = item.lots
          .map((lot) => {
            const qty = Number(lot.initial_qty ?? lot.current_qty ?? 0)
            const lotPrice =
              lot.unit_price !== undefined && lot.unit_price !== null
                ? Number(lot.unit_price)
                : null

            const matchedHistory =
              inboundHistories.find((h) => {
                const noteText = cleanNoteText(h.note)
                if (lot.po_number && noteText.includes(`LOT/PO: ${lot.po_number}`)) {
                  return !lot.import_date || h.date === lot.import_date
                }
                return false
              }) || inboundHistories.find((h) => lot.import_date && h.date === lot.import_date)

            const historyNote = matchedHistory ? cleanNoteText(matchedHistory.note) : ''

            return {
              date: lot.import_date || '-',
              badge: `로트 (${lot.po_number || '미지정'})`,
              summary: `[${item.code}] ${item.name} (${qty}개)`,
              note: historyNote,
              author: matchedHistory?.author || '로트 관리',
              unitPrice: lotPrice,
            }
          })
          .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

        setHistoryList(lotInboundRows)
        return
      }

      const historyInboundRows = (item.histories || [])
        .filter((h) => h.type === 'INBOUND' || h.company_name?.includes('입고'))
        .map((h) => {
          const parsedPrice = extractUnitPriceFromText(`${h.summary || ''} ${h.note || ''}`)
          return {
            date: h.date || '-',
            badge: h.company_name || '입고 이력',
            summary: h.summary || '-',
            note: cleanNoteText(h.note),
            author: h.author || '배진철',
            unitPrice: parsedPrice,
          }
        })
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

      setHistoryList(historyInboundRows)
      return
    }

    const filteredOutbound = (item.histories || [])
      .filter((h) => h.type === 'OUTBOUND' || h.company_name?.includes('출고'))
      .map((h) => ({
        date: h.date || '-',
        badge: h.company_name || '거래처 미지정',
        summary: h.summary || '-',
        note: cleanNoteText(h.note),
        author: h.author || '배진철',
        unitPrice: null,
      }))

    setHistoryList(filteredOutbound)
  }

  const escapeCsvCell = (value) => {
    const str = value === null || value === undefined ? '' : String(value)
    return `"${str.replace(/"/g, '""')}"`
  }

  const handleExportExcel = () => {
    let csv = '\uFEFF'
    csv += 'Ident No.,품명,구분,이월재고,입고수량,출고수량,현재고,재고금액(원)\n'

    filteredLedger.forEach((item) => {
      csv +=
        [
          escapeCsvCell(item.code),
          escapeCsvCell(item.name),
          escapeCsvCell(item.category),
          escapeCsvCell(item.carryOver),
          escapeCsvCell(item.inbound),
          escapeCsvCell(item.outbound),
          escapeCsvCell(item.current),
          escapeCsvCell(item.assetValue),
        ].join(',') + '\n'
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', `재고수불부_결산_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filteredLedger = ledgerData
    .filter((item) => {
      const matchesSearch =
        !searchTerm.trim() ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
      const matchesZeroStock = hideZeroStock ? item.current > 0 : true

      return matchesSearch && matchesCategory && matchesZeroStock
    })
    .sort((a, b) => {
      if (a.isPrinterGroup !== b.isPrinterGroup) return a.isPrinterGroup ? -1 : 1
      const codeDiff = (a.code || '').localeCompare(b.code || '', 'ko-KR')
      if (codeDiff !== 0) return codeDiff
      return (a.name || '').localeCompare(b.name || '', 'ko-KR')
    })

  const availableCategories = ['ALL', ...new Set(ledgerData.map((i) => i.category).filter(Boolean))]

  const totalSumAssetValue = filteredLedger.reduce((acc, cur) => acc + (cur.assetValue || 0), 0)

  const closingCheckRows = filteredLedger.map((item) => {
    const carryOver = Number(item.carryOver) || 0
    const inbound = Number(item.inbound) || 0
    const outbound = Number(item.outbound) || 0
    const current = Number(item.current) || 0
    const formulaCurrent = carryOver + inbound - outbound
    const diff = current - formulaCurrent
    return {
      ...item,
      formulaCurrent,
      diff,
      isBalanced: diff === 0,
    }
  })

  const unbalancedCount = closingCheckRows.filter((r) => !r.isBalanced).length

  const currentYearRecord = closedRecordsByYear[closingYear] || null
  const isYearClosed = Boolean(currentYearRecord && currentYearRecord.status === 'CLOSED')
  const hasPostCloseChange =
    isYearClosed &&
    (currentYearRecord.totalAssetValue !== totalSumAssetValue ||
      currentYearRecord.itemCount !== closingCheckRows.length ||
      currentYearRecord.unbalancedCount !== unbalancedCount)

  const handleOpenYearEndModal = () => {
    setReopenMode(false)
    setReopenReason('')
    setReopenConfirmedCheck(false)
    setShowYearEndModal(true)
  }

  const handleChangeClosingYear = (nextYear) => {
    setClosingYear(nextYear)
    setReopenMode(false)
    setReopenReason('')
    setReopenConfirmedCheck(false)
  }

  const canConfirmClosing =
    !isYearClosed || (reopenMode && reopenReason.trim().length >= 4 && reopenConfirmedCheck)

  const handleConfirmYearEnd = () => {
    if (!canConfirmClosing) return

    const targetNextYear = String(Number(closingYear) + 1)
    const nowLabel = new Date().toLocaleString('ko-KR')

    setClosedRecordsByYear((prev) => ({
      ...prev,
      [closingYear]: {
        status: 'CLOSED',
        closingYear,
        targetYear: targetNextYear,
        closedAt: nowLabel,
        note: closingConfirmedNote.trim(),
        reopenReason: reopenMode ? reopenReason.trim() : '',
        itemCount: closingCheckRows.length,
        unbalancedCount,
        totalAssetValue: totalSumAssetValue,
      },
    }))

    alert(
      `${closingYear}년 12월 마감 검토가 기록되었습니다.\n` +
        `차기 이월 대상: ${targetNextYear}년 | 불일치 항목: ${unbalancedCount}건 | 총 재고금액: ${totalSumAssetValue.toLocaleString()}원` +
        (reopenMode ? `\n재확정 사유: ${reopenReason.trim()}` : '')
    )

    setReopenMode(false)
    setReopenReason('')
    setReopenConfirmedCheck(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    fontSize: '13px',
    borderRadius: '8px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ padding: '4px' }}>
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
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flex: 1,
            maxWidth: '640px',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ ...inputStyle, width: '170px', fontWeight: '700', color: '#1E293B' }}
          >
            <option value="ALL">📁 구분 전체 보기</option>
            {availableCategories
              .filter((c) => c !== 'ALL')
              .map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
          </select>

          <input
            type="text"
            placeholder="🔍 품번/코드 또는 품명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ ...inputStyle, flex: 1, padding: '11px 14px', minWidth: '180px' }}
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: '700',
              color: '#334155',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              backgroundColor: '#F1F5F9',
              padding: '10px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
            }}
          >
            <input
              type="checkbox"
              checked={hideZeroStock}
              onChange={(e) => setHideZeroStock(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563EB' }}
            />
            잔여 재고 0 제외
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '800',
              color: '#1E40AF',
            }}
          >
            💰 자산 평가액 합계: {totalSumAssetValue.toLocaleString()} 원
          </div>

          <button
            type="button"
            onClick={handleOpenYearEndModal}
            style={{
              background: '#1E293B',
              color: '#fff',
              border: 'none',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📅 12월 마감 결산 확인
            {unbalancedCount > 0 && (
              <span
                style={{
                  backgroundColor: '#EF4444',
                  color: '#fff',
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: '999px',
                }}
              >
                차이 {unbalancedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleRefreshAll}
            style={{
              background: '#F1F5F9',
              color: '#334155',
              border: '1px solid #CBD5E1',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            🔄 새로고침
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              background: '#059669',
              color: '#fff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            📊 엑셀 다운로드 (결산용)
          </button>
        </div>
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
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '14px',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#F8FAFC',
                borderBottom: '1px solid #E2E8F0',
                color: '#475569',
              }}
            >
              <th style={{ padding: '14px 16px', width: '140px' }}>Ident No. (코드)</th>
              <th style={{ padding: '14px 16px', width: '200px' }}>ITEM (품명)</th>
              <th style={{ padding: '14px 16px', width: '120px' }}>구분</th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>
                이월 재고
              </th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>
                입고 (수량)
              </th>
              <th style={{ padding: '14px 16px', width: '90px', textAlign: 'center' }}>
                출고 (수량)
              </th>
              <th
                style={{
                  padding: '14px 16px',
                  width: '100px',
                  textAlign: 'center',
                  backgroundColor: '#F1F5F9',
                }}
              >
                현재고
              </th>
              <th
                style={{
                  padding: '14px 16px',
                  width: '130px',
                  textAlign: 'right',
                  backgroundColor: '#ECFDF5',
                  color: '#065F46',
                }}
              >
                재고 금액 (원)
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  데이터 집계 중...
                </td>
              </tr>
            ) : filteredLedger.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  조회된 수불부 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredLedger.map((item) => {
                const unitSuffix = item.isPrinterGroup ? '대' : '개'
                return (
                  <tr
                    key={item.id}
                    style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: '800',
                        color: '#2563EB',
                        wordBreak: 'break-all',
                      }}
                    >
                      {item.code}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: '700',
                        color: '#0F172A',
                        wordBreak: 'break-all',
                      }}
                    >
                      {item.name}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          backgroundColor: item.isPrinterGroup ? '#DBEAFE' : '#F1F5F9',
                          color: item.isPrinterGroup ? '#1E40AF' : '#334155',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#64748B',
                      }}
                    >
                      {item.carryOver}
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetailHistory(item, 'INBOUND')}
                        style={{
                          background: item.inbound > 0 ? '#ECFDF5' : 'transparent',
                          color: item.inbound > 0 ? '#059669' : '#94A3B8',
                          border: item.inbound > 0 ? '1px solid #A7F3D0' : 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          cursor: item.inbound > 0 ? 'pointer' : 'default',
                        }}
                      >
                        {item.inbound} {unitSuffix}
                      </button>
                    </td>

                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetailHistory(item, 'OUTBOUND')}
                        style={{
                          background: item.outbound > 0 ? '#EFF6FF' : 'transparent',
                          color: item.outbound > 0 ? '#2563EB' : '#94A3B8',
                          border: item.outbound > 0 ? '1px solid #BFDBFE' : 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: '800',
                          cursor: item.outbound > 0 ? 'pointer' : 'default',
                        }}
                      >
                        {item.outbound} {unitSuffix}
                      </button>
                    </td>

                    <td
                      style={{
                        padding: '12px 16px',
                        textAlign: 'center',
                        backgroundColor: '#F8FAFC',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: '900',
                          fontSize: '14px',
                          color: '#0F172A',
                          backgroundColor: '#fff',
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                        }}
                      >
                        {item.current} {unitSuffix}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontWeight: '800',
                        color: '#059669',
                        backgroundColor: '#F0FDF4',
                      }}
                    >
                      {item.assetValue ? item.assetValue.toLocaleString() : 0} 원
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 12월 마감 결산 확인 모달 */}
      {showYearEndModal && (
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
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '1290px',
              maxWidth: '96vw',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #E2E8F0',
                paddingBottom: '12px',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0F172A' }}>
                    📅 12월 마감 결산 및 차기 이월 확인
                  </h3>
                  {isYearClosed ? (
                    <span
                      style={{
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        border: '1px solid #F59E0B',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: '800',
                      }}
                    >
                      🔒 {closingYear}년 마감 완료 (잠금)
                    </span>
                  ) : (
                    <span
                      style={{
                        backgroundColor: '#E0F2FE',
                        color: '#0369A1',
                        border: '1px solid #7DD3FC',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: '800',
                      }}
                    >
                      검토 진행 중
                    </span>
                  )}
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                  공식: <strong>이월재고 + 당기입고 - 출고 = 현재고</strong> 기준으로 마감 수치를
                  점검합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowYearEndModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '14px',
                alignItems: 'center',
                flexWrap: 'wrap',
                backgroundColor: '#F8FAFC',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                marginBottom: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#1E293B' }}>
                  결산 연도:
                </span>
                <select
                  value={closingYear}
                  onChange={(e) => handleChangeClosingYear(e.target.value)}
                  style={{ ...inputStyle, width: '200px', fontWeight: '800', backgroundColor: '#fff' }}
                >
                  <option value="2026">2026년 결산 (→ 2027년 이월)</option>
                  <option value="2027">2027년 결산 (→ 2028년 이월)</option>
                </select>
              </div>

              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                검토 품목: <strong>{closingCheckRows.length}</strong>건
              </div>

              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  color: unbalancedCount === 0 ? '#059669' : '#DC2626',
                }}
              >
                수식 불일치: <strong>{unbalancedCount}</strong>건
              </div>

              <div style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: '800', color: '#1E40AF' }}>
                총 재고금액: {totalSumAssetValue.toLocaleString()} 원
              </div>
            </div>

            {isYearClosed && (
              <div
                style={{
                  backgroundColor: hasPostCloseChange ? '#FEF2F2' : '#FFFBEB',
                  border: `1px solid ${hasPostCloseChange ? '#FCA5A5' : '#FCD34D'}`,
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ fontSize: '12px', color: '#1E293B', lineHeight: '1.5' }}>
                  <strong>마감 기록 ({currentYearRecord.closedAt}):</strong>{' '}
                  {currentYearRecord.closingYear}년 → {currentYearRecord.targetYear}년 이월 기준
                  (기록 당시 총액 {Number(currentYearRecord.totalAssetValue || 0).toLocaleString()}원,
                  불일치 {currentYearRecord.unbalancedCount}건)
                  {currentYearRecord.reopenReason && (
                    <div>
                      <strong>직전 재확정 사유:</strong> {currentYearRecord.reopenReason}
                    </div>
                  )}
                  {hasPostCloseChange && (
                    <div style={{ color: '#DC2626', fontWeight: '800', marginTop: '4px' }}>
                      ⚠️ 마감 확정 이후 현재 집계 수치(총액 {totalSumAssetValue.toLocaleString()}원 /
                      불일치 {unbalancedCount}건)가 변경되었습니다.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setReopenMode((prev) => !prev)
                    setReopenReason('')
                    setReopenConfirmedCheck(false)
                  }}
                  style={{
                    backgroundColor: reopenMode ? '#E2E8F0' : '#DC2626',
                    color: reopenMode ? '#1E293B' : '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                  }}
                >
                  {reopenMode ? '재확정 해제 취소' : '🔓 재확정 모드 열기'}
                </button>
              </div>
            )}

            {isYearClosed && reopenMode && (
              <div
                style={{
                  backgroundColor: '#FFF1F2',
                  border: '1px solid #FDA4AF',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#9F1239' }}>
                  재확정(수정) 방어 절차: 이미 마감된 연도의 수치를 다시 확정하려면 사유를
                  입력하고 최종 확인에 체크해 주세요.
                </div>
                <input
                  type="text"
                  placeholder="재확정 사유를 4자 이상 입력해 주세요 (예: 출고 누락 정정 후 재마감)"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  style={{ ...inputStyle, backgroundColor: '#fff' }}
                />
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#881337',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={reopenConfirmedCheck}
                    onChange={(e) => setReopenConfirmedCheck(e.target.checked)}
                  />
                  마감 수치를 다시 확정하는 것이 맞으며, 변동 내역을 검토했음을 확인합니다.
                </label>
              </div>
            )}

            <div
              style={{
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                overflow: 'hidden',
                maxHeight: '440px',
                overflowY: 'auto',
                marginBottom: '14px',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#F1F5F9',
                      borderBottom: '1px solid #CBD5E1',
                      color: '#334155',
                    }}
                  >
                    <th style={{ padding: '10px 12px' }}>품번/구분</th>
                    <th style={{ padding: '10px 12px' }}>품명</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>이월</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>입고</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>출고</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>계산재고</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>현재고</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>판정</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>재고금액</th>
                  </tr>
                </thead>
                <tbody>
                  {closingCheckRows.map((row) => {
                    const suffix = row.isPrinterGroup ? '대' : '개'
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: '700', color: '#2563EB' }}>{row.code}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{row.category}</div>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: '700', color: '#0F172A' }}>
                          {row.name}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>{row.carryOver}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: '#059669' }}>
                          +{row.inbound}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', color: '#2563EB' }}>
                          -{row.outbound}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '700' }}>
                          {row.formulaCurrent} {suffix}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontWeight: '800' }}>
                          {row.current} {suffix}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          {row.isBalanced ? (
                            <span
                              style={{
                                backgroundColor: '#DCFCE7',
                                color: '#15803D',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '800',
                              }}
                            >
                              일치
                            </span>
                          ) : (
                            <span
                              style={{
                                backgroundColor: '#FEE2E2',
                                color: '#DC2626',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '800',
                              }}
                            >
                              차이 {row.diff > 0 ? `+${row.diff}` : row.diff}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            textAlign: 'right',
                            fontWeight: '700',
                            color: '#059669',
                          }}
                        >
                          {(row.assetValue || 0).toLocaleString()}원
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#475569',
                  display: 'block',
                  marginBottom: '6px',
                }}
              >
                마감 검토 메모 (선택)
              </label>
              <input
                type="text"
                placeholder="예: 12월 실물 재고 및 단가 확인 완료"
                value={closingConfirmedNote}
                onChange={(e) => setClosingConfirmedNote(e.target.value)}
                disabled={isYearClosed && !reopenMode}
                style={{
                  ...inputStyle,
                  backgroundColor: isYearClosed && !reopenMode ? '#F1F5F9' : '#F8FAFC',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '14px',
                gap: '10px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  background: '#059669',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                📊 결산 시트 CSV 다운로드
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowYearEndModal(false)}
                  style={{
                    padding: '9px 16px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  닫기
                </button>
                <button
                  type="button"
                  disabled={!canConfirmClosing}
                  onClick={handleConfirmYearEnd}
                  style={{
                    padding: '9px 18px',
                    background: canConfirmClosing ? '#2563EB' : '#94A3B8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '800',
                    cursor: canConfirmClosing ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isYearClosed
                    ? reopenMode
                      ? '재확정 저장'
                      : '마감 잠금됨'
                    : '검토 확인 완료'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedItemHistory && (
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
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              width: '700px',
              maxWidth: '95vw',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                borderBottom: '1px solid #E2E8F0',
                paddingBottom: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                  📋 {selectedItemHistory.type === 'INBOUND' ? '입고' : '출고'} 상세 내역 이력
                </h3>
                <span
                  style={{
                    fontSize: '13px',
                    color: '#2563EB',
                    fontWeight: '700',
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  [{selectedItemHistory.code}] {selectedItemHistory.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemHistory(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '18px',
                  color: '#64748B',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {historyList.length === 0 ? (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#94A3B8',
                    fontSize: '13px',
                  }}
                >
                  상세 이력이 존재하지 않습니다.
                </div>
              ) : (
                historyList.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#F8FAFC',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563EB' }}>
                          📅 {h.date}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            backgroundColor: '#E2E8F0',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '700',
                            color: '#334155',
                          }}
                        >
                          {h.badge}
                        </span>
                        {selectedItemHistory.type === 'INBOUND' && (
                          <span
                            style={{
                              fontSize: '11px',
                              backgroundColor: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: '800',
                              color: '#059669',
                            }}
                          >
                            💰 단가:{' '}
                            {h.unitPrice !== null && h.unitPrice !== undefined
                              ? `${Number(h.unitPrice).toLocaleString()}원`
                              : '미입력'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                        {h.summary}
                      </span>
                      {h.note && (
                        <span style={{ fontSize: '11px', color: '#64748B' }}>비고: {h.note}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#059669',
                          display: 'block',
                        }}
                      >
                        구분/작성자
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#334155' }}>
                        {h.author}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '16px',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedItemHistory(null)}
                style={{
                  padding: '8px 18px',
                  background: '#2563EB',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}