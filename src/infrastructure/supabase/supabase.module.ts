import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SupabaseStorageService } from './supabase-storage.service';
import { SupabaseService } from './supabase.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [SupabaseService, SupabaseStorageService],
  exports: [SupabaseService, SupabaseStorageService],
})
export class SupabaseModule {}
