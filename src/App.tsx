import React, { useState, useEffect } from 'react';
import { 
  loadStoredData, 
  saveStoredData, 
  resetStoredData, 
  updateActivityGroup, 
  deleteActivityGroup, 
  updateStudent, 
  deleteStudent, 
  addEnrollment, 
  removeEnrollment, 
  updateEnrollmentDismissal 
} from './utils/storage';
import { 
  AppDataState, 
  NavigationTab, 
  UserRole, 
  ActivityGroup, 
  Student, 
  AttendanceRecord, 
  DismissalMethod 
} from './types';
import { ConnectionStatusBar } from './components/ConnectionStatusBar';
import { realtimeSync } from './services/realtimeSync';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { ActivityGroupList } from './components/ActivityGroupList';
import { EditActivityModal } from './components/EditActivityModal';
import { StudentMasterList } from './components/StudentMasterList';
import { EditStudentModal } from './components/EditStudentModal';
import { QuickEnrollModal } from './components/QuickEnrollModal';
import { ScheduleView } from './components/ScheduleView';
import { RollCallView } from './components/RollCallView';
import { ColleagueShareView } from './components/ColleagueShareView';
import { AttendanceStatsView } from './components/AttendanceStatsView';
import { GoogleDriveView } from './components/GoogleDriveView';
import { DataImportExportModal } from './components/DataImportExportModal';
import { RoleAuthModal } from './components/RoleAuthModal';
import { getRoleInfo } from './utils/auth';

