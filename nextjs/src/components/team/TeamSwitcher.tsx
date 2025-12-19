/**
 * VeilForms - Team Switcher Component
 * Allows users to switch between personal and team workspaces
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Team {
  id: string;
  name: string;
  ownerId: string;
  plan: 'team' | 'enterprise';
}

interface TeamSwitcherProps {
  onTeamChange?: (teamId: string | null) => void;
  currentTeamId?: string | null;
}

export default function TeamSwitcher({ onTeamChange, currentTeamId }: TeamSwitcherProps) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(currentTeamId || null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    setSelectedTeamId(currentTeamId || null);
  }, [currentTeamId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadTeams = async () => {
    try {
      const token = localStorage.getItem("veilforms_token");
      const response = await fetch("/api/teams", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();
      setTeams(data.teams);
      setLoading(false);
    } catch (err) {
      console.error("Load teams error:", err);
      setLoading(false);
    }
  };

  const handleTeamSelect = (teamId: string | null) => {
    setSelectedTeamId(teamId);
    setIsOpen(false);
    if (onTeamChange) {
      onTeamChange(teamId);
    }
  };

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const displayName = selectedTeam ? selectedTeam.name : "Personal";

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  // Don't show if user has no teams
  if (teams.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 transition w-full"
      >
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="text-xs text-gray-500">
            {selectedTeam ? `${selectedTeam.plan} plan` : 'Personal workspace'}
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={() => handleTeamSelect(null)}
              className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition ${
                !selectedTeamId ? 'bg-indigo-50 text-indigo-700' : ''
              }`}
            >
              <div className="text-sm font-medium">Personal</div>
              <div className="text-xs text-gray-500">Your personal workspace</div>
            </button>

            {teams.length > 0 && (
              <>
                <div className="border-t my-1"></div>
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                  Teams
                </div>
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team.id)}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition ${
                      selectedTeamId === team.id ? 'bg-indigo-50 text-indigo-700' : ''
                    }`}
                  >
                    <div className="text-sm font-medium">{team.name}</div>
                    <div className="text-xs text-gray-500">
                      {team.plan === 'enterprise' ? 'Enterprise' : 'Team'} plan
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
