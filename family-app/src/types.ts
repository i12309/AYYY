export type Sex = 'M' | 'F' | 'U' | 'X';
export type Pedigree = 'birth' | 'adopted' | 'foster' | 'unknown';
export interface LifeEvent {
  id: string;
  tag: string;
  type: string;
  date: string;
  place: string;
  description: string;
}
export interface PersonWrite {
  given_name: string;
  surname: string;
  patronymic: string;
  maiden_name: string;
  sex: Sex;
  birth_date: string;
  birth_place: string;
  death_date: string;
  death_place: string;
  is_living: boolean;
  occupation: string;
  biography: string;
  biography_format?: 'text' | 'markdown';
  notes: string;
  events: LifeEvent[];
  revision?: number;
}
export interface Person extends PersonWrite {
  id: string;
  gedcom_id: string | null;
  photo_url: string | null;
  updated_at: string;
  revision: number;
  gallery?: MediaItem[];
}
export interface MediaItem {
  id: string;
  caption: string;
  date: string;
  place: string;
  description: string;
  mime_type: string;
  url: string;
}
export interface FamilyWrite {
  partner1_id: string | null;
  partner2_id: string | null;
  children: { person_id: string; pedigree: Pedigree }[];
  marriage_date: string;
  marriage_place: string;
  divorce_date: string;
  notes: string;
  revision?: number;
}
export interface Family extends FamilyWrite {
  id: string;
  gedcom_id: string | null;
  revision: number;
}
export interface TreeSummary {
  id: string;
  revision: number;
  slug?: string;
  name: string;
  description: string;
  person_count: number;
  family_count: number;
  updated_at: string;
}
export interface TreeData {
  tree: TreeSummary;
  persons: Person[];
  families: Family[];
}
export type Relation = 'parent' | 'partner' | 'child';
export type GraphMode = 'all' | 'ancestors' | 'descendants' | 'relatives';
export interface CardFields {
  photo: boolean;
  dates: boolean;
  places: boolean;
  occupation: boolean;
  patronymic: boolean;
}
