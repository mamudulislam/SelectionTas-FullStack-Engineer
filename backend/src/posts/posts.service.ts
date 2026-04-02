import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name);
  private postsTableName: string = 'posts';
  private tableDetected = false;

  constructor(private supabaseService: SupabaseService) {}

  async onModuleInit() {
    if (!this.supabaseService.isReady()) {
      this.logger.error('CRITICAL: SupabaseService not initialized. Cannot detect posts table.');
      return;
    }
    
    this.logger.log('Detecting correct posts table name...');
    
    await this.detectTable();
  }

  private async detectTable() {
    this.logger.log('Verifying profiles table visibility...');
    const { error: profileError } = await this.supabaseService.adminClient.from('profiles').select('id').limit(1);
    if (profileError) {
      this.logger.warn(`Could not see 'profiles' table either: ${profileError.code} - ${profileError.message}`);
    } else {
      this.logger.log(`Confirmed: 'profiles' table is visible. Database connection is OK.`);
    }

    const suspects = ['posts', 'Posts', 'post', 'Post', 'feeds', 'Feeds'];
    this.logger.log(`Scanning for posts table... Suspects: ${suspects.join(', ')}`);
    
    for (const name of suspects) {
      try {
        const { error, status, statusText } = await this.supabaseService.adminClient
          .from(name)
          .select('id')
          .limit(1);
          
        if (!error) {
          this.postsTableName = name;
          this.tableDetected = true;
          this.logger.log(`[SUCCESS] Table "${name}" detected and accessible.`);
          await this.warmUpSchema(name);
          return;
        }

        // PGRST204/205 are PostgREST codes for "not found" or "not in cache"
        if (error.code === 'PGRST204' || error.code === 'PGRST205') {
          this.logger.debug(`Suspect "${name}" not found (Error ${error.code}: ${error.message})`);
          continue;
        }

        // If we get an error that is NOT "not found", it might mean the table exists but we have another issue (like RLS or auth)
        // However, we are using the adminClient, so RLS shouldn't stay in the way of a HEAD/SELECT if we have the service key.
        this.logger.warn(`Suspect "${name}" returned unexpected error ${error.code}: ${error.message} (Status: ${status} ${statusText})`);
      } catch (err: any) {
        this.logger.error(`Exception while probing for table "${name}": ${err.message}`);
      }
    }
    
    this.logger.error('CRITICAL: No posts table found in database! Please run the schema SQL in your Supabase dashboard.');
    this.tableDetected = false;
  }

  private async warmUpSchema(tableName: string) {
    try {
      this.logger.log(`Warming up schema for "${tableName}"...`);
      const { error } = await this.supabaseService.adminClient.from(tableName).select('id').limit(1);
      if (error) {
        this.logger.warn(`Schema warm-up for "${tableName}" failed: ${error.message}`);
      } else {
        this.logger.log(`Schema cache warmed up for "${tableName}"`);
      }
    } catch (e) {
      this.logger.warn(`Schema warm-up for "${tableName}" exception: ${e.message}`);
    }
  }

  private async retryWithSchemaRefresh(operation: () => any): Promise<any> {
    const result = await operation();
    const error = (result as any)?.error;
    if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
      this.logger.warn('Schema cache miss detected, attempting retry after delay...');
      await new Promise(r => setTimeout(r, 500));
      return await operation();
    }
    return result;
  }

  private ensureTableReady() {
    if (!this.tableDetected) {
      throw new Error('Posts table not found. Please create the posts table in Supabase.');
    }
  }

  async createPost(authorId: string, authorName: { firstName: string; lastName: string }, content: string, privacy: string, imageUrl?: string) {
    this.ensureTableReady();
    await this.ensureProfileExists(authorId);
    this.logger.log(`User ${authorId} is creating a ${privacy} post in table "${this.postsTableName}"`);
    const insertData: any = { user_id: authorId, content, privacy: privacy || 'public' };
    if (imageUrl) insertData.image_url = imageUrl;

    try {
      const { data, error } = await this.supabaseService.adminClient
        .from(this.postsTableName).insert(insertData).select('*, profiles(id, first_name, last_name)').single();
      if (error) { 
        this.logger.error(`Database error: ${error.code} - ${error.message}`);
        if (error.code === 'PGRST205') {
          this.logger.warn('Schema cache miss on insert, retrying...');
          await new Promise(r => setTimeout(r, 500));
          const retry = await this.supabaseService.adminClient
            .from(this.postsTableName).insert(insertData).select('*, profiles(id, first_name, last_name)').single();
          if (retry.error) {
            this.logger.error(`Retry failed: ${retry.error.code} - ${retry.error.message}`);
            throw new Error(`Database error: ${retry.error.message}`);
          }
          return retry.data ? { ...retry.data, user: retry.data.profiles } : null;
        }
        throw new Error(`Database error: ${error.message}`); 
      }
      return data ? { ...data, user: data.profiles } : null;
    } catch (err: any) {
      this.logger.error('CRITICAL: createPost failed', err.message);
      throw err;
    }
  }

  async getAllPosts(userId: string, page: number = 1, limit: number = 20) {
    this.ensureTableReady();
    const skip = (page - 1) * limit;
    this.logger.log(`Fetching posts from table "${this.postsTableName}" for user: ${userId}, page: ${page}`);

    try {
      const { count, error: countError } = await this.supabaseService.adminClient
        .from(this.postsTableName).select('*', { count: 'exact', head: true })
        .or(`privacy.eq.public,user_id.eq.${userId}`);
      
      const { data: rawPosts, error: dataError } = await this.supabaseService.adminClient
        .from(this.postsTableName).select(`*, profiles(id, first_name, last_name)`)
        .or(`privacy.eq.public,user_id.eq.${userId}`).order('created_at', { ascending: false }).range(skip, skip + limit - 1);

      if (dataError) { 
        if (dataError.code === 'PGRST205') {
          this.logger.warn('Schema cache miss, retrying...');
          await new Promise(r => setTimeout(r, 500));
          const retry = await this.supabaseService.adminClient
            .from(this.postsTableName).select(`*, profiles(id, first_name, last_name)`)
            .or(`privacy.eq.public,user_id.eq.${userId}`).order('created_at', { ascending: false }).range(skip, skip + limit - 1);
          if (retry.error) {
            this.logger.error(`Database data error in table "${this.postsTableName}":`, retry.error); 
            return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } };
          }
          return this.processPosts(retry.data || [], userId, page, limit, count);
        }
        this.logger.error(`Database data error in table "${this.postsTableName}":`, dataError); 
        return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } };
      }

      return this.processPosts(rawPosts || [], userId, page, limit, count);
    } catch (err: any) {
      this.logger.error(`Unhandled error in getAllPosts from "${this.postsTableName}":`, err.stack);
      return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } };
    }
  }

  private async processPosts(rawPosts: any[], userId: string, page: number, limit: number, count: number | null) {
    const posts = (rawPosts || []).map(p => ({ ...p, user: p.profiles || null }));
    const postIds = (posts || []).map(p => p.id);
    if (postIds.length === 0) return { data: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } };

    const [likesData, commentsData] = await Promise.all([this.getPostsLikesBatch(postIds, userId), this.getPostsCommentsCountBatch(postIds)]);
    const enrichedPosts = (posts || []).map(post => ({
      ...post,
      likesCount: likesData[post.id]?.count || 0,
      isLiked: likesData[post.id]?.isLiked || false,
      likers: likesData[post.id]?.likers || [],
      commentsCount: commentsData[post.id] || 0,
    }));

    const skip = (page - 1) * limit;
    return { data: enrichedPosts, pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit), hasMore: skip + limit < (count || 0) } };
  }

  async getPostsLikesBatch(postIds: string[], userId: string) {
    const { data: likes, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('post_likes').select('post_id, user_id, profiles(id, first_name, last_name)').in('post_id', postIds)
    );
    
    if (error) this.logger.error('Error fetching likes batch:', error);
    const result: Record<string, any> = {};
    postIds.forEach(id => result[id] = { count: 0, isLiked: false, likers: [] });
    (likes || []).forEach(like => {
      if (result[like.post_id]) { 
        result[like.post_id].count++; 
        if (like.profiles) result[like.post_id].likers.push(like.profiles); 
        if (like.user_id === userId) {
          result[like.post_id].isLiked = true; 
        }
      }
    });
    return result;
  }

  async getPostsCommentsCountBatch(postIds: string[]) {
    const { data: comments, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient.from('comments').select('post_id').in('post_id', postIds)
    );
    if (error) this.logger.error('Error fetching comments count batch:', error);
    const result: Record<string, number> = {};
    postIds.forEach(id => result[id] = 0);
    (comments || []).forEach(c => { if (result[c.post_id] !== undefined) result[c.post_id]++; });
    return result;
  }

  async addComment(postId: string, userId: string, userName: { firstName: string; lastName: string }, content: string) {
    await this.ensureProfileExists(userId);
    const { data, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('comments').insert({ post_id: postId, user_id: userId, content })
        .select('*, profiles(id, first_name, last_name)').single()
    );
    if (error) throw new Error(error.message);
    return data ? { ...data, user: data.profiles, likesCount: 0, isLiked: false, likers: [], repliesCount: 0 } : null;
  }
  
  async deletePost(postId: string) {
    this.ensureTableReady();
    const { error } = await this.supabaseService.adminClient.from(this.postsTableName).delete().eq('id', postId);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  // LIKES SYSTEM
  private async ensureProfileExists(userId: string): Promise<void> {
    const { data: authUser } = await this.supabaseService.adminClient.auth.getUser(userId);
    const email = authUser?.user?.email || `${userId}@pending.local`;
    const firstName = authUser?.user?.user_metadata?.first_name || '';
    const lastName = authUser?.user?.user_metadata?.last_name || '';
    
    const { data: profile, error: profileError } = await this.supabaseService.adminClient
      .from('profiles').select('id, first_name, last_name').eq('id', userId).single();
    
    if (profileError || !profile) {
      this.logger.warn(`Profile not found for user ${userId}, creating...`);
      const { error: insertError } = await this.supabaseService.adminClient
        .from('profiles').insert({ id: userId, email, first_name: firstName || 'User', last_name: lastName });
      
      if (insertError) {
        this.logger.error(`Failed to create profile for user ${userId}: ${insertError.message}`);
        throw new Error('User profile not found and could not be created');
      }
      this.logger.log(`Created profile for user ${userId} with email ${email}`);
    } else if (profile.first_name === 'User' || !profile.first_name) {
      this.logger.warn(`Profile ${userId} has placeholder name, updating...`);
      await this.supabaseService.adminClient
        .from('profiles')
        .update({ 
          email, 
          first_name: firstName || 'User', 
          last_name: lastName 
        })
        .eq('id', userId);
      this.logger.log(`Updated profile for user ${userId} with real name`);
    }
  }

  async likePost(postId: string, userId: string, action?: 'like' | 'unlike') {
    await this.ensureProfileExists(userId);
    // First, check if the post exists
    const { data: post, error: postError } = await this.supabaseService.adminClient
      .from(this.postsTableName).select('id').eq('id', postId).maybeSingle();
    
    if (postError) {
      this.logger.error(`Error checking post existence: ${postError.message}`);
      throw new Error(`Database error: ${postError.message}`);
    }
    
    if (!post) {
      this.logger.warn(`Post ${postId} not found`);
      throw new NotFoundException('Post not found');
    }

    const { data: existing, error: checkError } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('post_likes').select('id, user_id').eq('post_id', postId).eq('user_id', userId).maybeSingle()
    );
    
    if (checkError) {
      this.logger.error(`Error checking post like: ${checkError.message}`);
      throw new Error(`Database error: ${checkError.message}`);
    }
    
    const performAction = async () => {
      if (action === 'like' && !existing) {
        const { error } = await this.supabaseService.adminClient.from('post_likes').insert({ post_id: postId, user_id: userId });
        if (error) throw error;
      } else if (action === 'unlike') {
        const { error } = await this.supabaseService.adminClient.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
        if (error) throw error;
      } else if (!action) {
        if (existing) {
          const { error } = await this.supabaseService.adminClient.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await this.supabaseService.adminClient.from('post_likes').insert({ post_id: postId, user_id: userId });
          if (error) throw error;
        }
      }
    };

    try {
      await performAction();
    } catch (err: any) {
      if (err.code === 'PGRST205') {
        this.logger.warn('Schema cache miss on likePost, retrying...');
        await new Promise(r => setTimeout(r, 500));
        await performAction();
      } else {
        this.logger.error(`Error performing post like action: ${err.message}`);
        throw new Error(err.message);
      }
    }
    
    const { count } = await this.supabaseService.adminClient
      .from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
    
    return { liked: action === 'unlike' ? false : (action === 'like' ? true : !existing), count: count || 0 };
  }

  async likeComment(commentId: string, userId: string, action?: 'like' | 'unlike') {
    await this.ensureProfileExists(userId);
    // First, check if the comment exists
    const { data: comment, error: commentError } = await this.supabaseService.adminClient
      .from('comments').select('id').eq('id', commentId).maybeSingle();
    
    if (commentError) {
      this.logger.error(`Error checking comment existence: ${commentError.message}`);
      throw new Error(`Database error: ${commentError.message}`);
    }
    
    if (!comment) {
      this.logger.warn(`Comment ${commentId} not found`);
      throw new NotFoundException('Comment not found');
    }

    const { data: existing, error: checkError } = await this.supabaseService.adminClient
      .from('comment_likes').select('id').eq('comment_id', commentId).eq('user_id', userId).maybeSingle();
    
    if (checkError) {
      if (checkError.message?.includes('schema cache') || checkError.code === 'PGRST205') {
        this.logger.error(`Schema cache issue for comment_likes table. Please ensure the table exists in Supabase.`);
        throw new Error(`Database schema issue: comment_likes table not found. Please run the schema SQL in your Supabase dashboard.`);
      }
      this.logger.error(`Error checking comment like: ${checkError.message}`);
      throw new Error(`Database error: ${checkError.message}`);
    }
    
    const performAction = async () => {
      if (action === 'like' && !existing) {
        const { error } = await this.supabaseService.adminClient.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
        if (error) throw error;
      } else if (action === 'unlike') {
        const { error } = await this.supabaseService.adminClient.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
        if (error) throw error;
      } else if (!action) {
        if (existing) {
          const { error } = await this.supabaseService.adminClient.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await this.supabaseService.adminClient.from('comment_likes').insert({ comment_id: commentId, user_id: userId });
          if (error) throw error;
        }
      }
    };

    try {
      await performAction();
    } catch (err: any) {
      if (err.code === 'PGRST205') {
        this.logger.warn('Schema cache miss on likeComment, retrying...');
        await new Promise(r => setTimeout(r, 500));
        await performAction();
      } else {
        this.logger.error(`Error performing comment like action: ${err.message}`);
        throw new Error(err.message);
      }
    }

    const { count } = await this.supabaseService.adminClient
      .from('comment_likes').select('*', { count: 'exact', head: true }).eq('comment_id', commentId);
    
    return { liked: action === 'unlike' ? false : (action === 'like' ? true : !existing), count: count || 0 };
  }

  async likeReply(replyId: string, userId: string, action?: 'like' | 'unlike') {
    await this.ensureProfileExists(userId);
    // First, check if the reply exists
    const { data: reply, error: replyError } = await this.supabaseService.adminClient
      .from('replies').select('id').eq('id', replyId).maybeSingle();
    
    if (replyError) {
      this.logger.error(`Error checking reply existence: ${replyError.message}`);
      throw new Error(`Database error: ${replyError.message}`);
    }
    
    if (!reply) {
      this.logger.warn(`Reply ${replyId} not found`);
      throw new NotFoundException('Reply not found');
    }

    const { data: existing, error: checkError } = await this.supabaseService.adminClient
      .from('reply_likes').select('id').eq('reply_id', replyId).eq('user_id', userId).maybeSingle();
    
    if (checkError) {
      if (checkError.message?.includes('schema cache') || checkError.code === 'PGRST205') {
        this.logger.error(`Schema cache issue for reply_likes table. Please ensure the table exists in Supabase.`);
        throw new Error(`Database schema issue: reply_likes table not found. Please run the schema SQL in your Supabase dashboard.`);
      }
      this.logger.error(`Error checking reply like: ${checkError.message}`);
      throw new Error(`Database error: ${checkError.message}`);
    }

    const performAction = async () => {
      if (action === 'like' && !existing) {
        const { error } = await this.supabaseService.adminClient.from('reply_likes').insert({ reply_id: replyId, user_id: userId });
        if (error) throw error;
      } else if (action === 'unlike') {
        const { error } = await this.supabaseService.adminClient.from('reply_likes').delete().eq('reply_id', replyId).eq('user_id', userId);
        if (error) throw error;
      } else if (!action) {
        if (existing) {
          const { error } = await this.supabaseService.adminClient.from('reply_likes').delete().eq('reply_id', replyId).eq('user_id', userId);
          if (error) throw error;
        } else {
          const { error } = await this.supabaseService.adminClient.from('reply_likes').insert({ reply_id: replyId, user_id: userId });
          if (error) throw error;
        }
      }
    };

    try {
      await performAction();
    } catch (err: any) {
      if (err.code === 'PGRST205') {
        this.logger.warn('Schema cache miss on likeReply, retrying...');
        await new Promise(r => setTimeout(r, 500));
        await performAction();
      } else {
        this.logger.error(`Error performing reply like action: ${err.message}`);
        throw new Error(err.message);
      }
    }

    const { count } = await this.supabaseService.adminClient
      .from('reply_likes').select('*', { count: 'exact', head: true }).eq('reply_id', replyId);
    
    return { liked: action === 'unlike' ? false : (action === 'like' ? true : !existing), count: count || 0 };
  }

  // COMMENTS & REPLIES FETCHING
  async getPostComments(postId: string, userId: string) {
    const { data: comments, error } = await this.supabaseService.adminClient
      .from('comments').select('*, profiles(id, first_name, last_name)').eq('post_id', postId).order('created_at', { ascending: true });
    
    if (error || !comments || comments.length === 0) return [];
    
    const commentIds = comments.map(c => c.id);
    const [likesData, repliesCountData] = await Promise.all([
      this.getCommentLikesBatch(commentIds, userId),
      this.getRepliesCountBatch(commentIds)
    ]);

    return comments.map(c => ({
      ...c,
      user: c.profiles,
      likesCount: likesData[c.id]?.count || 0,
      isLiked: likesData[c.id]?.isLiked || false,
      likers: likesData[c.id]?.likers || [],
      repliesCount: repliesCountData[c.id] || 0
    }));
  }

  async getCommentReplies(commentId: string, userId: string) {
    const { data: replies, error } = await this.supabaseService.adminClient
      .from('replies').select('*, profiles(id, first_name, last_name)').eq('comment_id', commentId).order('created_at', { ascending: true });
    
    if (error || !replies || replies.length === 0) return [];
    
    const replyIds = replies.map(r => r.id);
    const likesData = await this.getReplyLikesBatch(replyIds, userId);

    return replies.map(r => ({
      ...r,
      user: r.profiles,
      likesCount: likesData[r.id]?.count || 0,
      isLiked: likesData[r.id]?.isLiked || false,
      likers: likesData[r.id]?.likers || []
    }));
  }

  async addReply(postId: string, commentId: string, userId: string, content: string) {
    await this.ensureProfileExists(userId);
    const { data, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('replies').insert({ comment_id: commentId, user_id: userId, content })
        .select('*, profiles(id, first_name, last_name)').single()
    );
    
    if (error) throw new Error(error.message);
    return data ? { ...data, user: data.profiles, likesCount: 0, isLiked: false, likers: [] } : null;
  }

  // BATCH HELPERS
  private async getCommentLikesBatch(commentIds: string[], userId: string) {
    const { data: likes, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('comment_likes').select('comment_id, user_id, profiles(id, first_name, last_name)').in('comment_id', commentIds)
    );
    
    if (error) this.logger.error('Error fetching comment likes batch:', error);
    const result: Record<string, any> = {};
    commentIds.forEach(id => result[id] = { count: 0, isLiked: false, likers: [] });
    (likes || []).forEach(like => {
      if (result[like.comment_id]) { 
        result[like.comment_id].count++; 
        if (like.profiles) result[like.comment_id].likers.push(like.profiles); 
        if (like.user_id === userId) {
          result[like.comment_id].isLiked = true; 
        }
      }
    });
    return result;
  }

  private async getReplyLikesBatch(replyIds: string[], userId: string) {
    const { data: likes, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('reply_likes').select('reply_id, user_id, profiles(id, first_name, last_name)').in('reply_id', replyIds)
    );
    
    if (error) this.logger.error('Error fetching reply likes batch:', error);
    const result: Record<string, any> = {};
    replyIds.forEach(id => result[id] = { count: 0, isLiked: false, likers: [] });
    (likes || []).forEach(like => {
      if (result[like.reply_id]) { 
        result[like.reply_id].count++; 
        if (like.profiles) result[like.reply_id].likers.push(like.profiles); 
        if (like.user_id === userId) {
          result[like.reply_id].isLiked = true; 
        }
      }
    });
    return result;
  }

  private async getRepliesCountBatch(commentIds: string[]) {
    const { data: replies, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('replies').select('comment_id').in('comment_id', commentIds)
    );
    
    if (error) this.logger.error('Error fetching replies count batch:', error);
    const result: Record<string, number> = {};
    commentIds.forEach(id => result[id] = 0);
    (replies || []).forEach(r => { if (result[r.comment_id] !== undefined) result[r.comment_id]++; });
    return result;
  }

  async getPostLikers(postId: string) {
    const { data: likes, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('post_likes')
        .select('*, profiles(id, first_name, last_name)')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
    );
    
    if (error) {
      this.logger.error('Error fetching post likers:', error);
      return { count: 0, likers: [] };
    }

    const likers = (likes || []).map(like => like.profiles).filter(Boolean);
    return {
      count: likers.length,
      likers
    };
  }

  async getCommentLikers(commentId: string) {
    const { data: likes, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('comment_likes')
        .select('*, profiles(id, first_name, last_name)')
        .eq('comment_id', commentId)
        .order('created_at', { ascending: false })
    );
    
    if (error) {
      this.logger.error('Error fetching comment likers:', error);
      return { count: 0, likers: [] };
    }

    const likers = (likes || []).map(like => like.profiles).filter(Boolean);
    return {
      count: likers.length,
      likers
    };
  }

  async getReplyLikers(replyId: string) {
    const { data: likes, error } = await this.retryWithSchemaRefresh(() => 
      this.supabaseService.adminClient
        .from('reply_likes')
        .select('*, profiles(id, first_name, last_name)')
        .eq('reply_id', replyId)
        .order('created_at', { ascending: false })
    );
    
    if (error) {
      this.logger.error('Error fetching reply likers:', error);
      return { count: 0, likers: [] };
    }

    const likers = (likes || []).map(like => like.profiles).filter(Boolean);
    return {
      count: likers.length,
      likers
    };
  }
}
