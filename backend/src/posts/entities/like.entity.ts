import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { Reply } from './reply.entity';

@Entity('likes')
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column()
  userName: string;

  @Column({ nullable: true })
  postId: string;

  @ManyToOne(() => Post, (post) => post.likes, { onDelete: 'CASCADE' })
  post: Post;

  @Column({ nullable: true })
  commentId: string;

  @ManyToOne(() => Comment, (comment) => comment.likes, { onDelete: 'CASCADE' })
  comment: Comment;

  @Column({ nullable: true })
  replyId: string;

  @ManyToOne(() => Reply, (reply) => reply.likes, { onDelete: 'CASCADE' })
  reply: Reply;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
