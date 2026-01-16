export type AssigneeSection = 'SIN ASIGNAR' | 'Internos' | 'TERCEROS' | 'OTROS';

export interface Assignee {
id: number;
name: string;
last_name: string;
section: AssigneeSection;
is_active: boolean;
user_id?: string | null;
email?: string | null;
phone?: string | null;
}