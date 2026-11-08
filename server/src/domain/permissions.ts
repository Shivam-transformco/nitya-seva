import type { Role } from "./types.js";

/**
 * Who may do what. Routes and services ask `can(role, permission)`; nothing else checks role names,
 * so changing what a role can do is a change to this table only.
 *
 * Follow-up devotees hold none of these: they work only the pledges assigned to them, which the
 * services check separately.
 */
export const PERMISSIONS = {
  /** See every pledge, not just those assigned to you. */
  "pledges.viewAll": ["owner", "admin", "accounts"],
  /** Work any pledge: status, follow-ups, details, assigning, adding, merging, deleting. */
  "pledges.manage": ["owner", "admin"],
  /** Record and delete payments, and set how sevaks pay, on any pledge. */
  "payments.manage": ["owner", "admin", "accounts"],
  "counter.manage": ["owner", "admin"],
  "reports.view": ["owner", "admin", "accounts", "viewer"],
  /** The CSV has every sevak's phone number. */
  "reports.export": ["owner", "admin", "accounts"],
  "staff.manage": ["owner", "admin"],
  /** See "Recently deleted" and restore from it. */
  "bin.manage": ["owner", "admin"],
  "bin.purge": ["owner"],
  "audit.view": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export const can = (role: Role, permission: Permission) => (PERMISSIONS[permission] as readonly Role[]).includes(role);

export const permissionsFor = (role: Role) => (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(role, p));

/** Roles each role may hand out or take away. Admins can't create, change or deactivate admins or owners. */
const MANAGES: Record<Role, readonly Role[]> = {
  owner: ["owner", "admin", "accounts", "viewer", "followup"],
  admin: ["accounts", "viewer", "followup"],
  accounts: [],
  viewer: [],
  followup: [],
};

export const canManageRole = (actor: Role, target: Role) => MANAGES[actor].includes(target);

/** Roles that can be given pledges to follow up. */
export const ASSIGNABLE_ROLES: readonly Role[] = ["owner", "admin", "followup"];
