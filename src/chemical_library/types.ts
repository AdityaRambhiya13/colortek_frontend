export interface ChemicalRecord {
  id: string;
  code?: string;
  prefix: string;
  num: string;
  callNumber: string;
  name: string;
  category: string;
  description: string;
  storage?: string;
  drawer?: string;
  formula?: string;
  mw?: string;
  cas?: string;
  grade?: string;
  hazard?: string;
  dateArchived?: string;
  accessionNumber?: string;
  stock?: number;
  unit?: string;
  status?: string;
  structureSvg?: string;
}

export interface CollectionMeta {
  id: string;
  code?: string;
  label: string;
  range: string;
  count: number;
}

export type SortOrder = 'code' | 'code_desc' | 'name' | 'category';
