import { Module, Global } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { SchemaDiagnosticService } from './schema-diagnostic.service';

@Global()
@Module({
  providers: [SupabaseService, SchemaDiagnosticService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
