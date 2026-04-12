import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Post } from './post.entity';
import { Reply } from './reply.entity';
import { Like } from './like.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  authorId: string;

  @Column()
  authorFirstName: string;

  @Column()
  authorLastName: string;

  @Column('text')
  content: string;

  @Column('uuid')
  postId: string;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  post: Post;

  @OneToMany(() => Like, (like) => like.comment, { cascade: true, eager: true })
  likes: Like[];

  @OneToMany(() => Reply, (reply) => reply.comment, { cascade: true, eager: true })
  replies: Reply[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
