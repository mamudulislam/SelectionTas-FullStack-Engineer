import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;
    const postId = params.postId;
    const commentId = params.commentId;
    const replyId = params.replyId;

    if (!user) return false;

    if (replyId) {
      const { data, error } = await this.supabaseService.client
        .from('replies')
        .select('user_id')
        .eq('id', replyId)
        .single();
      
      if (error || !data) throw new NotFoundException('Reply not found');
      if (data.user_id !== user.id) throw new ForbiddenException('You do not own this reply');
      return true;
    }

    if (commentId) {
      const { data, error } = await this.supabaseService.client
        .from('comments')
        .select('user_id')
        .eq('id', commentId)
        .single();
      
      if (error || !data) throw new NotFoundException('Comment not found');
      if (data.user_id !== user.id) throw new ForbiddenException('You do not own this comment');
      return true;
    }

    if (postId) {
      const { data, error } = await this.supabaseService.client
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();
      
      if (error || !data) throw new NotFoundException('Post not found');
      if (data.user_id !== user.id) throw new ForbiddenException('You do not own this post');
      return true;
    }

    return true;
  }
}
