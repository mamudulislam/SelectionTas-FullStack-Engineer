import { IsString, IsIn, IsOptional, MaxLength, IsInt, Min, Max, IsNotEmpty, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';

export class CreatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsIn(['public', 'private'])
  privacy: string;
}

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class CommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

export class ReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;
}

export class LikeActionDto {
  @IsOptional()
  @IsString()
  @IsIn(['like', 'unlike'])
  action?: 'like' | 'unlike';
}