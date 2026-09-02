export type AccountRole = 'employee' | 'admin' | 'super_admin';

export function canChangeAccountActivation(callerRole: string | null | undefined, targetRole: string | null | undefined) {
  return callerRole === 'super_admin' && targetRole !== 'super_admin';
}
