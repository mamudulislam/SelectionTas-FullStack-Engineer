import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Comment } from './comment.entity';
import { Like } from './like.entity';

@Entity('posts')
export class Post {
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

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: 'public' })
  privacy: string;

  @OneToMany(() => Like, (like) => like.post, { cascade: true, eager: true })
  likes: Like[];

  @OneToMany(() => Comment, (comment) => comment.post, { cascade: true, eager: true })
  comments: Comment[];

  @CreateDateColumn()
  createdAt: Date;
}
