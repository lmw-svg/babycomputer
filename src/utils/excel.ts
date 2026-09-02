import * as XLSX from 'xlsx';
import { AppDataState, Student, ActivityGroup, Enrollment, AttendanceRecord, DismissalMethod } from '../types';
import { parseSessionDates, formatSessionDatesText } from './dateUtils';

export function exportFullSchoolDataToExcel(data: AppDataState, maskPhone: boolean = false): void {
  const wb = XLSX.utils.book_new();

  // 1. 活動小組設定
  const groupRows = data.activityGroups.map(g => ({
    'Group ID': g.id,
    '活動小組名稱': g.name,
    '類別': g.category,
    '星期': g.days.join('、'),
    '開始時間': g.startTime,
    '結束時間': g.endTime,
    '地點': g.venue,
    '負責職員': g.teacher,
    'S支援小組': g.isSSupportGroup ? '✓' : '',
    '支援目標': g.supportTarget || '',
    '活動小組日期（文字）': g.datesText || '',
    '備註': g.remarks || '',
  }));
  const wsGroups = XLSX.utils.json_to_sheet(groupRows);
  XLSX.utils.book_append_sheet(wb, wsGroups, '活動小組設定');

  // 2. 學生列表
  const studentRows = data.students.map(s => ({
    '學生編別': s.id,
    '班別': s.class,
    '學號': s.classNo,
    '學生姓名': s.name,
    '性別': s.gender,
    '年級': s.grade,
    'S支援': s.isSSupport ? '✓' : '',
    '主要支援需要': s.mainSupportNeed || '',
    '聯絡電話': maskPhone && s.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s.phone || '',
    '現時狀態': s.status,
    '備註': s.remarks || '',
  }));
  const wsStudents = XLSX.utils.json_to_sheet(studentRows);
  XLSX.utils.book_append_sheet(wb, wsStudents, '學生列表');

  // 3. 活動小組名單 (Enrollments with populated info)
  const studentMap = new Map(data.students.map(s => [s.id, s]));
  const groupMap = new Map(data.activityGroups.map(g => [g.id, g]));

  const enrollmentRows = data.enrollments.map(en => {
    const s = studentMap.get(en.studentId);
    const g = groupMap.get(en.groupId);
    return {
      'Group ID': en.groupId,
      '學生編別': en.studentId,
      '班別': s?.class || '',
      '學號': s?.classNo || '',
      '學生姓名': s?.name || '',
      '性別': s?.gender || '',
      '放學方式': en.dismissalMethod || '自行放學',
      '聯絡電話': maskPhone && s?.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s?.phone || '',
      '支援需要': s?.mainSupportNeed || '',
      '學生狀態': s?.status || '在讀',
      '活動小組名稱': g?.name || '',
      'S支援小組': g?.isSSupportGroup ? '✓' : '',
      '星期': g?.days.join('、') || '',
      '時間': g ? `${g.startTime}-${g.endTime}` : '',
      '地點': g?.venue || '',
      '負責職員': g?.teacher || '',
      '活動小組日期': g?.datesText || '',
    };
  });
  const wsEnrollments = XLSX.utils.json_to_sheet(enrollmentRows);
  XLSX.utils.book_append_sheet(wb, wsEnrollments, '活動小組名單');

  // 4. 學生總表 (Student Master Summary with S-Support follow-up reminder)
  const studentMasterRows = data.students.map(s => {
    const studentEns = data.enrollments.filter(e => e.studentId === s.id);
    const joinedGroups = studentEns.map(e => groupMap.get(e.groupId)).filter(Boolean) as ActivityGroup[];
    
    const supportGroups = joinedGroups.filter(g => g.isSSupportGroup);
    const otherGroups = joinedGroups.filter(g => !g.isSSupportGroup);
    
    let followUp = '';
    if (s.isSSupport) {
      followUp = supportGroups.length === 0 ? '尚未編排S支援活動小組' : '正常';
    }

    return {
      '學生編別': s.id,
      '班別': s.class,
      '學生姓名': s.name,
      '性別': s.gender,
      '支援需要': s.mainSupportNeed || (s.isSSupport ? '有支援需要' : ''),
      '支援活動小組數': supportGroups.length,
      '興趣班/校隊/課託數': otherGroups.length,
      '參加活動小組': joinedGroups.map(g => g.name).join('、'),
      '參加星期': Array.from(new Set(joinedGroups.flatMap(g => g.days))).join('、'),
      '跟進提示': followUp,
    };
  });
  const wsMaster = XLSX.utils.json_to_sheet(studentMasterRows);
  XLSX.utils.book_append_sheet(wb, wsMaster, '學生總表');

  // 5. 出席統計表 (Attendance Statistics)
  const statsRows = data.activityGroups.map(g => {
    const records = data.attendanceRecords.filter(r => r.groupId === g.id);
    const pCount = records.filter(r => r.status === 'P').length;
    const aCount = records.filter(r => r.status === 'A').length;
    const lCount = records.filter(r => r.status === 'L').length;
    const totalValid = pCount + aCount + lCount;
    const rate = totalValid > 0 ? ((pCount / totalValid) * 100).toFixed(1) + '%' : '0.0%';

    const enrolledStudents = data.enrollments.filter(e => e.groupId === g.id);

    return {
      'Group ID': g.id,
      '活動小組名稱': g.name,
      '負責職員': g.teacher,
      '報讀人數': enrolledStudents.length,
      '已記錄總堂數': g.sessionDates.length,
      '出席 (P)': pCount,
      '缺席 (A)': aCount,
      '請假 (L)': lCount,
      '出席率': rate,
    };
  });
  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  XLSX.utils.book_append_sheet(wb, wsStats, '出席統計表');

  const filename = `學校課外活動支援統計與點名表_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export function exportSingleGroupRollCallToExcel(
  group: ActivityGroup,
  students: Student[],
  enrollments: Enrollment[],
  attendanceRecords: AttendanceRecord[],
  maskPhone: boolean = false
): void {
  const wb = XLSX.utils.book_new();

  const groupEnrollments = enrollments.filter(e => e.groupId === group.id);
  const studentMap = new Map(students.map(s => [s.id, s]));

  const rows = groupEnrollments.map((en, idx) => {
    const s = studentMap.get(en.studentId);
    const row: Record<string, string | number> = {
      '編號': idx + 1,
      '班別': s?.class || '',
      '學號': s?.classNo || '',
      '學生姓名': s?.name || '',
      '性別': s?.gender || '',
      '放學方式': en.dismissalMethod || '自行放學',
      '聯絡電話': maskPhone && s?.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s?.phone || '',
      '學生編別': en.studentId,
    };

    // Add session attendance columns
    group.sessionDates.forEach((date) => {
      const rec = attendanceRecords.find(r => r.groupId === group.id && r.studentId === en.studentId && r.date === date);
      row[date] = rec ? rec.status : 'NA';
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `${group.id}_點名表`);
  XLSX.writeFile(wb, `${group.id}_${group.name}_點名表.xlsx`);
}

/**
 * Generate Excel Blob for Full School Data (suitable for Google Drive upload)
 */
export function generateFullSchoolExcelBlob(data: AppDataState, maskPhone: boolean = false): Blob {
  const wb = XLSX.utils.book_new();

  // 1. 活動小組設定
  const groupRows = data.activityGroups.map(g => ({
    'Group ID': g.id,
    '活動小組名稱': g.name,
    '類別': g.category,
    '星期': g.days.join('、'),
    '開始時間': g.startTime,
    '結束時間': g.endTime,
    '地點': g.venue,
    '負責職員': g.teacher,
    'S支援小組': g.isSSupportGroup ? '✓' : '',
    '支援目標': g.supportTarget || '',
    '活動小組日期（文字）': g.datesText || '',
    '備註': g.remarks || '',
  }));
  const wsGroups = XLSX.utils.json_to_sheet(groupRows);
  XLSX.utils.book_append_sheet(wb, wsGroups, '活動小組設定');

  // 2. 學生列表
  const studentRows = data.students.map(s => ({
    '學生編別': s.id,
    '班別': s.class,
    '學號': s.classNo,
    '學生姓名': s.name,
    '性別': s.gender,
    '年級': s.grade,
    'S支援': s.isSSupport ? '✓' : '',
    '主要支援需要': s.mainSupportNeed || '',
    '聯絡電話': maskPhone && s.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s.phone || '',
    '現時狀態': s.status,
    '備註': s.remarks || '',
  }));
  const wsStudents = XLSX.utils.json_to_sheet(studentRows);
  XLSX.utils.book_append_sheet(wb, wsStudents, '學生列表');

  // 3. 活動小組名單
  const studentMap = new Map(data.students.map(s => [s.id, s]));
  const groupMap = new Map(data.activityGroups.map(g => [g.id, g]));

  const enrollmentRows = data.enrollments.map(en => {
    const s = studentMap.get(en.studentId);
    const g = groupMap.get(en.groupId);
    return {
      'Group ID': en.groupId,
      '學生編別': en.studentId,
      '班別': s?.class || '',
      '學號': s?.classNo || '',
      '學生姓名': s?.name || '',
      '性別': s?.gender || '',
      '放學方式': en.dismissalMethod || '自行放學',
      '聯絡電話': maskPhone && s?.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s?.phone || '',
      '支援需要': s?.mainSupportNeed || '',
      '學生狀態': s?.status || '在讀',
      '活動小組名稱': g?.name || '',
    };
  });
  const wsEnroll = XLSX.utils.json_to_sheet(enrollmentRows);
  XLSX.utils.book_append_sheet(wb, wsEnroll, '活動小組名單');

  // 4. 出席記錄匯總
  const attendanceRows = data.attendanceRecords.map(att => {
    const s = studentMap.get(att.studentId);
    const g = groupMap.get(att.groupId);
    return {
      'Group ID': att.groupId,
      '活動名稱': g?.name || '',
      '學生編別': att.studentId,
      '學生姓名': s?.name || '',
      '班別': s?.class || '',
      '學號': s?.classNo || '',
      '日期': att.date,
      '出席狀態': att.status,
      '備註': att.note || '',
      '記錄更新時間': att.updatedAt || '',
    };
  });
  const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows);
  XLSX.utils.book_append_sheet(wb, wsAttendance, '出席記錄總表');

  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generate Excel Blob for Single Group Roll Call (suitable for Google Drive upload)
 */
export function generateSingleGroupExcelBlob(
  group: ActivityGroup,
  students: Student[],
  enrollments: Enrollment[],
  attendanceRecords: AttendanceRecord[],
  maskPhone: boolean = false
): Blob {
  const wb = XLSX.utils.book_new();
  const groupEnrollments = enrollments.filter(e => e.groupId === group.id);
  const studentMap = new Map(students.map(s => [s.id, s]));

  const rows = groupEnrollments.map((en, idx) => {
    const s = studentMap.get(en.studentId);
    const row: Record<string, string | number> = {
      '編號': idx + 1,
      '班別': s?.class || '',
      '學號': s?.classNo || '',
      '學生姓名': s?.name || '',
      '性別': s?.gender || '',
      '放學方式': en.dismissalMethod || '自行放學',
      '聯絡電話': maskPhone && s?.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s?.phone || '',
      '學生編別': en.studentId,
    };

    group.sessionDates.forEach((date) => {
      const rec = attendanceRecords.find(r => r.groupId === group.id && r.studentId === en.studentId && r.date === date);
      row[date] = rec ? rec.status : 'NA';
    });

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, `${group.id}_點名表`);
  const arrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function parseUploadedFile(file: File): Promise<{
  students?: Partial<Student>[];
  activityGroups?: Partial<ActivityGroup>[];
  enrollments?: Partial<Enrollment>[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'binary' });

        const result: {
          students?: Partial<Student>[];
          activityGroups?: Partial<ActivityGroup>[];
          enrollments?: Partial<Enrollment>[];
        } = {};

        // Parse student sheet if exists
        const studentSheetName = wb.SheetNames.find(n => n.includes('學生') || n.toLowerCase().includes('student'));
        if (studentSheetName) {
          const rawStudents = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[studentSheetName]);
          result.students = rawStudents.map((r) => {
            const classVal = String(r['班別'] || r['班級'] || r['class'] || '').trim();
            const classNoVal = String(r['學號'] || r['classNo'] || '').trim().padStart(2, '0');
            const idVal = String(r['學生編別'] || r['id'] || (classVal && classNoVal ? `${classVal}${classNoVal}` : '')).trim();
            const sSupportVal = r['S支援'] || r['S支援（✓）'] || r['isSSupport'];
            return {
              id: idVal,
              class: classVal,
              classNo: classNoVal,
              name: String(r['學生姓名'] || r['姓名'] || r['name'] || '').trim(),
              gender: (String(r['性別'] || '').toUpperCase() === 'F' ? 'F' : 'M') as 'M' | 'F',
              grade: String(r['年級'] || r['grade'] || '').trim() || (classVal ? classVal.slice(0, 1) + '年級' : '一年級'),
              isSSupport: sSupportVal === '✓' || sSupportVal === true || sSupportVal === 1 || String(sSupportVal).toLowerCase() === 'true',
              mainSupportNeed: String(r['主要支援需要'] || r['支援需要'] || '').trim(),
              phone: String(r['聯絡電話'] || r['電話'] || r['phone'] || '').trim(),
              status: (String(r['現時狀態'] || r['狀態'] || '在讀').trim() === '離校' ? '離校' : '在讀') as '在讀' | '離校',
              remarks: String(r['備註'] || '').trim(),
            };
          }).filter(s => s.name && s.id);
        }

        // Parse activity groups if exists
        const groupSheetName = wb.SheetNames.find(n => n.includes('活動') || n.includes('小組') || n.toLowerCase().includes('activity') || n.toLowerCase().includes('group'));
        if (groupSheetName) {
          const rawGroups = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[groupSheetName]);
          result.activityGroups = rawGroups.map((r) => {
            const id = String(r['Group ID'] || r['groupId'] || r['編號'] || '').trim();
            const name = String(r['活動小組名稱'] || r['名稱'] || r['name'] || '').trim();
            const daysRaw = String(r['星期'] || r['days'] || '星期一');
            const days = daysRaw.split(/[、,， ]+/).filter(Boolean) as any[];
            const datesText = String(r['活動小組日期（文字）'] || r['活動小組日期'] || r['日期'] || '').trim();
            const parsedDates = parseSessionDates(datesText);
            const datesList = parsedDates.length > 0 ? parsedDates : ['9/10', '16/10', '23/10', '30/10'];
            
            return {
              id,
              name,
              category: (r['類別'] || '興趣小組') as any,
              days: days.length > 0 ? days : ['星期一'],
              startTime: String(r['開始時間'] || r['startTime'] || '15:30').trim(),
              endTime: String(r['結束時間'] || r['endTime'] || '17:00').trim(),
              venue: String(r['地點'] || r['venue'] || '2A課室(301)').trim(),
              teacher: String(r['負責職員'] || r['老師'] || r['teacher'] || '').trim(),
              isSSupportGroup: r['S支援小組'] === '✓' || r['isSSupportGroup'] === true,
              supportTarget: String(r['支援目標'] || '').trim(),
              datesText: datesText || formatSessionDatesText(datesList),
              sessionDates: datesList,
              remarks: String(r['備註'] || '').trim(),
            };
          }).filter(g => g.id && g.name);
        }

        // Parse enrollments if exists
        const enrollSheetName = wb.SheetNames.find(n => n.includes('名單') || n.toLowerCase().includes('enrollment'));
        if (enrollSheetName && enrollSheetName !== studentSheetName) {
          const rawEnroll = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[enrollSheetName]);
          result.enrollments = rawEnroll.map((r, i) => ({
            id: `imported-en-${i}-${Date.now()}`,
            groupId: String(r['Group ID'] || r['groupId'] || '').trim(),
            studentId: String(r['學生編別'] || r['studentId'] || '').trim(),
            dismissalMethod: (r['放學方式'] || '自行放學') as any,
            remarks: String(r['備註'] || '').trim(),
          })).filter(e => e.groupId && e.studentId);
        }

        resolve(result);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Export single Student Detail List to Excel
 */
export function exportStudentsDetailToExcel(students: Student[], maskPhone: boolean = false): void {
  const wb = XLSX.utils.book_new();
  const rows = students.map(s => ({
    '學生編別': s.id,
    '班別': s.class,
    '學號': s.classNo,
    '學生姓名': s.name,
    '性別': s.gender,
    '年級': s.grade,
    'S支援': s.isSSupport ? '✓' : '',
    '主要支援需要': s.mainSupportNeed || '',
    '聯絡電話': maskPhone && s.phone ? s.phone.slice(0, 2) + '****' + s.phone.slice(-2) : s.phone || '',
    '現時狀態': s.status,
    '備註': s.remarks || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '學生列表');
  XLSX.writeFile(wb, `學生列表檔案_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export Student Master Summary to Excel
 */
export function exportStudentMasterToExcel(
  students: Student[],
  activityGroups: ActivityGroup[],
  enrollments: Enrollment[]
): void {
  const wb = XLSX.utils.book_new();
  const groupMap = new Map(activityGroups.map(g => [g.id, g]));

  const rows = students.map(s => {
    const studentEns = enrollments.filter(e => e.studentId === s.id);
    const joinedGroups = studentEns.map(e => groupMap.get(e.groupId)).filter(Boolean) as ActivityGroup[];
    
    const supportGroups = joinedGroups.filter(g => g.isSSupportGroup);
    const otherGroups = joinedGroups.filter(g => !g.isSSupportGroup);
    
    let followUp = '';
    if (s.isSSupport) {
      followUp = supportGroups.length === 0 ? '尚未編排S支援活動小組' : '正常';
    }

    return {
      '學生編別': s.id,
      '班別': s.class,
      '學號': s.classNo,
      '學生姓名': s.name,
      '性別': s.gender,
      '年級': s.grade,
      '支援需要': s.mainSupportNeed || (s.isSSupport ? '需S支援' : ''),
      '支援活動小組數': supportGroups.length,
      '興趣班/校隊/課託數': otherGroups.length,
      '參加活動小組': joinedGroups.map(g => g.name).join('、'),
      '參加星期': Array.from(new Set(joinedGroups.flatMap(g => g.days))).join('、'),
      '跟進提示': followUp,
      '現時狀態': s.status,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, '學生總表');
  XLSX.writeFile(wb, `學生總表彙總_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Download empty / sample Excel template for updating student list
 */
export function downloadStudentTemplateExcel(): void {
  const wb = XLSX.utils.book_new();
  const sampleRows = [
    {
      '學生編別': '1A01',
      '班別': '1A',
      '學號': '01',
      '學生姓名': '陳一心',
      '性別': 'F',
      '年級': '一年級',
      'S支援': '✓',
      '主要支援需要': '專注力訓練',
      '聯絡電話': '91234567',
      '現時狀態': '在讀',
      '備註': '初小課後支援名單',
    },
    {
      '學生編別': '1A02',
      '班別': '1A',
      '學號': '02',
      '學生姓名': '李家寶',
      '性別': 'M',
      '年級': '一年級',
      'S支援': '',
      '主要支援需要': '',
      '聯絡電話': '92345678',
      '現時狀態': '在讀',
      '備註': '',
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, '學生列表');
  XLSX.writeFile(wb, `學生名單更新範本.xlsx`);
}

export interface ParsedGroupEnrollmentItem {
  rawClass: string;
  rawClassNo: string;
  studentId: string;
  name: string;
  gender?: 'M' | 'F';
  dismissalMethod: DismissalMethod;
  phone?: string;
  isSSupport?: boolean;
  mainSupportNeed?: string;
  remarks?: string;
}

/**
 * Download standard Excel sample template for Activity Group Student Roster Import
 */
export function downloadGroupEnrollmentSampleExcel(group?: ActivityGroup): void {
  const wb = XLSX.utils.book_new();
  const groupLabel = group ? `${group.id} - ${group.name}` : '課外活動小組';

  const sampleRows = [
    {
      '班別': '4B',
      '學號': '11',
      '學生姓名': '陳小明',
      '性別': '男',
      '放學方式': '自行放學',
      '聯絡電話': '91234567',
      'S支援': '否',
      '備註': '常規隊員',
    },
    {
      '班別': '4B',
      '學號': '12',
      '學生姓名': '李美美',
      '性別': '女',
      '放學方式': '家長接送',
      '聯絡電話': '92345678',
      'S支援': '是',
      '備註': '樂隊小提琴部',
    },
    {
      '班別': '5A',
      '學號': '05',
      '學生姓名': '張偉強',
      '性別': '男',
      '放學方式': '課後託管班',
      '聯絡電話': '93456789',
      'S支援': '否',
      '備註': '',
    },
    {
      '班別': '6C',
      '學號': '23',
      '學生姓名': '黃樂童',
      '性別': '女',
      '放學方式': '校車',
      '聯絡電話': '94567890',
      'S支援': '否',
      '備註': '校車2號線',
    },
    {
      '班別': '3A',
      '學號': '08',
      '學生姓名': '周梓軒',
      '性別': '男',
      '放學方式': '留校',
      '聯絡電話': '95678901',
      'S支援': '是',
      '備註': '需關顧',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  
  // Set column widths for better visual readability
  ws['!cols'] = [
    { wch: 8 },  // 班別
    { wch: 8 },  // 學號
    { wch: 14 }, // 學生姓名
    { wch: 8 },  // 性別
    { wch: 14 }, // 放學方式
    { wch: 14 }, // 聯絡電話
    { wch: 10 }, // S支援
    { wch: 20 }, // 備註
  ];

  XLSX.utils.book_append_sheet(wb, ws, '小組學生名單範本');

  const filename = group 
    ? `${group.id}_${group.name}_學生名單匯入範本.xlsx` 
    : `課外活動小組學生名單匯入範本.xlsx`;
  
  XLSX.writeFile(wb, filename);
}

/**
 * Download standard CSV sample template for Activity Group Student Roster Import
 */
export function downloadGroupEnrollmentSampleCsv(group?: ActivityGroup): void {
  const csvContent = [
    '班別,學號,學生姓名,性別,放學方式,聯絡電話,S支援,備註',
    '4B,11,陳小明,男,自行放學,91234567,否,常規隊員',
    '4B,12,李美美,女,家長接送,92345678,是,樂隊小提琴部',
    '5A,05,張偉強,男,課後託管班,93456789,否,',
    '6C,23,黃樂童,女,校車,94567890,否,校車2號線',
    '3A,08,周梓軒,男,留校,95678901,是,需關顧',
  ].join('\r\n');

  // Prefix UTF-8 BOM so Excel opens Chinese characters accurately
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = group 
    ? `${group.id}_${group.name}_學生名單匯入範本.csv` 
    : `課外活動小組學生名單匯入範本.csv`;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to normalize dismissal method strings
 */
function normalizeDismissalMethod(val: any): DismissalMethod {
  const str = String(val || '').trim();
  if (str.includes('家長') || str.includes('接送')) return '家長接送';
  if (str.includes('託管') || str.includes('課託')) return '課後託管班';
  if (str.includes('校車') || str.includes('保母車')) return '校車';
  if (str.includes('留校') || str.includes('補習') || str.includes('留堂')) return '留校';
  if (str.includes('其他')) return '其他';
  return '自行放學';
}

/**
 * Normalize raw row object into ParsedGroupEnrollmentItem
 */
export function normalizeGroupEnrollmentRow(r: Record<string, any>): ParsedGroupEnrollmentItem | null {
  // Support multiple alias variations in Chinese and English
  const classVal = String(r['班別'] || r['班級'] || r['年級班別'] || r['Class'] || r['class'] || '').trim().toUpperCase();
  let classNoVal = String(r['學號'] || r['座號'] || r['班號'] || r['ClassNo'] || r['classNo'] || r['Class No'] || '').trim();
  if (classNoVal && /^\d+$/.test(classNoVal)) {
    classNoVal = classNoVal.padStart(2, '0');
  }

  const nameVal = String(r['學生姓名'] || r['姓名'] || r['全名'] || r['Name'] || r['name'] || r['Student Name'] || '').trim();
  let idVal = String(r['學生編別'] || r['學生編號'] || r['ID'] || r['id'] || r['StudentId'] || '').trim();

  if (!idVal && classVal && classNoVal) {
    idVal = `${classVal}${classNoVal}`;
  }

  // If no name and no ID/class, skip invalid empty row
  if (!nameVal && !idVal) return null;

  const rawGender = String(r['性別'] || r['Gender'] || r['gender'] || '').trim();
  const gender: 'M' | 'F' = (rawGender === '女' || rawGender.toUpperCase() === 'F' || rawGender.includes('女')) ? 'F' : 'M';

  const dismissalMethod = normalizeDismissalMethod(r['放學方式'] || r['放學'] || r['放學途徑'] || r['Dismissal'] || r['dismissalMethod']);
  const phone = String(r['聯絡電話'] || r['電話'] || r['手機'] || r['Phone'] || r['phone'] || '').trim();
  
  const rawSupport = String(r['S支援'] || r['S支援學生'] || r['支援'] || r['isSSupport'] || '').trim();
  const isSSupport = rawSupport === '✓' || rawSupport === '是' || rawSupport === '有' || rawSupport === '1' || rawSupport.toLowerCase() === 'true';
  const mainSupportNeed = String(r['主要支援需要'] || r['支援需要'] || r['支援類別'] || '').trim();
  const remarks = String(r['備註'] || r['Remarks'] || r['remarks'] || '').trim();

  return {
    rawClass: classVal,
    rawClassNo: classNoVal,
    studentId: idVal,
    name: nameVal,
    gender,
    dismissalMethod,
    phone,
    isSSupport,
    mainSupportNeed,
    remarks,
  };
}

/**
 * Parse uploaded Excel or CSV file for Group Enrollment
 */
export function parseGroupEnrollmentFile(file: File): Promise<ParsedGroupEnrollmentItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'binary' });

        // Prefer first sheet or sheet with name like '名單' / '學生'
        let targetSheetName = wb.SheetNames[0];
        const matchSheet = wb.SheetNames.find(n => n.includes('名單') || n.includes('學生') || n.toLowerCase().includes('roster') || n.toLowerCase().includes('student'));
        if (matchSheet) targetSheetName = matchSheet;

        const sheet = wb.Sheets[targetSheetName];
        if (!sheet) {
          resolve([]);
          return;
        }

        const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        const parsedList: ParsedGroupEnrollmentItem[] = [];

        rawRows.forEach((r) => {
          const item = normalizeGroupEnrollmentRow(r);
          if (item) {
            parsedList.push(item);
          }
        });

        resolve(parsedList);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

/**
 * Parse pasted plain text (from Excel, Google Sheets, or TSV/CSV)
 */
export function parseGroupEnrollmentText(text: string): ParsedGroupEnrollmentItem[] {
  if (!text || !text.trim()) return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Determine separator (Tab '\t' or Comma ',' or Semicolon ';')
  const firstLine = lines[0];
  let separator = '\t';
  if (firstLine.includes('\t')) {
    separator = '\t';
  } else if (firstLine.includes(',')) {
    separator = ',';
  } else if (firstLine.includes(';')) {
    separator = ';';
  } else {
    // Single space or multiple spaces
    separator = ' ';
  }

  // Check if first line is header
  let startIndex = 0;
  let headers: string[] = [];

  const firstTokens = firstLine.split(separator === ' ' ? /\s+/ : separator).map(t => t.trim().replace(/^["']|["']$/g, ''));
  const isHeaderLine = firstTokens.some(t => 
    t.includes('班') || t.includes('號') || t.includes('名') || t.includes('放學') || t.includes('ID') || t.toLowerCase().includes('name') || t.toLowerCase().includes('class')
  );

  if (isHeaderLine) {
    headers = firstTokens;
    startIndex = 1;
  } else {
    // Default columns assumed in order: 班別, 學號, 姓名, 放學方式, 性別, 電話, S支援, 備註
    headers = ['班別', '學號', '學生姓名', '放學方式', '性別', '聯絡電話', 'S支援', '備註'];
    startIndex = 0;
  }

  const results: ParsedGroupEnrollmentItem[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const tokens = line.split(separator === ' ' ? /\s+/ : separator).map(t => t.trim().replace(/^["']|["']$/g, ''));
    if (tokens.length === 0 || tokens.every(t => !t)) continue;

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = tokens[idx] || '';
    });

    // Also support fallback positional mapping if headers were custom
    if (!rowObj['班別'] && !rowObj['學生姓名'] && tokens.length >= 2) {
      if (/^[1-6][A-Za-z]$/.test(tokens[0])) {
        rowObj['班別'] = tokens[0];
        rowObj['學號'] = tokens[1];
        rowObj['學生姓名'] = tokens[2] || '';
        rowObj['放學方式'] = tokens[3] || '自行放學';
      }
    }

    const item = normalizeGroupEnrollmentRow(rowObj);
    if (item) {
      results.push(item);
    }
  }

  return results;
}

