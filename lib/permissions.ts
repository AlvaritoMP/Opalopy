
import { User, UserRole } from '../types';

type Action = 'manage_processes' | 'manage_users' | 'view_reports' | 'manage_candidates';

const rolePermissions: Record<UserRole, Action[]> = {
    admin: ['manage_processes', 'manage_users', 'view_reports', 'manage_candidates'],
    recruiter: ['manage_processes', 'view_reports', 'manage_candidates'],
    viewer: ['view_reports'],
};

export const hasPermission = (user: User | null, action: Action): boolean => {
    if (!user) {
        return false;
    }
    return rolePermissions[user.role]?.includes(action) || false;
};
