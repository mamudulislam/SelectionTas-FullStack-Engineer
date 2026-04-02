import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Injectable()
export class SchemaDiagnosticService implements OnModuleInit {
  private readonly logger = new Logger(SchemaDiagnosticService.name);

  constructor(private supabaseService: SupabaseService) {}

  async onModuleInit() {
    this.logger.log('--- DATABASE DIAGNOSTIC START ---');
    
    if (!this.supabaseService.isReady()) {
      this.logger.error('CRITICAL: SupabaseService is not initialized. Cannot run database diagnostics.');
      return;
    }

    try {
      const { error } = await this.supabaseService.adminClient
        .from('profiles').select('id').limit(1);
      
      if (error) {
        if (error.code === 'PGRST204') {
          this.logger.warn('Profiles table not found, but Supabase connection works.');
        } else {
          this.logger.warn(`Supabase connection issue: ${error.message}`);
        }
      } else {
        this.logger.log('SUCCESS: Connected to database and found "profiles" table.');
      }

      // Probing for the posts table
      const namesToTry = ['posts', 'Posts', 'post', 'Post', 'feeds', 'Feeds', 'feed', 'Feed'];
      let found = false;
      for (const name of namesToTry) {
        const { error: e } = await this.supabaseService.adminClient.from(name).select('*', { count: 'exact', head: true }).limit(0);
        if (!e) {
          this.logger.log(`!!! SUCCESS !!!: Found your posts table. It is named exactly: "${name}"`);
          found = true;
          break;
        }
      }

      if (!found) {
        this.logger.error('CRITICAL ERROR: No "posts" table found in your database.');
        this.logger.warn('--- SQL FIX FOR SUPABASE DASHBOARD ---');
        this.logger.warn('Please go to the SQL EDITOR in your Supabase dashboard and run this command:');
        this.logger.warn('--------------------------------------------------');
        this.logger.warn('CREATE TABLE IF NOT EXISTS public.posts (');
        this.logger.warn('  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),');
        this.logger.warn('  user_id UUID REFERENCES public.profiles(id),');
        this.logger.warn('  content TEXT NOT NULL,');
        this.logger.warn('  privacy VARCHAR(20) DEFAULT \'public\',');
        this.logger.warn('  image_url TEXT,');
        this.logger.warn('  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone(\'utc\'::text, now())');
        this.logger.warn(');');
        this.logger.warn('--------------------------------------------------');
      }
    } catch (err) {
      this.logger.error('Diagnostic error:', err.message);
    }
    this.logger.log('--- DATABASE DIAGNOSTIC END ---');
  }
}
