// src/api/numbers.ts
import type { AxiosInstance } from 'axios';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PhoneNumber {
  phone_number: string;
  label: string;
  provider: 'byo' | 'twilio';
  inbound: boolean;
  outbound: boolean;
  associated_pipeline: { pipeline_id: string; pipeline_name: string } | null;
  inbound_config: { allowed_addresses?: string[] } | null;
  outbound_config: {
    address?: string;
    transport?: 'tls' | 'tcp' | 'udp';
    prefix?: string;
    user?: string;
    password?: string;
  } | null;
}

export interface ImportNumberRequest {
  provider: 'byo' | 'twilio';
  phone_number: string;
  label: string;
  inbound?: boolean;
  outbound?: boolean;
  inbound_config?: { allowed_addresses?: string[] };
  outbound_config: {
    address: string;
    transport: 'tls' | 'tcp' | 'udp';
    prefix?: string;
    user?: string;
    password?: string;
  };
}

export interface UpdateNumberRequest {
  label?: string;
  inbound?: boolean;
  outbound?: boolean;
  inbound_config?: { allowed_addresses?: string[] };
  outbound_config?: {
    address?: string;
    transport?: 'tls' | 'tcp' | 'udp';
    prefix?: string;
    user?: string;
    password?: string;
  };
}

// ─── Number API ─────────────────────────────────────────────────────────────

export class NumberAPI {
  constructor(private readonly client: AxiosInstance) {}

  async list(): Promise<PhoneNumber[]> {
    const { data } = await this.client.get<PhoneNumber[]>('/phone-numbers');
    return data;
  }

  async import(req: ImportNumberRequest): Promise<PhoneNumber> {
    const { data } = await this.client.post<PhoneNumber>('/phone-numbers', req);
    return data;
  }

  async get(phoneNumber: string): Promise<PhoneNumber> {
    const { data } = await this.client.get<PhoneNumber>(`/phone-numbers/${encodeURIComponent(phoneNumber)}`);
    return data;
  }

  async update(phoneNumber: string, req: UpdateNumberRequest): Promise<PhoneNumber> {
    const { data } = await this.client.patch<PhoneNumber>(`/phone-numbers/${encodeURIComponent(phoneNumber)}`, req);
    return data;
  }

  async delete(phoneNumber: string): Promise<void> {
    await this.client.delete(`/phone-numbers/${encodeURIComponent(phoneNumber)}`);
  }
}
