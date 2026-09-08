import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Edit,
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const { user, sendPasswordResetLink } = useAuth();
  const navigate = useNavigate();
  
  const users = useUserStore(state => state.users);
  const loading = useUserStore(state => state.loading);
  const initializeUsers = useUserStore(state => state.initialize);
  const addUser = useUserStore(state => state.addUser);
  const updateUserPermissions = useUserStore(state => state.updateUserPermissions);
  const updateUserRole = useUserStore(state => state.updateUserRole);
  const updateUser = useUserStore(state => state.updateUser);
  const toggleUserStatus = useUserStore(state => state.toggleUserStatus);
  const deleteUser = useUserStore(state => state.deleteUser);

  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | null>(null);

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
      const targetEmail = email.trim();
      await addUser({
        email: targetEmail,
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

      let inviteSent = false;
      try {
        await sendPasswordResetLink(targetEmail);
        inviteSent = true;
      } catch (inviteErr) {
        console.warn('Could not automatically send invitation email:', inviteErr);
      }

      setSuccessMsg(
        inviteSent 
          ? `User "${displayName}" created! Invitation & password setup email sent to ${targetEmail}.`
          : `User "${displayName}" created successfully. You can send an invite link anytime.`
      );
      setModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error occurred while creating user.');
    }
  };

  const handleResendInvite = async (targetEmail: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await sendPasswordResetLink(targetEmail);
      setSuccessMsg(`Invitation & password setup email sent to ${targetEmail}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : `Failed to send invitation to ${targetEmail}.`);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Self-deletion safety check
    if (deleteConfirmUser.uid === user?.uid) {
      setErrorMsg('You cannot delete your own logged-in administrator account.');
      setDeleteConfirmUser(null);
      return;
    }

    try {
      const targetName = deleteConfirmUser.displayName;
      await deleteUser(deleteConfirmUser.uid);
      setSuccessMsg(`User account for "${targetName}" has been permanently deleted.`);
      setDeleteConfirmUser(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete user profile.');
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

  const handleToggleStatus = async (targetUser: UserProfile) => {
    if (targetUser.uid === user?.uid) {
      setErrorMsg('You cannot deactivate your own active account.');
      return;
    }
    try {
      await toggleUserStatus(targetUser.uid, targetUser.status);
      const nextStatus = targetUser.status === 'deactivated' ? 'activated' : 'deactivated';
      setSuccessMsg(`User "${targetUser.displayName}" ${nextStatus} successfully.`);
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (err) {
      console.error('Failed to toggle user status:', err);
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
                  <th className="py-4 px-6 w-28">Role</th>
                  <th className="py-4 px-6 text-center w-28">Status</th>
                  <th className="py-4 px-6 text-center w-24">Monthly Target</th>
                  <th className="py-4 px-6 text-center">Manage Deals</th>
                  <th className="py-4 px-6 text-center">Manage Meetings</th>
                  <th className="py-4 px-6 text-center">Manage Cadences</th>
                  <th className="py-4 px-6 text-center">View Team Schedules</th>
                  <th className="py-4 px-6 text-right w-24">Actions</th>
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
                  const isDeactivated = item.status === 'deactivated';

                  return (
                    <tr key={item.uid} className={`hover:bg-crm-bg/20 text-sm ${isDeactivated ? 'opacity-60 bg-rose-500/[0.02]' : ''}`}>
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
                      
                      {/* User Status Column */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          disabled={item.uid === user?.uid}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition flex items-center justify-center space-x-1 mx-auto border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isDeactivated
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}
                          title={item.uid === user?.uid ? "You cannot deactivate your own account" : isDeactivated ? "Click to Activate User" : "Click to Deactivate User"}
                        >
                          {isDeactivated ? (
                            <>
                              <UserX className="h-3 w-3" />
                              <span>Inactive</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span>Active</span>
                            </>
                          )}
                        </button>
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
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => handleResendInvite(item.email)}
                            className="p-1.5 rounded-lg text-crm-muted hover:text-cyan-500 hover:bg-crm-bg border border-transparent hover:border-crm-border transition shadow-sm cursor-pointer"
                            title="Send / Resend Password Setup Invitation"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 rounded-lg text-crm-muted hover:text-primary hover:bg-crm-bg border border-transparent hover:border-crm-border transition shadow-sm cursor-pointer"
                            title="Edit User Target Quota"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmUser(item)}
                            disabled={item.uid === user?.uid}
                            className="p-1.5 rounded-lg text-crm-muted hover:text-rose-500 hover:bg-crm-bg border border-transparent hover:border-crm-border transition shadow-sm disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            title={item.uid === user?.uid ? "You cannot delete your own account" : "Delete User"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in my-auto max-h-[88vh] overflow-y-auto scrollbar-thin">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border cursor-pointer"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-crm-muted uppercase tracking-wider mb-2">Email Address *</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-crm-muted">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="e.g. alice@crmplanner.com"
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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-crm-bg/50 p-4 rounded-2xl border border-crm-border">
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

              <div className="flex space-x-3 mt-6 pt-2 border-t border-crm-border/40">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10 cursor-pointer"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit User Modal */}
      {editModalOpen && editingUser && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in my-auto max-h-[88vh] overflow-y-auto scrollbar-thin">
            <button 
              onClick={() => setEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border cursor-pointer"
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

              <div className="flex space-x-3 mt-6 pt-2 border-t border-crm-border/40">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-primary/10 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete User Confirmation Modal */}
      {deleteConfirmUser && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-crm-card border border-crm-border rounded-3xl p-6 shadow-2xl relative text-crm-text animate-fade-in my-auto max-h-[88vh] overflow-y-auto scrollbar-thin">
            <button 
              onClick={() => setDeleteConfirmUser(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-crm-muted hover:text-crm-text hover:bg-crm-bg transition border border-transparent hover:border-crm-border cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4 text-rose-500">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-crm-text">Delete User Account</h3>
            </div>

            <p className="text-sm text-crm-muted mb-6 leading-relaxed">
              Are you sure you want to permanently delete the user profile for{' '}
              <strong className="text-crm-text font-bold">{deleteConfirmUser.displayName}</strong> ({deleteConfirmUser.email})? 
              This action cannot be undone.
            </p>

            <div className="flex space-x-3 pt-2 border-t border-crm-border/40">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="flex-1 bg-crm-bg hover:bg-crm-border text-crm-muted font-bold py-2.5 rounded-xl text-sm border border-crm-border transition shadow-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-rose-600/20 cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
