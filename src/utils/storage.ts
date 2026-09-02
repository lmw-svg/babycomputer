import { AppDataState, Student, ActivityGroup, Enrollment, AttendanceRecord, DismissalMethod } from '../types';
import { INITIAL_STUDENTS, INITIAL_ACTIVITY_GROUPS, INITIAL_ENROLLMENTS, INITIAL_ATTENDANCE_RECORDS } from '../data/initialData';
import { parseSessionDates, formatSessionDatesText } from './dateUtils';

const STORAGE_KEY = 'school_activities_system_v3_session_dates';
const PREVIOUS_STORAGE_KEYS = [
  'school_activities_system_v2_mon_sat',
  'school_activities_system_v1',
  'school_activities_system_data'
];

/**
 * Sanitizes and repairs date formats across activity groups and attendance records
 * to guarantee no single numbers (like "10") or outdated dummy March dates exist
 * and ensure format is consistently "D/M" (like "9/10", "16/10", "23/9").
 */
function sanitizeLoadedData(data: AppDataState): { sanitized: AppDataState; modified: boolean } {
  let modified = false;

  const initialGroupMap = new Map(INITIAL_ACTIVITY_GROUPS.map(ig => [ig.id, ig]));

  const sanitizedGroups = (Array.isArray(data.activityGroups) ? data.activityGroups : INITIAL_ACTIVITY_GROUPS).map(g => {
    let groupModified = false;
    let datesText = (g.datesText || '').trim();
    let sessionDates = Array.isArray(g.sessionDates) ? [...g.sessionDates] : [];

    const initialMatch = initialGroupMap.get(g.id);

    // If this is a predefined system group and contains old dummy dates like "16/3" or bare numbers or non-standard format
    const hasOldMarchDates = sessionDates.some(d => d.includes('/3') || d.includes('/4') || d.includes('/5'));
    const hasBareNumbers = sessionDates.some(d => /^\d{1,2}$/.test(d.trim()));

    if (initialMatch && (hasOldMarchDates || hasBareNumbers || sessionDates.length === 0 || !datesText)) {
      sessionDates = [...initialMatch.sessionDates];
      datesText = initialMatch.datesText;
      groupModified = true;
    } else {
      // Re-parse and sanitize sessionDates from datesText if needed
      let parsed = parseSessionDates(datesText);
      if (parsed.length > 0) {
        sessionDates = parsed;
        datesText = formatSessionDatesText(parsed);
        groupModified = true;
      } else if (sessionDates.length > 0) {
        sessionDates = sessionDates.map(d => {
          if (d.trim() === '10') {
            groupModified = true;
            return '9/10';
          }
          return d.trim();
        }).filter(d => !/^\d{1,2}$/.test(d));
        datesText = formatSessionDatesText(sessionDates);
        groupModified = true;
      } else if (initialMatch) {
        sessionDates = [...initialMatch.sessionDates];
        datesText = initialMatch.datesText;
        groupModified = true;
      }
    }

    if (groupModified) {
      modified = true;
      return {
        ...g,
        datesText: datesText || formatSessionDatesText(sessionDates),
        sessionDates,
      };
    }
    return g;
  });

  const sanitizedAttendance = (Array.isArray(data.attendanceRecords) ? data.attendanceRecords : INITIAL_ATTENDANCE_RECORDS).map(r => {
    let recModified = false;
    let newDate = r.date;
    if (r.date === '10') {
      newDate = '9/10';
      recModified = true;
    } else if (r.date === '16/3' || r.date === '23/3' || r.date === '30/3') {
      const g = sanitizedGroups.find(grp => grp.id === r.groupId);
      if (g && g.sessionDates.length > 0) {
        newDate = g.sessionDates[0];
        recModified = true;
      }
    }

    if (recModified) {
      modified = true;
      return { ...r, date: newDate };
    }
    return r;
  });

  return {
    sanitized: {
      students: Array.isArray(data.students) ? data.students : INITIAL_STUDENTS,
      activityGroups: sanitizedGroups,
      enrollments: Array.isArray(data.enrollments) ? data.enrollments : INITIAL_ENROLLMENTS,
      attendanceRecords: sanitizedAttendance,
    },
    modified,
  };
}

