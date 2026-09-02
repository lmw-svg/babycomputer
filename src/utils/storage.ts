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
 * Non-destructive data sanitizer: preserves user customized session dates,
 * ensures required array structures exist, and prevents corruption without
 * reverting user modifications.
 */
function sanitizeLoadedData(data: AppDataState): { sanitized: AppDataState; modified: boolean } {
  let modified = false;

  const initialGroupMap = new Map(INITIAL_ACTIVITY_GROUPS.map(ig => [ig.id, ig]));

  const sanitizedGroups = (Array.isArray(data.activityGroups) ? data.activityGroups : INITIAL_ACTIVITY_GROUPS).map(g => {
    let groupModified = false;
    let datesText = typeof g.datesText === 'string' ? g.datesText.trim() : '';
    let sessionDates = Array.isArray(g.sessionDates) ? [...g.sessionDates] : [];

    const initialMatch = initialGroupMap.get(g.id);

    // If both sessionDates and datesText are completely empty, use fallback from initial match or defaults
    if (sessionDates.length === 0 && !datesText) {
      if (initialMatch) {
        sessionDates = [...initialMatch.sessionDates];
        datesText = initialMatch.datesText;
      } else {
        sessionDates = ['9/10', '16/10', '23/10', '30/10'];
        datesText = '9/10、16/10、23/10、30/10';
      }
      groupModified = true;
    } else if (sessionDates.length === 0 && datesText) {
      // Derive sessionDates from non-empty datesText
      const parsed = parseSessionDates(datesText);
      sessionDates = parsed.length > 0 ? parsed : datesText.split(/[、,，;；\s]+/).filter(Boolean);
      groupModified = true;
    } else if (!datesText && sessionDates.length > 0) {
      // Derive datesText from sessionDates
      datesText = formatSessionDatesText(sessionDates);
      groupModified = true;
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

  const sanitizedAttendance = Array.isArray(data.attendanceRecords) ? data.attendanceRecords : INITIAL_ATTENDANCE_RECORDS;
  const sanitizedSettings = data.settings || { maskPhone: false, defaultGroupId: 'S002' };

  return {
    sanitized: {
      students: Array.isArray(data.students) ? data.students : INITIAL_STUDENTS,
      activityGroups: sanitizedGroups,
      enrollments: Array.isArray(data.enrollments) ? data.enrollments : INITIAL_ENROLLMENTS,
      attendanceRecords: sanitizedAttendance,
      settings: sanitizedSettings,
      lastUpdated: data.lastUpdated !== undefined ? data.lastUpdated : (data.isInitialDefault ? 0 : Date.now()),
      isInitialDefault: data.isInitialDefault ?? false,
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
        settings: { maskPhone: false, defaultGroupId: 'S002' },
        lastUpdated: 0,
        isInitialDefault: true,
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
      settings: { maskPhone: false, defaultGroupId: 'S002' },
      lastUpdated: 0,
      isInitialDefault: true,
    };
  }
}

export function saveStoredData(data: AppDataState): void {
  try {
    const toSave: AppDataState = {
      ...data,
      lastUpdated: data.lastUpdated !== undefined ? data.lastUpdated : Date.now(),
      isInitialDefault: data.isInitialDefault ?? false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    window.dispatchEvent(new CustomEvent('school-data-updated', { detail: toSave }));
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
    settings: { maskPhone: false, defaultGroupId: 'S002' },
    lastUpdated: Date.now(),
    isInitialDefault: false,
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
    updatedGroups[index] = { ...group };
  } else {
    updatedGroups = [...data.activityGroups, { ...group }];
  }
  const newData: AppDataState = {
    ...data,
    activityGroups: updatedGroups,
    lastUpdated: Date.now(),
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
