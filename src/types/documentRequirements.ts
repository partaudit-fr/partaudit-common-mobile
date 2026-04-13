export type DocumentNature = 'PROC' | 'MO' | 'INSTR' | 'VM' | 'ENR' | 'FORM' | 'MQ';
export type AvailabilityStatus = 'not_set' | 'provided' | 'on_site' | 'not_applicable';
export type RequirementStatus = 'pending' | 'in_progress' | 'completed';

export interface DocumentRequirementItem {
  id: string;
  template_item_id?: string;
  requirement_code: string;
  document_name: string;
  document_type: DocumentNature;
  category?: string;
  sort_order: number;
  client_reference?: string;
  revision_index?: string;
  availability: AvailabilityStatus;
  document_id?: number;
  document_url?: string;
  document_filename?: string;
  client_notes?: string;
  provider_notes?: string;
  filled_at?: string;
  filled_by_user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface RequirementsProgress {
  total: number;
  filled: number;
  provided: number;
  on_site: number;
  not_applicable: number;
  not_set: number;
}

export interface ReservationDocumentRequirements {
  id: string;
  reservation_id: string;
  template_id?: string;
  template_name?: string;
  status: RequirementStatus;
  due_date?: string;
  completed_at?: string;
  items: DocumentRequirementItem[];
  progress: RequirementsProgress;
  created_at: string;
  updated_at: string;
}

export interface UpdateItemRequest {
  client_reference?: string;
  revision_index?: string;
  availability?: AvailabilityStatus;
  client_notes?: string;
  document_url?: string;
  document_filename?: string;
}

export const documentTypeLabels: Record<DocumentNature, string> = {
  PROC: 'Procédure',
  MO: 'Mode opératoire',
  INSTR: 'Instruction',
  VM: 'Validation de méthode',
  ENR: 'Enregistrement',
  FORM: 'Formulaire',
  MQ: 'Manuel qualité',
};
