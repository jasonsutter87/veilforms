/**
 * VeilForms - Team Management Page
 */

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams, useRouter } from "next/navigation";

interface Team {
  id: string;
  name: string;
  ownerId: string;
  plan: 'team' | 'enterprise';
  createdAt: string;
  settings: {
    allowMemberInvites: boolean;
    defaultFormAccess: 'private' | 'team';
  };
}

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  userName: string | null;
  userEmail: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  joinedAt: string | null;
  status: 'pending' | 'active';
}

interface TeamInvite {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  createdAt: string;
  expiresAt: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const teamIdParam = searchParams.get('id');

  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Team creation
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Member invitation
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Team settings
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [allowMemberInvites, setAllowMemberInvites] = useState(true);
  const [defaultFormAccess, setDefaultFormAccess] = useState<'private' | 'team'>('team');

  // Load teams
  useEffect(() => {
    loadTeams();
  }, []);

  // Load team details when selected
  useEffect(() => {
    if (selectedTeam) {
      loadTeamMembers(selectedTeam.id);
      setTeamName(selectedTeam.name);
      setAllowMemberInvites(selectedTeam.settings.allowMemberInvites);
      setDefaultFormAccess(selectedTeam.settings.defaultFormAccess);
    }
  }, [selectedTeam]);

  // Select team from URL param
  useEffect(() => {
    if (teamIdParam && teams.length > 0) {
      const team = teams.find(t => t.id === teamIdParam);
      if (team) {
        setSelectedTeam(team);
      }
    } else if (teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0]);
    }
  }, [teamIdParam, teams]);

  const loadTeams = async () => {
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/teams", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load teams");

      const data = await response.json();
      setTeams(data.teams);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
      setLoading(false);
    }
  };

  const loadTeamMembers = async (teamId: string) => {
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/teams/${teamId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load members");

      const data = await response.json();
      setMembers(data.members);
      setInvites(data.invites);
    } catch (err) {
      console.error("Load members error:", err);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;

    setCreateLoading(true);
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newTeamName }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create team");
      }

      const data = await response.json();
      setTeams([...teams, data.team]);
      setSelectedTeam(data.team);
      setNewTeamName("");
      setShowCreateTeam(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreateLoading(false);
    }
  };

  const inviteMember = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteError("");
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      await loadTeamMembers(selectedTeam.id);
      setInviteEmail("");
      setInviteRole('viewer');
      setShowInviteModal(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedTeam) return;
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/teams/${selectedTeam.id}/members/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to remove member");

      await loadTeamMembers(selectedTeam.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  const updateMemberRole = async (userId: string, newRole: 'admin' | 'editor' | 'viewer') => {
    if (!selectedTeam) return;

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/teams/${selectedTeam.id}/members/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error("Failed to update role");

      await loadTeamMembers(selectedTeam.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const updateTeamSettings = async () => {
    if (!selectedTeam) return;

    setSettingsLoading(true);
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: teamName,
          settings: { allowMemberInvites, defaultFormAccess },
        }),
      });

      if (!response.ok) throw new Error("Failed to update team");

      const data = await response.json();
      setSelectedTeam(data.team);
      setTeams(teams.map(t => t.id === data.team.id ? data.team : t));
      setEditingSettings(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setSettingsLoading(false);
    }
  };

  const deleteTeam = async () => {
    if (!selectedTeam) return;
    if (!confirm(`Are you sure you want to delete ${selectedTeam.name}? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete team");

      setTeams(teams.filter(t => t.id !== selectedTeam.id));
      setSelectedTeam(teams[0] || null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete team");
    }
  };

  const currentUserRole = members.find(m => m.userId === user?.userId)?.role;
  const canManageTeam = currentUserRole === 'owner';
  const canInviteMembers = currentUserRole === 'owner' || currentUserRole === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading teams...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (teams.length === 0 && !showCreateTeam) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Create Your First Team</h2>
        <p className="text-gray-600 mb-6">
          Teams allow you to collaborate with others and share forms.
        </p>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Create Team
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Team Management</h1>
        <button
          onClick={() => setShowCreateTeam(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Create Team
        </button>
      </div>

      {showCreateTeam && (
        <div className="bg-white border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="flex-1 px-4 py-2 border rounded-lg"
            />
            <button
              onClick={createTeam}
              disabled={createLoading || !newTeamName.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createLoading ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowCreateTeam(false)}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Team selector */}
        <div className="lg:col-span-1">
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Your Teams</h3>
            <div className="space-y-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    selectedTeam?.id === team.id
                      ? "bg-indigo-100 text-indigo-700"
                      : "hover:bg-gray-100"
                  }`}
                >
                  {team.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Team details */}
        {selectedTeam && (
          <div className="lg:col-span-3 space-y-6">
            {/* Team settings */}
            <div className="bg-white border rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">
                    {editingSettings ? (
                      <input
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="px-3 py-1 border rounded"
                      />
                    ) : (
                      selectedTeam.name
                    )}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedTeam.plan === 'enterprise' ? 'Enterprise' : 'Team'} Plan
                  </p>
                </div>
                {canManageTeam && (
                  <div className="flex gap-2">
                    {editingSettings ? (
                      <>
                        <button
                          onClick={updateTeamSettings}
                          disabled={settingsLoading}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingSettings(false)}
                          className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEditingSettings(true)}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Edit Settings
                      </button>
                    )}
                  </div>
                )}
              </div>

              {editingSettings && (
                <div className="space-y-4 border-t pt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allowMemberInvites}
                      onChange={(e) => setAllowMemberInvites(e.target.checked)}
                      className="rounded"
                    />
                    <span>Allow admins to invite members</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Default form access
                    </label>
                    <select
                      value={defaultFormAccess}
                      onChange={(e) => setDefaultFormAccess(e.target.value as 'private' | 'team')}
                      className="px-3 py-2 border rounded-lg"
                    >
                      <option value="private">Private (owner only)</option>
                      <option value="team">Team (all members)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Members */}
            <div className="bg-white border rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Members ({members.length})</h3>
                {canInviteMembers && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm"
                  >
                    Invite Member
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{member.userName || member.userEmail}</div>
                      {member.userName && (
                        <div className="text-sm text-gray-500">{member.userEmail}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {member.role === 'owner' && 'Owner'}
                        {member.role === 'admin' && 'Admin'}
                        {member.role === 'editor' && 'Editor'}
                        {member.role === 'viewer' && 'Viewer'}
                        {member.joinedAt && ` · Joined ${new Date(member.joinedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    {member.role !== 'owner' && canInviteMembers && (
                      <div className="flex gap-2">
                        <select
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.userId, e.target.value as any)}
                          className="px-3 py-1 border rounded text-sm"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => removeMember(member.userId)}
                          className="text-red-600 hover:text-red-700 text-sm px-3 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {invites.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h4 className="font-semibold mb-3">Pending Invites ({invites.length})</h4>
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">{invite.email}</div>
                          <div className="text-xs text-gray-500">
                            Invited as {invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Danger zone */}
            {canManageTeam && (
              <div className="bg-white border border-red-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-red-700 mb-2">Danger Zone</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Deleting a team is permanent and cannot be undone.
                </p>
                <button
                  onClick={deleteTeam}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
                >
                  Delete Team
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Invite Team Member</h3>
            {inviteError && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-800">
                {inviteError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="viewer">Viewer - View forms and submissions</option>
                  <option value="editor">Editor - Create and edit forms</option>
                  <option value="admin">Admin - Manage members and forms</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={inviteMember}
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </button>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setInviteError("");
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
