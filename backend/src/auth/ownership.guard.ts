import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../posts/entities/post.entity';
import { Comment } from '../posts/entities/comment.entity';
import { Reply } from '../posts/entities/reply.entity';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(Post)
    private postRepository: Repository<Post>,
    @InjectRepository(Comment)
    private commentRepository: Repository<Comment>,
    @InjectRepository(Reply)
    private replyRepository: Repository<Reply>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const params = request.params;
    const postId = params.postId;
    const commentId = params.commentId;
    const replyId = params.replyId;

    if (!user) return false;

    if (replyId) {
      const reply = await this.replyRepository.findOne({ where: { id: replyId } });
      if (!reply) throw new NotFoundException('Reply not found');
      if (reply.authorId !== user.id) throw new ForbiddenException('You do not own this reply');
      return true;
    }

    if (commentId) {
      const comment = await this.commentRepository.findOne({ where: { id: commentId } });
      if (!comment) throw new NotFoundException('Comment not found');
      if (comment.authorId !== user.id) throw new ForbiddenException('You do not own this comment');
      return true;
    }

    if (postId) {
      const post = await this.postRepository.findOne({ where: { id: postId } });
      if (!post) throw new NotFoundException('Post not found');
      if (post.authorId !== user.id) throw new ForbiddenException('You do not own this post');
      return true;
    }

    return true;
  }
}