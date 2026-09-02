export type UserRole = 'admin' | 'teacher' | 'head-teacher' | 'guest';

export type WeekDay = '星期一' | '星期二' | '星期三' | '星期四' | '星期五' | '星期六';

export type AttendanceStatus = 'P' | 'A' | 'L' | 'NA';
// P = 出席 (Present)
// A = 缺席 (Absent)
// L = 請假 (Leave)
// NA = 不適用 / 未有記錄 (Not Applicable / Unrecorded)

export type DismissalMethod = '自行放學' | '家長接送' | '課後託管班' | '校車' | '留校' | '其他';

export interface Student {
  id: string; // 學生編別 e.g. "1A01", "4B11"
  class: string; // 班別 e.g. "1A", "4B"
  classNo: string; // 學號 e.g. "01", "11"
  name: string; // 學生姓名 e.g. "學生 A", "李祉昕"
  gender: 'M' | 'F'; // 性別
  grade: string; // 年級 e.g. "一年級", "四年級"
  isSSupport: boolean; // S支援 (✓)
  mainSupportNeed?: string; // 主要支援需要 e.g. "讀寫樂"
  phone?: string; // 聯絡電話
  status: '在讀' | '離校'; // 現時狀態
  remarks?: string; // 備註
}

export type ActivityCategory = '隊伍/校隊' | '興趣小組' | '支援小組' | '託管班' | '留堂/補習' | '其他';

export interface ActivityGroup {
  id: string; // Group ID e.g. "S001", "T001", "M001", "ASCP001"
  name: string; // 活動小組名稱 e.g. "獅藝校隊", "光輝樂隊校隊"
  category: ActivityCategory;
  days: WeekDay[]; // 星期 e.g. ['星期一', '星期二']
  startTime: string; // 開始時間 e.g. "15:30"
  endTime: string; // 結束時間 e.g. "17:00"
  venue: string; // 地點 e.g. "N702", "七樓盧碧珊堂", "5C課室(401)"
  teacher: string; // 負責職員 / 老師
  isSSupportGroup: boolean; // 是否為 S支援小組
  supportTarget?: string; // 支援目標 / 年級
  datesText: string; // 活動小組日期（文字） e.g. "16/3、23/3、30/3"
  sessionDates: string[]; // 個別堂數日期清單 e.g. ["16/3", "23/3", "30/3"]
  rollCallLink?: string; // 點名連結 / 備註代號
  remarks?: string; // 備註
  maxCapacity?: number;
}

export interface Enrollment {
  id: string; // Enrollment ID
  groupId: string; // Group ID
  studentId: string; // 學生編別
  dismissalMethod: DismissalMethod; // 放學方式
  remarks?: string;
  enrolledAt?: string;
}

export interface AttendanceRecord {
  id: string;
  groupId: string;
  studentId: string;
  date: string; // Session date string e.g. "16/3", "23/3"
  status: AttendanceStatus;
  note?: string; // 備註 (e.g. 病假, 比賽)
  updatedAt?: number;
  updatedBy?: string;
}

export interface AppDataState {
  students: Student[];
  activityGroups: ActivityGroup[];
  enrollments: Enrollment[];
  attendanceRecords: AttendanceRecord[];
  lastUpdated?: number;
}

export type NavigationTab = 
  | 'dashboard' 
  | 'activity-groups' 
  | 'students' 
  | 'schedule' 
  | 'roll-call' 
  | 'statistics'
  | 'share'
  | 'google-drive';

