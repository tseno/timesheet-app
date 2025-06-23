'use client';

import { useState, useEffect } from 'react';

interface Timesheet {
  date: string;
  start_time: string;
  end_time: string;
  break_time: number;
  work_content: string;
  total_hours: number;
}

enum TimesheetStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

interface MonthlyTimesheet {
  year: number;
  month: number;
  days: Timesheet[];
  status: TimesheetStatus;
  rejection_reason?: string;
}

export default function Home() {
  const [currentView, setCurrentView] = useState<'home' | 'monthly'>('home');
  const [monthlyData, setMonthlyData] = useState<MonthlyTimesheet | null>(null);
  const [months, setMonths] = useState<{month: string; status: string}[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMonthYear, setNewMonthYear] = useState<{year: number; month: number}>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [snackbar, setSnackbar] = useState<{message: string; show: boolean}>({
    message: '',
    show: false
  });

  useEffect(() => {
    fetchMonths();
  }, []);

  const showSnackbar = (message: string) => {
    console.log('Showing snackbar:', message); // デバッグ用
    setSnackbar({ message, show: true });
    setTimeout(() => {
      setSnackbar({ message: '', show: false });
    }, 3000);
  };


  const fetchMonths = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/timesheets/months-with-status');
      const data = await response.json();
      setMonths(data);
    } catch (error) {
      console.error('Error fetching months:', error);
    }
  };

  const fetchMonthlyTimesheet = async (year: number, month: number) => {
    try {
      const daysInMonth = new Date(year, month, 0).getDate();
      const days: Timesheet[] = [];
      
      // 月次勤務表のステータスを取得
      let monthlyStatus = TimesheetStatus.DRAFT;
      let rejectionReason = '';
      
      try {
        const statusResponse = await fetch(`http://localhost:8000/api/timesheets/status/${year}-${month.toString().padStart(2, '0')}`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          monthlyStatus = statusData.status;
          rejectionReason = statusData.rejection_reason || '';
        }
      } catch {
        // ステータスが取得できない場合はDRAFTとして扱う
      }
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        try {
          const response = await fetch(`http://localhost:8000/api/timesheets/${date}`);
          const data = await response.json();
          days.push(data);
        } catch {
          days.push({
            date,
            start_time: '',
            end_time: '',
            break_time: 0,
            work_content: '',
            total_hours: 0
          });
        }
      }
      
      setMonthlyData({ 
        year, 
        month, 
        days, 
        status: monthlyStatus,
        rejection_reason: rejectionReason 
      });
    } catch (error) {
      console.error('Error fetching monthly timesheet:', error);
    }
  };


  const handleMonthSelect = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    fetchMonthlyTimesheet(year, month);
    setCurrentView('monthly');
  };


  const handleCreateNewMonth = () => {
    const { year, month } = newMonthYear;
    fetchMonthlyTimesheet(year, month);
    setCurrentView('monthly');
    setShowCreateModal(false);
  };


  if (currentView === 'monthly' && monthlyData) {
    const totalMonthlyHours = monthlyData.days.reduce((sum, day) => sum + day.total_hours, 0);
    
    const handleBulkInputChange = (dayIndex: number, field: keyof Timesheet, value: string) => {
      if (!monthlyData) return;
      
      const updatedDays = [...monthlyData.days];
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        [field]: field === 'break_time' ? parseInt(value) || 0 : value
      };
      
      setMonthlyData({
        ...monthlyData,
        days: updatedDays
      });
    };

    const handleBulkSave = async () => {
      if (!monthlyData) return;
      
      // 編集不可状態をチェック
      if (monthlyData.status === TimesheetStatus.SUBMITTED || monthlyData.status === TimesheetStatus.APPROVED) {
        alert('提出済みまたは承認済みの勤務表は編集できません');
        return;
      }
      
      try {
        const savePromises = monthlyData.days.map((day) => {
          if (day.start_time || day.end_time || day.work_content) {
            return fetch('http://localhost:8000/api/timesheets', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(day),
            });
          }
          return Promise.resolve();
        });
        
        await Promise.all(savePromises);
        showSnackbar('勤務表が一括保存されました');
        
        // データベースの更新完了を待つため少し遅延してから再取得
        setTimeout(() => {
          fetchMonthlyTimesheet(monthlyData.year, monthlyData.month);
        }, 100);
      } catch (error) {
        console.error('Error saving bulk timesheet:', error);
        alert('一括保存に失敗しました');
      }
    };

    const handleStatusChange = async (newStatus: TimesheetStatus) => {
      if (!monthlyData) return;
      
      const statusText = {
        [TimesheetStatus.SUBMITTED]: '提出',
        [TimesheetStatus.DRAFT]: '提出取り消し',
        [TimesheetStatus.APPROVED]: '承認',
        [TimesheetStatus.REJECTED]: '差し戻し'
      }[newStatus];
      
      const messages = {
        [TimesheetStatus.SUBMITTED]: `${monthlyData.year}年${monthlyData.month}月の勤務表を提出しますか？\n提出後は編集できなくなります。`,
        [TimesheetStatus.DRAFT]: `${monthlyData.year}年${monthlyData.month}月の勤務表の提出を取り消しますか？`,
        [TimesheetStatus.APPROVED]: `${monthlyData.year}年${monthlyData.month}月の勤務表を承認しますか？`,
        [TimesheetStatus.REJECTED]: `${monthlyData.year}年${monthlyData.month}月の勤務表を差し戻しますか？`
      };
      const message = messages[newStatus];
      
      if (!confirm(message)) {
        return;
      }
      
      try {
        const response = await fetch(`http://localhost:8000/api/timesheets/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            year: monthlyData.year,
            month: monthlyData.month,
            status: newStatus
          }),
        });
        
        if (response.ok) {
          showSnackbar(`勤務表が${statusText}されました`);
          fetchMonthlyTimesheet(monthlyData.year, monthlyData.month);
          fetchMonths(); // サイドバーの絵文字も更新
        }
      } catch (error) {
        console.error('Error changing status:', error);
        alert('ステータス変更に失敗しました');
      }
    };

    const getStatusDisplay = (status: TimesheetStatus) => {
      const statusMap = {
        [TimesheetStatus.DRAFT]: { text: '作成中', color: 'bg-gray-100 text-gray-800' },
        [TimesheetStatus.SUBMITTED]: { text: '提出済み', color: 'bg-blue-100 text-blue-800' },
        [TimesheetStatus.APPROVED]: { text: '承認済み', color: 'bg-green-100 text-green-800' },
        [TimesheetStatus.REJECTED]: { text: '差し戻し', color: 'bg-red-100 text-red-800' }
      };
      return statusMap[status];
    };

    const isEditable = monthlyData.status === TimesheetStatus.DRAFT || monthlyData.status === TimesheetStatus.REJECTED;
    
    return (
      <div className="min-h-screen bg-gray-100 p-8 relative">
        {/* スナックバー - 勤務表画面用 */}
        {snackbar.show && (
          <div 
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 99999,
              backgroundColor: '#22c55e',
              color: 'white',
              padding: '16px 32px',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.3s ease',
              pointerEvents: 'none'
            }}
          >
            ✓ {snackbar.message}
          </div>
        )}
        
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            {/* 左側：一覧に戻るボタン */}
            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  setCurrentView('home');
                  fetchMonths(); // 月一覧とステータスを更新
                }}
                className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                ← ホームに戻る
              </button>
            </div>
            
            {/* 中央：タイトルと提出済みステータス */}
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold">
                {monthlyData.year}年{monthlyData.month}月 勤務表
              </h1>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusDisplay(monthlyData.status).color}`}>
                {getStatusDisplay(monthlyData.status).text}
              </div>
            </div>
            
            {/* 右側：アクションボタン */}
            <div className="flex space-x-4 flex-shrink-0">
              {isEditable && (
                <button
                  onClick={handleBulkSave}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  一括保存
                </button>
              )}
              {(monthlyData.status === TimesheetStatus.DRAFT || monthlyData.status === TimesheetStatus.REJECTED) && (
                <button
                  onClick={() => handleStatusChange(TimesheetStatus.SUBMITTED)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  提出
                </button>
              )}
              {monthlyData.status === TimesheetStatus.SUBMITTED && (
                <button
                  onClick={() => handleStatusChange(TimesheetStatus.DRAFT)}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                  提出取り消し
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="text-xl font-bold text-blue-800 mb-4">
              月間合計時間: {totalMonthlyHours.toFixed(2)} 時間
            </div>
            {monthlyData.status === TimesheetStatus.REJECTED && monthlyData.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-800 font-medium mb-2">差し戻し理由:</div>
                <div className="text-red-700">{monthlyData.rejection_reason}</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="grid gap-0 border-b-2 border-gray-300" style={{ gridTemplateColumns: '80px 100px 100px 100px 80px 1fr' }}>
              <div className="p-3 bg-gray-50 font-bold text-center border-r border-gray-200">日</div>
              <div className="p-3 bg-gray-50 font-bold text-center border-r border-gray-200">開始時間</div>
              <div className="p-3 bg-gray-50 font-bold text-center border-r border-gray-200">終了時間</div>
              <div className="p-3 bg-gray-50 font-bold text-center border-r border-gray-200">休憩(分)</div>
              <div className="p-3 bg-gray-50 font-bold text-center border-r border-gray-200">時間</div>
              <div className="p-3 bg-gray-50 font-bold text-center">作業内容</div>
            </div>

            {monthlyData.days.map((day, index) => {
              const dayNumber = index + 1;
              const date = new Date(monthlyData.year, monthlyData.month - 1, dayNumber);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              
              return (
                <div 
                  key={dayNumber} 
                  className={`grid gap-0 border-b border-gray-100 ${
                    isWeekend ? 'bg-red-50' : 'hover:bg-gray-50'
                  }`}
                  style={{ gridTemplateColumns: '80px 100px 100px 100px 80px 1fr' }}
                >
                  <div className="p-2 text-center font-medium border-r border-gray-200 flex items-center justify-center">
                    <div className="flex items-center space-x-1">
                      <span>{dayNumber}</span>
                      <span className={`text-xs ${isWeekend ? 'text-red-500' : 'text-gray-500'}`}>
                        ({['日', '月', '火', '水', '木', '金', '土'][date.getDay()]})
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-1 border-r border-gray-200">
                    <input
                      type="time"
                      value={day.start_time || ''}
                      onChange={(e) => handleBulkInputChange(index, 'start_time', e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!isEditable}
                    />
                  </div>
                  
                  <div className="p-1 border-r border-gray-200">
                    <input
                      type="time"
                      value={day.end_time || ''}
                      onChange={(e) => handleBulkInputChange(index, 'end_time', e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!isEditable}
                    />
                  </div>
                  
                  <div className="p-1 border-r border-gray-200">
                    <input
                      type="number"
                      value={day.break_time || ''}
                      onChange={(e) => handleBulkInputChange(index, 'break_time', e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      placeholder="0"
                      disabled={!isEditable}
                    />
                  </div>
                  
                  <div className="p-2 text-center text-sm font-medium flex items-center justify-center border-r border-gray-200">
                    {day.total_hours ? day.total_hours.toFixed(2) : '-'}
                  </div>
                  
                  <div className="p-1">
                    <input
                      type="text"
                      value={day.work_content || ''}
                      onChange={(e) => handleBulkInputChange(index, 'work_content', e.target.value)}
                      className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="作業内容"
                      disabled={!isEditable}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 p-10">
      <h1 className="text-3xl font-semibold text-center text-gray-800 mb-12">勤務表管理システム</h1>
      
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 勤務表セクション */}
        <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-200">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">📋</span>
            <h2 className="text-2xl font-semibold text-gray-800">勤務表</h2>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full p-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-px flex items-center justify-center gap-2 mb-8"
          >
            <span>📝</span>
            新規作成
          </button>
          
          <h3 className="text-lg font-semibold text-gray-700 mb-4">過去の勤務表</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Array.isArray(months) && months.map(monthData => (
              <div
                key={monthData.month}
                onClick={() => handleMonthSelect(monthData.month)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-all duration-200 transform hover:-translate-y-px border border-gray-200"
              >
                <div className="flex items-center">
                  <span className="text-base mr-3 opacity-80">📊</span>
                  <span className="text-sm text-gray-700 font-medium">{monthData.month}</span>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                  monthData.status === 'approved' ? 'bg-green-100 text-green-800' :
                  monthData.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                  monthData.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-indigo-100 text-indigo-800'
                }`}>
                  {monthData.status === 'approved' ? '承認済' :
                   monthData.status === 'submitted' ? '提出済' :
                   monthData.status === 'rejected' ? '差戻し' :
                   '入力中'}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* 休暇届セクション */}
        <div className="bg-white rounded-2xl p-8 shadow-md border border-gray-200">
          <div className="flex items-center mb-6">
            <span className="text-2xl mr-3">🌴</span>
            <h2 className="text-2xl font-semibold text-gray-800">休暇届</h2>
          </div>
          
          <button
            className="w-full p-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all duration-200 transform hover:-translate-y-px flex items-center justify-center gap-2 mb-8"
            disabled
          >
            <span>✈️</span>
            休暇届作成
          </button>
          
          <h3 className="text-lg font-semibold text-gray-700 mb-4">申請一覧</h3>
          <div className="text-center py-10 text-gray-500">
            <div className="text-5xl mb-4 opacity-30">📋</div>
            <div className="text-sm">休暇届機能は準備中です</div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-xl font-bold mb-4">新しい勤務表を作成</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  年
                </label>
                <input
                  type="number"
                  value={newMonthYear.year}
                  onChange={(e) => setNewMonthYear(prev => ({
                    ...prev,
                    year: parseInt(e.target.value)
                  }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                  min="2020"
                  max="2030"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  月
                </label>
                <select
                  value={newMonthYear.month}
                  onChange={(e) => setNewMonthYear(prev => ({
                    ...prev,
                    month: parseInt(e.target.value)
                  }))}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  {Array.from({length: 12}, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}月
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreateNewMonth}
                className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}