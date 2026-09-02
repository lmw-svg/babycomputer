import React, { useState } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  X, 
  AlertCircle, 
  Check, 
  Settings2,
  Info
} from 'lucide-react';
import { UserRole } from '../types';
import { 
  verifyRolePassword, 
  getRoleInfo, 
  getRolePasswords, 
  updateSingleRolePassword, 
  DEFAULT_PASSWORDS 
} from '../utils/auth';

interface RoleAuthModalProps {
  targetRole: Exclude<UserRole, 'guest'>;
  currentRole: UserRole;
  onSuccess: (authenticatedRole: UserRole) => void;
  onClose: () => void;
}

export const RoleAuthModal: React.FC<RoleAuthModalProps> = ({
  targetRole,
  currentRole,
  onSuccess,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isManagingPasswords, setIsManagingPasswords] = useState(false);

  // Admin password management state
  const [managePasswords, setManagePasswords] = useState(getRolePasswords());
  const [manageSuccessMsg, setManageSuccessMsg] = useState<string | null>(null);

  const roleInfo = getRoleInfo(targetRole);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!password.trim()) {
      setError('請輸入身份密碼');
      setIsSubmitting(false);
      return;
    }

    const isValid = verifyRolePassword(targetRole, password);
    if (isValid) {
      onSuccess(targetRole);
    } else {
      setError('密碼不正確，請重新輸入。');
      setIsSubmitting(false);
    }
  };

  const handleSaveChangedPasswords = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      managePasswords.teacher.length < 4 ||
      managePasswords['head-teacher'].length < 4 ||
      managePasswords.admin.length < 4
    ) {
      setError('所有角色密碼長度不得少於 4 個字元');
      return;
    }

    updateSingleRolePassword('teacher', managePasswords.teacher);
    updateSingleRolePassword('head-teacher', managePasswords['head-teacher']);
    updateSingleRolePassword('admin', managePasswords.admin);

    setManageSuccessMsg('所有身份密碼已成功更新！');
    setTimeout(() => {
      setManageSuccessMsg(null);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E2DA] max-w-md w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#EAE7DE]">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${roleInfo.bgColor} ${roleInfo.textColor} border ${roleInfo.borderColor}`}>
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2C2C2A] flex items-center gap-2">
                <span>切換至「{roleInfo.title}」身份</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${roleInfo.badgeColor}`}>
                  需密碼
                </span>
              </h3>
              <p className="text-xs text-[#78786E]">請輸入此身份的專屬通行密碼以解鎖權限</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#78786E] hover:text-[#2C2C2A] hover:bg-[#EFEFEA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isManagingPasswords ? (
          /* Password Verification Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Capabilities Banner */}
            <div className={`p-3 rounded-xl border ${roleInfo.borderColor} ${roleInfo.bgColor} text-xs ${roleInfo.textColor} flex items-start gap-2`}>
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">{roleInfo.title}權限說明：</span>
                <span className="opacity-90">{roleInfo.description}</span>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#4A4A42] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#485945]" />
                  <span>{roleInfo.title}密碼</span>
                </span>
                <span className="text-[11px] text-[#78786E] font-normal">
                  預設：<code className="bg-[#FAF9F5] px-1.5 py-0.5 rounded border border-[#E5E2DA] font-mono text-[#2C2C2A]">{DEFAULT_PASSWORDS[targetRole]}</code>
                </span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={`請輸入${roleInfo.title}密碼...`}
                  autoFocus
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] text-sm font-medium text-[#2C2C2A] focus:bg-white focus:ring-2 focus:ring-[#485945] focus:border-[#485945] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#78786E] hover:text-[#2C2C2A]"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-xl bg-[#FDF0F0] border border-[#F5CCCC] text-[#8C3A3A] text-xs flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Default credentials reminder box */}
            <div className="p-3 bg-[#FAF9F5] rounded-xl border border-[#EAE7DE] text-[11px] text-[#78786E] space-y-1">
              <div className="font-semibold text-[#4A4A42] flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-[#485945]" />
                <span>全校身份預設密碼速查：</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1 text-center font-mono">
                <div className="bg-white p-1.5 rounded-lg border border-[#DDDCD4]">
                  <span className="text-[#606056] text-[10px] block">教師</span>
                  <strong className="text-[#2C5E32]">{DEFAULT_PASSWORDS.teacher}</strong>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-[#DDDCD4]">
                  <span className="text-[#606056] text-[10px] block">科主任</span>
                  <strong className="text-[#8C521E]">{DEFAULT_PASSWORDS['head-teacher']}</strong>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-[#DDDCD4]">
                  <span className="text-[#606056] text-[10px] block">管理員</span>
                  <strong className="text-[#8C3A3A]">{DEFAULT_PASSWORDS.admin}</strong>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3">
              {currentRole === 'admin' ? (
                <button
                  type="button"
                  onClick={() => setIsManagingPasswords(true)}
                  className="text-xs text-[#485945] hover:underline flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>管理員修改密碼</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#FAF9F5] hover:bg-[#EFEFEA] text-[#78786E] text-xs font-semibold border border-[#DDDCD4] transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-[#485945] hover:bg-[#3D4C3A] text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>確認切換</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Admin Password Management Form */
          <form onSubmit={handleSaveChangedPasswords} className="space-y-4">
            <div className="p-3 bg-[#FDF6ED] border border-[#EED7B8] rounded-xl text-xs text-[#8C521E] flex items-center gap-2">
              <Settings2 className="w-4 h-4 shrink-0" />
              <span>管理員可在此自訂各身份通行密碼（將保存在此瀏覽器中）。</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">教師身份密碼</label>
                <input
                  type="text"
                  value={managePasswords.teacher}
                  onChange={(e) => setManagePasswords({ ...managePasswords, teacher: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">科主任身份密碼</label>
                <input
                  type="text"
                  value={managePasswords['head-teacher']}
                  onChange={(e) => setManagePasswords({ ...managePasswords, 'head-teacher': e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#4A4A42] mb-1">管理員身份密碼</label>
                <input
                  type="text"
                  value={managePasswords.admin}
                  onChange={(e) => setManagePasswords({ ...managePasswords, admin: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#DDDCD4] bg-[#FAF9F5] font-mono"
                  required
                />
              </div>
            </div>

            {manageSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-[#EEF5EF] border border-[#D0E4D3] text-[#2C5E32] text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{manageSuccessMsg}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsManagingPasswords(false)}
                className="text-xs text-[#78786E] hover:underline"
              >
                返回驗證
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#485945] text-white text-xs font-bold shadow-xs hover:bg-[#3D4C3A]"
              >
                儲存新密碼
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
