/**
 * Synthetic Data Generation types
 */

export interface SyntheticDataRequest {
  count: number; // 1-1000
  state?: string; // Optional single state filter (deprecated)
  states?: string[]; // Optional multiple state filters
}

export interface SyntheticVoterRecord {
  voter_id: string;
  first_name: string;
  last_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
}

export interface SyntheticDataResponse {
  success: boolean;
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
    downloadUrl?: string;
  };
  metadata: {
    recordCount: number;
    generatedAt: string;
    state?: string;
    states?: string[];
  };
}
