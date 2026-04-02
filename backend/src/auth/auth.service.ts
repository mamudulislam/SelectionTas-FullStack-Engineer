import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(firstName: string, lastName: string, email: string, password: string, country: string = 'bd') {
    this.logger.log(`Attempting registration for email: ${email}`);
    const { data: existing } = await this.supabaseService.adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const { data: authData, error } = await this.supabaseService.adminClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          country,
        },
      },
    });

    if (error) throw new Error(error.message);
    if (!authData.user) throw new Error('Failed to create user');

    const payload = { sub: authData.user.id, email: authData.user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: authData.session?.refresh_token || '',
      user: {
        id: authData.user.id,
        firstName,
        lastName,
        email,
      },
    };
  }

  async login(email: string, password: string) {
    const { data: authData, error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        throw new UnauthorizedException('Please confirm your email before logging in');
      }
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!authData.user || !authData.session) throw new UnauthorizedException('Invalid credentials');

    let { data: profile } = await this.supabaseService.adminClient
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', authData.user.id)
      .single();

    if (!profile) {
      const { data: userMetaData } = await this.supabaseService.adminClient.auth.getUser(authData.user.id);
      const firstName = userMetaData?.user?.user_metadata?.first_name || 'User';
      const lastName = userMetaData?.user?.user_metadata?.last_name || '';

      const { data: insertData, error: insertError } = await this.supabaseService.adminClient
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: email,
          first_name: firstName,
          last_name: lastName,
        })
        .select('first_name, last_name')
        .single();
      
      if (insertError) {
        this.logger.error(`Failed to create profile for user ${authData.user.id}: ${insertError.message}`);
        throw new Error('Failed to create user profile');
      }
      profile = insertData || { first_name: firstName, last_name: lastName };
    } else if (profile.first_name === 'User' || !profile.first_name) {
      const { data: userMetaData } = await this.supabaseService.adminClient.auth.getUser(authData.user.id);
      const firstName = userMetaData?.user?.user_metadata?.first_name || 'User';
      const lastName = userMetaData?.user?.user_metadata?.last_name || '';
      
      const { data: updateData, error: updateError } = await this.supabaseService.adminClient
        .from('profiles')
        .update({ email, first_name: firstName, last_name: lastName })
        .eq('id', authData.user.id)
        .select('first_name, last_name')
        .single();
      
      if (!updateError && updateData) {
        profile = updateData;
      }
    }

    return {
      accessToken: this.jwtService.sign({ sub: authData.user.id, email: authData.user.email }),
      refreshToken: authData.session.refresh_token,
      user: {
        id: authData.user.id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: authData.user.email,
      },
    };
  }

  async validateUser(userId: string) {
    const { data: profile, error } = await this.supabaseService.adminClient
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      throw new UnauthorizedException();
    }

    return {
      id: profile.id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
    };
  }

  async refreshToken(refreshToken: string) {
    const { data, error } = await this.supabaseService.client.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const profile = await this.validateUser(data.user.id);

    return {
      accessToken: this.jwtService.sign({ sub: data.user.id, email: data.user.email }),
      refreshToken: data.session.refresh_token,
      user: profile,
    };
  }

  async logout(refreshToken: string) {
    // Optionally call signOut on Supabase but usually backend session is distinct
    return { success: true };
  }
}
