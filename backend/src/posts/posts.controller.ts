import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, UploadedFile, UseInterceptors, Inject, Query, ParseUUIDPipe, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OwnershipGuard } from '../auth/ownership.guard';
import { CreatePostDto, PaginationDto, CommentDto, ReplyDto, LikeActionDto } from './dto/post.dto';

@Controller('posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(
    private postsService: PostsService,
    private configService: ConfigService,
  ) {}

  @Get()
  async getAllPosts(@Request() req, @Query() query: PaginationDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    return this.postsService.getAllPosts(req.user.id, page, limit);
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const ext = allowedTypes.test(extname(file.originalname).toLowerCase());
      const mime = allowedTypes.test(file.mimetype);
      if (ext && mime) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, JPG, PNG, GIF, and WebP images are allowed.'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  }))
  async createPost(
    @Request() req,
    @Body() body: CreatePostDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file && file.size > 5 * 1024 * 1024) {
      throw new HttpException('File size exceeds 5MB limit', HttpStatus.BAD_REQUEST);
    }
    const backendUrl = this.configService.get('BACKEND_URL') || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3001';
    const imageUrl = file ? `${backendUrl}/uploads/${file.filename}` : undefined;
    return this.postsService.createPost(
      req.user.id,
      { firstName: req.user.firstName, lastName: req.user.lastName },
      body.content,
      body.privacy,
      imageUrl,
    );
  }

  @Delete(':postId')
  @UseGuards(OwnershipGuard)
  async deletePost(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.postsService.deletePost(postId);
  }

  @Post(':postId/like')
  async likePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Request() req,
  ) {
    const userName = `${req.user.firstName} ${req.user.lastName}`;
    return this.postsService.likePost(postId, req.user.id, userName, 'like');
  }

  @Post(':postId/unlike')
  async unlikePost(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Request() req,
  ) {
    const userName = `${req.user.firstName} ${req.user.lastName}`;
    return this.postsService.likePost(postId, req.user.id, userName, 'unlike');
  }

  @Post(':postId/comments')
  async addComment(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Body() body: CommentDto,
    @Request() req,
  ) {
    return this.postsService.addComment(
      postId,
      req.user.id,
      { firstName: req.user.firstName, lastName: req.user.lastName },
      body.content,
    );
  }

  @Post(':postId/comments/:commentId/like')
  async likeComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Request() req,
  ) {
    const userName = `${req.user.firstName} ${req.user.lastName}`;
    return this.postsService.likeComment(commentId, req.user.id, userName, 'like');
  }

  @Post(':postId/comments/:commentId/unlike')
  async unlikeComment(
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Request() req,
  ) {
    const userName = `${req.user.firstName} ${req.user.lastName}`;
    return this.postsService.likeComment(commentId, req.user.id, userName, 'unlike');
  }

  @Post(':postId/comments/:commentId/replies')
  async addReply(
    @Param('postId', ParseUUIDPipe) postId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() body: ReplyDto,
    @Request() req,
  ) {
    return this.postsService.addReply(
      postId,
      commentId,
      req.user.id,
      { firstName: req.user.firstName, lastName: req.user.lastName },
      body.content,
    );
  }

  @Post(':postId/comments/:commentId/replies/:replyId/like')
  async likeReply(
    @Param('replyId', ParseUUIDPipe) replyId: string,
    @Request() req,
  ) {
    const userName = `${req.user.firstName} ${req.user.lastName}`;
    return this.postsService.likeReply(replyId, req.user.id, userName, 'like');
  }

  @Post(':postId/comments/:commentId/replies/:replyId/unlike')
  async unlikeReply(
    @Param('replyId', ParseUUIDPipe) replyId: string,
    @Request() req,
  ) {
    const userName = `${req.user.firstName} ${req.user.lastName}`;
    return this.postsService.likeReply(replyId, req.user.id, userName, 'unlike');
  }

  @Get(':postId/comments')
  async getPostComments(@Param('postId', ParseUUIDPipe) postId: string, @Request() req) {
    return this.postsService.getPostComments(postId, req.user.id);
  }

  @Get(':postId/comments/:commentId/replies')
  async getCommentReplies(@Param('postId', ParseUUIDPipe) postId: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Request() req) {
    return this.postsService.getCommentReplies(commentId, req.user.id);
  }

  @Get(':postId/likers')
  async getPostLikers(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.postsService.getPostLikers(postId);
  }

  @Get(':postId/comments/:commentId/likers')
  async getCommentLikers(@Param('postId', ParseUUIDPipe) postId: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
    return this.postsService.getCommentLikers(commentId);
  }

  @Get(':postId/comments/:commentId/replies/:replyId/likers')
  async getReplyLikers(@Param('postId', ParseUUIDPipe) postId: string, @Param('commentId', ParseUUIDPipe) commentId: string, @Param('replyId', ParseUUIDPipe) replyId: string) {
    return this.postsService.getReplyLikers(replyId);
  }
}
