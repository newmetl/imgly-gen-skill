export type SocialPlatform =
  | 'facebook'
  | 'instagram_square'
  | 'instagram_story'
  | 'instagram_landscape'
  | 'linkedin'
  | 'twitter';

export interface TemplateDimensions {
  width: number;
  height: number;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  platform: SocialPlatform;
  dimensions: TemplateDimensions;
  variables: string[];
  placeholders: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RenderJob {
  templateId: string;
  variables: Record<string, string>;
  imagePath: string;
  outputPath?: string;
}

export interface RenderResult {
  outputPath: string;
  templateId: string;
  renderedAt: string;
}

export const PLATFORM_DIMENSIONS: Record<SocialPlatform, TemplateDimensions> = {
  facebook: { width: 1200, height: 630 },
  instagram_square: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  instagram_landscape: { width: 1080, height: 566 },
  linkedin: { width: 1200, height: 627 },
  twitter: { width: 1600, height: 900 },
};

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = Object.keys(
  PLATFORM_DIMENSIONS,
) as SocialPlatform[];

export const DEFAULT_IMAGE_PLACEHOLDER_NAME = 'main-image';
