import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  public client: SupabaseClient;
  public adminClient: SupabaseClient;
  private initialized = false;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!url) {
      this.logger.error('CRITICAL: SUPABASE_URL is missing from environment.');
      return;
    }

    if (!serviceKey) {
      this.logger.warn('WARNING: SUPABASE_SERVICE_KEY is missing. Backend operations might fail RLS check.');
    }

    this.logger.log(`Initializing Supabase connection to: ${url}`);
    
    try {
      this.client = createClient(url, anonKey || serviceKey || '');
      this.adminClient = createClient(url, serviceKey || anonKey || '');
      this.initialized = true;
      this.logger.log('SUCCESS: Supabase clients initialized successfully.');
    } catch (err) {
      this.logger.error('CRITICAL: Failed to initialize Supabase clients:', err.message);
    }
  }

  isReady(): boolean {
    return this.initialized && !!this.client && !!this.adminClient;
  }
}
