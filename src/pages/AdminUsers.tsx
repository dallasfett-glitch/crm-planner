import React, { useState, useEffect } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { useAuth, type UserProfile } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  UserPlus, 
  X, 
  AlertCircle, 
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Mail,
  User as UserIcon,
  Edit
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const users = useUserStore(state => state.users);
  const loading = useUserStore(state => state.loading);
  const initializeUsers = useUserStore(state => state.initialize);
  const addUser = useUserStore(state => state.addUser);
  const updateUserPermissions = useUserStore(state => state.updateUserPermissions);
  const updateUserRole = useUserStore(state => state.updateUserRole);
  const updateUser = useUserStore(state => state.updateUser);

  const [modalOpen, setModalOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'salesperson'>('salesperson');
  const [monthlyQuota, setMonthlyQuota] = useState('20');
  
  // Custom permissions state for new user creation
  const [canManageDeals, setCanManageDeals] = useState(true);
  const [canManageMeetings, setCanManageMeetings] = useState(true);
  const [canManageCadences, setCanManageCadences] = useState(false);
  const [canViewAllSchedules, setCanViewAllSchedules] = useState(false);

  // Edit User modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editMonthlyQuota, setEditMonthlyQuota] = useState('20');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // Initialize store
  useEffect(() => {
    const unsub = initializeUsers();
    return () => unsub();
  }, [initializeUsers]);

  const openAddModal = () => {
    setDisplayName('');
    setEmail('');
    setRole('salesperson');
    setMonthlyQuota('20');
    setCanManageDeals(true);
    setCanManageMeetings(true);
    setCanManageCadences(false);
    setCanViewAllSchedules(false);
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!displayName.trim() || !email.trim()) {
      setErrorMsg('Please populate name and email address fields.');
      return;
    }

    const quotaNum = parseInt(monthlyQuota);
    if (isNaN(quotaNum) || quotaNum < 0) {
      setErrorMsg('Monthly Meeting Target must be a non-negative integer.');
      return;
    }

    try {
      await addUser({
        email: email.trim(),
        displayName: displayName.trim(),
        role,
        monthly_meeting_quota: quotaNum,
        permissions: {
          canManageDeals,
          canManageMeetings,
          canManageCadences,
          canViewAllSchedules,
        }
      });
      setSuccessMsg(`User "${displayName}" created successfully.`);
      setModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error occurred while creating user.');
    }
  };

  const openEditModal = (targetUser: UserProfile) => {
    setEditingUser(targetUser);
    setEditDisplayName(targetUser.displayName);
    setEditMonthlyQuota(targetUser.monthly_meeting_quota !== undefined && targetUser.monthly_meeting_quota !== null ? String(targetUser.monthly_meeting_quota) : '20');
    setErrorMsg(null);
    setSuccessMsg(null);
    setEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!editDisplayName.trim()) {
      setErrorMsg('Please populate display name.');
      return;
    }

    const quotaNum = parseInt(editMonthlyQuota);
    if (isNaN(quotaNum) || quotaNum < 0) {
      setErrorMsg('Monthly Meeting Target must be a non-negative integer.');
      return;
    }

    try {
      if (!editingUser) return;
      await updateUser(editingUser.uid, {
        displayName: editDisplayName.trim(),
        monthly_meeting_quota: quotaNum,
      });
      setSuccessMsg('User quota updated successfully.');
      setEditModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error occurred while updating user.');
    }
  };

  const handleTogglePermission = async (uid: string, permissionKey: 'canManageDeals' | 'canManageMeetings' | 'canManageCadences' | 'canViewAllSchedules', currentValue: boolean) => {
    try {
      const targetUser = users.find(u => u.uid === uid);
      if (!targetUser) return;

      const currentPerms = targetUser.permissions || {
        canManageDeals: targetUser.role === 'admin',
        canManageMeetings: true,
        canManageCadences: targetUser.role === 'admin',
        canViewAllSchedules: targetUser.role === 'admin',
      };

      const updatedPerms = {
        ...currentPerms,
        [permissionKey]: !currentValue
      };

      await updateUserPermissions(uid, updatedPerms);
      setSuccessMsg('Permissions updated.');
      setTimeout(() => setSuccessMsg(null), 1500);
    } catch (err) {
      console.error('Failed to toggle permission:', err);
    }
  };

  const handleRoleChange = async (uid: string, newRole: 'admin' | 'salesperson') => {
    try {
      await updateUserRole(uid, newRole);
      setSuccessMsg('Role updated successfully.');
      setTimeout(() => setSuccessMsg(null), 1500);
    } catch (err) {
      console.error('Failed to change user role:', err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-crm-text">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-wide text-crm-text flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Shield className="h-7 w-7" />
            </div>
            <span>User Permissions & Management</span>
          </h1>
          <p className="text-crm-muted text-sm mt-1">Add new staff members and configure access permissions to CRM modules</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center space-x-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-primary/10"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add User</span>
        </button>
      </div>

      {successMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Users List Table */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-10 h-10 border-4 border-crm-border border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-crm-muted text-sm">Loading user directory...</p>
        </div>
      ) : (
        <div className="bg-crm-card border border-crm-border rounded-2xl overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-crm-border bg-crm-bg/40 text-crm-muted font-bold text-xs uppercase tracking-wider">
                  <th className="py-4 px-6">Name / Email</th>
                  <th className="py-4 px-6 w-32">Role</th>
                  <th className="py-4 px-6 text-center w-28">Monthly Target</th>
                  <th className="py-4 px-6 text-center">Manage Deals</th>
                  <th className="py-4 px-6 text-center">Manage Meetings</th>
                  <th className="py-4 px-6 text-center">Manage Cadences</th>
                  <th className="py-4 px-6 text-center">View Team Schedules</th>
                  <th className="py-4 px-6 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-crm-border/60">
                {users.map((item) => {
                  const perms = item.permissions || {
                    canManageDeals: item.role === 'admin',
                    canManageMeetings: true,
                    canManageCadences: item.role === 'admin',
                    canViewAllSchedules: item.role === 'admin',
                  };

                  return (
                    <tr key={item.uid} className="hover:bg-crm-bg/20 text-sm">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-semibold text-crm-text">{item.displayName}</p>
                          <p className="text-xs text-crm-muted">{item.email}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <select
                          value={item.role}
                          onChange={(e) => handleRoleChange(item.uid, e.target.value as 'admin' | 'salesperson')}
                          className="bg-crm-bg border border-crm-border rounded-lg px-2.5 py-1 text-xs text-primary font-bold outline-none cursor-pointer"
                        >
                          <option value="admin">Admin</option>
                          <option value="salesperson">Salesperson</option>
                        </select>
                      </td>
                      
                      {/* Quota Target Column */}
                      <td className="py-4 px-6 text-center">
                        <span className="font-semibold text-crm-text bg-crm-bg border border-crm-border rounded-lg px-2.5 py-1 text-xs">
                          {item.monthly_meeting_quota !== undefined && item.monthly_meeting_quota !== null ? item.monthly_meeting_quota : 20}
                        </span>
                      </td>
                      
                      {/* Deal Permission Toggle */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleTogglePermission(item.uid, 'canManageDeals', !!perms.canManageDeals)}
                          className="focus:outline-none transition-colors"
                        >
                          {perms.canManageDeals ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-crm-muted" />
                          )}
                        </button>
                      </td>

                      {/* Meetings Permission Toggle */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleTogglePermission(item.uid, 'canManageMeetings', !!perms.canManageMeetings)}
                          className="focus:outline-none transition-colors"
                        >
                          {perms.canManageMeetings ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-crm-muted" />
                          )}
                        </button>
                      </td>

                      {/* Cadences Permission Toggle */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleTogglePermission(item.uid, 'canManageCadences', !!perms.canManageCadences)}
                          className="focus:outline-none transition-colors"
                        >
                          {perms.canManageCadences ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-crm-muted" />
                          )}
                        </button>
                      </td>

                      {/* View Schedules Toggle */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleTogglePermission(item.uid, 'canViewAllSchedules', !!perms.canViewAllSchedules)}
                          className="focus:outline-none transition-colors"
                        >
                          {perms.canViewAllSchedules ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-crm-muted" />
                          )}
                        </button>
                      </td>

                      {/* Action Column */}
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 rounded-lg text-crm-muted hover:text-primary hover:bg-crm-bg border border-transparent hover:border-crm-border transition shadow-sm"
                          title="Edit User Target Quota"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text mb-2">Create New User</h3>
            <p className="text-xs text-crm-muted mb-5">Create profile credentials and configure initial module permissions.</p>

            {errorMsg && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Display Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Alice Smith"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-9 pr-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Email Address *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="e.g. alice@northstar.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-9 pr-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">User Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'admin' | 'salesperson')}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text outline-none transition cursor-pointer"
                  >
                    <option value="salesperson">Salesperson</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              {/* Performance Settings Section */}
              <div className="border-t border-crm-border/60 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Performance Settings</h4>
                <div className="bg-crm-bg/50 p-4 rounded-2xl border border-crm-border">
                  <div>
                    <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Monthly Meeting Target</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 20"
                      value={monthlyQuota}
                      onChange={(e) => setMonthlyQuota(e.target.value)}
                      className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Fine-grained permissions check list */}
              <div className="border-t border-crm-border/60 pt-4 space-y-3">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Module Level Permissions</h4>
                
                <div className="grid grid-cols-2 gap-3 bg-crm-bg/50 p-4 rounded-2xl border border-crm-border">
                  <label className="flex items-center space-x-2.5 text-xs cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={canManageDeals}
                      onChange={(e) => setCanManageDeals(e.target.checked)}
                      className="h-4 w-4 rounded text-primary border-crm-border focus:ring-primary/20 accent-primary"
                    />
                    <span>Can Manage Deals</span>
                  </label>
                  <label className="flex items-center space-x-2.5 text-xs cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={canManageMeetings}
                      onChange={(e) => setCanManageMeetings(e.target.checked)}
                      className="h-4 w-4 rounded text-primary border-crm-border focus:ring-primary/20 accent-primary"
                    />
                    <span>Can Manage Meetings</span>
                  </label>
                  <label className="flex items-center space-x-2.5 text-xs cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={canManageCadences}
                      onChange={(e) => setCanManageCadences(e.target.checked)}
                      className="h-4 w-4 rounded text-primary border-crm-border focus:ring-primary/20 accent-primary"
                    />
                    <span>Can Manage Cadences</span>
                  </label>
                  <label className="flex items-center space-x-2.5 text-xs cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={canViewAllSchedules}
                      onChange={(e) => setCanViewAllSchedules(e.target.checked)}
                      className="h-4 w-4 rounded text-primary border-crm-border focus:ring-primary/20 accent-primary"
                    />
                    <span>Can View Team Schedules</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in">
            <button 
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-xl font-bold text-crm-text mb-2">Edit User Settings</h3>
            <p className="text-xs text-crm-muted mb-5">Configure Performance Settings and other parameters for this user.</p>

            {errorMsg && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Display Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Alice Smith"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl pl-9 pr-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Performance Settings Section */}
              {user?.role === 'admin' ? (
                <div className="border-t border-crm-border/60 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Performance Settings</h4>
                  <div className="bg-crm-bg/50 p-4 rounded-2xl border border-crm-border">
                    <div>
                      <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Monthly Meeting Target</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 20"
                        value={editMonthlyQuota}
                        onChange={(e) => setEditMonthlyQuota(e.target.value)}
                        className="w-full bg-crm-bg border border-crm-border focus:border-primary rounded-xl px-4 py-2.5 text-sm text-crm-text placeholder-crm-muted outline-none transition"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
