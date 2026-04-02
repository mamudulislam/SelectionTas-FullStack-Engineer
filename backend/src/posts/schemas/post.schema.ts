import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class Like {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId: Types.ObjectId;

  @Prop()
  userName: string;
}

@Schema({ _id: false, timestamps: false })
export class Reply {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  author: { id: Types.ObjectId; firstName: string; lastName: string };

  @Prop()
  content: string;

  @Prop({ type: [Object], default: [] })
  likes: Like[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ type: Types.ObjectId })
  id: Types.ObjectId;
}

@Schema({ _id: false, timestamps: false })
export class Comment {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  author: { id: Types.ObjectId; firstName: string; lastName: string };

  @Prop()
  content: string;

  @Prop({ type: [Object], default: [] })
  likes: Like[];

  @Prop({ type: [Object], default: [] })
  replies: Reply[];

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ type: Types.ObjectId })
  id: Types.ObjectId;
}

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class Post {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  author: { id: Types.ObjectId; firstName: string; lastName: string };

  @Prop({ index: 'text' })
  content: string;

  @Prop()
  imageUrl: string;

  @Prop({ enum: ['public', 'private'], default: 'public', index: true })
  privacy: string;

  @Prop({ type: [Object], default: [] })
  likes: Like[];

  @Prop({ type: [Object], default: [] })
  comments: Comment[];

  @Prop({ default: Date.now, index: true })
  createdAt: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ privacy: 1, createdAt: -1 });
PostSchema.index({ 'author.id': 1, createdAt: -1 });