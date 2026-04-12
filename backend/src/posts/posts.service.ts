import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { Like } from './entities/like.entity';
import { Reply } from './entities/reply.entity';

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Like)
    private likeRepository: Repository<Like>,
    @InjectRepository(Reply)
    private replyRepository: Repository<Reply>,
  ) {}

  async createPost(authorId: string, authorName: { firstName: string; lastName: string }, content: string, privacy: string, imageUrl?: string) {
    this.logger.log(`User ${authorId} is creating a ${privacy} post`);
    
    const post = this.postRepository.create({
      authorId,
      authorFirstName: authorName.firstName,
      authorLastName: authorName.lastName,
      content,
      privacy: privacy || 'public',
      imageUrl,
    });
    
    const savedPost = await this.postRepository.save(post);
    return {
      ...savedPost,
      user: {
        id: authorId,
        first_name: authorName.firstName,
        last_name: authorName.lastName,
      },
      likesCount: 0,
      commentsCount: 0,
    };
  }

  async getAllPosts(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    this.logger.log(`Fetching posts for user: ${userId}, page: ${page}`);

    const [posts, total] = await this.postRepository.findAndCount({
      where: [
        { privacy: 'public' },
        { authorId: userId },
      ],
      relations: ['likes', 'comments'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    const enrichedPosts = await Promise.all(posts.map(async (post) => {
      const likesCount = await this.likeRepository.count({ where: { postId: post.id } });
      const commentsCount = await this.commentRepository.count({ where: { postId: post.id } });
      const isLiked = await this.likeRepository.findOne({ where: { postId: post.id, userId } });
      
      const likers = await this.likeRepository.find({
        where: { postId: post.id },
        relations: [],
        take: 5,
      });

      return {
        ...post,
        user: {
          id: post.authorId,
          first_name: post.authorFirstName,
          last_name: post.authorLastName,
        },
        likesCount,
        commentsCount,
        isLiked: !!isLiked,
        likers: likers.map(l => ({ id: l.userId, first_name: l.userName.split(' ')[0], last_name: l.userName.split(' ').slice(1).join(' ') })),
      };
    }));

    return {
      data: enrichedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };
  }

  async addComment(postId: string, userId: string, userName: { firstName: string; lastName: string }, content: string) {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = this.commentRepository.create({
      postId,
      authorId: userId,
      authorFirstName: userName.firstName,
      authorLastName: userName.lastName,
      content,
    });

    const savedComment = await this.commentRepository.save(comment);
    
    return {
      ...savedComment,
      user: {
        id: userId,
        first_name: userName.firstName,
        last_name: userName.lastName,
      },
      likesCount: 0,
      isLiked: false,
      likers: [],
      repliesCount: 0,
    };
  }

  async deletePost(postId: string) {
    const result = await this.postRepository.delete(postId);
    if (result.affected === 0) {
      throw new NotFoundException('Post not found');
    }
    return { success: true };
  }

async likePost(postId: string, userId: string, userName: string, action?: 'like' | 'unlike') {
    const post = await this.postRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.likeRepository.findOne({ where: { postId, userId } });

    if (action === 'like' && !existing) {
      await this.likeRepository.save({ postId, userId, userName });
    } else if (action === 'unlike') {
      if (existing) {
        await this.likeRepository.delete(existing.id);
      }
    } else if (!action) {
      if (existing) {
        await this.likeRepository.delete(existing.id);
      } else {
        await this.likeRepository.save({ postId, userId, userName });
      }
    }

    const count = await this.likeRepository.count({ where: { postId } });
    const liked = action === 'unlike' ? false : (action === 'like' ? true : !existing);

    return { liked, count };
  }

  async likeComment(commentId: string, userId: string, userName: string, action?: 'like' | 'unlike') {
    const comment = await this.commentRepository.findOne({ where: { id: commentId } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.likeRepository.findOne({ where: { commentId, userId } });
    
    if (action === 'like' && !existing) {
      await this.likeRepository.save({ commentId, userId, userName });
    } else if (action === 'unlike') {
      if (existing) {
        await this.likeRepository.delete(existing.id);
      }
    } else if (!action) {
      if (existing) {
        await this.likeRepository.delete(existing.id);
      } else {
        await this.likeRepository.save({ commentId, userId, userName });
      }
    }

    const count = await this.likeRepository.count({ where: { commentId } });
    const liked = action === 'unlike' ? false : (action === 'like' ? true : !existing);

    return { liked, count };
  }

  async likeReply(replyId: string, userId: string, userName: string, action?: 'like' | 'unlike') {
    const reply = await this.replyRepository.findOne({ where: { id: replyId } });
    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const existing = await this.likeRepository.findOne({ where: { replyId, userId } });
    
    if (action === 'like' && !existing) {
      await this.likeRepository.save({ replyId, userId, userName });
    } else if (action === 'unlike') {
      if (existing) {
        await this.likeRepository.delete(existing.id);
      }
    } else if (!action) {
      if (existing) {
        await this.likeRepository.delete(existing.id);
      } else {
        await this.likeRepository.save({ replyId, userId, userName });
      }
    }

    const count = await this.likeRepository.count({ where: { replyId } });
    const liked = action === 'unlike' ? false : (action === 'like' ? true : !existing);

    return { liked, count };
  }

  async getPostComments(postId: string, userId: string) {
    const comments = await this.commentRepository.find({
      where: { postId },
      order: { createdAt: 'ASC' },
    });

    return Promise.all(comments.map(async (comment) => {
      const likesCount = await this.likeRepository.count({ where: { commentId: comment.id } });
      const isLiked = await this.likeRepository.findOne({ where: { commentId: comment.id, userId } });
      const repliesCount = await this.replyRepository.count({ where: { commentId: comment.id } });

      return {
        ...comment,
        user: {
          id: comment.authorId,
          first_name: comment.authorFirstName,
          last_name: comment.authorLastName,
        },
        likesCount,
        isLiked: !!isLiked,
        likers: [],
        repliesCount,
      };
    }));
  }

  async getCommentReplies(commentId: string, userId: string) {
    const replies = await this.replyRepository.find({
      where: { commentId },
      order: { createdAt: 'ASC' },
    });

    return Promise.all(replies.map(async (reply) => {
      const likesCount = await this.likeRepository.count({ where: { replyId: reply.id } });
      const isLiked = await this.likeRepository.findOne({ where: { replyId: reply.id, userId } });

      return {
        ...reply,
        user: {
          id: reply.authorId,
          first_name: reply.authorFirstName,
          last_name: reply.authorLastName,
        },
        likesCount,
        isLiked: !!isLiked,
        likers: [],
      };
    }));
  }

  async addReply(postId: string, commentId: string, userId: string, userName: { firstName: string; lastName: string }, content: string) {
    const reply = this.replyRepository.create({
      commentId,
      authorId: userId,
      authorFirstName: userName.firstName,
      authorLastName: userName.lastName,
      content,
    });

    const savedReply = await this.replyRepository.save(reply);

    return {
      ...savedReply,
      user: {
        id: userId,
        first_name: userName.firstName,
        last_name: userName.lastName,
      },
      likesCount: 0,
      isLiked: false,
      likers: [],
    };
  }

  async getPostLikers(postId: string) {
    const likes = await this.likeRepository.find({ where: { postId } });
    return {
      count: likes.length,
      likers: likes.map(l => ({
        id: l.userId,
        first_name: l.userName.split(' ')[0],
        last_name: l.userName.split(' ').slice(1).join(' '),
      })),
    };
  }

  async getCommentLikers(commentId: string) {
    const likes = await this.likeRepository.find({ where: { commentId } });
    return {
      count: likes.length,
      likers: likes.map(l => ({
        id: l.userId,
        first_name: l.userName.split(' ')[0],
        last_name: l.userName.split(' ').slice(1).join(' '),
      })),
    };
  }

  async getReplyLikers(replyId: string) {
    const likes = await this.likeRepository.find({ where: { replyId } });
    return {
      count: likes.length,
      likers: likes.map(l => ({
        id: l.userId,
        first_name: l.userName.split(' ')[0],
        last_name: l.userName.split(' ').slice(1).join(' '),
      })),
    };
  }
}