export function loadStoredData(): AppDataState {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Check if previous versions exist in localStorage to migrate user changes
      for (const prevKey of PREVIOUS_STORAGE_KEYS) {
        const prevRaw = localStorage.getItem(prevKey);
        if (prevRaw) {
          raw = prevRaw;
          break;
        }
      }
    }

    if (!raw) {
      const initial: AppDataState = {
        students: INITIAL_STUDENTS,
        activityGroups: INITIAL_ACTIVITY_GROUPS,
        enrollments: INITIAL_ENROLLMENTS,
        attendanceRecords: INITIAL_ATTENDANCE_RECORDS,
      };
      saveStoredData(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDataState;
    const { sanitized } = sanitizeLoadedData(parsed);
    // Always persist to the current STORAGE_KEY
    saveStoredData(sanitized);
    return sanitized;
  } catch (e) {
    console.error('Error loading stored data:', e);
    return {
      students: INITIAL_STUDENTS,
      activityGroups: INITIAL_ACTIVITY_GROUPS,
      enrollments: INITIAL_ENROLLMENTS,
      attendanceRecords: INITIAL_ATTENDANCE_RECORDS,
    };
  }
}

export function saveStoredData(data: AppDataState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('school-data-updated', { detail: data }));
  } catch (e) {
    console.error('Error saving stored data:', e);
  }
}

export function resetStoredData(): AppDataState {
  const initial: AppDataState = {
    students: INITIAL_STUDENTS,
    activityGroups: INITIAL_ACTIVITY_GROUPS,
    enrollments: INITIAL_ENROLLMENTS,
    attendanceRecords: INITIAL_ATTENDANCE_RECORDS,
  };
  saveStoredData(initial);
  return initial;
}

export function resetToInitialData(): AppDataState {
  return resetStoredData();
}

// Activity Group CRUD
export function updateActivityGroup(group: ActivityGroup): AppDataState {
  const data = loadStoredData();
  const index = data.activityGroups.findIndex(g => g.id === group.id);
  let updatedGroups: ActivityGroup[];
  if (index >= 0) {
    updatedGroups = [...data.activityGroups];
    updatedGroups[index] = group;
  } else {
    updatedGroups = [...data.activityGroups, group];
  }
  const newData: AppDataState = {
    ...data,
    activityGroups: updatedGroups,
  };
  saveStoredData(newData);
  return newData;
}

export function deleteActivityGroup(groupId: string): AppDataState {
  const data = loadStoredData();
  const newData: AppDataState = {
    ...data,
    activityGroups: data.activityGroups.filter(g => g.id !== groupId),
    enrollments: data.enrollments.filter(e => e.groupId !== groupId),
    attendanceRecords: data.attendanceRecords.filter(r => r.groupId !== groupId),
  };
  saveStoredData(newData);
  return newData;
}

// Student CRUD
export function updateStudent(student: Student): AppDataState {
  const data = loadStoredData();
  const index = data.students.findIndex(s => s.id === student.id);
  let updatedStudents: Student[];
  if (index >= 0) {
    updatedStudents = [...data.students];
    updatedStudents[index] = student;
  } else {
    updatedStudents = [...data.students, student];
  }
  const newData: AppDataState = {
    ...data,
    students: updatedStudents,
  };
  saveStoredData(newData);
  return newData;
}

export function deleteStudent(studentId: string): AppDataState {
  const data = loadStoredData();
  const newData: AppDataState = {
    ...data,
    students: data.students.filter(s => s.id !== studentId),
    enrollments: data.enrollments.filter(e => e.studentId !== studentId),
    attendanceRecords: data.attendanceRecords.filter(r => r.studentId !== studentId),
  };
  saveStoredData(newData);
  return newData;
}

// Enrollment CRUD
export function addEnrollment(groupId: string, studentId: string, dismissalMethod: DismissalMethod = '自行放學'): AppDataState {
  const data = loadStoredData();
  const exists = data.enrollments.some(e => e.groupId === groupId && e.studentId === studentId);
  if (exists) return data;

  const newEnrollment: Enrollment = {
    id: `en-${groupId}-${studentId}-${Date.now()}`,
    groupId,
    studentId,
    dismissalMethod,
    enrolledAt: new Date().toISOString(),
  };

  const newData: AppDataState = {
    ...data,
    enrollments: [...data.enrollments, newEnrollment],
  };
  saveStoredData(newData);
  return newData;
}

export function removeEnrollment(enrollmentId: string): AppDataState {
  const data = loadStoredData();
  const target = data.enrollments.find(e => e.id === enrollmentId);
  const newData: AppDataState = {
    ...data,
    enrollments: data.enrollments.filter(e => e.id !== enrollmentId),
    ...(target ? {
      attendanceRecords: data.attendanceRecords.filter(r => !(r.groupId === target.groupId && r.studentId === target.studentId))
    } : {}),
  };
  saveStoredData(newData);
  return newData;
}

export function updateEnrollmentDismissal(enrollmentId: string, dismissalMethod: DismissalMethod): AppDataState {
  const data = loadStoredData();
  const updatedEnrollments = data.enrollments.map(e => 
    e.id === enrollmentId ? { ...e, dismissalMethod } : e
  );
  const newData: AppDataState = {
    ...data,
    enrollments: updatedEnrollments,
  };
  saveStoredData(newData);
  return newData;
}
