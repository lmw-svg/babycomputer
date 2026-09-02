import { UserRole } from '../types';

const PASSWORDS_STORAGE_KEY = 'school_role_passwords_v1';

export interface RoleCredentials {
  teacher: string;
  'head-teacher': string;
  admin: string;
}

export const DEFAULT_PASSWORDS: RoleCredentials = {
  teacher: 'teacher123',
  'head-teacher': 'head123',
  admin: 'admin123',
};

export function getRolePasswords(): RoleCredentials {
  try {
    const raw = localStorage.getItem(PASSWORDS_STORAGE_KEY);
    if (!raw) {
      saveRolePasswords(DEFAULT_PASSWORDS);
      return DEFAULT_PASSWORDS;
    }
    const parsed = JSON.parse(raw);
    return {
      teacher: parsed.teacher || DEFAULT_PASSWORDS.teacher,
      'head-teacher': parsed['head-teacher'] || DEFAULT_PASSWORDS['head-teacher'],
      admin: parsed.admin || DEFAULT_PASSWORDS.admin,
    };
  } catch (e) {
    console.error('Failed to load role passwords:', e);
    return DEFAULT_PASSWORDS;
  }
}

export function saveRolePasswords(passwords: RoleCredentials): void {
  try {
    localStorage.setItem(PASSWORDS_STORAGE_KEY, JSON.stringify(passwords));
  } catch (e) {
    console.error('Failed to save role passwords:', e);
  }
}

export function verifyRolePassword(targetRole: Exclude<UserRole, 'guest'>, inputPassword: string): boolean {
  const currentPasswords = getRolePasswords();
  return currentPasswords[targetRole] === inputPassword.trim();
}

export function updateSingleRolePassword(
  roleToChange: Exclude<UserRole, 'guest'>,
  newPassword: string
): boolean {
  if (!newPassword || newPassword.trim().length < 4) {
    return false;
  }
  const current = getRolePasswords();
  current[roleToChange] = newPassword.trim();
  saveRolePasswords(current);
  return true;
}

export function getRoleInfo(role: UserRole): {
  title: string;
  badgeColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  description: string;
  needsPassword: boolean;
} {
  switch (role) {
    case 'admin':
      return {
        title: '管理員',
        badgeColor: 'bg-[#8C3A3A] text-white',
        textColor: 'text-[#8C3A3A]',
        bgColor: 'bg-[#FDF0F0]',
        borderColor: 'border-[#F5CCCC]',
        description: '全校最高權限：可增修刪除活動小組、編輯學生名單、管理全校點名、重設資料庫與修改各身份密碼。',
        needsPassword: true,
      };
    case 'head-teacher':
      return {
        title: '科主任',
        badgeColor: 'bg-[#8C521E] text-white',
        textColor: 'text-[#8C521E]',
        bgColor: 'bg-[#FDF6ED]',
        borderColor: 'border-[#EED7B8]',
        description: '主任權限：可查閱管理所有組別、點名登記、自訂加堂、加入/移出組內學生及匯出各類報表。',
        needsPassword: true,
      };
    case 'teacher':
      return {
        title: '教師',
        badgeColor: 'bg-[#485945] text-white',
        textColor: 'text-[#2C5E32]',
        bgColor: 'bg-[#EEF5EF]',
        borderColor: 'border-[#D0E4D3]',
        description: '任教權限：可進行負責小組點名、標記全體出席、登記請假原因、加入/移出組內學生、管理學生名冊及查閱出席履歷。',
        needsPassword: true,
      };
    case 'guest':
    default:
      return {
        title: '訪客',
        badgeColor: 'bg-[#78786E] text-white',
        textColor: 'text-[#606056]',
        bgColor: 'bg-[#FAF9F5]',
        borderColor: 'border-[#E5E2DA]',
        description: '公開查閱模式：唯讀檢視活動安排、點名出席狀態與統計；嚴格禁止查閱學生聯絡電話。無需密碼。',
        needsPassword: false,
      };
  }
}
