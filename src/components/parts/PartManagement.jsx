import React, { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import ConsumablesTab from './ConsumablesTab'
import GeneralPartsTab from './GeneralPartsTab'
import PrintersTab from './PrintersTab'
import DeliveryHistoryTab from './DeliveryHistoryTab'
// 💡 [수불부 탭 추가용] 나중에 삭제하려면 이 임포트 문을 지우세요.
import InventoryLedgerTab from './InventoryLedgerTab'

export default function PartManagement() {
  const [activeTab, setActiveTab] = useState('소모품') // '소모품' | '일반부품' | '프린터' | '이력관리' | '재고수불부'
  const [partsList, setPartsList] = useState([])
  const [showAddPartForm, setShowAddPartForm] = useState(false) // 💡 올바른 상태 이름 정의

  useEffect(() => {
    fetchParts()
  }, [])

  const fetchParts = async () => {
    const { data, error } = await supabase.from('parts').select('*').order('created_at', { ascending: false })
    if (!error) setPartsList(data || [])
  }

  return (
    <div>
      {/* 상단 타이틀 및 등록 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '800' }}>🔧 자재 및 부품 재고 관리</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748B' }}>
            {activeTab === '소모품' && '🧪 잉크, 희석제 및 소모품의 유통기한을 관리합니다.'}
            {activeTab === '일반부품' && '⚙️ 일반 부품 및 부자재 S/N별 보유 상태 및 매입가·특가를 관리합니다.'}
            {activeTab === '프린터' && '🖨️ 프린터 및 라이너 장비 S/N별 상태를 관리합니다.'}
            {activeTab === '이력관리' && '📋 발행된 모든 입고 및 출고 이력을 시간순으로 확인합니다.'}
            {/* 💡 [수불부 탭 추가용] 나중에 삭제하려면 이 줄을 지우세요. */}
            {activeTab === '재고수불부' && '📊 이월재고, 입고, 출고, 현재고의 수불 흐름 및 결산용 자산 수량을 확인합니다.'}
          </p>
        </div>
        {/* 이력관리와 재고수불부 탭에서는 신규 등록 버튼 숨김 */}
        {activeTab !== '이력관리' && activeTab !== '재고수불부' && (
          <button 
            type="button" 
            onClick={() => setShowAddPartForm(!showAddPartForm)} 
            style={{ padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}
          >
            {showAddPartForm ? '✕ 닫기' : `+ 신규 ${activeTab} 품목 등록`}
          </button>
        )}
      </div>

      {/* 📌 상단 탭 메뉴 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #E2E8F0', paddingBottom: '2px', flexWrap: 'wrap' }}>
        {/* 💡 [수불부 탭 추가용] 나중에 삭제하려면 배열에서 '재고수불부'를 빼세요. */}
        {['소모품', '일반부품', '프린터', '이력관리', '재고수불부'].map(tab => (
          <button 
            key={tab} 
            type="button" 
            onClick={() => { setActiveTab(tab); setShowAddPartForm(false); }} 
            style={{ 
              padding: '10px 20px', fontSize: '14px', fontWeight: '800', border: 'none', 
              borderBottom: activeTab === tab ? '3px solid #2563EB' : 'none', 
              color: activeTab === tab ? '#2563EB' : '#64748B', backgroundColor: 'transparent', cursor: 'pointer' 
            }}
          >
            {tab === '소모품' && '🧪 소모품 관리 (유통기한)'}
            {tab === '일반부품' && '⚙️ 일반 부품 및 부자재'}
            {tab === '프린터' && '🖨️ 프린터 관리'}
            {tab === '이력관리' && '📋 입·출고증 발행 이력'}
            {/* 💡 [수불부 탭 추가용] 나중에 삭제하려면 이 줄을 지우세요. */}
            {tab === '재고수불부' && '📊 재고 수불부 (결산용)'}
          </button>
        ))}
      </div>

      {/* 탭별 컴포넌트 렌더링 */}
      {activeTab === '소모품' && <ConsumablesTab partsList={partsList} refreshParts={fetchParts} showAddForm={showAddPartForm} setShowAddForm={setShowAddPartForm} />}
      {activeTab === '일반부품' && <GeneralPartsTab partsList={partsList} refreshParts={fetchParts} showAddForm={showAddPartForm} setShowAddForm={setShowAddPartForm} />}
      {activeTab === '프린터' && <PrintersTab partsList={partsList} refreshParts={fetchParts} showAddForm={showAddPartForm} setShowAddForm={setShowAddPartForm} />}
      {activeTab === '이력관리' && <DeliveryHistoryTab refreshParts={fetchParts} />}
      
      {/* 💡 [수불부 탭 추가용] 나중에 삭제하려면 이 아래 줄 전체를 지우세요. */}
      {activeTab === '재고수불부' && <InventoryLedgerTab partsList={partsList} refreshParts={fetchParts} />}
    </div>
  )
}