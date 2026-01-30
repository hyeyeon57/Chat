import React, { useState, useEffect } from 'react';
import './UserList.css';

const API_URL = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/auth/users`);
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.users);
        setLastUpdated(new Date());
      } else {
        setError('사용자 목록을 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('서버에 연결할 수 없습니다.');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getProviderLabel = (provider) => {
    const labels = {
      'local': '일반',
      'kakao': '카카오',
      'naver': '네이버',
      'google': '구글'
    };
    return labels[provider] || provider;
  };

  return (
    <div className="user-list-container">
      <div className="user-list-header">
        <h1>회원 관리</h1>
        <div className="header-actions">
          <button onClick={fetchUsers} className="refresh-btn" disabled={loading}>
            {loading ? '새로고침 중...' : '새로고침'}
          </button>
          {lastUpdated && (
            <span className="last-updated">
              마지막 업데이트: {formatDate(lastUpdated)}
            </span>
          )}
        </div>
      </div>

      {loading && users.length === 0 ? (
        <div className="loading">로딩 중...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <div className="user-stats">
            <div className="stat-item">
              <span className="stat-label">총 회원 수:</span>
              <span className="stat-value">{users.length}명</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">일반 회원:</span>
              <span className="stat-value">
                {users.filter(u => u.provider === 'local').length}명
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">소셜 회원:</span>
              <span className="stat-value">
                {users.filter(u => u.provider !== 'local').length}명
              </span>
            </div>
          </div>

          <div className="user-table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>가입 방식</th>
                  <th>가입일시</th>
                  <th>최종 수정</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-data">
                      등록된 회원이 없습니다.
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr key={user._id || user.id}>
                      <td>{index + 1}</td>
                      <td className="user-name">{user.name}</td>
                      <td className="user-email">{user.email}</td>
                      <td>
                        <span className={`provider-badge provider-${user.provider}`}>
                          {getProviderLabel(user.provider)}
                        </span>
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{formatDate(user.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default UserList;

