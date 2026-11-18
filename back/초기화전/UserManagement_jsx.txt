import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function UserManagement() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('직원 목록 불러오기 실패:', error)
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleApprove = async (user) => {
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('username', user.username)

      if (updateError) {
        alert('승인 처리 실패: ' + updateError.message)
        return
      }

      alert(`🎉 ${user.full_name || user.username} 님의 가입이 최종 승인되었습니다!`)
      fetchUsers()
    } catch (err) {
      console.error('승인 처리 에러:', err)
      alert('승인 중 오류가 발생했습니다.')
    }
  }

  const handleRevoke = async (username) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_approved: false })
      .eq('username', username)

    if (error) {
      alert('처리 실패: ' + error.message)
    } else {
      alert('승인이 취소되었습니다.')
      fetchUsers()
    }
  }

  const handleRoleChange = async (username, newRole) => {
    if (username === 'bae' && newRole !== 'admin') {
      alert('⚠️ 최고 관리자(bae)의 역할은 변경할 수 없습니다.')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('username', username)

    if (error) {
      alert('역할 변경 실패: ' + error.message)
    } else {
      alert(`✅ 역할이 '${newRole}'(으)로 변경되었습니다.`)
      fetchUsers()
    }
  }

  const handleDelete = async (user) => {
    if (user.username === 'bae') {
      alert('⚠️ 최고 관리자 계정은 삭제할 수 없습니다.')
      return
    }

    const confirmDelete = window.confirm(`정말로 '${user.full_name || user.username}' 님의 신청/계정 정보를 삭제하시겠습니까?`)
    if (!confirmDelete) return

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('username', user.username)

    if (error) {
      alert('삭제 실패: ' + error.message)
    } else {
      alert('🗑️ 성공적으로 삭제되었습니다.')
      fetchUsers()
    }
  }

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>👥 직원 가입 승인 및 권한 관리</h3>
      <p style={styles.subtitle}>신규 가입 직원의 승인 여부를 관리하고, 시스템 역할(user, manager, admin)을 지정할 수 있습니다.</p>

      {loading ? (
        <p style={{ textAlign: 'center', color: '#64748b' }}>직원 목록을 불러오는 중...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.thRow}>
              <th style={styles.th}>이름</th>
              <th style={styles.th}>아이디 / 이메일</th>
              <th style={styles.th}>신청일시</th>
              <th style={styles.th}>상태</th>
              <th style={styles.th}>시스템 역할 (Role)</th>
              <th style={{ ...styles.th, textAlign: 'center' }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id || u.username} style={styles.tdRow}>
                <td style={styles.td}>{u.full_name || '미입력'}</td>
                <td style={styles.td}>{u.email || `${u.username}@mace-inkjet.co.kr`}</td>
                <td style={styles.td}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                <td style={styles.td}>
                  {u.is_approved ? (
                    <span style={{ ...styles.badge, backgroundColor: '#dcfce7', color: '#166534' }}>승인 완료</span>
                  ) : (
                    <span style={{ ...styles.badge, backgroundColor: '#fef3c7', color: '#92400e' }}>승인 대기</span>
                  )}
                </td>
                <td style={styles.td}>
                  <select 
                    value={u.role || 'user'} 
                    onChange={(e) => handleRoleChange(u.username, e.target.value)}
                    style={styles.selectBox}
                    disabled={u.username === 'bae'}
                  >
                    <option value="user">user (일반)</option>
                    <option value="manager">manager (매니저)</option>
                    <option value="admin">admin (최고관리자)</option>
                  </select>
                </td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                    {u.is_approved ? (
                      <button onClick={() => handleRevoke(u.username)} style={styles.btnRevoke}>승인 취소</button>
                    ) : (
                      <button onClick={() => handleApprove(u)} style={styles.btnApprove}>승인하기</button>
                    )}
                    
                    {u.username !== 'bae' && (
                      <button onClick={() => handleDelete(u)} style={styles.btnDelete}>삭제</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const styles = {
  container: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '20px' },
  title: { fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0', textAlign: 'center' },
  subtitle: { fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', textAlign: 'center' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  thRow: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '12px 16px', color: '#475569', fontWeight: '600' },
  tdRow: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '14px 16px', color: '#334155' },
  badge: { padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' },
  selectBox: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', fontWeight: '600', color: '#1e293b', cursor: 'pointer' },
  btnApprove: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  btnRevoke: { backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
  btnDelete: { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', padding: '6px 10px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' },
}