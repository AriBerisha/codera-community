/** Check whether a user role has admin-level privileges (OWNER or ADMIN). */
export function isAdminRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "OWNER";
}
