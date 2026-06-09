import type { AgentTeamMembership } from '@/types'
import type { PendingTeamChange } from './memberEditTypes'

export function applyPendingTeamChanges(
  currentTeams: AgentTeamMembership[],
  pendingChanges: PendingTeamChange[]
): AgentTeamMembership[] {
  let teams = [...currentTeams]

  for (const change of pendingChanges) {
    if (change.type === 'add') {
      if (!teams.some(team => team.teamId === change.teamId)) {
        teams.push({
          teamId: change.teamId,
          teamName: change.teamName,
          roleInTeam: 'member',
          isPrimary: teams.length === 0
        })
      }
    } else if (change.type === 'remove') {
      teams = teams.filter(team => team.teamId !== change.teamId)
    } else {
      teams = teams.map(team => ({
        ...team,
        isPrimary: team.teamId === change.teamId
      }))
    }
  }

  return teams
}

export function addPendingTeam(
  currentTeams: AgentTeamMembership[],
  pendingChanges: PendingTeamChange[],
  teamId: number,
  teamName: string
): PendingTeamChange[] {
  const existingRemoveIndex = pendingChanges.findIndex(
    change => change.type === 'remove' && change.teamId === teamId
  )
  if (existingRemoveIndex !== -1) {
    return pendingChanges.filter((_, index) => index !== existingRemoveIndex)
  }

  if (currentTeams.some(team => team.teamId === teamId)) {
    return pendingChanges
  }

  if (pendingChanges.some(change => change.type === 'add' && change.teamId === teamId)) {
    return pendingChanges
  }

  return [...pendingChanges, { type: 'add', teamId, teamName }]
}

export function removePendingTeam(
  currentTeams: AgentTeamMembership[],
  pendingChanges: PendingTeamChange[],
  teamId: number
): PendingTeamChange[] {
  const existingAddIndex = pendingChanges.findIndex(
    change => change.type === 'add' && change.teamId === teamId
  )
  if (existingAddIndex !== -1) {
    return pendingChanges.filter((_, index) => index !== existingAddIndex)
  }

  if (!currentTeams.some(team => team.teamId === teamId)) {
    return pendingChanges
  }

  if (pendingChanges.some(change => change.type === 'remove' && change.teamId === teamId)) {
    return pendingChanges
  }

  return [...pendingChanges, { type: 'remove', teamId }]
}

export function setPrimaryTeamPending(
  currentTeams: AgentTeamMembership[],
  pendingChanges: PendingTeamChange[],
  teamId: number
): PendingTeamChange[] {
  const pendingWithoutPrimary = pendingChanges.filter(change => change.type !== 'set-primary')
  const currentPrimary = currentTeams.find(team => team.isPrimary)

  if (currentPrimary?.teamId === teamId) {
    return pendingWithoutPrimary
  }

  return [...pendingWithoutPrimary, { type: 'set-primary', teamId }]
}