export const App: React.FC = () => {
  // Global Data State initialized from localStorage or initial school dataset
  const [data, setData] = useState<AppDataState>(() => loadStoredData());

  // Listen to remote realtime data changes across devices / tabs
  useEffect(() => {
    const unsubData = realtimeSync.subscribeDataUpdates((newData) => {
      setData(newData);
    });
    return () => unsubData();
  }, []);

  // Navigation & Role State (Default to guest, requires password to switch to teacher/head-teacher/admin)
  const [currentTab, setCurrentTab] = useState<NavigationTab>('dashboard');
  const [role, setRole] = useState<UserRole>('guest');
  const [pendingAuthRole, setPendingAuthRole] = useState<Exclude<UserRole, 'guest'> | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [maskPhone, setMaskPhone] = useState<boolean>(false);

  // Cross-component selected IDs
  const [activeGroupId, setActiveGroupId] = useState<string>('S002');
  const [filterPendingSupport, setFilterPendingSupport] = useState<boolean>(false);

  // Modal States
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ActivityGroup | null>(null);

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollTargetStudent, setEnrollTargetStudent] = useState<Student | null>(null);
  const [enrollTargetGroupId, setEnrollTargetGroupId] = useState<string | null>(null);

  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  // Notification Banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Sync to localStorage and broadcast to cloud/peers
  const handleSaveData = (newData: AppDataState) => {
    setData(newData);
    saveStoredData(newData);
    realtimeSync.broadcastDataUpdate(newData);
  };

  // Activity Group CRUD
  const handleSaveActivityGroup = (group: ActivityGroup) => {
    const updated = updateActivityGroup(group);
    handleSaveData(updated);
    showToast(`已成功儲存活動小組：${group.name}`);
  };

  const handleDeleteActivityGroup = (groupId: string) => {
    if (window.confirm(`確定要刪除活動小組 (${groupId}) 嗎？相關名單亦將一併移除。`)) {
      const updated = deleteActivityGroup(groupId);
      handleSaveData(updated);
      showToast(`已刪除活動小組 (${groupId})`);
    }
  };

  // Student CRUD
  const handleSaveStudent = (student: Student) => {
    const updated = updateStudent(student);
    handleSaveData(updated);
    showToast(`已成功儲存學生資料：${student.name} (${student.id})`);
  };

  const handleDeleteStudent = (studentId: string) => {
    if (window.confirm(`確定要刪除學生 (${studentId}) 嗎？`)) {
      const updated = deleteStudent(studentId);
      handleSaveData(updated);
      showToast(`已刪除學生 (${studentId})`);
    }
  };

  const handleBatchUpdateStudents = (
    studentIds: string[],
    updates: Partial<Student>,
    options?: { addGroupId?: string; removeGroupId?: string }
  ) => {
    let updatedStudents = data.students.map(s => {
      if (studentIds.includes(s.id)) {
        return {
          ...s,
          ...updates,
          // Recalculate id if class or classNo changed
          id: (updates.class || s.class) + (updates.classNo || s.classNo || '01').padStart(2, '0'),
        };
      }
      return s;
    });

    let updatedEnrollments = [...data.enrollments];

    if (options?.addGroupId) {
      studentIds.forEach(sid => {
        const exists = updatedEnrollments.some(e => e.groupId === options.addGroupId && e.studentId === sid);
        if (!exists) {
          updatedEnrollments.push({
            id: `en-${options.addGroupId}-${sid}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            groupId: options.addGroupId,
            studentId: sid,
            dismissalMethod: '自行放學',
            enrolledAt: new Date().toISOString(),
          });
        }
      });
    }

    if (options?.removeGroupId) {
      updatedEnrollments = updatedEnrollments.filter(
        e => !(e.groupId === options.removeGroupId && studentIds.includes(e.studentId))
      );
    }

    const updatedData: AppDataState = {
      ...data,
      students: updatedStudents,
      enrollments: updatedEnrollments,
    };

    handleSaveData(updatedData);
    showToast(`已成功批量更新 ${studentIds.length} 名學生資料！`);
  };

  const handleBulkImportStudents = (newOrUpdatedStudents: Student[], mode: 'merge' | 'replace') => {
    let finalStudents: Student[] = [];

    if (mode === 'replace') {
      finalStudents = newOrUpdatedStudents;
    } else {
      // Merge mode (Upsert)
      const studentMap = new Map<string, Student>();
      data.students.forEach(s => studentMap.set(s.id, s));
      newOrUpdatedStudents.forEach(s => {
        const existing = studentMap.get(s.id);
        studentMap.set(s.id, {
          ...(existing || {}),
          ...s,
        } as Student);
      });
      finalStudents = Array.from(studentMap.values());
    }

    const updatedData: AppDataState = {
      ...data,
      students: finalStudents,
    };

    handleSaveData(updatedData);
    showToast(`已成功${mode === 'merge' ? '合併更新' : '覆蓋匯入'} ${newOrUpdatedStudents.length} 名學生資料！`);
  };

  // Enrollment actions
  const handleEnrollStudent = (groupId: string, studentId: string, dismissalMethod: DismissalMethod) => {
    const updated = addEnrollment(groupId, studentId, dismissalMethod);
    handleSaveData(updated);
    showToast(`已成功將學生加入活動小組！`);
  };

  const handleBatchEnrollStudents = (
    groupId: string,
    enrollmentsToAdd: { studentId: string; dismissalMethod: DismissalMethod; remarks?: string }[],
    newStudentsToCreate?: Student[]
  ) => {
    let updatedStudents = [...data.students];
    if (newStudentsToCreate && newStudentsToCreate.length > 0) {
      const studentMap = new Map<string, Student>();
      data.students.forEach(s => studentMap.set(s.id, s));
      newStudentsToCreate.forEach(s => {
        studentMap.set(s.id, s);
      });
      updatedStudents = Array.from(studentMap.values());
    }

    const updatedEnrollments = [...data.enrollments];
    let addedCount = 0;

    enrollmentsToAdd.forEach(item => {
      const exists = updatedEnrollments.some(e => e.groupId === groupId && e.studentId === item.studentId);
      if (!exists) {
        updatedEnrollments.push({
          id: `en-${groupId}-${item.studentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          groupId,
          studentId: item.studentId,
          dismissalMethod: item.dismissalMethod || '自行放學',
          remarks: item.remarks || '',
          enrolledAt: new Date().toISOString(),
        });
        addedCount++;
      }
    });

    const targetGroup = data.activityGroups.find(g => g.id === groupId);
    const updatedData: AppDataState = {
      ...data,
      students: updatedStudents,
      enrollments: updatedEnrollments,
    };

    handleSaveData(updatedData);
    showToast(`已成功為「${targetGroup?.name || groupId}」新增/導入 ${addedCount} 名學生名單！`);
  };

  const handleRemoveEnrollment = (enrollmentId: string) => {
    const updated = removeEnrollment(enrollmentId);
    handleSaveData(updated);
    showToast(`已自名單移除學生`);
  };

  const handleUpdateDismissal = (enrollmentId: string, dismissalMethod: DismissalMethod) => {
    const updated = updateEnrollmentDismissal(enrollmentId, dismissalMethod);
    handleSaveData(updated);
  };

  // Attendance Records Update
  const handleUpdateAttendance = (records: AttendanceRecord[]) => {
    const updated: AppDataState = {
      ...data,
      attendanceRecords: records,
    };
    handleSaveData(updated);
  };

  // Full Import / Reset
  const handleImportPartialData = (partial: Partial<AppDataState>) => {
    const merged: AppDataState = {
      ...data,
      ...partial,
    };
    handleSaveData(merged);
    showToast(`資料已成功更新並同步儲存！`);
  };

  const handleResetSchoolData = () => {
    const initial = resetStoredData();
    handleSaveData(initial);
    showToast(`已成功重設為學校初始標準資料！`);
  };

  // Role switching authentication
  const handleRequestRoleChange = (targetRole: UserRole) => {
    if (targetRole === role) return;

    if (targetRole === 'guest') {
      setRole('guest');
      showToast('已切換為「訪客」身份（唯讀模式）');
      return;
    }

    setPendingAuthRole(targetRole);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (authenticatedRole: UserRole) => {
    setRole(authenticatedRole);
    setIsAuthModalOpen(false);
    setPendingAuthRole(null);
    showToast(`已通過驗證，切換至「${getRoleInfo(authenticatedRole).title}」身份！`);
  };

  // Quick navigation handlers
  const handleNavigateToRollCall = (groupId?: string) => {
    if (groupId) setActiveGroupId(groupId);
    setCurrentTab('roll-call');
  };

  const handleNavigateToShare = (groupId?: string) => {
    if (groupId) setActiveGroupId(groupId);
    setCurrentTab('share');
  };

  const handleNavigateToStudentsPending = () => {
    setFilterPendingSupport(true);
    setCurrentTab('students');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#2C2C2A] flex flex-col font-sans antialiased selection:bg-[#485945] selection:text-white">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#2C2C2A] text-[#FAF9F5] px-4 py-2.5 rounded-xl shadow-xl border border-[#44443E] text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-[#759870] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Real-time Connection Status Bar above Navbar */}
      <ConnectionStatusBar onManualSyncRequest={() => realtimeSync.syncWithCloud()} />

      {/* Main Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab !== 'students') setFilterPendingSupport(false);
          setCurrentTab(tab as NavigationTab);
        }}
        role={role}
        onRequestRoleChange={handleRequestRoleChange}
        maskPhone={maskPhone}
        setMaskPhone={setMaskPhone}
        onOpenImportExport={() => setIsImportExportModalOpen(true)}
        onResetData={handleResetSchoolData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <Dashboard
            data={data}
            role={role}
            onNavigateTab={(tab) => {
              if (tab !== 'students') setFilterPendingSupport(false);
              setCurrentTab(tab);
            }}
            onStartRollCall={handleNavigateToRollCall}
            onViewPendingSupport={handleNavigateToStudentsPending}
            onAddActivity={() => {
              setEditingGroup(null);
              setIsActivityModalOpen(true);
            }}
          />
        )}

        {currentTab === 'activity-groups' && (
          <ActivityGroupList
            activityGroups={data.activityGroups}
            students={data.students}
            enrollments={data.enrollments}
            role={role}
            maskPhone={maskPhone}
            onAddGroup={() => {
              setEditingGroup(null);
              setIsActivityModalOpen(true);
            }}
            onEditGroup={(group) => {
              setEditingGroup(group);
              setIsActivityModalOpen(true);
            }}
            onDeleteGroup={handleDeleteActivityGroup}
            onOpenRollCall={handleNavigateToRollCall}
            onOpenShareView={handleNavigateToShare}
            onEnrollStudent={(groupId) => {
              setEnrollTargetGroupId(groupId);
              setEnrollTargetStudent(null);
              setIsEnrollModalOpen(true);
            }}
            onBatchEnrollStudents={handleBatchEnrollStudents}
            onRemoveEnrollment={handleRemoveEnrollment}
            onUpdateDismissal={handleUpdateDismissal}
          />
        )}

        {currentTab === 'students' && (
          <StudentMasterList
            students={data.students}
            activityGroups={data.activityGroups}
            enrollments={data.enrollments}
            role={role}
            maskPhone={maskPhone}
            initialFilterPendingSupport={filterPendingSupport}
            onAddStudent={() => {
              setEditingStudent(null);
              setIsStudentModalOpen(true);
            }}
            onEditStudent={(student) => {
              setEditingStudent(student);
              setIsStudentModalOpen(true);
            }}
            onDeleteStudent={handleDeleteStudent}
            onQuickEnroll={(student) => {
              setEnrollTargetStudent(student);
              setEnrollTargetGroupId(null);
              setIsEnrollModalOpen(true);
            }}
            onSaveStudent={handleSaveStudent}
            onRemoveEnrollment={handleRemoveEnrollment}
            onBatchUpdateStudents={handleBatchUpdateStudents}
            onBulkImportStudents={handleBulkImportStudents}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'schedule' && (
          <ScheduleView
            activityGroups={data.activityGroups}
            role={role}
            onStartRollCall={handleNavigateToRollCall}
            onViewShare={handleNavigateToShare}
            onEditGroup={(group) => {
              setEditingGroup(group);
              setIsActivityModalOpen(true);
            }}
          />
        )}

        {currentTab === 'roll-call' && (
          <RollCallView
            activityGroups={data.activityGroups}
            students={data.students}
            enrollments={data.enrollments}
            attendanceRecords={data.attendanceRecords}
            role={role}
            maskPhone={maskPhone}
            initialGroupId={activeGroupId}
            onUpdateAttendance={handleUpdateAttendance}
            onSaveGroup={handleSaveActivityGroup}
            onEditGroup={(group) => {
              setEditingGroup(group);
              setIsActivityModalOpen(true);
            }}
            onEnrollStudent={(groupId) => {
              setEnrollTargetGroupId(groupId);
              setEnrollTargetStudent(null);
              setIsEnrollModalOpen(true);
            }}
            onBatchEnrollStudents={handleBatchEnrollStudents}
            onRemoveEnrollment={handleRemoveEnrollment}
          />
        )}

        {currentTab === 'share' && (
          <ColleagueShareView
            activityGroups={data.activityGroups}
            students={data.students}
            enrollments={data.enrollments}
            attendanceRecords={data.attendanceRecords}
            initialGroupId={activeGroupId}
            maskPhone={maskPhone}
            setMaskPhone={setMaskPhone}
            role={role}
          />
        )}

        {currentTab === 'statistics' && (
          <AttendanceStatsView
            activityGroups={data.activityGroups}
            students={data.students}
            enrollments={data.enrollments}
            attendanceRecords={data.attendanceRecords}
          />
        )}

        {currentTab === 'google-drive' && (
          <GoogleDriveView
            data={data}
            role={role}
            maskPhone={maskPhone}
            onRestoreData={(restored) => {
              handleSaveData(restored);
              showToast('已成功從 Google Drive 還原數據！');
            }}
            onShowToast={showToast}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#FAF9F5] border-t border-[#E5E2DA] py-4 px-6 text-center text-xs text-[#78786E] no-print">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>學校課外活動組與支援小組智能管理系統 · 支援 Excel 導入導出與實時出席統計</span>
          <span className="font-mono text-[#99998E]">目前權限：{getRoleInfo(role).title} ({role === 'admin' ? '全權管理' : role === 'head-teacher' ? '科主任管理' : role === 'teacher' ? '點名/出勤登記' : '唯讀查閱'})</span>
        </div>
      </footer>

      {/* Modals */}
      {isAuthModalOpen && pendingAuthRole && (
        <RoleAuthModal
          targetRole={pendingAuthRole}
          currentRole={role}
          onSuccess={handleAuthSuccess}
          onClose={() => {
            setIsAuthModalOpen(false);
            setPendingAuthRole(null);
          }}
        />
      )}

      <EditActivityModal
        isOpen={isActivityModalOpen}
        onClose={() => setIsActivityModalOpen(false)}
        groupToEdit={editingGroup}
        enrollments={data.enrollments}
        onSave={handleSaveActivityGroup}
      />

      <EditStudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        studentToEdit={editingStudent}
        onSave={handleSaveStudent}
      />

      <QuickEnrollModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        student={enrollTargetStudent}
        groupId={enrollTargetGroupId}
        students={data.students}
        activityGroups={data.activityGroups}
        enrollments={data.enrollments}
        onEnroll={handleEnrollStudent}
      />

      <DataImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        data={data}
        role={role}
        maskPhone={maskPhone}
        onImportData={handleImportPartialData}
        onResetData={handleResetSchoolData}
      />
    </div>
  );
};
export default App;
