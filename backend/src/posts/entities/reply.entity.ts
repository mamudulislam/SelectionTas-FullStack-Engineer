import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Comment } from './comment.entity';
import { Like } from './like.entity';

@Entity('replies')
export class Reply {
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
  commentId: string;

  @ManyToOne(() => Comment, (comment) => comment.replies, { onDelete: 'CASCADE' })
  comment: Comment;

  @OneToMany(() => Like, (like) => like.reply, { cascade: true, eager: true })
  likes: Like[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
