export const ROLE_SYSTEM = "SYSTEM"
export const ROLE_ADMIN = "ADMIN"
export const ROLE_STAFF = "STAFF"
export const ROLE_EDITOR = "EDITOR"
export const ROLE_VIEWER = "VIEWER"

export const isSystem = (role?: string | null) => role === ROLE_SYSTEM

export const isAdmin = (role?: string | null) => role === ROLE_ADMIN

export const isStaff = (role?: string | null) =>
  role === ROLE_STAFF || role === ROLE_EDITOR

export const canManageVideos = (role?: string | null) =>
  isSystem(role) || isAdmin(role) || isStaff(role)

export const canViewAllVideos = (role?: string | null) => isSystem(role) || isAdmin(role)

export const canManageTokens = (role?: string | null) => isSystem(role)

export const canManageUsers = (role?: string | null) => isSystem(role) || isAdmin(role)

export const canManageDomains = (role?: string | null) => isSystem(role) || isAdmin(role)
